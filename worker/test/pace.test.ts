import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DAILY_PIN_SOFT_MAX, paceWarnings } from '../../shared/pace'

const at = (day: number, hour = 12, min = 0) => new Date(Date.UTC(2030, 0, day, hour, min)).toISOString()
const pin = (day: number, img: string, hour = 12) => ({ scheduled_at: at(day, hour), image_url: img })

test('a normal pace produces no warnings', () => {
  const added = [pin(10, 'a', 9), pin(10, 'b', 14), pin(11, 'c', 9)]
  assert.deepEqual(paceWarnings(added, [], 'UTC'), [])
})

test('flags a day above the soft maximum, counting pins already queued', () => {
  const existing = Array.from({ length: DAILY_PIN_SOFT_MAX - 1 }, (_, i) => pin(10, `old${i}`, 8))
  const added = [pin(10, 'n1', 20), pin(10, 'n2', 21)]
  const w = paceWarnings(added, existing, 'UTC')
  assert.equal(w.length, 1)
  assert.match(w[0], /2030-01-10 \(16\)/)
})

test('exactly at the maximum is fine', () => {
  const added = Array.from({ length: DAILY_PIN_SOFT_MAX }, (_, i) => pin(10, `i${i}`, 6))
  assert.deepEqual(paceWarnings(added, [], 'UTC'), [])
})

test('a crowded day that this batch does not touch is not reported', () => {
  const existing = Array.from({ length: 30 }, (_, i) => pin(12, `x${i}`, 6))
  assert.deepEqual(paceWarnings([pin(10, 'n')], existing, 'UTC'), [])
})

test('days are counted in the user timezone', () => {
  // 23:30 and 00:30 UTC are the same evening in New York (UTC-5 in January) but two different UTC days.
  const added = [{ scheduled_at: at(10, 23, 30), image_url: 'a' }, { scheduled_at: at(11, 0, 30), image_url: 'b' }]
  const big = Array.from({ length: DAILY_PIN_SOFT_MAX - 1 }, (_, i) => ({ scheduled_at: at(10, 20), image_url: `f${i}` }))
  assert.equal(paceWarnings(added, big, 'America/New_York').length, 1)
  assert.equal(paceWarnings(added, big, 'UTC').length, 0)
})

test('flags an image reused within seven days, inside the batch and against the queue', () => {
  const w = paceWarnings([pin(10, 'same'), pin(12, 'same')], [pin(11, 'same')], 'UTC')
  assert.equal(w.length, 1)
  assert.match(w[0], /2 pins reuse images/)
})

test('the same image more than a week apart is fine', () => {
  assert.deepEqual(paceWarnings([pin(20, 'same')], [pin(10, 'same')], 'UTC'), [])
})
