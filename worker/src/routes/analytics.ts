import { Hono } from 'hono'
import { byBoard, byDestination, byHour, toCsv, type PinStat } from '@shared/insights'
import { isValidTimeZone } from '@shared/schedule'
import { connectionOf, limit, type AppEnv } from '../lib/auth'
import { db } from '../lib/clients'
import { getProfile } from '../lib/plan'

export const analytics = new Hono<AppEnv>()
analytics.use('*', limit('default'))

/** Latest Pinterest-reported snapshot of each tracked pin in the window, joined to what we know about the pin. */
async function trackedPins(connectionId: string, days: number): Promise<PinStat[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  const { data: snaps } = await db.from('analytics_snapshots').select('pin_id, impressions, saves, clicks, outbound_clicks, snapshot_date')
    .eq('connection_id', connectionId).gte('snapshot_date', since).order('snapshot_date', { ascending: false }).limit(2000)
  const latest = new Map<string, NonNullable<typeof snaps>[number]>()
  for (const s of snaps ?? []) if (s.pin_id && !latest.has(s.pin_id as string)) latest.set(s.pin_id as string, s)
  const ids = [...latest.keys()]
  const pins: Record<string, { title: string | null; board_id: string | null; board_name: string | null; destination_url: string | null; published_at: string | null }> = {}
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await db.from('scheduled_pins').select('id, title, board_id, board_name, destination_url, published_at').in('id', ids.slice(i, i + 100))
    for (const p of data ?? []) pins[p.id as string] = p as never
  }
  return ids.filter((id) => pins[id]).map((id) => {
    const s = latest.get(id)!
    return { ...pins[id], impressions: s.impressions ?? 0, saves: s.saves ?? 0, clicks: s.clicks ?? 0, outbound_clicks: s.outbound_clicks ?? 0 }
  })
}

async function windowDays(userId: string, raw: string | undefined) {
  const profile = await getProfile(userId)
  const asked = [7, 30, 90].includes(Number(raw)) ? Number(raw) : 30
  return { days: Math.min(asked, profile.limits.analytics_days), tz: isValidTimeZone(profile.timezone) ? profile.timezone : 'UTC' }
}

/** Which boards, destination pages and posting hours went with stronger results. Association, not proof of cause. */
analytics.get('/breakdown', async (c) => {
  const { days, tz } = await windowDays(c.get('userId'), c.req.query('days'))
  const rows = await trackedPins(connectionOf(c).id, days)
  return c.json({
    days, pins_counted: rows.length,
    boards: byBoard(rows), destinations: byDestination(rows), hours: byHour(rows, tz).slice(0, 5), timezone: tz,
    notes: {
      source: 'Impressions, saves and clicks are reported by Pinterest for pins published through GoPinKaro. Only the most recent pins of each sync are tracked.',
      calculated: 'Engagement rate is calculated here as (saves + pin clicks) / impressions. It is not a figure Pinterest reports.',
      hours: 'Hours with fewer than 3 pins are left out. A higher average at some hour does not prove that hour caused it.',
    },
  })
})

/** CSV downloads. type=daily is the account totals; type=pins is the tracked pins. */
analytics.get('/export', async (c) => {
  const conn = connectionOf(c)
  const { days } = await windowDays(c.get('userId'), c.req.query('days'))
  const type = c.req.query('type') === 'pins' ? 'pins' : 'daily'
  let csv: string
  if (type === 'daily') {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
    const { data } = await db.from('account_analytics').select('day, impressions, saves, pin_clicks, outbound_clicks, engagements').eq('connection_id', conn.id).gte('day', since).order('day')
    csv = toCsv(['Date', 'Impressions', 'Saves', 'Pin clicks', 'Outbound clicks', 'Engagements'], (data ?? []).map((d) => [d.day, d.impressions, d.saves, d.pin_clicks, d.outbound_clicks, d.engagements]))
  } else {
    const rows = await trackedPins(conn.id, days)
    csv = toCsv(['Title', 'Board', 'Destination', 'Published', 'Impressions', 'Saves', 'Pin clicks', 'Outbound clicks'], rows.map((r) => [r.title, r.board_name, r.destination_url, r.published_at, r.impressions, r.saves, r.clicks, r.outbound_clicks]))
  }
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="gopinkaro-${type}-${days}d.csv"`, 'cache-control': 'no-store' } })
})
