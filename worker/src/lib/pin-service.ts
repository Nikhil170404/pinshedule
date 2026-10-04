import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { PIN_LIMITS, PLANS, type PlanDetails } from '@shared/plans'
import { generateSlots, isValidTimeZone } from '@shared/schedule'
import { db } from './clients'
import { getProfile, invalidateProfile, type Profile } from './plan'
import { dequeue, enqueue } from './queue'
import { aiEnabled, embed } from './ai'
import { errMsg, log } from './log'

/** Thrown by service functions; routes map it to an HTTP response, the assistant maps it to tool output. */
export class ServiceError extends Error {
  constructor(message: string, readonly status = 400, readonly extra: Record<string, unknown> = {}) {
    super(message)
  }
}

const httpsUrl = z.string().trim().max(PIN_LIMITS.link).url().refine((u) => u.startsWith('https://'), 'Must be an https URL')
const optionalUrl = z.union([z.literal(''), z.string().trim().max(PIN_LIMITS.link).url()]).nullish()

export const pinInput = z.object({
  image_url: httpsUrl,
  title: z.string().trim().max(PIN_LIMITS.title).optional().default(''),
  description: z.string().trim().max(PIN_LIMITS.description).optional().default(''),
  alt_text: z.string().trim().max(PIN_LIMITS.altText).optional().default(''),
  board_id: z.string().trim().min(1, 'Choose a board'),
  board_name: z.string().trim().max(100).optional().default(''),
  destination_url: optionalUrl,
  scheduled_at: z.string().datetime({ offset: true }).optional(),
})

export const scheduleBody = z.object({
  pins: z.array(pinInput).min(1),
  /** Pins without scheduled_at are spread over best-time slots, `per_day` per day. */
  auto: z.object({ per_day: z.number().int().min(1).max(10).default(2), start_after: z.string().datetime({ offset: true }).optional() }).optional(),
})
export type ScheduleBody = z.infer<typeof scheduleBody>

export const patchBody = z.object({
  title: z.string().trim().max(PIN_LIMITS.title).optional(),
  description: z.string().trim().max(PIN_LIMITS.description).optional(),
  alt_text: z.string().trim().max(PIN_LIMITS.altText).optional(),
  board_id: z.string().trim().min(1).optional(),
  board_name: z.string().trim().max(100).optional(),
  destination_url: optionalUrl,
  scheduled_at: z.string().datetime({ offset: true }).optional(),
})

async function lastQueued(userId: string): Promise<Date> {
  const { data } = await db.from('scheduled_pins').select('scheduled_at').eq('user_id', userId).eq('status', 'pending')
    .order('scheduled_at', { ascending: false }).limit(1).maybeSingle()
  return data?.scheduled_at ? new Date(data.scheduled_at) : new Date()
}

export interface PreparedRow {
  id: string; image_url: string; title: string; description: string; alt_text: string; board_id: string
  board_name: string; destination_url: string; scheduled_at: string; batch_id: string
}
export interface Prepared { rows: PreparedRow[]; plan: PlanDetails; profile: Profile }

/** Validate plan gates, resolve times and build the rows. No writes, so it is safe for dry runs. */
export async function prepareSchedule(userId: string, body: ScheduleBody): Promise<Prepared> {
  const { pins, auto } = body
  const profile = await getProfile(userId)
  const plan = PLANS[profile.plan]
  const maxBatch = plan.batch_max
  if (pins.length > maxBatch) throw new ServiceError(`Your ${plan.name} plan schedules up to ${maxBatch} pins at a time.`, 403, { upgrade_required: !plan.bulk_upload })

  const needSlots = pins.filter((p) => !p.scheduled_at).length
  let slots: Date[] = []
  if (needSlots > 0) {
    if (!auto) throw new ServiceError('Every pin needs a scheduled_at, or enable auto scheduling.')
    if (!plan.smart_scheduler) throw new ServiceError('Auto-scheduling at best times is available on paid plans.', 403, { upgrade_required: true })
    const tz = isValidTimeZone(profile.timezone) ? profile.timezone : 'UTC'
    const after = auto.start_after ? new Date(auto.start_after) : await lastQueued(userId)
    slots = generateSlots({ after, count: needSlots, perDay: auto.per_day, timeZone: tz })
  }

  const now = Date.now()
  const batchId = pins.length > 1 ? randomUUID() : ''
  let slotIdx = 0
  const rows: PreparedRow[] = pins.map((p) => {
    const at = p.scheduled_at ? new Date(p.scheduled_at) : slots[slotIdx++]
    if (at.getTime() < now - 60_000) throw new ServiceError('Scheduled time must be in the future.')
    if (at.getTime() > now + 365 * 86_400_000) throw new ServiceError('Pins can be scheduled up to 1 year ahead.')
    return {
      id: randomUUID(), image_url: p.image_url, title: p.title, description: p.description, alt_text: p.alt_text,
      board_id: p.board_id, board_name: p.board_name, destination_url: p.destination_url || '', scheduled_at: at.toISOString(), batch_id: batchId,
    }
  })
  return { rows, plan, profile }
}

/** Store vectors for similarity warnings. Best effort and off the request path. */
async function indexPins(userId: string, rows: { id: string; title: string; description: string }[]) {
  if (!aiEnabled()) return
  try {
    const usable = rows.filter((r) => `${r.title}${r.description}`.trim().length > 8)
    if (usable.length === 0) return
    const vecs = await embed(usable.map((r) => `${r.title}\n${r.description}`))
    await db.from('pin_embeddings').upsert(usable.map((r, i) => ({ pin_id: r.id, user_id: userId, embedding: JSON.stringify(vecs[i]) })), { onConflict: 'pin_id' })
  } catch (e) {
    log.warn('pin indexing failed', { error: errMsg(e) })
  }
}

export async function commitSchedule(userId: string, { rows, plan, profile }: Prepared) {
  const { data, error } = await db.rpc('schedule_pins', { p_user: userId, p_rows: rows, p_limit: plan.pins_per_month })
  if (error) {
    const m = error.message.match(/quota_exceeded:(\d+):(\d+)/)
    if (m) {
      throw new ServiceError(`Monthly pin limit reached on the ${plan.name} plan (${m[2]}/month). ${m[1]} left in that month.`, 403,
        { remaining: Number(m[1]), limit: Number(m[2]), upgrade_required: profile.plan !== 'growth' })
    }
    throw new ServiceError('Could not schedule pins. Please try again.', 500)
  }
  const created = (data ?? []) as { id: string; scheduled_at: string }[]
  await enqueue(created.map((r) => ({ id: r.id, at: r.scheduled_at }))).catch(() => {})
  await invalidateProfile(userId)
  void indexPins(userId, rows)
  const times = rows.map((r) => r.scheduled_at).sort()
  return { created: created.length, ids: created.map((r) => r.id), first_at: times[0], last_at: times[times.length - 1] }
}

export async function schedulePins(userId: string, body: ScheduleBody) {
  return commitSchedule(userId, await prepareSchedule(userId, body))
}

export async function updatePin(userId: string, id: string, input: z.infer<typeof patchBody>) {
  const patch: Record<string, unknown> = { ...input }
  if ('destination_url' in patch) patch.destination_url = input.destination_url || null
  if (input.scheduled_at) {
    if (new Date(input.scheduled_at).getTime() < Date.now() - 60_000) throw new ServiceError('Scheduled time must be in the future.')
    patch.status = 'pending'
    patch.error_message = null
    patch.attempts = 0
  }
  const { data, error } = await db.from('scheduled_pins').update(patch).eq('id', id).eq('user_id', userId)
    .in('status', ['pending', 'failed']).select('id, status, scheduled_at').maybeSingle()
  if (error) throw new ServiceError('Update failed', 500)
  if (!data) throw new ServiceError('Only pending or failed pins can be edited.', 409)
  if (data.status === 'pending') await enqueue([{ id: data.id, at: data.scheduled_at }]).catch(() => {})
}

export async function deletePins(userId: string, ids: string[]) {
  const { data, error } = await db.from('scheduled_pins').delete().in('id', ids).eq('user_id', userId).neq('status', 'processing').select('id')
  if (error) throw new ServiceError('Delete failed', 500)
  await dequeue((data ?? []).map((r) => r.id as string)).catch(() => {})
  await invalidateProfile(userId)
  return data?.length ?? 0
}

/** Re-queue failed pins a couple of minutes out. */
export async function retryPins(userId: string, ids: string[]) {
  const at = new Date(Date.now() + 2 * 60_000)
  const { data, error } = await db.from('scheduled_pins').update({ status: 'pending', scheduled_at: at.toISOString(), attempts: 0, error_message: null })
    .in('id', ids).eq('user_id', userId).eq('status', 'failed').select('id')
  if (error) throw new ServiceError('Retry failed', 500)
  await enqueue((data ?? []).map((r) => ({ id: r.id as string, at }))).catch(() => {})
  return data?.length ?? 0
}

export async function previewSlots(userId: string, count: number, perDay: number) {
  const profile = await getProfile(userId)
  if (!PLANS[profile.plan].smart_scheduler) throw new ServiceError('Best-time scheduling is available on paid plans.', 403, { upgrade_required: true })
  const tz = isValidTimeZone(profile.timezone) ? profile.timezone : 'UTC'
  const slots = generateSlots({ after: await lastQueued(userId), count, perDay, timeZone: tz })
  return { slots: slots.map((s) => s.toISOString()), timezone: tz }
}
