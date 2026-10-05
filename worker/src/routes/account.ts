import { Hono } from 'hono'
import { z } from 'zod'
import { isValidTimeZone } from '@shared/schedule'
import { connectionOf, limit, type AppEnv } from '../lib/auth'
import { db, redis, withLock } from '../lib/clients'
import { invalidateProfile } from '../lib/plan'
import { buildSummary } from '../lib/summary'
import { syncConnectionAnalytics } from '../jobs/analytics'
import { NotConnectedError } from '../lib/tokens'
import { errMsg } from '../lib/log'

export const account = new Hono<AppEnv>()
account.use('*', limit('default'))

/** One call powering plan/usage meters and the connection banner. */
account.get('/summary', async (c) => c.json(await buildSummary(c.get('userId'), c.get('accountStale') ? null : c.get('connection'))))

account.patch('/settings', async (c) => {
  const userId = c.get('userId')
  const parsed = z.object({ timezone: z.string().refine(isValidTimeZone, 'Unknown timezone').optional(), notifications_enabled: z.boolean().optional() })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings' }, 400)
  const { error } = await db.from('user_profiles').update(parsed.data).eq('id', userId)
  if (error) return c.json({ error: 'Could not save settings' }, 500)
  await invalidateProfile(userId)
  return c.json({ ok: true })
})

/** Pull fresh analytics for the active account now (rate limited to once per 10 minutes per account). */
account.post('/analytics/sync', async (c) => {
  const connectionId = connectionOf(c).id
  const ran = await withLock(`analytics-conn:${connectionId}`, 600, async () => {
    try { return { ok: true as const, ...(await syncConnectionAnalytics(connectionId)) } }
    catch (e) { return { ok: false as const, error: e instanceof NotConnectedError ? e.message : errMsg(e) } }
  })
  if (!ran) return c.json({ error: 'Analytics were refreshed a moment ago. Try again in a few minutes.' }, 429)
  if (!ran.ok) return c.json({ error: ran.error }, 502)
  return c.json(ran)
})

/** Permanently delete the account and all data (also cancels any subscription at period end). */
account.post('/delete', async (c) => {
  const userId = c.get('userId')
  const body = z.object({ confirm: z.literal('DELETE') }).safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Type DELETE to confirm.' }, 400)
  const { cancelSubscription } = await import('./billing')
  await cancelSubscription(userId).catch(() => {})
  const { data: conns } = await db.from('pinterest_connections').select('id').eq('user_id', userId)
  for (const bucket of ['pin-images', 'pin-videos']) {
    await db.storage.from(bucket).list(userId, { limit: 1000 }).then(async ({ data }) => {
      if (data?.length) await db.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`))
    }).catch(() => {})
  }
  const { error } = await db.auth.admin.deleteUser(userId)
  if (error) return c.json({ error: 'Could not delete the account. Contact support.' }, 500)
  await redis.del(`profile:${userId}`, ...(conns ?? []).map((x) => `boards:${x.id}`)).catch(() => {})
  return c.json({ ok: true })
})
