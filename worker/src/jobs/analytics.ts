import { PLANS } from '@shared/plans'
import { db, mapLimit } from '../lib/clients'
import { getProfile } from '../lib/plan'
import { accountAnalytics, pinAnalytics } from '../lib/pinterest'
import { NotConnectedError, withPinterest } from '../lib/tokens'
import { errMsg, log } from '../lib/log'

const day = (d: Date) => d.toISOString().slice(0, 10)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function syncUserAnalytics(userId: string, requestedDays = 30) {
  // Only collect as much history as the user's plan shows (also keeps Pinterest API calls down).
  const days = Math.min(requestedDays, PLANS[(await getProfile(userId)).plan].analytics_days)
  const end = new Date()
  const start = new Date(Date.now() - days * 86_400_000)

  const daily = await withPinterest(userId, (t) => accountAnalytics(t, day(start), day(end)))
  const rows = daily.map((d) => ({
    user_id: userId,
    day: d.date,
    impressions: d.metrics?.IMPRESSION ?? 0,
    saves: d.metrics?.SAVE ?? 0,
    pin_clicks: d.metrics?.PIN_CLICK ?? 0,
    outbound_clicks: d.metrics?.OUTBOUND_CLICK ?? 0,
    engagements: d.metrics?.ENGAGEMENT ?? 0,
  }))
  if (rows.length) await db.from('account_analytics').upsert(rows, { onConflict: 'user_id,day' })

  // Per-pin lifetime numbers for the most recent pins (bounded to protect Pinterest rate limits).
  const { data: pins } = await db
    .from('scheduled_pins')
    .select('id, pinterest_pin_id')
    .eq('user_id', userId)
    .eq('status', 'published')
    .not('pinterest_pin_id', 'is', null)
    .gte('published_at', start.toISOString())
    .order('published_at', { ascending: false })
    .limit(40)
  const today = day(end)
  const snaps: Record<string, unknown>[] = []
  for (const p of pins ?? []) {
    try {
      const m = await withPinterest(userId, (t) => pinAnalytics(t, p.pinterest_pin_id as string, day(start), today))
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
  const { data } = await db.from('pinterest_connections').select('user_id').eq('status', 'active').limit(2000)
  let ok = 0
  await mapLimit(data ?? [], 3, async (c) => {
    try {
      await syncUserAnalytics(c.user_id as string)
      ok++
    } catch (e) {
      if (!(e instanceof NotConnectedError)) log.warn('analytics sync failed', { user: c.user_id, error: errMsg(e) })
    }
  })
  log.info('analytics sync', { users: ok })
}
