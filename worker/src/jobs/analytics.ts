import { db, mapLimit } from '../lib/clients'
import { accountAnalytics, pinAnalytics } from '../lib/pinterest'
import { NotConnectedError, withPinterest } from '../lib/tokens'
import { errMsg, log } from '../lib/log'

const day = (d: Date) => d.toISOString().slice(0, 10)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function syncConnectionAnalytics(connectionId: string, days = 30) {
  const { data: conn } = await db.from('pinterest_connections').select('id, user_id').eq('id', connectionId).maybeSingle()
  if (!conn) throw new NotConnectedError('That Pinterest account is not connected.')
  const userId = conn.user_id as string
  const end = new Date()
  const start = new Date(Date.now() - days * 86_400_000)

  const daily = await withPinterest(connectionId, (t) => accountAnalytics(t, day(start), day(end)))
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
  if (rows.length) await db.from('account_analytics').upsert(rows, { onConflict: 'connection_id,day' })

  // Per-pin lifetime numbers for the most recent pins (bounded to protect Pinterest rate limits).
  const { data: pins } = await db
    .from('scheduled_pins')
    .select('id, pinterest_pin_id')
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
      const m = await withPinterest(connectionId, (t) => pinAnalytics(t, p.pinterest_pin_id as string, day(start), today))
      snaps.push({
        user_id: userId,
        connection_id: connectionId,
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
  await db.from('pinterest_connections').update({ analytics_synced_at: new Date().toISOString() }).eq('id', connectionId)
  return { days: rows.length, pins: snaps.length }
}

/** Every active account, least recently synced first, capped per run so a big install cannot starve itself. */
export async function syncAllAnalytics() {
  const stale = new Date(Date.now() - 5 * 3600_000).toISOString()
  const { data } = await db.from('pinterest_connections').select('id').eq('status', 'active')
    .or(`analytics_synced_at.is.null,analytics_synced_at.lt.${stale}`)
    .order('analytics_synced_at', { ascending: true, nullsFirst: true }).limit(1200)
  let ok = 0
  await mapLimit(data ?? [], 4, async (c) => {
    try {
      await syncConnectionAnalytics(c.id as string)
      ok++
    } catch (e) {
      if (!(e instanceof NotConnectedError)) log.warn('analytics sync failed', { connection: c.id, error: errMsg(e) })
    }
  })
  log.info('analytics sync', { accounts: ok })
}
