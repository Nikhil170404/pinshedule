import type { BillingCycle, Plan } from '@shared/plans'

// Pure decisions for the subscription lifecycle. No I/O here so every rule can be unit-tested.

export const RANK: Record<Plan, number> = { free_trial: 0, starter: 1, pro: 2, growth: 3 }

export type PlanChange = 'same' | 'upgrade' | 'downgrade'
export const changeKind = (from: Plan, to: Plan): PlanChange => (RANK[to] === RANK[from] ? 'same' : RANK[to] > RANK[from] ? 'upgrade' : 'downgrade')

/** Razorpay subscription fields the lifecycle cares about. */
export interface RzpSub {
  id: string
  plan_id: string
  status: string
  current_start?: number | null
  current_end?: number | null
  ended_at?: number | null
  start_at?: number | null
  customer_id?: string | null
  notes?: Record<string, string> | unknown[] | null
}

/**
 * What a Razorpay subscription state means for a customer's access.
 *  grant   - they have paid; give (or keep) the plan. `payment_failed` while Razorpay retries or has halted it.
 *  ending  - cancelled/completed/expired; keep access until the paid period ends.
 *  wait    - authorised but not started yet (or never paid); change nothing.
 */
export type Verdict = { kind: 'grant'; status: 'active' | 'payment_failed' } | { kind: 'ending'; endsAt: number | null } | { kind: 'wait' }

export function verdictFor(sub: RzpSub, now = Date.now()): Verdict {
  switch (sub.status) {
    case 'active':
      return { kind: 'grant', status: 'active' }
    case 'pending':
    case 'halted':
      return { kind: 'grant', status: 'payment_failed' }
    case 'authenticated': {
      // Authorised with an immediate start: the signed checkout callback proves the first payment, so access
      // starts now. A future start_at (replacement after cancelling, new card) waits for activation.
      const startsLater = sub.start_at != null && sub.start_at * 1000 > now + 60_000
      return startsLater ? { kind: 'wait' } : { kind: 'grant', status: 'active' }
    }
    case 'cancelled':
    case 'completed':
    case 'expired': {
      const end = sub.ended_at ?? sub.current_end ?? null
      return { kind: 'ending', endsAt: end ? end * 1000 : null }
    }
    default:
      return { kind: 'wait' }
  }
}

/** Expiry to store when Razorpay has not told us the period end yet: one cycle ahead, corrected by the next charged event. */
export function fallbackExpiry(cycle: BillingCycle, now = Date.now()): string {
  return new Date(now + (cycle === 'yearly' ? 366 : 32) * 86_400_000).toISOString()
}

export interface ProfileBilling {
  plan: Plan
  plan_status: string
  razorpay_subscription_id: string | null
  /** True when the stored plan has not lapsed (see effectivePlan). */
  paidAndCurrent: boolean
}

/**
 * Should a paid subscription become the user's subscription?
 *  apply     - yes (first purchase, same subscription, or it replaces one that is ending or failing)
 *  duplicate - the user already has a healthy different subscription: a second checkout. Cancel the new one.
 */
export function adoption(profile: ProfileBilling, subId: string): 'apply' | 'duplicate' {
  if (!profile.razorpay_subscription_id || profile.razorpay_subscription_id === subId) return 'apply'
  if (!profile.paidAndCurrent) return 'apply'
  if (profile.plan_status === 'cancelling' || profile.plan_status === 'payment_failed') return 'apply'
  return 'duplicate'
}

/**
 * Plan status to store when Razorpay reports the current subscription active. A cancellation we scheduled
 * ('cancelling') must survive later syncs, because Razorpay keeps the subscription `active` until the period ends.
 */
export function statusForGrant(previous: string, isCurrent: boolean, granted: 'active' | 'payment_failed'): 'active' | 'cancelling' | 'payment_failed' {
  if (granted === 'payment_failed') return 'payment_failed'
  return isCurrent && previous === 'cancelling' ? 'cancelling' : 'active'
}

export type RefundOutcome = 'none' | 'partial' | 'full'
export function refundOutcome(paymentAmount: number, totalRefunded: number): RefundOutcome {
  if (totalRefunded <= 0) return 'none'
  return totalRefunded >= paymentAmount ? 'full' : 'partial'
}

/** Ledger status for a payment once refunds are applied. */
export function paymentStatusAfterRefund(paymentAmount: number, totalRefunded: number): 'captured' | 'partially_refunded' | 'refunded' {
  const o = refundOutcome(paymentAmount, totalRefunded)
  return o === 'full' ? 'refunded' : o === 'partial' ? 'partially_refunded' : 'captured'
}

/** A start_at far enough in the future to be valid, or undefined to start immediately. */
export function startAtFor(periodEndIso: string | null | undefined, now = Date.now()): number | undefined {
  if (!periodEndIso) return undefined
  const end = new Date(periodEndIso).getTime()
  return Number.isFinite(end) && end > now + 3_600_000 ? Math.floor(end / 1000) : undefined
}

/** Razorpay returns [] instead of {} for empty notes. */
export function noteOf(sub: Pick<RzpSub, 'notes'>, key: string): string | undefined {
  const n = sub.notes
  return n && !Array.isArray(n) && typeof n[key] === 'string' ? n[key] : undefined
}

/** Split a tax-inclusive total (minor units) into subtotal and tax. A rate of 0 means no tax line. */
export function splitTax(total: number, ratePercent: number): { subtotal: number; tax: number } {
  if (!(ratePercent > 0)) return { subtotal: total, tax: 0 }
  const tax = Math.round(total - total / (1 + ratePercent / 100))
  return { subtotal: total - tax, tax }
}

/** "$9.00" for USD, "INR 900.00" otherwise (the PDF fonts have no currency symbols beyond $). Amounts are minor units. */
export function formatMoney(minor: number, currency: string): string {
  const abs = (Math.abs(minor) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const body = currency.toUpperCase() === 'USD' ? `$${abs}` : `${currency.toUpperCase()} ${abs}`
  return minor < 0 ? `-${body}` : body
}
