import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GENERAL_HOURS, generateSlots, hoursForPerDay } from '../../shared/schedule'
import { MIN_PINS, MIN_PINS_PER_HOUR, PRIOR_IMPRESSIONS, localHour, rankHours, type TimingSample } from '../../shared/best-times'

const at = (day: number, hour: number) => new Date(Date.UTC(2030, 0, day, hour, 15)).toISOString()
const sample = (day: number, hour: number, impressions: number, engaged: number): TimingSample => ({
  published_at: at(day, hour), impressions, saves: Math.round(engaged * 0.5), clicks: Math.round(engaged * 0.3), outbound_clicks: engaged - Math.round(engaged * 0.5) - Math.round(engaged * 0.3),
})

/** `n` pins at an hour with the given engagement rate. */
const pins = (hour: number, n: number, rate: number, impressions = 1000): TimingSample[] =>
  Array.from({ length: n }, (_, i) => sample(1 + (i % 25), hour, impressions, Math.round(impressions * rate)))

test('below the minimum sample the general ranking is used', () => {
  const t = rankHours(pins(20, MIN_PINS - 1, 0.1), 'UTC')
  assert.equal(t.source, 'general')
  assert.deepEqual(t.hours, [...GENERAL_HOURS])
  assert.equal(t.confidence, null)
})

test('pins that were barely seen do not count towards the sample', () => {
  const t = rankHours(pins(20, 60, 0.1, 10), 'UTC') // 10 impressions each
  assert.equal(t.sample, 0)
  assert.equal(t.source, 'general')
})

test('an hour that clearly performs better moves to the front', () => {
  const data = [...pins(20, 12, 0.08), ...pins(14, 12, 0.02), ...pins(9, 12, 0.02)]
  const t = rankHours(data, 'UTC')
  assert.equal(t.source, 'personal')
  assert.equal(t.hours[0], 20)
  assert.ok(t.hours.indexOf(14) > 0)
})

test('an hour with too little data cannot win, however good its few pins look', () => {
  const data = [...pins(20, 14, 0.02), ...pins(9, 14, 0.02), ...pins(3, MIN_PINS_PER_HOUR - 1, 0.5), ...pins(5, 6, 0.5, 100)]
  const t = rankHours(data, 'UTC')
  assert.equal(t.source, 'personal')
  assert.ok(!t.hours.includes(3), 'too few pins: not even a candidate')
  assert.ok(!t.hours.includes(5), 'enough pins but under the impressions floor: not a candidate either')
})

test('shrinkage: a thinly measured good hour is pulled toward the average', () => {
  // 40 solid pins at 3% in hour 14; hour 21 has 5 pins x 250 impressions at 6% (1250 impressions, just eligible).
  const data = [...pins(14, 40, 0.03), ...pins(21, 5, 0.06, 250)]
  const t = rankHours(data, 'UTC')
  const thin = t.detail.find((d) => d.hour === 21)!
  const overall = t.detail.reduce((s, d) => s + d.rate * d.impressions, 0) / t.detail.reduce((s, d) => s + d.impressions, 0)
  assert.ok(thin.score > overall, 'it still counts as better than average')
  assert.ok(thin.score - overall < 0.5 * (thin.rate - overall), 'but by less than half of its raw advantage')
  assert.ok(thin.impressions < PRIOR_IMPRESSIONS * 1, 'the prior outweighs this hour\'s own evidence')
})

test('hours are bucketed in the account timezone', () => {
  // 01:15 UTC is 20:15 the previous evening in New York (UTC-5).
  assert.equal(localHour(at(5, 1), 'America/New_York'), 20)
  assert.equal(localHour(at(5, 1), 'UTC'), 1)
  const data = pins(1, 40, 0.06) // all published at 01:15 UTC
  const ny = rankHours(data, 'America/New_York')
  assert.ok(ny.detail.every((d) => d.hour === 20))
})

test('confidence grows with the sample size', () => {
  assert.equal(rankHours(pins(20, 40, 0.05), 'UTC').confidence, 'low')
  assert.equal(rankHours([...pins(20, 40, 0.05), ...pins(14, 40, 0.05)], 'UTC').confidence, 'medium')
  assert.equal(rankHours([...pins(20, 80, 0.05), ...pins(14, 80, 0.05)], 'UTC').confidence, 'high')
})

test('no engagement at all falls back to the general ranking', () => {
  assert.equal(rankHours(pins(20, 40, 0), 'UTC').source, 'general')
})

test('slot generation follows a supplied ranking', () => {
  assert.deepEqual(hoursForPerDay(2, [22, 7, 9]), [7, 22])
  assert.deepEqual(hoursForPerDay(2), [14, 20], 'the default is still the general ranking')
  const slots = generateSlots({ after: new Date(Date.UTC(2031, 0, 1)), count: 4, perDay: 2, timeZone: 'UTC', ranked: [22, 7, 9] })
  assert.deepEqual(slots.map((s) => s.getUTCHours()), [7, 22, 7, 22])
})
