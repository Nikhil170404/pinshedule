import { Hono } from 'hono'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { PIN_LIMITS, PLANS } from '@shared/plans'
import { generateSlots, isValidTimeZone } from '@shared/schedule'
import { db } from '../lib/clients'
import { limit, type AppEnv } from '../lib/auth'
import { getProfile } from '../lib/plan'
import { dequeue, enqueue } from '../lib/queue'
import { aiEnabled, embed } from '../lib/ai'
import { invalidateProfile } from '../lib/plan'
import { errMsg, log } from '../lib/log'

export const pins = new Hono<AppEnv>()
pins.use('*', limit('default'))

const httpsUrl = z.string().trim().max(PIN_LIMITS.link).url().refine((u) => u.startsWith('https://'), 'Must be an https URL')
const optionalUrl = z.union([z.literal(''), z.string().trim().max(PIN_LIMITS.link).url()]).nullish()

const pinInput = z.object({
  image_url: httpsUrl,
  title: z.string().trim().max(PIN_LIMITS.title).optional().default(''),
  description: z.string().trim().max(PIN_LIMITS.description).optional().default(''),
  alt_text: z.string().trim().max(PIN_LIMITS.altText).optional().default(''),
  board_id: z.string().trim().min(1, 'Choose a board'),
  board_name: z.string().trim().max(100).optional().default(''),
  destination_url: optionalUrl,
  scheduled_at: z.string().datetime({ offset: true }).optional(),
})

const scheduleBody = z.object({
  pins: z.array(pinInput).min(1),
  /** Pins without scheduled_at are spread over best-time slots, `per_day` per day. */
  auto: z.object({ per_day: z.number().int().min(1).max(10).default(2), start_after: z.string().datetime({ offset: true }).optional() }).optional(),
})

async function lastQueued(userId: string): Promise<Date> {
  const { data } = await db
    .from('scheduled_pins')
    .select('scheduled_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.scheduled_at ? new Date(data.scheduled_at) : new Date()
}

pins.post('/schedule', async (c) => {
  const userId = c.get('userId')
  const parsed = scheduleBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request', path: parsed.error.issues[0]?.path }, 400)
  const { pins: items, auto } = parsed.data

  const profile = await getProfile(userId)
  const plan = PLANS[profile.plan]
  const maxBatch = plan.bulk_upload ? 200 : 10
  if (items.length > maxBatch) {
    return c.json({ error: `Your ${plan.name} plan schedules up to ${maxBatch} pins at a time.`, upgrade_required: !plan.bulk_upload }, 403)
  }

  const needSlots = items.filter((p) => !p.scheduled_at).length
  let slots: Date[] = []
  if (needSlots > 0) {
    if (!auto) return c.json({ error: 'Every pin needs a scheduled_at, or enable auto scheduling.' }, 400)
    if (!plan.smart_scheduler) return c.json({ error: 'Auto-scheduling at best times is available on paid plans.', upgrade_required: true }, 403)
    const tz = isValidTimeZone(profile.timezone) ? profile.timezone : 'UTC'
    const after = auto.start_after ? new Date(auto.start_after) : await lastQueued(userId)
    slots = generateSlots({ after, count: needSlots, perDay: auto.per_day, timeZone: tz })
  }

  const now = Date.now()
  const batchId = items.length > 1 ? randomUUID() : null
  let slotIdx = 0
  const rows = []
  for (const p of items) {
    const at = p.scheduled_at ? new Date(p.scheduled_at) : slots[slotIdx++]
    if (at.getTime() < now - 60_000) return c.json({ error: 'Scheduled time must be in the future.' }, 400)
    if (at.getTime() > now + 365 * 86_400_000) return c.json({ error: 'Pins can be scheduled up to 1 year ahead.' }, 400)
    rows.push({
      id: randomUUID(),
      image_url: p.image_url,
      title: p.title,
      description: p.description,
      alt_text: p.alt_text,
      board_id: p.board_id,
      board_name: p.board_name,
      destination_url: p.destination_url || '',
      scheduled_at: at.toISOString(),
      batch_id: batchId ?? '',
    })
  }

  const { data, error } = await db.rpc('schedule_pins', { p_user: userId, p_rows: rows, p_limit: plan.pins_per_month })
  if (error) {
    const m = error.message.match(/quota_exceeded:(\d+):(\d+)/)
    if (m) {
      return c.json({
        error: `Monthly pin limit reached on the ${plan.name} plan (${m[2]}/month). ${m[1]} left in that month.`,
        remaining: Number(m[1]), limit: Number(m[2]), upgrade_required: profile.plan !== 'growth',
      }, 403)
    }
    return c.json({ error: 'Could not schedule pins. Please try again.' }, 500)
  }

  const created = (data ?? []) as { id: string; scheduled_at: string }[]
  // Fast path for the dispatcher; the reconciler covers us if this fails.
  await enqueue(created.map((r) => ({ id: r.id, at: r.scheduled_at }))).catch(() => {})
  await invalidateProfile(userId)
  void indexPins(userId, rows)
  return c.json({ created: created.length, ids: created.map((r) => r.id), first_at: rows[0].scheduled_at })
})

const patchBody = z.object({
  title: z.string().trim().max(PIN_LIMITS.title).optional(),
  description: z.string().trim().max(PIN_LIMITS.description).optional(),
  alt_text: z.string().trim().max(PIN_LIMITS.altText).optional(),
  board_id: z.string().trim().min(1).optional(),
  board_name: z.string().trim().max(100).optional(),
  destination_url: optionalUrl,
  scheduled_at: z.string().datetime({ offset: true }).optional(),
})

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

pins.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const parsed = patchBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, 400)
  const patch: Record<string, unknown> = { ...parsed.data }
  if ('destination_url' in patch) patch.destination_url = parsed.data.destination_url || null
  if (parsed.data.scheduled_at) {
    if (new Date(parsed.data.scheduled_at).getTime() < Date.now() - 60_000) return c.json({ error: 'Scheduled time must be in the future.' }, 400)
    patch.status = 'pending'
    patch.error_message = null
    patch.attempts = 0
  }
  const { data, error } = await db
    .from('scheduled_pins')
    .update(patch)
    .eq('id', c.req.param('id'))
    .eq('user_id', userId)
    .in('status', ['pending', 'failed'])
    .select('id, status, scheduled_at')
    .maybeSingle()
  if (error) return c.json({ error: 'Update failed' }, 500)
  if (!data) return c.json({ error: 'Only pending or failed pins can be edited.' }, 409)
  if (data.status === 'pending') await enqueue([{ id: data.id, at: data.scheduled_at }]).catch(() => {})
  return c.json({ ok: true })
})

const idsBody = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) })

pins.post('/delete', async (c) => {
  const userId = c.get('userId')
  const parsed = idsBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'ids required' }, 400)
  const { data, error } = await db
    .from('scheduled_pins')
    .delete()
    .in('id', parsed.data.ids)
    .eq('user_id', userId)
    .neq('status', 'processing')
    .select('id')
  if (error) return c.json({ error: 'Delete failed' }, 500)
  await dequeue((data ?? []).map((r) => r.id as string)).catch(() => {})
  await invalidateProfile(userId)
  return c.json({ deleted: data?.length ?? 0 })
})

/** Re-queue failed pins, rescheduled a few minutes out. */
pins.post('/retry', async (c) => {
  const userId = c.get('userId')
  const parsed = idsBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'ids required' }, 400)
  const at = new Date(Date.now() + 2 * 60_000)
  const { data, error } = await db
    .from('scheduled_pins')
    .update({ status: 'pending', scheduled_at: at.toISOString(), attempts: 0, error_message: null })
    .in('id', parsed.data.ids)
    .eq('user_id', userId)
    .eq('status', 'failed')
    .select('id')
  if (error) return c.json({ error: 'Retry failed' }, 500)
  await enqueue((data ?? []).map((r) => ({ id: r.id as string, at }))).catch(() => {})
  return c.json({ retried: data?.length ?? 0 })
})

/** Preview best-time slots (used by the bulk scheduler UI). */
pins.get('/slots', async (c) => {
  const userId = c.get('userId')
  const profile = await getProfile(userId)
  if (!PLANS[profile.plan].smart_scheduler) return c.json({ error: 'Best-time scheduling is available on paid plans.', upgrade_required: true }, 403)
  const count = Math.min(Math.max(1, Number(c.req.query('count') ?? 1) || 1), 200)
  const perDay = Math.min(Math.max(1, Number(c.req.query('per_day') ?? 2) || 2), 10)
  const tz = isValidTimeZone(profile.timezone) ? profile.timezone : 'UTC'
  const slots = generateSlots({ after: await lastQueued(userId), count, perDay, timeZone: tz })
  return c.json({ slots: slots.map((s) => s.toISOString()), timezone: tz })
})
