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

test('plan prices: yearly is exactly 2 months free, and the displayed monthly equivalent is right', async () => {
  const { PLANS, PAID_PLANS, monthsFree, monthlyEquivalent } = await import('../../shared/plans')
  for (const id of PAID_PLANS) assert.equal(monthsFree(PLANS[id]), 2, `${id} yearly price`)
  assert.equal(monthsFree(PLANS.free_trial), 0)
  assert.equal(monthlyEquivalent(PLANS.starter, 'yearly'), 7.5)
  assert.equal(monthlyEquivalent(PLANS.pro, 'yearly'), 15.83)
  assert.equal(monthlyEquivalent(PLANS.growth, 'yearly'), 32.5)
  assert.equal(monthlyEquivalent(PLANS.starter, 'monthly'), 9)
})

test('plans only ever get better as you go up: limits never drop and features never disappear', async () => {
  const { PLANS } = await import('../../shared/plans')
  const order = ['free_trial', 'starter', 'pro', 'growth'] as const
  for (let i = 1; i < order.length; i++) {
    const lo = PLANS[order[i - 1]], hi = PLANS[order[i]]
    for (const k of ['pins_per_month', 'website_imports', 'ai_generations', 'batch_max', 'analytics_days', 'price_monthly_usd'] as const) assert.ok(hi[k] >= lo[k], `${order[i]}.${k}`)
    for (const k of ['bulk_upload', 'sitemap_import', 'smart_scheduler'] as const) assert.ok(!lo[k] || hi[k], `${order[i]}.${k}`)
  }
  assert.equal(PLANS.free_trial.bulk_upload, false)
  assert.equal(PLANS.free_trial.batch_max, 10)
  assert.equal(PLANS.starter.batch_max, 200)
})

test('Razorpay plan check: catches wrong amount, currency, period or interval', async () => {
  const { razorpayPlanProblems } = await import('../src/lib/razorpay-plan')
  const { PLANS } = await import('../../shared/plans')
  const good = { period: 'monthly', interval: 1, item: { amount: 900, currency: 'USD' } }
  assert.deepEqual(razorpayPlanProblems(good, PLANS.starter, 'monthly'), [])
  assert.deepEqual(razorpayPlanProblems({ period: 'yearly', interval: 1, item: { amount: 19000, currency: 'USD' } }, PLANS.pro, 'yearly'), [])
  assert.equal(razorpayPlanProblems({ ...good, item: { amount: 90, currency: 'USD' } }, PLANS.starter, 'monthly').length, 1) // $0.90 typo
  assert.equal(razorpayPlanProblems({ ...good, item: { amount: 900, currency: 'INR' } }, PLANS.starter, 'monthly').length, 1)
  assert.equal(razorpayPlanProblems(good, PLANS.starter, 'yearly').length >= 2, true) // monthly plan used for yearly
  assert.equal(razorpayPlanProblems({ ...good, interval: 12 }, PLANS.starter, 'monthly').length, 1)
  assert.ok(razorpayPlanProblems({}, PLANS.pro, 'monthly').length >= 3) // missing info is never "ok"
})

// ─── growth features ────────────────────────────────────────────────────────
import { isUpgrade, nextPlan, PLAN_ORDER } from '../../shared/plans'

test('plan switching: upgrades can start now, everything else waits for renewal', () => {
  const m = (plan: 'free_trial' | 'starter' | 'pro' | 'growth', cycle: 'monthly' | 'yearly') => ({ plan, cycle })
  assert.equal(isUpgrade(m('starter', 'monthly'), m('pro', 'monthly')), true)
  assert.equal(isUpgrade(m('pro', 'yearly'), m('growth', 'monthly')), true) // a higher plan always counts as an upgrade
  assert.equal(isUpgrade(m('pro', 'monthly'), m('starter', 'monthly')), false)
  assert.equal(isUpgrade(m('pro', 'monthly'), m('pro', 'yearly')), true)
  assert.equal(isUpgrade(m('pro', 'yearly'), m('pro', 'monthly')), false)
  assert.equal(nextPlan('free_trial'), 'starter')
  assert.equal(nextPlan('growth'), null)
  assert.deepEqual(PLAN_ORDER, ['free_trial', 'starter', 'pro', 'growth'])
})

test('plan features never shrink as the plan goes up', () => {
  for (let i = 1; i < PLAN_ORDER.length; i++) {
    const lo = PLANS[PLAN_ORDER[i - 1]], hi = PLANS[PLAN_ORDER[i]]
    assert.ok(hi.accounts >= lo.accounts && hi.automations >= lo.automations && hi.analytics_days >= lo.analytics_days && hi.batch_max >= lo.batch_max)
  }
  assert.equal(PLANS.free_trial.automations, 0)
  assert.ok(PLANS.growth.accounts > 1)
})

test('evergreen ranking: best saves first, otherwise oldest first, ties by impressions then age', async () => {
  const { rankEvergreen } = await import('../src/lib/automations')
  const pins = [
    { id: 'a', published_at: '2026-01-03T00:00:00Z' },
    { id: 'b', published_at: '2026-01-01T00:00:00Z' },
    { id: 'c', published_at: '2026-01-02T00:00:00Z' },
  ]
  const stats = new Map([['a', { saves: 50, impressions: 1000 }], ['c', { saves: 50, impressions: 4000 }]])
  assert.deepEqual(rankEvergreen(pins, stats, true).map((p) => p.id), ['c', 'a', 'b'])
  assert.deepEqual(rankEvergreen(pins, stats, false).map((p) => p.id), ['b', 'c', 'a'])
})

test('automation configs reject out-of-range values', async () => {
  const { sitemapConfig, evergreenConfig } = await import('../src/lib/automations')
  assert.equal(sitemapConfig.safeParse({ sitemap_url: 'https://x.com/sitemap.xml', board_id: '1', per_day: 9 }).success, false)
  assert.equal(sitemapConfig.safeParse({ sitemap_url: 'not a url', board_id: '1' }).success, false)
  assert.equal(evergreenConfig.safeParse({ min_age_days: 5 }).success, false)
  assert.deepEqual(evergreenConfig.parse({}), { min_age_days: 60, per_day: 1, best_first: true })
})

test('billing: how a purchase starts when a subscription already exists', async () => {
  const { decideStartMode } = await import('../src/lib/switch')
  const m = (plan: 'free_trial' | 'starter' | 'pro' | 'growth', cycle: 'monthly' | 'yearly') => ({ plan, cycle })
  assert.equal(decideStartMode(false, m('free_trial', 'monthly'), m('pro', 'monthly')), 'now')
  assert.equal(decideStartMode(true, m('starter', 'monthly'), m('pro', 'monthly')), 'now') // upgrade defaults to now
  assert.equal(decideStartMode(true, m('starter', 'monthly'), m('pro', 'monthly'), 'renewal'), 'renewal') // ...unless they choose renewal
  assert.equal(decideStartMode(true, m('pro', 'monthly'), m('starter', 'monthly'), 'now'), 'renewal') // a downgrade can never start early
  assert.equal(decideStartMode(true, m('pro', 'yearly'), m('pro', 'monthly'), 'now'), 'renewal')
})

test('billing: stale subscription events never bring an old plan back', async () => {
  const { isStaleEvent, isSwitchPending } = await import('../src/lib/switch')
  assert.equal(isStaleEvent(null, { id: 's1' }), false) // first purchase
  assert.equal(isStaleEvent({ razorpay_subscription_id: 's1' }, { id: 's1' }), false) // renewal of the current one
  assert.equal(isStaleEvent({ razorpay_subscription_id: 's2' }, { id: 's1' }), true) // late event from a replaced subscription
  assert.equal(isStaleEvent({ razorpay_subscription_id: 's1' }, { id: 's2', replaces: 's1' }), false) // the replacement itself
  assert.equal(isStaleEvent({ razorpay_subscription_id: 's1', next_subscription_id: 's3' }, { id: 's3' }), false) // the scheduled one starting
  const soon = new Date(Date.now() + 86_400_000).toISOString()
  assert.equal(isSwitchPending({ next_subscription_id: 's3', next_plan_at: soon }), true)
  assert.equal(isSwitchPending({ next_subscription_id: 's3', next_plan_at: new Date(Date.now() + 30 * 86_400_000).toISOString() }), false)
  assert.equal(isSwitchPending({ next_subscription_id: null, next_plan_at: soon }), false)
})
