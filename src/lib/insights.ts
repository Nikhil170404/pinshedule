export interface DayRow { day: string; impressions: number; saves: number; pin_clicks: number; outbound_clicks: number }
export interface TopRow { impressions: number; saves: number }
export interface Insight { id: string; title: string; body: string; tone: 'good' | 'neutral' | 'warn' }

const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
const sum = (rows: DayRow[], k: keyof Omit<DayRow, 'day'>) => rows.reduce((t, r) => t + r[k], 0)
const pct = (n: number) => `${Math.abs(Math.round(n))}%`

/**
 * Plain-language takeaways computed only from the user's own numbers. Each one needs enough data to mean
 * something, so a new account sees fewer cards instead of noise. Days must be sorted oldest to newest.
 */
export function buildInsights(days: DayRow[], top: TopRow[] = []): Insight[] {
  const out: Insight[] = []
  const total = sum(days, 'impressions')
  if (days.length < 7 || total === 0) return out

  // Momentum: last 7 days against the 7 before.
  if (days.length >= 14) {
    const recent = days.slice(-7)
    const prior = days.slice(-14, -7)
    const a = sum(recent, 'impressions')
    const b = sum(prior, 'impressions')
    if (b > 0) {
      const change = ((a - b) / b) * 100
      if (Math.abs(change) >= 5) out.push({
        id: 'momentum', tone: change > 0 ? 'good' : 'warn',
        title: change > 0 ? `Impressions are up ${pct(change)}` : `Impressions are down ${pct(change)}`,
        body: `${a.toLocaleString()} impressions in the last 7 days against ${b.toLocaleString()} in the 7 days before.${change < 0 ? ' Steady daily pinning usually recovers this.' : ''}`,
      })
    }
  }

  // Best weekday, only when every weekday has been observed at least twice so one spike cannot win.
  if (days.length >= 21) {
    const buckets = new Map<number, number[]>()
    for (const d of days) {
      const wd = new Date(`${d.day}T00:00:00Z`).getUTCDay()
      buckets.set(wd, [...(buckets.get(wd) ?? []), d.impressions])
    }
    if ([...buckets.values()].every((v) => v.length >= 2) && buckets.size === 7) {
      const avg = new Map([...buckets].map(([wd, v]) => [wd, v.reduce((t, x) => t + x, 0) / v.length]))
      const [bestDay, bestAvg] = [...avg].sort((x, y) => y[1] - x[1])[0]
      const overall = total / days.length
      if (overall > 0 && bestAvg > overall * 1.1) out.push({
        id: 'weekday', tone: 'neutral', title: `${WEEKDAYS[bestDay]} perform best`,
        body: `They average ${pct(((bestAvg - overall) / overall) * 100)} more impressions than your typical day. Schedule your strongest pins for then.`,
      })
    }
  }

  const saves = sum(days, 'saves')
  out.push({
    id: 'save-rate', tone: 'neutral', title: `${((saves / total) * 100).toFixed(1)}% of impressions become saves`,
    body: `${saves.toLocaleString()} saves from ${total.toLocaleString()} impressions in this period. Clear titles and tall, readable images tend to lift this.`,
  })

  const clicks = sum(days, 'outbound_clicks')
  if (clicks > 0) out.push({
    id: 'ctr', tone: 'neutral', title: `${((clicks / total) * 100).toFixed(2)}% click through to your site`,
    body: `${clicks.toLocaleString()} outbound clicks. Pins with a clear destination link and a call to action in the description drive most of these.`,
  })

  const topTotal = top.reduce((t, p) => t + p.impressions, 0)
  if (top.length >= 3 && topTotal > 0 && top[0].impressions / topTotal >= 0.4) out.push({
    id: 'concentration', tone: 'neutral', title: 'One pin carries your results',
    body: `Your best pin has ${pct((top[0].impressions / topTotal) * 100)} of the views among your top ${top.length}. Make more pins in the same style, or re-pin it with evergreen recycling.`,
  })
  return out.slice(0, 4)
}
