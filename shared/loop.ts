// SmartLoop rules: when an evergreen pin may be recycled, and when in the day it may go out.
// Pure functions shared by the job and tests. Quality over volume: the defaults are deliberately slow.

import { zonedToUtc } from './schedule'

/** A recycled pin may not come back sooner than this, whatever the loop is set to. */
export const MIN_INTERVAL_DAYS = 14
export const MAX_INTERVAL_DAYS = 365
export const MAX_PER_DAY_LIMIT = 5
/** Pins of one loop are kept at least this far apart so they never go out in a burst. */
export const MIN_GAP_MS = 45 * 60_000
/** After this many failures in a row a loop pauses itself instead of retrying into a restriction. */
export const PAUSE_AFTER_FAILURES = 3

export interface LoopSettings { interval_days: number; max_per_day: number; window_start: number; window_end: number }

export function normalizeSettings(s: Partial<LoopSettings>): LoopSettings {
  const clamp = (n: unknown, lo: number, hi: number, d: number) => Math.min(hi, Math.max(lo, Math.round(Number(n)) || d))
  const start = clamp(s.window_start, 0, 22, 9)
  return {
    interval_days: clamp(s.interval_days, MIN_INTERVAL_DAYS, MAX_INTERVAL_DAYS, 30),
    max_per_day: clamp(s.max_per_day, 1, MAX_PER_DAY_LIMIT, 2),
    window_start: start,
    window_end: Math.max(start + 1, clamp(s.window_end, 1, 23, 21)),
  }
}

export interface LoopItemState { last_recycled_at: string | null; times_recycled: number; active: boolean }

export function isDue(item: LoopItemState, intervalDays: number, now: number): boolean {
  if (!item.active) return false
  if (!item.last_recycled_at) return true
  return now - new Date(item.last_recycled_at).getTime() >= intervalDays * 86_400_000
}

/** Least recycled first, then the one waiting longest, so the whole library rotates evenly. */
export function byFairness<T extends LoopItemState>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.times_recycled - b.times_recycled ||
    (a.last_recycled_at ? new Date(a.last_recycled_at).getTime() : 0) - (b.last_recycled_at ? new Date(b.last_recycled_at).getTime() : 0))
}

const ymd = (utc: number, tz: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(utc)).map((x) => [x.type, Number(x.value)]))
  return { y: p.year, m: p.month, d: p.day }
}

/**
 * A random moment inside the daily window (in the account's timezone) on the earliest day with room, at least
 * `lead` ms from now and MIN_GAP_MS from every taken time. `taken` should include pins already queued.
 * Returns null when no day in the next two weeks has room.
 */
export function pickSlot(opts: { now: number; tz: string; start: number; end: number; maxPerDay: number; taken: number[]; /** Other queued pins of the account: only used to keep a gap, not counted against the daily cap. */ avoid?: number[]; rng?: () => number; lead?: number }): number | null {
  const { now, tz, start, end, maxPerDay, taken } = opts
  const apart = [...taken, ...(opts.avoid ?? [])]
  const rng = opts.rng ?? Math.random
  const lead = opts.lead ?? 15 * 60_000
  const dayOf = (t: number) => { const x = ymd(t, tz); return `${x.y}-${x.m}-${x.d}` }
  for (let offset = 0; offset < 14; offset++) {
    const base = ymd(now + offset * 86_400_000, tz)
    const winStart = zonedToUtc(base.y, base.m, base.d, start, 0, tz)
    const winEnd = zonedToUtc(base.y, base.m, base.d, end, 0, tz)
    const key = `${base.y}-${base.m}-${base.d}`
    if (taken.filter((t) => dayOf(t) === key).length >= maxPerDay) continue
    const from = Math.max(winStart, now + lead)
    if (winEnd - from < 1) continue
    for (let attempt = 0; attempt < 30; attempt++) {
      const t = from + Math.floor(rng() * (winEnd - from))
      if (apart.every((x) => Math.abs(x - t) >= MIN_GAP_MS)) return Math.floor(t / 60_000) * 60_000
    }
  }
  return null
}
