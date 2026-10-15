import { Hono } from 'hono'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { effectivePlan, isPaidPlan, YEARLY_BILLING, type BillingCycle, type Plan } from '@shared/plans'
import { env } from '../env'
import { limit, type AppEnv } from '../lib/auth'
import { db, redis } from '../lib/clients'
import { errMsg, log } from '../lib/log'
import { changeKind, noteOf, startAtFor, type RzpSub } from '../lib/billing-logic'
import { planFromRazorpayId } from '../lib/subscriptions'
import { billingDetailsSchema, getBillingDetails, getInvoice, saveBillingDetails } from '../lib/invoices'
import { invoiceFilename, renderInvoicePdf, type DocKind } from '../lib/invoice-pdf'
import {
  applyRefund, BillingError, cancelSubscription, completeUpgrade, loadBilling, quoteUpgrade, recordPayment, rzp, startUpgrade, syncSubscription, userForSubscription,
  type BillingRow, type PaymentEntity, type RefundEntity,
} from '../lib/subscriptions'

export { cancelSubscription }

export const billing = new Hono<AppEnv>()
billing.use('*', limit('payment'))

const planIdFor = (plan: string, cycle: BillingCycle) => env.razorpayPlans[`${plan}_${cycle}`]
const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
const isLive = (p: BillingRow | null) => !!p?.razorpay_subscription_id && effectivePlan(p.plan, p.plan_expires_at) !== 'free_trial'

async function createSubscription(userId: string, plan: string, cycle: BillingCycle, rzpPlanId: string, startAt?: number, reason = 'checkout') {
  return rzp!.subscriptions.create({
    plan_id: rzpPlanId,
    total_count: cycle === 'yearly' ? 10 : 120,
    customer_notify: 1,
    ...(startAt ? { start_at: startAt } : {}),
    notes: { user_id: userId, plan, cycle, reason },
  })
}

/**
 * Start or change a subscription.
 *  - Free, or fully ended      -> a new subscription starting now.
 *  - Paid and healthy          -> the existing subscription is changed in place: upgrades apply now (Razorpay prorates),
 *                                 downgrades apply at the end of the period already paid for. Nobody is billed twice.
 *  - Cancelled but time left   -> a new subscription that starts when the paid period ends (no overlap, no gap).
 *  - Payment failing           -> a new subscription now; it replaces the failing one when it activates.
 */
billing.post('/checkout', async (c) => {
  const userId = c.get('userId')
  if (!rzp) return c.json({ error: 'Payments are not configured yet.' }, 503)
  const parsed = z.object({ plan: z.string().refine(isPaidPlan), cycle: z.enum(['monthly', 'yearly']) }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid plan' }, 400)
  const { plan, cycle } = parsed.data
  if (cycle === 'yearly' && !YEARLY_BILLING) return c.json({ error: 'Yearly billing is not available yet. Choose monthly.' }, 400)
  const rzpPlanId = planIdFor(plan, cycle)
  if (!rzpPlanId) return c.json({ error: 'This plan is not available for purchase yet.' }, 503)

  const prof = await loadBilling(userId)
  const live = isLive(prof)

  try {
    if (live && prof!.plan_status === 'active') {
      if (prof!.plan === plan && (prof!.billing_cycle ?? 'monthly') === cycle) return c.json({ error: 'You are already on this plan.' }, 409)
      if (changeKind(prof!.plan, plan as Plan) === 'upgrade') {
        // Pay only the price difference for the days left; the new plan's full price starts at the next renewal.
        const r = await startUpgrade(userId, plan as Plan)
        if ('free' in r) return c.json({ changed: true, effective: 'now', plan })
        return c.json({ upgrade: { order_id: r.order_id, amount: r.amount, currency: r.currency, key_id: env.razorpayKeyId, days_left: r.quote.daysLeft, renews_at: new Date(r.quote.periodEnd).toISOString() } })
      }
      // A downgrade keeps the current plan until the period already paid for ends, then bills the lower price.
      await rzp.subscriptions.update(prof!.razorpay_subscription_id!, { plan_id: rzpPlanId, schedule_change_at: 'cycle_end', customer_notify: 1 })
      return c.json({ changed: true, effective: 'cycle_end', plan, effective_at: prof!.plan_expires_at })
    }

    // New subscription. While a cancelled subscription still has paid time, start the new one when that time ends.
    const startAt = live && prof!.plan_status === 'cancelling' ? startAtFor(prof!.plan_expires_at) : undefined
    const sub = await createSubscription(userId, plan, cycle, rzpPlanId, startAt)
    if (live) await db.from('user_profiles').update({ pending_subscription_id: sub.id }).eq('id', userId)
    return c.json({ subscription_id: sub.id, key_id: env.razorpayKeyId, starts_at: startAt ? new Date(startAt * 1000).toISOString() : null })
  } catch (e) {
    if (e instanceof BillingError) return c.json({ error: e.message }, e.status)
    log.error('billing checkout failed', { userId, plan, error: errMsg(e) })
    return c.json({ error: 'Could not start checkout. Please try again in a moment.' }, 502)
  }
})

/** What a plan change would cost, so the customer can confirm before anything is charged. */
billing.get('/quote', async (c) => {
  const userId = c.get('userId')
  const plan = c.req.query('plan')
  if (!isPaidPlan(plan)) return c.json({ error: 'Invalid plan' }, 400)
  const prof = await loadBilling(userId)
  if (!isLive(prof) || prof!.plan_status !== 'active') return c.json({ kind: 'new' })
  const kind = changeKind(prof!.plan, plan)
  if (kind === 'same') return c.json({ error: 'You are already on this plan.' }, 409)
  if (kind === 'downgrade') return c.json({ kind: 'downgrade', effective_at: prof!.plan_expires_at })
  try {
    const q = await quoteUpgrade(userId, plan)
    return c.json({ kind: 'upgrade', charge: q.charge, free: q.free, currency: q.currency, days_left: q.daysLeft, renews_at: new Date(q.periodEnd).toISOString(), new_monthly: q.newMonthly })
  } catch (e) {
    if (e instanceof BillingError) return c.json({ error: e.message }, e.status)
    log.error('billing quote failed', { userId, error: errMsg(e) })
    return c.json({ error: 'Could not price that change right now. Please try again.' }, 502)
  }
})

/** Called by the browser after the prorated upgrade payment succeeds. The webhook (order.paid) does the same if the tab was closed. */
billing.post('/upgrade/verify', async (c) => {
  const userId = c.get('userId')
  if (!rzp) return c.json({ error: 'Payments are not configured yet.' }, 503)
  const parsed = z.object({ razorpay_payment_id: z.string(), razorpay_order_id: z.string(), razorpay_signature: z.string() }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid payment data' }, 400)
  const p = parsed.data
  const expected = createHmac('sha256', env.razorpayKeySecret).update(`${p.razorpay_order_id}|${p.razorpay_payment_id}`).digest('hex')
  if (!safeEq(expected, p.razorpay_signature)) return c.json({ error: 'Payment signature mismatch' }, 400)
  try {
    const order = (await rzp.orders.fetch(p.razorpay_order_id)) as unknown as { id: string; amount: number; notes?: Record<string, string> }
    if (order.notes?.user_id !== userId) return c.json({ error: 'This payment belongs to another account' }, 403)
    let payment = (await rzp.payments.fetch(p.razorpay_payment_id)) as unknown as PaymentEntity
    if (payment.order_id !== order.id || payment.amount !== order.amount) return c.json({ error: 'Payment does not match this upgrade' }, 400)
    if (payment.status === 'authorized') payment = (await rzp.payments.capture(payment.id, payment.amount, 'USD')) as unknown as PaymentEntity
    if (payment.status !== 'captured') return c.json({ error: 'Your payment is still being confirmed. Your plan will update within a minute.' }, 202)
    const result = await completeUpgrade(order, payment)
    const prof = await loadBilling(userId)
    if (result === 'refunded') return c.json({ error: 'Your subscription changed while you were paying, so the upgrade was not applied and your payment is being refunded.' }, 409)
    return c.json({ ok: result === 'applied', plan: effectivePlan(prof?.plan, prof?.plan_expires_at) })
  } catch (e) {
    log.error('upgrade verify failed', { userId, error: errMsg(e) })
    return c.json({ error: 'Payment received but the upgrade is still being applied. It will show within a minute.' }, 202)
  }
})

/**
 * Replace the card on file. Razorpay cannot swap the payment method of a running subscription, so the customer authorises
 * a replacement for the same plan that starts when the current period ends; the old one is retired once the new is authorised.
 */
billing.post('/payment-method', async (c) => {
  const userId = c.get('userId')
  if (!rzp) return c.json({ error: 'Payments are not configured yet.' }, 503)
  const prof = await loadBilling(userId)
  if (!isLive(prof)) return c.json({ error: 'You do not have an active subscription.' }, 400)
  const cycle = (prof!.billing_cycle ?? 'monthly') as BillingCycle
  const rzpPlanId = planIdFor(prof!.plan, cycle)
  if (!rzpPlanId) return c.json({ error: 'This plan is not available right now.' }, 503)
  try {
    const startAt = prof!.plan_status === 'payment_failed' ? undefined : startAtFor(prof!.plan_expires_at)
    const sub = await createSubscription(userId, prof!.plan, cycle, rzpPlanId, startAt, 'payment_method')
    await db.from('user_profiles').update({ pending_subscription_id: sub.id }).eq('id', userId)
    return c.json({ subscription_id: sub.id, key_id: env.razorpayKeyId, starts_at: startAt ? new Date(startAt * 1000).toISOString() : null })
  } catch (e) {
    log.error('payment method update failed', { userId, error: errMsg(e) })
    return c.json({ error: 'Could not start the update. Please try again in a moment.' }, 502)
  }
})

/** Called by the browser after Razorpay Checkout succeeds. The plan comes from Razorpay, never from the client. */
billing.post('/verify', async (c) => {
  const userId = c.get('userId')
  if (!rzp) return c.json({ error: 'Payments are not configured yet.' }, 503)
  const parsed = z.object({ razorpay_payment_id: z.string(), razorpay_subscription_id: z.string(), razorpay_signature: z.string() })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid payment data' }, 400)
  const p = parsed.data

  const expected = createHmac('sha256', env.razorpayKeySecret).update(`${p.razorpay_payment_id}|${p.razorpay_subscription_id}`).digest('hex')
  if (!safeEq(expected, p.razorpay_signature)) return c.json({ error: 'Payment signature mismatch' }, 400)

  try {
    const sub = (await rzp.subscriptions.fetch(p.razorpay_subscription_id)) as unknown as RzpSub
    if (noteOf(sub, 'user_id') !== userId) return c.json({ error: 'This subscription belongs to another account' }, 403)
    const state = await syncSubscription(userId, sub.id, sub)
    if (state === 'applied') await db.from('user_profiles').update({ razorpay_payment_id: p.razorpay_payment_id }).eq('id', userId)
    const prof = await loadBilling(userId)
    return c.json({ ok: true, state, plan: effectivePlan(prof?.plan, prof?.plan_expires_at) })
  } catch (e) {
    log.error('billing verify failed', { userId, error: errMsg(e) })
    return c.json({ error: 'Payment received but activation is pending. It will apply within a minute.' }, 202)
  }
})

billing.post('/cancel', async (c) => {
  try {
    const ok = await cancelSubscription(c.get('userId'))
    return ok ? c.json({ ok: true }) : c.json({ error: 'No active subscription found.' }, 404)
  } catch (e) {
    log.error('billing cancel failed', { userId: c.get('userId'), error: errMsg(e) })
    return c.json({ error: 'Could not cancel right now. Please try again in a moment.' }, 502)
  }
})

/** A downgrade waiting for the end of the paid period, read from Razorpay. Null when there is none. */
async function scheduledChange(prof: BillingRow | null): Promise<{ plan: Plan; at: string | null } | null> {
  if (!rzp || !prof?.razorpay_subscription_id || prof.plan_status !== 'active') return null
  try {
    const pending = (await rzp.subscriptions.pendingUpdate(prof.razorpay_subscription_id)) as unknown as RzpSub
    const mapped = pending?.plan_id ? planFromRazorpayId(pending.plan_id) : null
    return mapped && mapped.plan !== prof.plan ? { plan: mapped.plan, at: prof.plan_expires_at } : null
  } catch {
    return null // Razorpay answers with an error when nothing is scheduled
  }
}

/** Payment history for the billing page, plus whether a replacement subscription is waiting to take over. */
billing.get('/history', async (c) => {
  const userId = c.get('userId')
  const [{ data: payments }, prof] = await Promise.all([
    db.from('billing_payments').select('payment_id, invoice_number, amount, currency, status, refunded_amount, plan, paid_at')
      .eq('user_id', userId).order('paid_at', { ascending: false }).limit(24),
    loadBilling(userId),
  ])
  return c.json({ payments: payments ?? [], replacement_scheduled: !!prof?.pending_subscription_id, scheduled_change: await scheduledChange(prof) })
})

/** One invoice as data: feeds the in-app invoice page. */
billing.get('/invoices/:paymentId', async (c) => {
  const invoice = await getInvoice(c.get('userId'), c.req.param('paymentId'))
  return invoice ? c.json(invoice) : c.json({ error: 'Invoice not found.' }, 404)
})

/** Invoice or receipt as a PDF download. ?kind=receipt for the receipt, otherwise the invoice. */
billing.get('/invoices/:paymentId/pdf', async (c) => {
  const invoice = await getInvoice(c.get('userId'), c.req.param('paymentId'))
  if (!invoice) return c.json({ error: 'Invoice not found.' }, 404)
  const kind: DocKind = c.req.query('kind') === 'receipt' ? 'receipt' : 'invoice'
  try {
    const pdf = await renderInvoicePdf(invoice, kind)
    return c.body(new Uint8Array(pdf), 200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoiceFilename(invoice, kind)}"`,
      'Cache-Control': 'private, no-store',
    })
  } catch (e) {
    log.error('invoice pdf failed', { userId: c.get('userId'), payment: invoice.paymentId, error: errMsg(e) })
    return c.json({ error: 'Could not create the PDF right now. Please try again.' }, 500)
  }
})

/** What the customer wants printed under "Bill to" on their invoices. */
billing.get('/details', async (c) => c.json(await getBillingDetails(c.get('userId'))))
billing.patch('/details', async (c) => {
  const parsed = billingDetailsSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message === 'Invalid email' ? 'Enter a valid email address.' : 'Check the invoice details: one of the fields is too long or invalid.' }, 400)
  await saveBillingDetails(c.get('userId'), parsed.data)
  return c.json(parsed.data)
})

// ─── Webhook (mounted outside the authenticated router) ─────────────────────
export const razorpayWebhook = new Hono()

const SUBSCRIPTION_EVENTS = new Set([
  'subscription.authenticated', 'subscription.activated', 'subscription.charged', 'subscription.updated', 'subscription.resumed',
  'subscription.pending', 'subscription.halted', 'subscription.cancelled', 'subscription.completed', 'subscription.expired',
])

interface WebhookBody {
  event: string
  payload?: {
    subscription?: { entity?: RzpSub }
    payment?: { entity?: PaymentEntity }
    refund?: { entity?: RefundEntity }
    order?: { entity?: { id: string; notes?: Record<string, string> | unknown[] } }
  }
}

async function handleEvent(event: WebhookBody) {
  const sub = event.payload?.subscription?.entity
  if (SUBSCRIPTION_EVENTS.has(event.event) && sub) {
    const userId = await userForSubscription(sub)
    if (!userId) { log.warn('webhook for an unknown subscription', { event: event.event, sub: sub.id }); return }
    const payment = event.payload?.payment?.entity
    if (event.event === 'subscription.charged' && payment) await recordPayment(userId, sub, payment)
    await syncSubscription(userId, sub.id) // the payload is only a hint: Razorpay's current state decides
    return
  }
  if (event.event === 'order.paid') {
    const order = event.payload?.order?.entity
    const payment = event.payload?.payment?.entity
    if (order && payment) await completeUpgrade(order, payment)
    return
  }
  if (event.event === 'refund.processed') {
    const refund = event.payload?.refund?.entity
    if (refund?.payment_id) await applyRefund(refund, event.payload?.payment?.entity)
  }
}

razorpayWebhook.post('/', async (c) => {
  const raw = await c.req.text()
  const sig = c.req.header('x-razorpay-signature') ?? ''
  const expected = createHmac('sha256', env.razorpayWebhookSecret || 'unset').update(raw).digest('hex')
  if (!env.razorpayWebhookSecret || !safeEq(expected, sig)) return c.json({ error: 'Invalid signature' }, 400)

  let event: WebhookBody
  try { event = JSON.parse(raw) as WebhookBody } catch { return c.json({ error: 'Invalid body' }, 400) }

  // Razorpay retries failed deliveries. Mark an event done only AFTER it succeeded, otherwise a failed first attempt
  // would make every retry look like a duplicate and the event would be lost for good. Handling is idempotent.
  const eventId = c.req.header('x-razorpay-event-id')
  const doneKey = eventId ? `rzp:event:${eventId}` : null
  if (doneKey && (await redis.get(doneKey).catch(() => null))) return c.json({ received: true, duplicate: true })

  try {
    await handleEvent(event)
  } catch (e) {
    log.error('razorpay webhook failed', { event: event.event, error: errMsg(e) })
    return c.json({ error: 'processing failed' }, 500) // Razorpay will retry
  }
  if (doneKey) await redis.set(doneKey, '1', { ex: 7 * 86400 }).catch(() => {})
  return c.json({ received: true })
})
