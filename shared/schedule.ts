// Timezone-aware "best time" slot generation. Pure functions, no I/O.

/**
 * Hours (local time) ranked by typical Pinterest engagement; first N are used for N pins/day.
 * A fixed, general-purpose ranking: it is not learned from an individual account's own audience, so
 * user-facing copy must describe it as "typically busy hours" and not as personalized timing.
 */
export const GENERAL_HOURS = [20, 14, 21, 9, 12, 16, 18, 11, 7, 22] as const

/** The best `perDay` hours of a ranking (best first), in clock order. Defaults to the general ranking. */
export function hoursForPerDay(perDay: number, ranked: readonly number[] = GENERAL_HOURS): number[] {
  const n = Math.min(Math.max(1, Math.floor(perDay)), ranked.length)
  return ranked.slice(0, n).slice().sort((a, b) => a - b)
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function offsetMs(utc: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(new Date(utc)).map((x) => [x.type, Number(x.value)])
  )
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utc / 1000) * 1000
}

/** Convert a wall-clock time in `tz` to a UTC epoch (handles DST). */
export function zonedToUtc(y: number, m: number, d: number, h: number, min: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, h, min)
  const first = guess - offsetMs(guess, tz)
  return guess - offsetMs(first, tz)
}

function localYmd(utc: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(new Date(utc)).map((x) => [x.type, Number(x.value)])
  )
  return { y: p.year, m: p.month, d: p.day }
}

/**
 * Generate `count` slots, `perDay` per local day, strictly after `after`.
 * A small deterministic-looking minute offset avoids robotic on-the-hour posting.
 */
export function generateSlots(opts: { after: Date; count: number; perDay: number; timeZone: string; minLeadMs?: number; /** Hours ranked best first, e.g. learned from the account's results. */ ranked?: readonly number[] }): Date[] {
  const { count, perDay, timeZone } = opts
  const hours = hoursForPerDay(perDay, opts.ranked)
  const earliest = Math.max(opts.after.getTime(), Date.now() + (opts.minLeadMs ?? 5 * 60_000))
  const slots: Date[] = []
  const start = localYmd(earliest, timeZone)
  for (let day = 0; slots.length < count && day < 400; day++) {
    // Date.UTC handles month overflow for us
    const base = new Date(Date.UTC(start.y, start.m - 1, start.d + day))
    for (const h of hours) {
      const minute = (h * 7 + day * 13) % 23 // 0-22, stable per slot
      const t = zonedToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), h, minute, timeZone)
      if (t > earliest) {
        slots.push(new Date(t))
        if (slots.length >= count) break
      }
    }
  }
  return slots
}
