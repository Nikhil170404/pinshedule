import Razorpay from 'razorpay'
import { effectivePlan, PLANS, type BillingCycle, type Plan } from '@shared/plans'
import { env } from '../env'
import { db } from './clients'
import { invalidateProfile } from './plan'
import { errMsg, log } from './log'
import { adoption, changeKind, fallbackExpiry, MIN_CHARGE_MINOR, paymentStatusAfterRefund, prorateUpgrade, refundOutcome, splitTax, statusForGrant, verdictFor, type RzpSub } from './billing-logic'

/**
 * Subscription lifecycle. One rule runs through all of it: Razorpay is the source of truth.
 * Webhooks, the checkout callback and the expiry job only say "look at this subscription again";
 * syncSubscription() fetches its real state and applies it, so late, duplicated or out-of-order events
 * can never move a customer to a stale plan.
 */
export const rzp = env.razorpayKeyId ? new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret }) : null

export function planFromRazorpayId(rzpPlanId: string): { plan: Exclude<Plan, 'free_trial'>; cycle: BillingCycle } | null {
  for (const [k, v] of Object.entries(env.razorpayPlans)) {
    if (v && v === rzpPlanId) {
      const [plan, cycle] = k.split('_')
      return { plan: plan as Exclude<Plan, 'free_trial'>, cycle: cycle as BillingCycle }
    }
  }
  return null
}

export interface BillingRow {
  plan: Plan
  plan_status: string
  billing_cycle: BillingCycle | null
  plan_expires_at: string | null
  razorpay_subscription_id: string | null
  pending_subscription_id: string | null
}

export async function loadBilling(userId: string): Promise<BillingRow | null> {
  const { data } = await db.from('user_profiles')
    .select('plan, plan_status, billing_cycle, plan_expires_at, razorpay_subscription_id, pending_subscription_id')
    .eq('id', userId).maybeSingle()
  return (data as BillingRow | null) ?? null
}

/** Cancel on Razorpay, ignoring "already cancelled / not cancellable" errors. Returns whether it went through. */
export async function cancelQuietly(subId: string, atCycleEnd: boolean): Promise<boolean> {
  if (!rzp) return false
  try {
    await rzp.subscriptions.cancel(subId, atCycleEnd)
    return true
  } catch (e) {
    log.warn('razorpay cancel skipped', { subId, atCycleEnd, error: errMsg(e) })
    return false
  }
}

export const FREE_PATCH = { plan: 'free_trial', plan_status: 'active', plan_expires_at: null, razorpay_subscription_id: null, billing_cycle: 'monthly' } as const

export type SyncResult = 'applied' | 'pending' | 'ending' | 'duplicate' | 'ignored'

export async function syncSubscription(userId: string, subId: string, known?: RzpSub): Promise<SyncResult> {
  if (!rzp) throw new Error('Payments are not configured')
  const sub = known ?? ((await rzp.subscriptions.fetch(subId)) as unknown as RzpSub)
  const prof = await loadBilling(userId)
  if (!prof) return 'ignored'
  const isCurrent = prof.razorpay_subscription_id === sub.id
  const isPending = prof.pending_subscription_id === sub.id
  const verdict = verdictFor(sub)

  if (verdict.kind === 'wait') {
    // A replacement the customer has just authorised (new card, or a plan after cancelling). Stop the old subscription
    // renewing so the two never bill for the same period; it runs to the end of what was paid.
    if (isPending && sub.status === 'authenticated' && prof.razorpay_subscription_id && prof.plan_status === 'active') {
      if (await cancelQuietly(prof.razorpay_subscription_id, true)) {
        await db.from('user_profiles').update({ plan_status: 'cancelling' }).eq('id', userId)
        await invalidateProfile(userId)
      }
    }
    return 'pending'
  }

  if (verdict.kind === 'ending') {
    if (!isCurrent) return 'ignored' // an old subscription that was already replaced
    if (verdict.endsAt && verdict.endsAt > Date.now()) {
      await db.from('user_profiles').update({ plan_status: 'cancelling', plan_expires_at: new Date(verdict.endsAt).toISOString() }).eq('id', userId)
    } else {
      await db.from('user_profiles').update(FREE_PATCH).eq('id', userId)
    }
    await invalidateProfile(userId)
    return 'ending'
  }

  const mapped = planFromRazorpayId(sub.plan_id)
  if (!mapped) throw new Error(`Unknown Razorpay plan ${sub.plan_id}`)

  const decision = isPending ? 'apply' : adoption({
    plan: prof.plan, plan_status: prof.plan_status, razorpay_subscription_id: prof.razorpay_subscription_id,
    paidAndCurrent: effectivePlan(prof.plan, prof.plan_expires_at) !== 'free_trial',
  }, sub.id)
  if (decision === 'duplicate') {
    // Two checkouts completed (two tabs, a double click). Keep the first; stop the second from billing.
    log.warn('duplicate subscription cancelled', { userId, kept: prof.razorpay_subscription_id, cancelled: sub.id })
    await cancelQuietly(sub.id, false)
    return 'duplicate'
  }

  const previous = prof.razorpay_subscription_id && !isCurrent ? prof.razorpay_subscription_id : null
  const stillPaid = isCurrent && prof.plan_expires_at && new Date(prof.plan_expires_at).getTime() > Date.now()
  const expires = sub.current_end ? new Date(sub.current_end * 1000).toISOString() : stillPaid ? prof.plan_expires_at! : fallbackExpiry(mapped.cycle)
  const plan: Plan = mapped.plan
  const patch: Record<string, unknown> = {
    plan,
    billing_cycle: mapped.cycle,
    plan_status: statusForGrant(prof.plan_status, isCurrent, verdict.status),
    plan_expires_at: expires,
    razorpay_subscription_id: sub.id,
  }
  if (sub.customer_id) patch.razorpay_customer_id = sub.customer_id
  if (!isCurrent || prof.plan !== plan) patch.plan_started_at = new Date().toISOString()
  if (isPending) patch.pending_subscription_id = null
  await db.from('user_profiles').update(patch).eq('id', userId)

  // The subscription this one replaced must not keep billing. A failing one is dead already: cancel it now.
  if (previous) await cancelQuietly(previous, prof.plan_status !== 'payment_failed')
  await invalidateProfile(userId)
  return 'applied'
}

/** Cancel the user's subscription: at the end of the paid period when it is active, immediately otherwise. */
export async function cancelSubscription(userId: string): Promise<boolean> {
  if (!rzp) return false
  const prof = await loadBilling(userId)
  if (prof?.pending_subscription_id) {
    await cancelQuietly(prof.pending_subscription_id, false)
    await db.from('user_profiles').update({ pending_subscription_id: null }).eq('id', userId)
  }
  const id = prof?.razorpay_subscription_id
  if (!id) return false
  if (prof.plan_status === 'cancelling') return true // already scheduled; cancelling twice is a no-op

  const sub = (await rzp.subscriptions.fetch(id)) as unknown as RzpSub
  if (sub.status === 'active') {
    await rzp.subscriptions.cancel(id, true)
    await db.from('user_profiles').update({
      plan_status: 'cancelling',
      ...(sub.current_end ? { plan_expires_at: new Date(sub.current_end * 1000).toISOString() } : {}),
    }).eq('id', userId)
    await invalidateProfile(userId)
  } else {
    if (!['cancelled', 'completed', 'expired'].includes(sub.status)) await rzp.subscriptions.cancel(id, false)
    await syncSubscription(userId, id)
  }
  return true
}

/** Stop billing now and return the account to Free (used after a full refund). */
export async function endSubscriptionNow(userId: string): Promise<void> {
  const prof = await loadBilling(userId)
  if (prof?.razorpay_subscription_id) await cancelQuietly(prof.razorpay_subscription_id, false)
  if (prof?.pending_subscription_id) await cancelQuietly(prof.pending_subscription_id, false)
  await db.from('user_profiles').update({ ...FREE_PATCH, pending_subscription_id: null }).eq('id', userId)
  await invalidateProfile(userId)
}

// ─── Payment ledger and refunds ─────────────────────────────────────────────

export interface PaymentEntity { id: string; amount: number; currency?: string; method?: string; email?: string; created_at?: number; amount_refunded?: number; order_id?: string; status?: string }
export interface RefundEntity { id: string; payment_id: string; amount: number }

/**
 * Record a payment and, with it, its invoice. Insert-only: replaying a charged event must never overwrite refund data, and
 * the invoice number is only drawn from the sequence for a payment we have not seen (so numbers are not burnt on replays).
 */
export interface PaymentExtra { kind?: 'subscription' | 'plan_change'; description?: string }

export async function recordPayment(userId: string, sub: RzpSub, p: PaymentEntity, extra: PaymentExtra = {}): Promise<void> {
  const { data: existing } = await db.from('billing_payments').select('payment_id').eq('payment_id', p.id).maybeSingle()
  if (existing) return
  const refunded = p.amount_refunded ?? 0
  const { subtotal, tax } = splitTax(p.amount, env.invoice.taxRate)
  const iso = (t?: number | null) => (t ? new Date(t * 1000).toISOString() : null)
  const { error } = await db.from('billing_payments').upsert({
    payment_id: p.id,
    user_id: userId,
    subscription_id: sub.id,
    amount: p.amount,
    currency: p.currency ?? 'USD',
    status: paymentStatusAfterRefund(p.amount, refunded),
    method: p.method ?? null,
    refunded_amount: refunded,
    plan: planFromRazorpayId(sub.plan_id)?.plan ?? null,
    paid_at: p.created_at ? new Date(p.created_at * 1000).toISOString() : new Date().toISOString(),
    period_start: iso(sub.current_start),
    period_end: iso(sub.current_end),
    kind: extra.kind ?? 'subscription',
    description: extra.description ?? null,
    subtotal,
    tax_amount: tax,
    tax_rate: env.invoice.taxRate,
    tax_name: tax > 0 ? env.invoice.taxName : null,
    payer_email: p.email?.slice(0, 200) ?? null,
  }, { onConflict: 'payment_id', ignoreDuplicates: true })
  if (error) throw new Error(`ledger write failed: ${error.message}`)
}

/**
 * A refund was processed. Update the ledger; when the latest payment of the current subscription is refunded in full
 * the customer is no longer paying for the period, so billing stops and the account returns to Free.
 */
export async function applyRefund(refund: RefundEntity, payment?: PaymentEntity): Promise<void> {
  const { data: row } = await db.from('billing_payments')
    .select('user_id, subscription_id, amount, refunded_amount').eq('payment_id', refund.payment_id).maybeSingle()
  if (!row) { log.warn('refund for a payment not in the ledger', { payment: refund.payment_id, refund: refund.id }); return }

  const total = Math.max(row.refunded_amount as number, payment?.amount_refunded ?? Math.min(row.amount as number, (row.refunded_amount as number) + refund.amount))
  await db.from('billing_payments').update({ refunded_amount: total, status: paymentStatusAfterRefund(row.amount as number, total) }).eq('payment_id', refund.payment_id)
  if (refundOutcome(row.amount as number, total) !== 'full') return

  const userId = row.user_id as string
  const prof = await loadBilling(userId)
  if (!prof?.razorpay_subscription_id || prof.razorpay_subscription_id !== row.subscription_id) return
  const { data: latest } = await db.from('billing_payments').select('payment_id')
    .eq('user_id', userId).eq('subscription_id', row.subscription_id).order('paid_at', { ascending: false }).limit(1)
  if (latest?.[0]?.payment_id === refund.payment_id) {
    log.info('full refund of the latest payment: ending subscription', { userId, payment: refund.payment_id })
    await endSubscriptionNow(userId)
  }
}

/** Resolve which user a subscription belongs to: signed notes first, then our own records. */
export async function userForSubscription(sub: RzpSub): Promise<string | null> {
  const fromNotes = sub.notes && !Array.isArray(sub.notes) ? sub.notes.user_id : undefined
  if (typeof fromNotes === 'string' && fromNotes) return fromNotes
  const { data } = await db.from('user_profiles').select('id')
    .or(`razorpay_subscription_id.eq.${sub.id},pending_subscription_id.eq.${sub.id}`).limit(1).maybeSingle()
  return (data?.id as string | undefined) ?? null
}

// ─── Plan changes ───────────────────────────────────────────────────────────
// Upgrades use Razorpay's own immediate plan update: it prorates, raises an invoice for the difference and charges the saved
// payment method, and leaves the plan unchanged if that charge fails. Downgrades are scheduled for the end of the paid period.

export class BillingError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 | 502 = 400) { super(message) }
}

export interface UpgradeQuote {
  from: Plan
  to: Plan
  currency: 'USD'
  /** Estimated minor units Razorpay will charge now. */
  charge: number
  /** False when the difference is too small for Razorpay to charge now, so the change waits for the renewal. */
  immediate: boolean
  daysLeft: number
  periodEnd: number
  newMonthly: number
}

export async function quoteUpgrade(userId: string, to: Plan): Promise<UpgradeQuote> {
  if (!rzp) throw new BillingError('Payments are not configured yet.', 502)
  const prof = await loadBilling(userId)
  if (!prof?.razorpay_subscription_id || effectivePlan(prof.plan, prof.plan_expires_at) === 'free_trial' || prof.plan_status !== 'active') throw new BillingError('You do not have an active subscription to upgrade.', 409)
  if (changeKind(prof.plan, to) !== 'upgrade') throw new BillingError('That plan is not an upgrade.')
  const sub = (await rzp.subscriptions.fetch(prof.razorpay_subscription_id)) as unknown as RzpSub
  // Razorpay can only update a subscription that is authenticated or active.
  if (!['active', 'authenticated'].includes(sub.status) || !sub.current_end) throw new BillingError('Your subscription cannot be changed right now. If a payment failed, update your payment method first.', 409)
  const periodEnd = sub.current_end * 1000
  const periodStart = (sub.current_start ?? sub.current_end - 30 * 86_400) * 1000
  const pr = prorateUpgrade({ oldMonthly: PLANS[prof.plan].price_monthly_usd * 100, newMonthly: PLANS[to].price_monthly_usd * 100, periodStart, periodEnd })
  return { from: prof.plan, to, currency: 'USD', charge: pr.charge, immediate: pr.charge >= MIN_CHARGE_MINOR, daysLeft: pr.daysLeft, periodEnd, newMonthly: PLANS[to].price_monthly_usd * 100 }
}
