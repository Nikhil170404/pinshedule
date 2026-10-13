import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PLANS, PAID_PLANS, type Plan, type PlanDetails } from '../../shared/plans'

// The agreed entitlements. Every plan must match exactly: no plan may give more, and none may give less.
// Changing a number here is a pricing decision and must be made on purpose.
type Entitlements = Pick<PlanDetails, 'price_monthly_usd' | 'price_yearly_usd' | 'pins_per_month' | 'ai_generations' | 'ai_images' | 'website_imports' | 'accounts' | 'bulk_upload' | 'smart_scheduler' | 'sitemap_import' | 'analytics_days'>

const EXPECTED: Record<Plan, Entitlements> = {
  free_trial: { price_monthly_usd: 0, price_yearly_usd: 0, pins_per_month: 50, ai_generations: 20, ai_images: 0, website_imports: 10, accounts: 1, bulk_upload: false, smart_scheduler: false, sitemap_import: false, analytics_days: 7 },
  starter: { price_monthly_usd: 9, price_yearly_usd: 90, pins_per_month: 1000, ai_generations: 500, ai_images: 20, website_imports: 200, accounts: 1, bulk_upload: true, smart_scheduler: true, sitemap_import: false, analytics_days: 30 },
  pro: { price_monthly_usd: 19, price_yearly_usd: 190, pins_per_month: 5000, ai_generations: 2000, ai_images: 75, website_imports: 1000, accounts: 3, bulk_upload: true, smart_scheduler: true, sitemap_import: true, analytics_days: 90 },
  growth: { price_monthly_usd: 39, price_yearly_usd: 390, pins_per_month: 15000, ai_generations: 6000, ai_images: 200, website_imports: 4000, accounts: 10, bulk_upload: true, smart_scheduler: true, sitemap_import: true, analytics_days: 90 },
}

for (const id of Object.keys(EXPECTED) as Plan[]) {
  test(`${id}: gives exactly the agreed entitlements, no more and no less`, () => {
    const p = PLANS[id]
    for (const [key, want] of Object.entries(EXPECTED[id])) {
      assert.equal(p[key as keyof Entitlements], want, `${id}.${key}`)
    }
  })
}

test('the plan table has exactly the four plans, with the right paid set', () => {
  assert.deepEqual(Object.keys(PLANS).sort(), ['free_trial', 'growth', 'pro', 'starter'])
  assert.deepEqual([...PAID_PLANS].sort(), ['growth', 'pro', 'starter'])
})

test('every plan declares only the fields this test covers or knows to be copy', () => {
  const copy = new Set(['id', 'name', 'tagline', 'support'])
  for (const [id, p] of Object.entries(PLANS)) {
    for (const k of Object.keys(p)) {
      assert.ok(k in EXPECTED.starter || copy.has(k), `${id} has an unchecked field "${k}": add it to EXPECTED so it cannot drift`)
    }
  }
})

test('yearly price is ten times monthly (two months free)', () => {
  for (const p of Object.values(PLANS)) assert.equal(p.price_yearly_usd, p.price_monthly_usd * 10)
})

test('every allowance grows or stays equal from Free up to Business', () => {
  const order: Plan[] = ['free_trial', 'starter', 'pro', 'growth']
  const numeric = ['price_monthly_usd', 'pins_per_month', 'ai_generations', 'ai_images', 'website_imports', 'accounts', 'analytics_days'] as const
  for (let i = 1; i < order.length; i++) for (const k of numeric) assert.ok(PLANS[order[i]][k] >= PLANS[order[i - 1]][k], `${order[i]}.${k} below ${order[i - 1]}`)
})
