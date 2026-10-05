// Personalised posting hours, learned from an account's own published pins. Pure functions, no I/O.
//
// Pinterest's API reports analytics per day, not per hour, so the audience's busiest hours cannot be read
// directly. What we can measure is how each pin we published performed, and at which local hour it went out.
// That is weak evidence (content quality matters far more than the hour), so the method is deliberately cautious:
//  - nothing personal is used until there are enough pins that have actually been seen;
//  - an hour needs several pins before its own results count, and those results are pulled toward the account's
//    overall average (shrinkage), so one lucky pin cannot decide the schedule;
//  - hours without enough data keep the general ranking.

import { GENERAL_HOURS } from './schedule'

export interface TimingSample {
  /** When the pin was published (ISO). */
  published_at: string
  impressions: number
  saves: number
  clicks: number
  outbound_clicks: number
}

export interface HourScore { hour: number; pins: number; impressions: number; rate: number; score: number }
export type Confidence = 'low' | 'medium' | 'high'

export interface Timing {
  source: 'personal' | 'general'
  /** Published pins with enough impressions to count. */
  sample: number
  confidence: Confidence | null
  /** Hours ranked best first. */
  hours: number[]
  detail: HourScore[]
}

export const MIN_PINS = 30
/** An hour needs this many pins AND this many impressions before its own results count at all. */
export const MIN_PINS_PER_HOUR = 4
export const MIN_HOUR_IMPRESSIONS = 1000
export const MIN_IMPRESSIONS = 50
/** Pseudo-impressions of "average" results mixed into every hour. Larger means more caution. */
export const PRIOR_IMPRESSIONS = 2000

export function localHour(iso: string, timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(iso)).find((p) => p.type === 'hour')
  return Number(h?.value ?? 0)
}

const engagements = (s: TimingSample) => s.saves + s.clicks + s.outbound_clicks

export const confidenceFor = (sample: number): Confidence => (sample >= 150 ? 'high' : sample >= 60 ? 'medium' : 'low')

export function rankHours(samples: TimingSample[], timeZone: string, general: readonly number[] = GENERAL_HOURS): Timing {
  const usable = samples.filter((s) => s.impressions >= MIN_IMPRESSIONS)
  const fallback: Timing = { source: 'general', sample: usable.length, confidence: null, hours: [...general], detail: [] }
  if (usable.length < MIN_PINS) return fallback

  const totalImp = usable.reduce((t, s) => t + s.impressions, 0)
  const overall = usable.reduce((t, s) => t + engagements(s), 0) / totalImp
  if (!(overall > 0)) return fallback // no engagement at all: nothing to learn from

  const byHour = new Map<number, { pins: number; imp: number; eng: number }>()
  for (const s of usable) {
    const h = localHour(s.published_at, timeZone)
    const b = byHour.get(h) ?? { pins: 0, imp: 0, eng: 0 }
    b.pins++; b.imp += s.impressions; b.eng += engagements(s)
    byHour.set(h, b)
  }

  const enough = (b: { pins: number; imp: number }) => b.pins >= MIN_PINS_PER_HOUR && b.imp >= MIN_HOUR_IMPRESSIONS
  const detail: HourScore[] = [...byHour.entries()].map(([hour, b]) => ({
    hour, pins: b.pins, impressions: b.imp, rate: b.eng / b.imp,
    // Shrunk toward the account average; hours without enough data stay exactly at the average.
    score: enough(b) ? (b.eng + overall * PRIOR_IMPRESSIONS) / (b.imp + PRIOR_IMPRESSIONS) : overall,
  })).sort((a, b) => a.hour - b.hour)

  const scoreOf = new Map(detail.map((d) => [d.hour, d.score]))
  const candidates = [...new Set([...general, ...detail.filter((d) => d.pins >= MIN_PINS_PER_HOUR && d.impressions >= MIN_HOUR_IMPRESSIONS).map((d) => d.hour)])]
  const generalRank = (h: number) => { const i = general.indexOf(h); return i === -1 ? general.length : i }
  const hours = candidates.sort((a, b) => (scoreOf.get(b) ?? overall) - (scoreOf.get(a) ?? overall) || generalRank(a) - generalRank(b))

  return { source: 'personal', sample: usable.length, confidence: confidenceFor(usable.length), hours, detail }
}
