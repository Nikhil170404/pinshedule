import { Hono } from 'hono'
import { z } from 'zod'
import { normalizeSettings } from '@shared/loop'
import { isValidTimeZone } from '@shared/schedule'
import { connectionOf, limit, type AppEnv } from '../lib/auth'
import { db } from '../lib/clients'
import { getProfile } from '../lib/plan'
import { loopTimes, scheduleRecycled, type Item, type Loop } from '../lib/loops'
import { ServiceError } from '../lib/pin-service'
import { PIN_LIMITS } from '@shared/plans'

export const loops = new Hono<AppEnv>()
loops.use('*', limit('default'))

const MAX_LOOPS_PER_ACCOUNT = 5
const MAX_ITEMS_PER_LOOP = 500
const UUID = z.string().uuid()

loops.use('*', async (c, next) => {
  const plan = (await getProfile(c.get('userId'))).limits
  if (!plan.smart_scheduler) return c.json({ error: 'SmartLoop is available on paid plans.', upgrade_required: true }, 403)
  await next()
})

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(60),
  interval_days: z.number().optional(), max_per_day: z.number().optional(), window_start: z.number().optional(), window_end: z.number().optional(),
  require_approval: z.boolean().optional(), refresh_text: z.boolean().optional(),
})

loops.get('/', async (c) => {
  const userId = c.get('userId'), conn = connectionOf(c)
  const [ls, reviews, history, counts] = await Promise.all([
    db.from('loops').select('*').eq('connection_id', conn.id).eq('user_id', userId).order('created_at'),
    db.from('loop_runs').select('id, loop_id, item_id, title, description, note, created_at').eq('connection_id', conn.id).eq('user_id', userId).eq('status', 'review').order('created_at').limit(50),
    db.from('loop_runs').select('id, loop_id, status, title, scheduled_at, note, created_at').eq('connection_id', conn.id).eq('user_id', userId).neq('status', 'review').order('created_at', { ascending: false }).limit(50),
    db.from('loop_items').select('loop_id, active').eq('connection_id', conn.id).eq('user_id', userId),
  ])
  const itemCount: Record<string, number> = {}
  for (const i of counts.data ?? []) if (i.active) itemCount[i.loop_id as string] = (itemCount[i.loop_id as string] ?? 0) + 1
  // The image of each pending review comes from its item.
  const itemIds = [...new Set((reviews.data ?? []).map((r) => r.item_id as string))]
  const { data: its } = itemIds.length ? await db.from('loop_items').select('id, image_url').in('id', itemIds) : { data: [] }
  const img = new Map((its ?? []).map((i) => [i.id as string, i.image_url as string]))
  return c.json({
    loops: (ls.data ?? []).map((l) => ({ ...l, item_count: itemCount[l.id as string] ?? 0 })),
    reviews: (reviews.data ?? []).map((r) => ({ ...r, image_url: img.get(r.item_id as string) ?? null })),
    history: history.data ?? [],
  })
})

loops.post('/', async (c) => {
  const userId = c.get('userId'), conn = connectionOf(c)
  const parsed = settingsSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Give the loop a name.' }, 400)
  const { count } = await db.from('loops').select('id', { count: 'exact', head: true }).eq('connection_id', conn.id)
  if ((count ?? 0) >= MAX_LOOPS_PER_ACCOUNT) return c.json({ error: `An account can have up to ${MAX_LOOPS_PER_ACCOUNT} loops.` }, 403)
  const { name, require_approval, refresh_text, ...rest } = parsed.data
  const { data, error } = await db.from('loops').insert({ user_id: userId, connection_id: conn.id, name, ...normalizeSettings(rest), require_approval: require_approval ?? true, refresh_text: refresh_text ?? true }).select('*').single()
  return error ? c.json({ error: 'Could not create the loop.' }, 500) : c.json({ loop: data })
})

loops.patch('/:id', async (c) => {
  const id = UUID.safeParse(c.req.param('id'))
  const parsed = settingsSchema.partial().extend({ active: z.boolean().optional() }).safeParse(await c.req.json().catch(() => null))
  if (!id.success || !parsed.success) return c.json({ error: 'Invalid request' }, 400)
  const { data: cur } = await db.from('loops').select('*').eq('id', id.data).eq('user_id', c.get('userId')).maybeSingle()
  if (!cur) return c.json({ error: 'Loop not found' }, 404)
  const { active, name, require_approval, refresh_text, ...rest } = parsed.data
  const patch: Record<string, unknown> = { ...normalizeSettings({ ...cur, ...rest }) }
  if (name !== undefined) patch.name = name
  if (require_approval !== undefined) patch.require_approval = require_approval
  if (refresh_text !== undefined) patch.refresh_text = refresh_text
  if (active !== undefined) { patch.active = active; patch.paused_reason = active ? null : cur.paused_reason ?? 'Paused by you.' }
  const { data } = await db.from('loops').update(patch).eq('id', id.data).select('*').single()
  return c.json({ loop: data })
})

loops.delete('/:id', async (c) => {
  const id = UUID.safeParse(c.req.param('id'))
  if (!id.success) return c.json({ error: 'Invalid request' }, 400)
  await db.from('loops').delete().eq('id', id.data).eq('user_id', c.get('userId')) // pins already scheduled stay on the calendar
  return c.json({ ok: true })
})

/** Published pins of the active account that are not in any loop yet: the pool to choose evergreen content from. */
loops.get('/candidates', async (c) => {
  const userId = c.get('userId'), conn = connectionOf(c)
  const [pins, used] = await Promise.all([
    db.from('scheduled_pins').select('id, image_url, title, board_id, board_name, destination_url, published_at').eq('connection_id', conn.id).eq('user_id', userId).eq('status', 'published').is('loop_id', null).eq('media_type', 'image').order('published_at', { ascending: false }).limit(120),
    db.from('loop_items').select('source_pin_id').eq('connection_id', conn.id).not('source_pin_id', 'is', null),
  ])
  const taken = new Set((used.data ?? []).map((u) => u.source_pin_id as string))
  return c.json({ pins: (pins.data ?? []).filter((p) => !taken.has(p.id as string)) })
})

loops.post('/:id/items', async (c) => {
  const userId = c.get('userId'), conn = connectionOf(c)
  const id = UUID.safeParse(c.req.param('id'))
  const parsed = z.object({ pin_ids: z.array(UUID).min(1).max(50) }).safeParse(await c.req.json().catch(() => null))
  if (!id.success || !parsed.success) return c.json({ error: 'Choose at least one pin.' }, 400)
  const { data: loop } = await db.from('loops').select('id').eq('id', id.data).eq('user_id', userId).eq('connection_id', conn.id).maybeSingle()
  if (!loop) return c.json({ error: 'Loop not found' }, 404)
  const { count } = await db.from('loop_items').select('id', { count: 'exact', head: true }).eq('loop_id', id.data)
  if ((count ?? 0) + parsed.data.pin_ids.length > MAX_ITEMS_PER_LOOP) return c.json({ error: `A loop holds up to ${MAX_ITEMS_PER_LOOP} pins.` }, 403)
  const { data: pins } = await db.from('scheduled_pins').select('id, image_url, title, description, alt_text, destination_url, board_id, board_name').in('id', parsed.data.pin_ids).eq('user_id', userId).eq('connection_id', conn.id).eq('status', 'published')
  const rows = (pins ?? []).map((p) => ({ loop_id: id.data, user_id: userId, connection_id: conn.id, source_pin_id: p.id, image_url: p.image_url, title: p.title, description: p.description, alt_text: p.alt_text, destination_url: p.destination_url, board_id: p.board_id, board_name: p.board_name,
    // A pin that was just published is not recycled until a full interval has passed.
    last_recycled_at: new Date().toISOString() }))
  if (rows.length) await db.from('loop_items').upsert(rows, { onConflict: 'loop_id,source_pin_id', ignoreDuplicates: true })
  return c.json({ added: rows.length })
})

async function ownedRun(userId: string, raw: string) {
  const id = UUID.safeParse(raw)
  if (!id.success) return null
  const { data } = await db.from('loop_runs').select('*').eq('id', id.data).eq('user_id', userId).eq('status', 'review').maybeSingle()
  return data
}

loops.post('/runs/:id/reject', async (c) => {
  const run = await ownedRun(c.get('userId'), c.req.param('id'))
  if (!run) return c.json({ error: 'Already handled.' }, 409)
  await db.from('loop_runs').update({ status: 'rejected' }).eq('id', run.id).eq('status', 'review')
  return c.json({ ok: true })
})

/** Approving schedules the recycled pin at a random time inside the loop's window. */
loops.post('/runs/:id/approve', async (c) => {
  const userId = c.get('userId')
  const body = z.object({ title: z.string().trim().max(PIN_LIMITS.title).optional(), description: z.string().trim().max(PIN_LIMITS.description).optional() }).safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: 'Invalid request' }, 400)
  const run = await ownedRun(userId, c.req.param('id'))
  if (!run) return c.json({ error: 'Already handled.' }, 409)
  // Claim first so a double click cannot schedule it twice.
  const { data: claimed } = await db.from('loop_runs').update({ status: 'scheduled' }).eq('id', run.id).eq('status', 'review').select('id').maybeSingle()
  if (!claimed) return c.json({ error: 'Already handled.' }, 409)
  try {
    const [{ data: loop }, { data: item }, profile] = await Promise.all([
      db.from('loops').select('*').eq('id', run.loop_id).single(), db.from('loop_items').select('*').eq('id', run.item_id).single(), getProfile(userId),
    ])
    if (!loop || !item) throw new ServiceError('This loop or pin no longer exists.', 404)
    const text = { title: body.data.title ?? run.title ?? '', description: body.data.description ?? run.description ?? '' }
    const tz = isValidTimeZone(profile.timezone) ? profile.timezone : 'UTC'
    const s = await scheduleRecycled(loop as Loop, item as Item, text, tz, await loopTimes(run.loop_id as string))
    await db.from('loop_runs').update({ title: text.title, description: text.description, pin_id: s.pin_id, scheduled_at: s.scheduled_at }).eq('id', run.id)
    return c.json({ ok: true, scheduled_at: s.scheduled_at, warnings: s.warnings })
  } catch (e) {
    await db.from('loop_runs').update({ status: 'review' }).eq('id', run.id)
    if (e instanceof ServiceError) return c.json({ error: e.message, ...e.extra }, e.status as 400)
    throw e
  }
})
