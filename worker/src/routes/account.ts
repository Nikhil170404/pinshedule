import { Hono } from 'hono'
import { z } from 'zod'
import { isValidTimeZone } from '@shared/schedule'
import { limit, type AppEnv } from '../lib/auth'
import { db, redis, withLock } from '../lib/clients'
import { invalidateProfile } from '../lib/plan'
import { buildSummary } from '../lib/summary'
import { syncUserAnalytics } from '../jobs/analytics'
import { NotConnectedError } from '../lib/tokens'
import { errMsg } from '../lib/log'

export const account = new Hono<AppEnv>()
account.use('*', limit('default'))

/** One call powering plan/usage meters and the connection banner. */
account.get('/summary', async (c) => c.json(await buildSummary(c.get('userId'))))

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

/** Pull fresh analytics now (rate limited to once per 10 minutes per user). */
account.post('/analytics/sync', async (c) => {
  const userId = c.get('userId')
  const ran = await withLock(`analytics-user:${userId}`, 600, async () => {
    try { return { ok: true as const, ...(await syncUserAnalytics(userId)) } }
    catch (e) { return { ok: false as const, error: e instanceof NotConnectedError ? e.message : errMsg(e) } }
  })
  if (!ran) return c.json({ error: 'Analytics were refreshed a moment ago. Try again in a few minutes.' }, 429)
  if (!ran.ok) return c.json({ error: ran.error }, 502)
  return c.json(ran)
})

account.post('/disconnect', async (c) => {
  const userId = c.get('userId')
  await db.from('pinterest_connections').delete().eq('user_id', userId)
  await redis.del(`boards:${userId}`).catch(() => {})
  await invalidateProfile(userId)
  return c.json({ ok: true })
})

/** Read every row a user owns from a table, 1000 at a time (PostgREST caps a single response). */
async function fetchAll(table: string, userId: string, columns: string, order: string, max = 50_000) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await db.from(table).select(columns).eq('user_id', userId).order(order).range(from, from + 999)
    if (error) throw new Error(`export failed for ${table}: ${error.message}`)
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

/**
 * Self-serve copy of everything we hold about the user. Tokens are deliberately excluded.
 * Limited to a few requests an hour because it reads a lot of rows.
 */
account.get('/export', async (c) => {
  const userId = c.get('userId')
  const allowed = await withLock(`export:${userId}`, 300, async () => true)
  if (!allowed) return c.json({ error: 'You exported your data a moment ago. Please wait a few minutes and try again.' }, 429)
  try {
    const [profile, connection, pins, daily, snapshots, usage] = await Promise.all([
      db.from('user_profiles').select('plan, billing_cycle, timezone, plan_status, plan_started_at, plan_expires_at, created_at').eq('id', userId).maybeSingle(),
      db.from('pinterest_connections').select('pinterest_user_id, pinterest_username, status, created_at').eq('user_id', userId).maybeSingle(),
      fetchAll('scheduled_pins', userId, 'id, image_url, title, description, alt_text, board_id, board_name, destination_url, scheduled_at, status, pinterest_pin_id, error_message, published_at, created_at', 'created_at'),
      fetchAll('account_analytics', userId, 'day, impressions, saves, pin_clicks, outbound_clicks, engagements', 'day'),
      fetchAll('analytics_snapshots', userId, 'pin_id, pinterest_pin_id, impressions, saves, clicks, outbound_clicks, snapshot_date', 'snapshot_date'),
      fetchAll('usage_counters', userId, 'kind, period, count', 'period'),
    ])
    const day = new Date().toISOString().slice(0, 10)
    c.header('Content-Disposition', `attachment; filename="gopinkaro-export-${day}.json"`)
    return c.json({
      exported_at: new Date().toISOString(),
      note: 'Pinterest access tokens are never included. Images you uploaded are linked from each pin (image_url).',
      profile: profile.data, pinterest_connection: connection.data, scheduled_pins: pins,
      account_analytics: daily, pin_analytics: snapshots, usage_counters: usage,
    })
  } catch (e) {
    return c.json({ error: `Could not prepare your export: ${errMsg(e)}` }, 500)
  }
})

/** Permanently delete the account and all data (also cancels any subscription at period end). */
account.post('/delete', async (c) => {
  const userId = c.get('userId')
  const body = z.object({ confirm: z.literal('DELETE') }).safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Type DELETE to confirm.' }, 400)
  const { cancelSubscription } = await import('./billing')
  await cancelSubscription(userId).catch(() => {})
  await db.storage.from('pin-images').list(userId, { limit: 1000 }).then(async ({ data }) => {
    if (data?.length) await db.storage.from('pin-images').remove(data.map((f) => `${userId}/${f.name}`))
  }).catch(() => {})
  const { error } = await db.auth.admin.deleteUser(userId)
  if (error) return c.json({ error: 'Could not delete the account. Contact support.' }, 500)
  await redis.del(`boards:${userId}`, `profile:${userId}`).catch(() => {})
  return c.json({ ok: true })
})
