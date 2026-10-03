import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateSlots, hoursForPerDay, zonedToUtc } from '../../shared/schedule'
import { PLANS, PAID_PLANS, monthlyEquivalent } from '../../shared/plans'
import { encrypt, decrypt } from '../../shared/crypto'
import { extractImages, metaContent, parseSitemapUrls } from '../src/lib/html'

process.env.APP_URL ??= 'http://x'
process.env.SUPABASE_URL ??= 'https://example.supabase.co'
process.env.UPSTASH_REDIS_REST_URL ??= 'https://example.upstash.io'
for (const k of ['SUPABASE_SERVICE_ROLE_KEY', 'UPSTASH_REDIS_REST_TOKEN', 'ENCRYPTION_SECRET', 'PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET']) process.env[k] ??= 'x'

test('slots are in the future, ordered, and land in the user local evening', () => {
  const after = new Date()
  const slots = generateSlots({ after, count: 20, perDay: 3, timeZone: 'Asia/Kolkata' })
  assert.equal(slots.length, 20)
  slots.forEach((s, i) => {
    assert.ok(s.getTime() > after.getTime())
    if (i) assert.ok(s > slots[i - 1])
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(s))
    assert.ok(hoursForPerDay(3).includes(h), `hour ${h}`)
  })
})

test('slots respect DST: 20:xx local stays 20:xx across the US spring-forward', () => {
  const t = zonedToUtc(2027, 3, 14, 20, 0, 'America/New_York') // DST starts 2027-03-14
  assert.equal(new Date(t).toISOString(), '2027-03-15T00:00:00.000Z') // EDT = UTC-4
  const before = zonedToUtc(2027, 3, 13, 20, 0, 'America/New_York')
  assert.equal(new Date(before).toISOString(), '2027-03-14T01:00:00.000Z') // EST = UTC-5
})

test('plans: strictly increasing limits and yearly is cheaper than 12 months', () => {
  const ids = ['free_trial', ...PAID_PLANS] as const
  for (let i = 1; i < ids.length; i++) assert.ok(PLANS[ids[i]].pins_per_month > PLANS[ids[i - 1]].pins_per_month)
  for (const id of PAID_PLANS) {
    assert.ok(PLANS[id].price_yearly_usd < PLANS[id].price_monthly_usd * 12)
    assert.ok(monthlyEquivalent(PLANS[id], 'yearly') < PLANS[id].price_monthly_usd)
  }
})

test('token encryption round-trips and rejects the wrong key', async () => {
  const c = await encrypt('secret-token', 'k1')
  assert.equal(await decrypt(c, 'k1'), 'secret-token')
  await assert.rejects(decrypt(c, 'k2'))
})

test('html: og meta in either attribute order, image extraction skips junk', () => {
  const html = `<meta content="My &amp; Title" property="og:title"><meta property="og:image" content="/a.jpg">
    <img src="/logo.png"><img width="50" src="/tiny.jpg"><img data-src="/b.jpg" srcset="/b-1x.jpg 400w, /b-2x.jpg 800w"><img src="data:image/gif;base64,AAA">`
  assert.equal(metaContent(html, 'property', 'og:title'), 'My & Title')
  assert.deepEqual(extractImages(html, 'https://site.com/post'), ['https://site.com/a.jpg', 'https://site.com/b-2x.jpg'])
})

test('sitemap parsing separates indexes from pages', () => {
  assert.deepEqual(parseSitemapUrls('<urlset><url><loc>https://a.com/1</loc></url></urlset>').pages, ['https://a.com/1'])
  assert.deepEqual(parseSitemapUrls('<sitemapindex><sitemap><loc>https://a.com/s.xml</loc></sitemap></sitemapindex>').sitemaps, ['https://a.com/s.xml'])
})

test('SSRF guard blocks private and loopback targets', async () => {
  const { assertPublicUrl } = await import('../src/lib/safe-fetch')
  for (const u of ['http://127.0.0.1/', 'http://10.0.0.5/x', 'http://192.168.1.1', 'http://169.254.169.254/latest', 'http://localhost:3000', 'http://[::1]/', 'file:///etc/passwd', 'http://[::ffff:127.0.0.1]/'])
    await assert.rejects(assertPublicUrl(u), undefined, u)
})

test('cosine similarity: identical = 1, orthogonal = 0, opposite = -1', async () => {
  const { cosine } = await import('../src/lib/ai')
  assert.ok(Math.abs(cosine([1, 2, 3], [1, 2, 3]) - 1) < 1e-9)
  assert.equal(cosine([1, 0], [0, 1]), 0)
  assert.ok(Math.abs(cosine([1, 1], [-1, -1]) + 1) < 1e-9)
})

test('assistant: every tool shown to the model has a handler, and vice versa', async () => {
  const { TOOL_DEFS, registeredToolNames } = await import('../src/lib/assistant-tools')
  const defs = TOOL_DEFS.map((d) => d.function.name).sort()
  assert.deepEqual(defs, registeredToolNames().sort())
  for (const d of TOOL_DEFS) assert.equal(d.function.parameters.additionalProperties, false, d.function.name)
})

test('assistant: write tools never execute from runTool, bad input is reported not thrown', async () => {
  const { runTool } = await import('../src/lib/assistant-tools')
  const ctx = { userId: 'u', tz: 'UTC', planId: 'starter' as const }
  const save = async () => { throw new Error('must not be reached for invalid input') }
  const bad = await runTool(ctx, 'delete_pins', '{}', save)
  assert.equal(bad.kind, 'result')
  assert.match(bad.text, /error/)
  const junk = await runTool(ctx, 'schedule_pins', '{not json', save)
  assert.match(junk.text, /not valid JSON/)
  const unknown = await runTool(ctx, 'drop_database', '{}', save)
  assert.match(unknown.text, /Unknown tool/)
  const ui = await runTool(ctx, 'open_page', '{"page":"calendar"}', save)
  assert.equal(ui.kind, 'ui')
  const badPage = await runTool(ctx, 'open_page', '{"page":"https://evil.example"}', save)
  assert.equal(badPage.kind, 'result')
})
