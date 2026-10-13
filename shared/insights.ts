// Analytics roll-ups. Pure functions shared by the API and tests.
// Inputs are Pinterest-reported per-pin numbers; everything computed here is labelled as calculated in the UI.

export interface PinStat {
  title: string | null
  board_id: string | null
  board_name: string | null
  destination_url: string | null
  published_at: string | null
  impressions: number
  saves: number
  clicks: number
  outbound_clicks: number
}

export interface Group { key: string; label: string; pins: number; impressions: number; saves: number; outbound_clicks: number; /** (saves + pin clicks) / impressions, calculated */ engagement_rate: number }

const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10_000) / 10_000 : 0)

/** Group pins and total their numbers, best first by impressions. */
export function groupStats(rows: PinStat[], keyOf: (r: PinStat) => { key: string; label: string } | null, max = 10): Group[] {
  const map = new Map<string, Group & { eng: number }>()
  for (const r of rows) {
    const k = keyOf(r)
    if (!k) continue
    const g = map.get(k.key) ?? { key: k.key, label: k.label, pins: 0, impressions: 0, saves: 0, outbound_clicks: 0, engagement_rate: 0, eng: 0 }
    g.pins++; g.impressions += r.impressions; g.saves += r.saves; g.outbound_clicks += r.outbound_clicks; g.eng += r.saves + r.clicks
    map.set(k.key, g)
  }
  return [...map.values()].map(({ eng, ...g }) => ({ ...g, engagement_rate: rate(eng, g.impressions) })).sort((a, b) => b.impressions - a.impressions).slice(0, max)
}

export const byBoard = (rows: PinStat[]) => groupStats(rows, (r) => (r.board_id ? { key: r.board_id, label: r.board_name || 'Unnamed board' } : null))

/** A destination is its host plus path, without query string or trailing slash, so tracking parameters do not split one page in two. */
export function destinationKey(url: string | null): { key: string; label: string } | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const label = `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`
    return { key: label.toLowerCase(), label }
  } catch { return null }
}
export const byDestination = (rows: PinStat[]) => groupStats(rows, (r) => destinationKey(r.destination_url))

export interface HourBucket { hour: number; pins: number; avg_impressions: number }
export const MIN_PINS_PER_HOUR = 3

/**
 * Average impressions per pin by the local hour it was published. Hours with fewer than MIN_PINS_PER_HOUR pins are
 * left out: with so few pins the average is noise. This shows association, not cause.
 */
export function byHour(rows: PinStat[], timeZone: string): HourBucket[] {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' })
  const map = new Map<number, { pins: number; imp: number }>()
  for (const r of rows) {
    if (!r.published_at) continue
    const hour = Number(fmt.format(new Date(r.published_at)))
    const b = map.get(hour) ?? { pins: 0, imp: 0 }
    b.pins++; b.imp += r.impressions
    map.set(hour, b)
  }
  return [...map.entries()].filter(([, b]) => b.pins >= MIN_PINS_PER_HOUR).map(([hour, b]) => ({ hour, pins: b.pins, avg_impressions: Math.round(b.imp / b.pins) })).sort((a, b) => b.avg_impressions - a.avg_impressions)
}

/** RFC 4180 CSV. Cells that start with = + - @ are prefixed with an apostrophe so spreadsheets never run them as formulas. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    let s = v === null || v === undefined ? '' : String(v)
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}
