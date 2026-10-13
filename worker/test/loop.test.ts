import { test } from 'node:test'
import assert from 'node:assert/strict'
import { byFairness, isDue, MIN_GAP_MS, MIN_INTERVAL_DAYS, normalizeSettings, pickSlot } from '../../shared/loop'

const DAY = 86_400_000

test('settings are clamped to safe values', () => {
  assert.deepEqual(normalizeSettings({}), { interval_days: 30, max_per_day: 2, window_start: 9, window_end: 21 })
  const s = normalizeSettings({ interval_days: 1, max_per_day: 50, window_start: 20, window_end: 5 })
  assert.equal(s.interval_days, MIN_INTERVAL_DAYS)
  assert.equal(s.max_per_day, 5)
  assert.ok(s.window_end > s.window_start)
})

test('a pin is due only after the interval, and never when switched off', () => {
  const now = Date.parse('2026-10-13T12:00:00Z')
  assert.equal(isDue({ last_recycled_at: null, times_recycled: 0, active: true }, 30, now), true)
  assert.equal(isDue({ last_recycled_at: new Date(now - 29 * DAY).toISOString(), times_recycled: 1, active: true }, 30, now), false)
  assert.equal(isDue({ last_recycled_at: new Date(now - 30 * DAY).toISOString(), times_recycled: 1, active: true }, 30, now), true)
  assert.equal(isDue({ last_recycled_at: null, times_recycled: 0, active: false }, 30, now), false)
})

test('the library rotates evenly: least recycled, then longest waiting', () => {
  const a = { id: 'a', last_recycled_at: '2026-08-01T00:00:00Z', times_recycled: 2, active: true }
  const b = { id: 'b', last_recycled_at: '2026-09-01T00:00:00Z', times_recycled: 1, active: true }
  const c = { id: 'c', last_recycled_at: '2026-07-01T00:00:00Z', times_recycled: 1, active: true }
  const d = { id: 'd', last_recycled_at: null, times_recycled: 0, active: true }
  assert.deepEqual(byFairness([a, b, c, d]).map((x) => x.id), ['d', 'c', 'b', 'a'])
})

test('slots land inside the local window, spaced apart, and respect the daily cap', () => {
  const tz = 'America/New_York'
  const now = Date.parse('2026-10-13T10:00:00Z') // 6 am in New York
  let seed = 7
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const taken: number[] = []
  for (let i = 0; i < 6; i++) {
    const t = pickSlot({ now, tz, start: 9, end: 21, maxPerDay: 2, taken, rng })
    assert.ok(t !== null)
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date(t!)))
    assert.ok(hour >= 9 && hour < 21, `hour ${hour}`)
    assert.ok(t! >= now + 15 * 60_000)
    for (const x of taken) assert.ok(Math.abs(x - t!) >= MIN_GAP_MS)
    taken.push(t!)
  }
  const perDay = new Map<string, number>()
  for (const t of taken) { const k = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(t)); perDay.set(k, (perDay.get(k) ?? 0) + 1) }
  assert.ok([...perDay.values()].every((n) => n <= 2))
  assert.equal(perDay.size, 3)
})

test('no slot when the next two weeks are full', () => {
  const now = Date.parse('2026-10-13T10:00:00Z')
  const taken = Array.from({ length: 40 }, (_, i) => now + i * 3_600_000 * 10)
  assert.equal(pickSlot({ now, tz: 'UTC', start: 9, end: 21, maxPerDay: 1, taken: Array.from({ length: 14 }, (_, i) => Date.parse('2026-10-13T12:00:00Z') + i * DAY) }), null)
  assert.ok(taken.length > 0)
})
