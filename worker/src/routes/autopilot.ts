import { Hono } from 'hono'
import { z } from 'zod'
import { PIN_LIMITS } from '@shared/plans'
import { connectionOf, limit, type AppEnv } from '../lib/auth'
import { db } from '../lib/clients'
import { assertPublicUrl } from '../lib/safe-fetch'
import { getProfile } from '../lib/plan'
import { fetchFeed, pollFeed, type Feed } from '../lib/autopilot'
import { ServiceError, schedulePins } from '../lib/pin-service'
import { errMsg } from '../lib/log'

export const autopilot = new Hono<AppEnv>()
autopilot.use('*', limit('heavy'))

const FEED_COLUMNS = 'id, user_id, connection_id, url, board_id, board_name, active, last_checked_at, last_error, failures'
const UUID = z.string().uuid()

autopilot.get('/', async (c) => {
  const userId = c.get('userId')
  const conn = connectionOf(c)
  const profile = await getProfile(userId)
  const [feeds, drafts, total] = await Promise.all([
    db.from('rss_feeds').select(FEED_COLUMNS).eq('connection_id', conn.id).eq('user_id', userId).order('created_at'),
    db.from('feed_drafts').select('id, feed_id, item_url, title, description, image_url, created_at').eq('connection_id', conn.id).eq('user_id', userId).eq('status', 'review').order('created_at', { ascending: false }).limit(100),
    db.from('rss_feeds').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])
  return c.json({ feeds: feeds.data ?? [], drafts: drafts.data ?? [], feed_limit: profile.limits.rss_feeds, feed_count: total.count ?? 0, plan_name: profile.limits.name })
})

autopilot.post('/feeds', async (c) => {
  const userId = c.get('userId')
  const parsed = z.object({ url: z.string().trim().url().max(2048), board_id: z.string().trim().max(100).optional(), board_name: z.string().trim().max(100).optional() })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Enter the feed address, starting with https://' }, 400)
  const plan = (await getProfile(userId)).limits
  const { count } = await db.from('rss_feeds').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if ((count ?? 0) >= plan.rss_feeds) {
    return c.json({ error: plan.rss_feeds === 0 ? `RSS feeds are not included in the ${plan.name} plan.` : `The ${plan.name} plan includes ${plan.rss_feeds} RSS feed${plan.rss_feeds === 1 ? '' : 's'}.`, upgrade_required: plan.id !== 'growth' }, 403)
  }
  try {
    await assertPublicUrl(parsed.data.url)
    await fetchFeed(parsed.data.url) // reject addresses that are not feeds before saving
  } catch (e) {
    return c.json({ error: errMsg(e) }, 422)
  }
  const { data, error } = await db.from('rss_feeds').insert({
    user_id: userId, connection_id: connectionOf(c).id, url: parsed.data.url,
    board_id: parsed.data.board_id || null, board_name: parsed.data.board_name || null,
  }).select(FEED_COLUMNS).single()
  if (error) return c.json({ error: error.code === '23505' ? 'This feed is already connected to this account.' : 'Could not save the feed.' }, error.code === '23505' ? 409 : 500)
  const res = await pollFeed(data as Feed)
  return c.json({ feed: data, drafted: res.drafted })
})

autopilot.patch('/feeds/:id', async (c) => {
  const id = UUID.safeParse(c.req.param('id'))
  const body = z.object({ active: z.boolean().optional(), board_id: z.string().trim().max(100).optional(), board_name: z.string().trim().max(100).optional() }).safeParse(await c.req.json().catch(() => null))
  if (!id.success || !body.success) return c.json({ error: 'Invalid request' }, 400)
  const patch: Record<string, unknown> = { ...body.data }
  if (body.data.active === true) { patch.failures = 0; patch.last_error = null } // turning a paused feed back on starts fresh
  const { data } = await db.from('rss_feeds').update(patch).eq('id', id.data).eq('user_id', c.get('userId')).select(FEED_COLUMNS).maybeSingle()
  return data ? c.json({ feed: data }) : c.json({ error: 'Feed not found' }, 404)
})

autopilot.delete('/feeds/:id', async (c) => {
  const id = UUID.safeParse(c.req.param('id'))
  if (!id.success) return c.json({ error: 'Invalid request' }, 400)
  await db.from('rss_feeds').delete().eq('id', id.data).eq('user_id', c.get('userId'))
  return c.json({ ok: true })
})

autopilot.patch('/drafts/:id', async (c) => {
  const id = UUID.safeParse(c.req.param('id'))
  const body = z.object({ title: z.string().trim().max(PIN_LIMITS.title).optional(), description: z.string().trim().max(PIN_LIMITS.description).optional() }).safeParse(await c.req.json().catch(() => null))
  if (!id.success || !body.success) return c.json({ error: 'Invalid request' }, 400)
  const { data } = await db.from('feed_drafts').update(body.data).eq('id', id.data).eq('user_id', c.get('userId')).eq('status', 'review').select('id').maybeSingle()
  return data ? c.json({ ok: true }) : c.json({ error: 'Draft not found' }, 404)
})

autopilot.post('/drafts/:id/reject', async (c) => {
  const id = UUID.safeParse(c.req.param('id'))
  if (!id.success) return c.json({ error: 'Invalid request' }, 400)
  await db.from('feed_drafts').update({ status: 'rejected' }).eq('id', id.data).eq('user_id', c.get('userId')).eq('status', 'review')
  return c.json({ ok: true })
})

/** Approve = schedule. Nothing from a feed is ever published without this explicit step. */
autopilot.post('/drafts/:id/approve', async (c) => {
  const userId = c.get('userId')
  const id = UUID.safeParse(c.req.param('id'))
  const body = z.object({ board_id: z.string().trim().min(1, 'Choose a board'), board_name: z.string().trim().max(100).optional(), scheduled_at: z.string().datetime({ offset: true }).optional() })
    .safeParse(await c.req.json().catch(() => null))
  if (!id.success || !body.success) return c.json({ error: body.success ? 'Invalid request' : body.error.issues[0].message }, 400)

  // Claim the draft atomically so a double click cannot schedule it twice.
  const { data: draft } = await db.from('feed_drafts').update({ status: 'scheduled' }).eq('id', id.data).eq('user_id', userId).eq('status', 'review')
    .select('connection_id, item_url, title, description, image_url').maybeSingle()
  if (!draft) return c.json({ error: 'This draft was already handled.' }, 409)
  try {
    const r = await schedulePins(userId, draft.connection_id as string, {
      pins: [{ image_url: draft.image_url as string, media_type: 'image', title: (draft.title as string) ?? '', description: (draft.description as string) ?? '', alt_text: '', board_id: body.data.board_id, board_name: body.data.board_name ?? '', destination_url: draft.item_url as string, scheduled_at: body.data.scheduled_at }],
      auto: body.data.scheduled_at ? undefined : { per_day: 2, use_data: true },
    })
    return c.json({ ok: true, scheduled_at: r.first_at, warnings: r.warnings })
  } catch (e) {
    await db.from('feed_drafts').update({ status: 'review' }).eq('id', id.data)
    if (e instanceof ServiceError) return c.json({ error: e.message, ...e.extra }, e.status as 400)
    throw e
  }
})
