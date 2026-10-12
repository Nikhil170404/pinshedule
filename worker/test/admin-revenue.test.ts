import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PLANS } from '@shared/plans'

// The admin route imports the database client, which needs env vars to exist before it loads.
for (const k of ['APP_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'ENCRYPTION_SECRET', 'PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET']) process.env[k] ??= 'http://test.invalid'

test('MRR counts active and cancelling subscribers, flags failed payments separately, ignores free users', async () => {
  const { revenue } = await import('../src/routes/admin')
  const r = revenue([
    { plan: 'free_trial', status: 'active', cycle: 'monthly', n: 1000 },
    { plan: 'starter', status: 'active', cycle: 'monthly', n: 10 },
    { plan: 'pro', status: 'cancelling', cycle: 'monthly', n: 2 },
    { plan: 'pro', status: 'payment_failed', cycle: 'monthly', n: 3 },
  ], 1015)
  const expected = 10 * PLANS.starter.price_monthly_usd + 2 * PLANS.pro.price_monthly_usd
  assert.equal(r.mrr, expected)
  assert.equal(r.arr, expected * 12)
  assert.equal(r.paying_users, 12)
  assert.equal(r.at_risk.users, 3)
  assert.equal(r.at_risk.mrr, 3 * PLANS.pro.price_monthly_usd)
  assert.equal(r.churning.users, 2)
})
