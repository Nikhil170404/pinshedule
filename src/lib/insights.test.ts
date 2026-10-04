import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildInsights, type DayRow } from './insights'
import { nudgeFor } from './usage-nudge'

function days(n: number, f: (i: number, date: Date) => Partial<DayRow>): DayRow[] {
  const start = Date.UTC(2026, 8, 1)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start + i * 86_400_000)
    return { day: d.toISOString().slice(0, 10), impressions: 100, saves: 5, pin_clicks: 3, outbound_clicks: 2, ...f(i, d) }
  })
}

test('too little data produces no insights', () => {
  assert.deepEqual(buildInsights(days(5, () => ({}))), [])
  assert.deepEqual(buildInsights(days(30, () => ({ impressions: 0 }))), [])
})

test('momentum compares the last 7 days with the 7 before', () => {
  const rows = days(14, (i) => ({ impressions: i < 7 ? 100 : 150 }))
  const m = buildInsights(rows).find((i) => i.id === 'momentum')!
  assert.equal(m.tone, 'good')
  assert.match(m.title, /up 50%/)
  const down = buildInsights(days(14, (i) => ({ impressions: i < 7 ? 200 : 100 }))).find((i) => i.id === 'momentum')!
  assert.equal(down.tone, 'warn')
})

test('best weekday needs every weekday seen twice and a clear lead', () => {
  assert.equal(buildInsights(days(20, () => ({}))).some((i) => i.id === 'weekday'), false)
  const rows = days(28, (_, d) => ({ impressions: d.getUTCDay() === 3 ? 300 : 100 }))
  assert.match(buildInsights(rows).find((i) => i.id === 'weekday')!.title, /Wednesdays/)
  assert.equal(buildInsights(days(28, () => ({}))).some((i) => i.id === 'weekday'), false) // flat data: no winner
})

test('rates are computed from the totals and cards are capped at four', () => {
  const rows = days(28, (_, d) => ({ impressions: d.getUTCDay() === 3 ? 300 : 100 }))
  const out = buildInsights(rows, [{ impressions: 900, saves: 1 }, { impressions: 100, saves: 1 }, { impressions: 100, saves: 1 }])
  assert.ok(out.length <= 4)
  assert.match(out.find((i) => i.id === 'save-rate')!.title, /^\d+\.\d% of impressions/)
})

test('usage nudge warns from 80%, flags 100%, and picks the fullest meter', () => {
  const base = { plan: 'starter' as const, limits: { pins: 300, ai: 300, imports: 100, accounts: 1, automations: 1 } }
  assert.equal(nudgeFor({ ...base, used: { pins: 100, ai: 10, imports: 5, accounts: 1, automations: 0 } }), null)
  const warn = nudgeFor({ ...base, used: { pins: 250, ai: 10, imports: 5, accounts: 1, automations: 0 } })!
  assert.equal(warn.level, 'warning')
  assert.equal(warn.meter, 'pins')
  assert.equal(warn.upgradeTo, 'Pro')
  const full = nudgeFor({ ...base, used: { pins: 250, ai: 10, imports: 100, accounts: 1, automations: 0 } })!
  assert.equal(full.level, 'limit')
  assert.equal(full.meter, 'imports')
  const top = nudgeFor({ plan: 'growth', limits: { pins: 6000, ai: 6000, imports: 3000, accounts: 3, automations: 10 }, used: { pins: 6000, ai: 0, imports: 0, accounts: 1, automations: 0 } })!
  assert.equal(top.upgradeTo, null)
})
