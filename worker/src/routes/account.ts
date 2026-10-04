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
import { emailEnabled, startEmailVerification } from '../lib/email'
import { listConnections } from '../lib/connections'

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
    try { return { ok: true as const, ...(await syncUserAnalytics(userId, 30, c.req.query('connection') || undefined)) } }
    catch (e) { return { ok: false as const, error: e instanceof NotConnectedError ? e.message : errMsg(e) } }
  })
  if (!ran) return c.json({ error: 'Analytics were refreshed a moment ago. Try again in a few minutes.' }, 429)
  if (!ran.ok) return c.json({ error: ran.error }, 502)
  return c.json(ran)
})

/** Disconnect one Pinterest account (the primary one when no id is given). Its waiting pins are removed so nothing posts to the wrong place. */
account.post('/disconnect', async (c) => {
  const userId = c.get('userId')
  const body = z.object({ connection_id: z.string().uuid().optional() }).safeParse(await c.req.json().catch(() => ({})))
  const all = await listConnections(userId)
  const target = all.find((a) => a.id === body.data?.connection_id) ?? (body.data?.connection_id ? undefined : all[0])
  if (!target) return c.json({ ok: true })
  await db.from('scheduled_pins').delete().eq('user_id', userId).eq('connection_id', target.id).in('status', ['pending', 'failed'])
  await db.from('account_analytics').delete().eq('user_id', userId).eq('connection_id', target.id)
  await db.from('pinterest_connections').delete().eq('id', target.id).eq('user_id', userId)
  await redis.del(`boards:${userId}:${target.id}`).catch(() => {})
  await invalidateProfile(userId)
  return c.json({ ok: true })
})

const emailBody = z.object({ email: z.string().trim().toLowerCase().email().max(200) })

/** Add or change the address for alerts. It only becomes active after the owner clicks the link we email. */
account.post('/email', async (c) => {
  const userId = c.get('userId')
  if (!emailEnabled()) return c.json({ error: 'Email alerts are not available on this server yet.' }, 503)
  const parsed = emailBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Enter a valid email address.' }, 400)
  const allowed = await withLock(`email-verify:${userId}`, 60, async () => true)
  if (!allowed) return c.json({ error: 'Please wait a minute before requesting another email.' }, 429)
  const sent = await startEmailVerification(userId, parsed.data.email)
  await invalidateProfile(userId)
  return sent ? c.json({ ok: true }) : c.json({ error: 'We could not send that email. Check the address and try again.' }, 502)
})

account.delete('/email', async (c) => {
  const userId = c.get('userId')
  await db.from('user_profiles').update({ notification_email: null, notification_email_verified: false }).eq('id', userId)
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
    const [profile, connections, pins, daily, snapshots, usage, automations] = await Promise.all([
      db.from('user_profiles').select('plan, billing_cycle, timezone, plan_status, plan_started_at, plan_expires_at, created_at, notification_email').eq('id', userId).maybeSingle(),
      db.from('pinterest_connections').select('id, pinterest_user_id, pinterest_username, status, is_primary, created_at').eq('user_id', userId),
      fetchAll('scheduled_pins', userId, 'id, connection_id, image_url, title, description, alt_text, board_id, board_name, destination_url, scheduled_at, status, pinterest_pin_id, error_message, published_at, created_at', 'created_at'),
      fetchAll('account_analytics', userId, 'connection_id, day, impressions, saves, pin_clicks, outbound_clicks, engagements', 'day'),
      fetchAll('analytics_snapshots', userId, 'pin_id, pinterest_pin_id, impressions, saves, clicks, outbound_clicks, snapshot_date', 'snapshot_date'),
      fetchAll('usage_counters', userId, 'kind, period, count', 'period'),
      fetchAll('automations', userId, 'id, kind, enabled, config, last_run_at, last_result, total_created, created_at', 'created_at'),
    ])
    const day = new Date().toISOString().slice(0, 10)
    c.header('Content-Disposition', `attachment; filename="gopinkaro-export-${day}.json"`)
    return c.json({
      exported_at: new Date().toISOString(),
      note: 'Pinterest access tokens are never included. Images you uploaded are linked from each pin (image_url).',
      profile: profile.data, pinterest_connections: connections.data ?? [], automations, scheduled_pins: pins,
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
