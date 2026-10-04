import { PLANS } from '@shared/plans'
import { db, mapLimit } from '../lib/clients'
import { getProfile } from '../lib/plan'
import { accountAnalytics, pinAnalytics } from '../lib/pinterest'
import { NotConnectedError, withPinterest } from '../lib/tokens'
import { errMsg, log } from '../lib/log'
import { listConnections } from '../lib/connections'

const day = (d: Date) => d.toISOString().slice(0, 10)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Pull analytics for every connected account of a user (or just one). Returns totals across accounts. */
export async function syncUserAnalytics(userId: string, requestedDays = 30, only?: string) {
  const conns = (await listConnections(userId)).filter((c) => c.status === 'active' && (!only || c.id === only))
  if (conns.length === 0) throw new NotConnectedError('Pinterest is not connected. Reconnect your account.')
  const total = { days: 0, pins: 0 }
  let lastError: unknown = null
  for (const conn of conns) {
    try {
      const r = await syncConnection(userId, conn.id, requestedDays)
      total.days += r.days
      total.pins += r.pins
    } catch (e) {
      lastError = e // one broken account must not stop the others
      if (!(e instanceof NotConnectedError)) log.warn('analytics sync failed', { user: userId, connection: conn.id, error: errMsg(e) })
    }
  }
  if (lastError && total.days === 0 && total.pins === 0) throw lastError
  return total
}

async function syncConnection(userId: string, connectionId: string, requestedDays: number) {
  // Only collect as much history as the user's plan shows (also keeps Pinterest API calls down).
  const days = Math.min(requestedDays, PLANS[(await getProfile(userId)).plan].analytics_days)
  const end = new Date()
  const start = new Date(Date.now() - days * 86_400_000)

  const daily = await withPinterest(userId, (t) => accountAnalytics(t, day(start), day(end)), connectionId)
  const rows = daily.map((d) => ({
    user_id: userId,
    connection_id: connectionId,
    day: d.date,
    impressions: d.metrics?.IMPRESSION ?? 0,
    saves: d.metrics?.SAVE ?? 0,
    pin_clicks: d.metrics?.PIN_CLICK ?? 0,
    outbound_clicks: d.metrics?.OUTBOUND_CLICK ?? 0,
    engagements: d.metrics?.ENGAGEMENT ?? 0,
  }))
  if (rows.length) await db.from('account_analytics').upsert(rows, { onConflict: 'user_id,connection_id,day' })

  // Per-pin lifetime numbers for the most recent pins (bounded to protect Pinterest rate limits).
  const { data: pins } = await db
    .from('scheduled_pins')
    .select('id, pinterest_pin_id')
    .eq('user_id', userId)
    .eq('connection_id', connectionId)
    .eq('status', 'published')
    .not('pinterest_pin_id', 'is', null)
    .gte('published_at', start.toISOString())
    .order('published_at', { ascending: false })
    .limit(40)
  const today = day(end)
  const snaps: Record<string, unknown>[] = []
  for (const p of pins ?? []) {
    try {
      const m = await withPinterest(userId, (t) => pinAnalytics(t, p.pinterest_pin_id as string, day(start), today), connectionId)
      snaps.push({
        user_id: userId,
        pin_id: p.id,
        pinterest_pin_id: p.pinterest_pin_id,
        impressions: m.IMPRESSION ?? 0,
        saves: m.SAVE ?? 0,
        clicks: m.PIN_CLICK ?? 0,
        outbound_clicks: m.OUTBOUND_CLICK ?? 0,
        snapshot_date: today,
      })
    } catch {
      // A pin that is too new for analytics (or deleted) must not abort the whole sync.
    }
    await sleep(250)
  }
  if (snaps.length) await db.from('analytics_snapshots').upsert(snaps, { onConflict: 'pin_id,snapshot_date' })
  return { days: rows.length, pins: snaps.length }
}

export async function syncAllAnalytics() {
  const { data } = await db.from('pinterest_connections').select('user_id').eq('status', 'active').limit(4000)
  const users = [...new Set((data ?? []).map((c) => c.user_id as string))]
  let ok = 0
  await mapLimit(users, 3, async (userId) => {
    try {
      await syncUserAnalytics(userId)
      ok++
    } catch (e) {
      if (!(e instanceof NotConnectedError)) log.warn('analytics sync failed', { user: userId, error: errMsg(e) })
    }
  })
  log.info('analytics sync', { users: ok })
}

/** Enforce each plan's analytics window in the database (the UI also limits what is shown). */
export async function pruneAnalytics() {
  let removed = 0
  // Daily runs only look at rows that expired in the last 35 days (a cheap index range). On the 1st of the month the
  // whole table is swept, which catches anything a missed run left behind.
  const band = new Date().getUTCDate() === 1 ? null : 35
  for (const plan of Object.values(PLANS)) {
    const { data, error } = await db.rpc('prune_analytics', { p_plan: plan.id, p_days: plan.analytics_days, p_band: band })
    if (error) log.warn('analytics prune failed', { plan: plan.id, error: error.message })
    else removed += Number(data ?? 0)
  }
  if (removed) log.info('analytics pruned', { rows: removed })
  return removed
}
