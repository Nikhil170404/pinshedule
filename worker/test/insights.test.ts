import { test } from 'node:test'
import assert from 'node:assert/strict'
import { byBoard, byDestination, byHour, destinationKey, toCsv, type PinStat } from '../../shared/insights'

const pin = (o: Partial<PinStat>): PinStat => ({ title: 't', board_id: 'b1', board_name: 'Dinners', destination_url: 'https://blog.test/a', published_at: '2026-10-01T14:00:00Z', impressions: 100, saves: 5, clicks: 3, outbound_clicks: 2, ...o })

test('byBoard totals and ranks boards, with a calculated engagement rate', () => {
  const g = byBoard([pin({}), pin({ impressions: 300, saves: 10, clicks: 10 }), pin({ board_id: 'b2', board_name: 'Decor', impressions: 50 })])
  assert.deepEqual(g.map((x) => x.label), ['Dinners', 'Decor'])
  assert.equal(g[0].pins, 2)
  assert.equal(g[0].impressions, 400)
  assert.equal(g[0].engagement_rate, 0.07) // (saves 5+10 + pin clicks 3+10) / 400 impressions
})

test('byDestination ignores tracking parameters, www and trailing slash', () => {
  assert.equal(destinationKey('https://www.Blog.test/Recipe/?utm_source=pinterest')?.key, 'blog.test/recipe')
  const g = byDestination([pin({ destination_url: 'https://blog.test/a/' }), pin({ destination_url: 'https://www.blog.test/a?utm=x' }), pin({ destination_url: null })])
  assert.equal(g.length, 1)
  assert.equal(g[0].pins, 2)
})

test('byHour leaves out hours with too few pins and uses the local hour', () => {
  const rows = [
    ...Array.from({ length: 3 }, () => pin({ published_at: '2026-10-01T14:30:00Z', impressions: 200 })), // 10:30 in New York (EDT)
    pin({ published_at: '2026-10-01T03:00:00Z', impressions: 9999 }), // lone pin: ignored
  ]
  assert.deepEqual(byHour(rows, 'America/New_York'), [{ hour: 10, pins: 3, avg_impressions: 200 }])
})

test('toCsv quotes cells and defuses spreadsheet formulas', () => {
  const csv = toCsv(['a', 'b'], [['x, "y"', '=HYPERLINK("http://evil")'], [1, null]])
  assert.equal(csv, 'a,b\r\n"x, ""y""","\'=HYPERLINK(""http://evil"")"\r\n1,\r\n')
})
