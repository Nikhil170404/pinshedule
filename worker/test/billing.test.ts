import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  adoption, changeKind, fallbackExpiry, noteOf, paymentStatusAfterRefund, refundOutcome, startAtFor, statusForGrant, verdictFor,
} from '../src/lib/billing-logic'

const NOW = Date.parse('2026-10-15T12:00:00Z')
const sec = (ms: number) => Math.floor(ms / 1000)
const sub = (o: Record<string, unknown>) => ({ id: 'sub_1', plan_id: 'plan_1', status: 'active', ...o })

test('plan changes: upgrade, downgrade and same', () => {
  assert.equal(changeKind('starter', 'pro'), 'upgrade')
  assert.equal(changeKind('growth', 'starter'), 'downgrade')
  assert.equal(changeKind('pro', 'pro'), 'same')
})

test('verdict: active grants, failing payment keeps access but flags it', () => {
  assert.deepEqual(verdictFor(sub({ status: 'active' }), NOW), { kind: 'grant', status: 'active' })
  assert.deepEqual(verdictFor(sub({ status: 'pending' }), NOW), { kind: 'grant', status: 'payment_failed' })
  assert.deepEqual(verdictFor(sub({ status: 'halted' }), NOW), { kind: 'grant', status: 'payment_failed' })
})

test('verdict: authenticated starts now unless its start is in the future; created never grants', () => {
  assert.deepEqual(verdictFor(sub({ status: 'authenticated' }), NOW), { kind: 'grant', status: 'active' })
  assert.deepEqual(verdictFor(sub({ status: 'authenticated', start_at: sec(NOW) }), NOW), { kind: 'grant', status: 'active' })
  assert.deepEqual(verdictFor(sub({ status: 'authenticated', start_at: sec(NOW + 10 * 86_400_000) }), NOW), { kind: 'wait' })
  assert.deepEqual(verdictFor(sub({ status: 'created' }), NOW), { kind: 'wait' })
})

test('verdict: cancelled, completed and expired end at ended_at, falling back to current_end', () => {
  const end = sec(NOW + 5 * 86_400_000)
  assert.deepEqual(verdictFor(sub({ status: 'cancelled', current_end: end }), NOW), { kind: 'ending', endsAt: end * 1000 })
  assert.deepEqual(verdictFor(sub({ status: 'completed', ended_at: sec(NOW - 1000), current_end: end }), NOW), { kind: 'ending', endsAt: sec(NOW - 1000) * 1000 })
  assert.deepEqual(verdictFor(sub({ status: 'expired' }), NOW), { kind: 'ending', endsAt: null })
})

test('adoption: first purchase, same subscription and replacing an ending or failing one apply', () => {
  const base = { plan: 'pro' as const, plan_status: 'active', razorpay_subscription_id: 'sub_old', paidAndCurrent: true }
  assert.equal(adoption({ ...base, razorpay_subscription_id: null }, 'sub_new'), 'apply')
  assert.equal(adoption(base, 'sub_old'), 'apply')
  assert.equal(adoption({ ...base, plan_status: 'cancelling' }, 'sub_new'), 'apply')
  assert.equal(adoption({ ...base, plan_status: 'payment_failed' }, 'sub_new'), 'apply')
  assert.equal(adoption({ ...base, paidAndCurrent: false }, 'sub_new'), 'apply')
})

test('adoption: a second checkout while a healthy subscription exists is a duplicate', () => {
  assert.equal(adoption({ plan: 'pro', plan_status: 'active', razorpay_subscription_id: 'sub_old', paidAndCurrent: true }, 'sub_new'), 'duplicate')
})

test('a scheduled cancellation survives later syncs; a successful charge clears a payment failure', () => {
  assert.equal(statusForGrant('cancelling', true, 'active'), 'cancelling')
  assert.equal(statusForGrant('payment_failed', true, 'active'), 'active')
  assert.equal(statusForGrant('cancelling', false, 'active'), 'active') // a different (replacement) subscription
  assert.equal(statusForGrant('active', true, 'payment_failed'), 'payment_failed')
})

test('refunds: none, partial and full are told apart, and the ledger status follows', () => {
  assert.equal(refundOutcome(900, 0), 'none')
  assert.equal(refundOutcome(900, 300), 'partial')
  assert.equal(refundOutcome(900, 900), 'full')
  assert.equal(paymentStatusAfterRefund(900, 0), 'captured')
  assert.equal(paymentStatusAfterRefund(900, 300), 'partially_refunded')
  assert.equal(paymentStatusAfterRefund(900, 900), 'refunded')
})

test('start_at is only used when the period end is far enough ahead', () => {
  assert.equal(startAtFor(null, NOW), undefined)
  assert.equal(startAtFor(new Date(NOW + 60_000).toISOString(), NOW), undefined)
  assert.equal(startAtFor(new Date(NOW + 7 * 86_400_000).toISOString(), NOW), sec(NOW + 7 * 86_400_000))
})

test('fallback expiry is bounded and notes tolerate Razorpay returning []', () => {
  assert.ok(Date.parse(fallbackExpiry('monthly', NOW)) - NOW <= 32 * 86_400_000)
  assert.equal(noteOf({ notes: [] }, 'user_id'), undefined)
  assert.equal(noteOf({ notes: { user_id: 'u1' } }, 'user_id'), 'u1')
})
