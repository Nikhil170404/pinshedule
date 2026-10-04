import { Hono } from 'hono'
import { createHmac, timingSafeEqual } from 'node:crypto'
import Razorpay from 'razorpay'
import { z } from 'zod'
import { PLANS, isPaidPlan, type BillingCycle, type Plan } from '@shared/plans'
import { env } from '../env'
import { limit, type AppEnv } from '../lib/auth'
import { db, redis } from '../lib/clients'
import { invalidateProfile } from '../lib/plan'
import { razorpayPlanProblems, type RazorpayPlanInfo } from '../lib/razorpay-plan'
import { errMsg, log } from '../lib/log'
import { notifyUser } from '../lib/email'
import { decideStartMode, isStaleEvent, isSwitchPending } from '../lib/switch'

const rzp = env.razorpayKeyId ? new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret }) : null

export const billing = new Hono<AppEnv>()
billing.use('*', limit('payment'))

const planIdFor = (plan: string, cycle: BillingCycle) => env.razorpayPlans[`${plan}_${cycle}`]
function planFromRazorpayId(rzpPlanId: string): { plan: Plan; cycle: BillingCycle } | null {
  for (const [k, v] of Object.entries(env.razorpayPlans)) {
    if (v && v === rzpPlanId) {
      const [plan, cycle] = k.split('_')
      return { plan: plan as Plan, cycle: cycle as BillingCycle }
    }
  }
  return null
}

const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

interface SubEntity {
  id: string; plan_id: string; status: string; current_end?: number | null; start_at?: number | null; customer_id?: string | null
  notes?: Record<string, string> | unknown[]
}
const noteOf = (sub: SubEntity, key: string) => (Array.isArray(sub.notes) ? undefined : sub.notes?.[key])

/**
 * Start a subscription. Nothing about the current subscription changes here: it is only retired after the
 * new one is paid (see retireReplaced), so abandoning checkout never costs the customer their plan.
 *   mode "now"     : the new plan starts immediately (used for upgrades and first purchases)
 *   mode "renewal" : the new plan starts when the paid period ends, so nobody pays twice for the same days
 */
billing.post('/checkout', async (c) => {
  const userId = c.get('userId')
  if (!rzp) return c.json({ error: 'Payments are not configured yet.' }, 503)
  const parsed = z.object({ plan: z.string().refine(isPaidPlan), cycle: z.enum(['monthly', 'yearly']), when: z.enum(['now', 'renewal']).optional() }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid plan' }, 400)
  const { plan, cycle } = parsed.data
  const rzpPlanId = planIdFor(plan, cycle)
  if (!rzpPlanId) return c.json({ error: 'This plan is not available for purchase yet.' }, 503)

  // Refuse to sell a plan whose Razorpay configuration does not match our price list.
  const info = (await rzp.plans.fetch(rzpPlanId).catch((e: unknown) => { log.error('razorpay plan fetch failed', { rzpPlanId, error: errMsg(e) }); return null })) as RazorpayPlanInfo | null
  if (!info) return c.json({ error: 'Payments are temporarily unavailable. Please try again shortly.' }, 503)
  const problems = razorpayPlanProblems(info, PLANS[plan as Plan], cycle)
  if (problems.length) {
    log.error('razorpay plan does not match price list', { plan, cycle, rzpPlanId, problems })
    return c.json({ error: 'This plan is not available for purchase right now. Please contact support.' }, 503)
  }

  const { data: prof } = await db.from('user_profiles').select('razorpay_subscription_id, plan, billing_cycle, plan_status, plan_expires_at').eq('id', userId).maybeSingle()
  const hasSub = !!prof?.razorpay_subscription_id && prof.plan !== 'free_trial' && ['active', 'cancelling'].includes(prof.plan_status as string)
  const current = { plan: prof?.plan as Plan, cycle: (prof?.billing_cycle ?? 'monthly') as BillingCycle }
  if (hasSub && prof?.plan_status === 'active' && current.plan === plan && current.cycle === cycle) return c.json({ error: 'You are already on this plan.' }, 409)

  let mode = decideStartMode(hasSub, current, { plan: plan as Plan, cycle }, parsed.data.when)
  let startAt: number | undefined
  if (mode === 'renewal') {
    const old = (await rzp.subscriptions.fetch(prof!.razorpay_subscription_id as string).catch(() => null)) as unknown as SubEntity | null
    const end = old?.current_end ?? (prof?.plan_expires_at ? Math.floor(new Date(prof.plan_expires_at as string).getTime() / 1000) : 0)
    if (end * 1000 > Date.now() + 10 * 60_000) startAt = end
    else mode = 'now' // the period is about to end anyway
  }

  const sub = await rzp.subscriptions.create({
    plan_id: rzpPlanId,
    total_count: cycle === 'yearly' ? 10 : 120,
    customer_notify: 1,
    ...(startAt ? { start_at: startAt } : {}),
    notes: { user_id: userId, plan, cycle, mode, ...(hasSub ? { replaces: prof!.razorpay_subscription_id as string } : {}) },
  })
  return c.json({ subscription_id: sub.id, key_id: env.razorpayKeyId, mode, starts_at: startAt ? new Date(startAt * 1000).toISOString() : null })
})

async function applySubscription(userId: string, sub: SubEntity) {
  const mapped = planFromRazorpayId(sub.plan_id)
  if (!mapped) throw new Error(`Unknown Razorpay plan ${sub.plan_id}`)
  const expires = sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null
  await db.from('user_profiles').update({
    plan: mapped.plan,
    billing_cycle: mapped.cycle,
    plan_status: 'active',
    plan_started_at: new Date().toISOString(),
    plan_expires_at: expires,
    razorpay_subscription_id: sub.id,
    razorpay_customer_id: sub.customer_id ?? null,
    next_plan: null, next_billing_cycle: null, next_plan_at: null, next_subscription_id: null,
  }).eq('id', userId)
  await invalidateProfile(userId)
  await retireReplaced(sub)
  return mapped.plan
}

/** The subscription this one replaced is cancelled only now that the new one is live (best effort, idempotent). */
async function retireReplaced(sub: SubEntity) {
  const old = noteOf(sub, 'replaces')
  if (!rzp || !old || old === sub.id) return
  await rzp.subscriptions.cancel(old, false).catch((e: unknown) => log.warn('could not cancel replaced subscription', { old, error: errMsg(e) }))
}

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
    const sub = (await rzp.subscriptions.fetch(p.razorpay_subscription_id)) as unknown as SubEntity
    if (noteOf(sub, 'user_id') !== userId) return c.json({ error: 'This subscription belongs to another account' }, 403)

    // A switch at renewal is authorised now but starts later: keep the current plan, record what comes next.
    if (noteOf(sub, 'mode') === 'renewal' && sub.start_at && sub.start_at * 1000 > Date.now() + 60_000) {
      const mapped = planFromRazorpayId(sub.plan_id)
      if (!mapped) throw new Error(`Unknown Razorpay plan ${sub.plan_id}`)
      await db.from('user_profiles').update({
        next_plan: mapped.plan, next_billing_cycle: mapped.cycle, next_plan_at: new Date(sub.start_at * 1000).toISOString(), next_subscription_id: sub.id,
        razorpay_customer_id: sub.customer_id ?? null,
      }).eq('id', userId)
      await cancelSubscription(userId, true).catch((e) => log.warn('could not schedule end of current plan', { userId, error: errMsg(e) }))
      await invalidateProfile(userId)
      return c.json({ ok: true, scheduled: true, plan: mapped.plan, starts_at: new Date(sub.start_at * 1000).toISOString() })
    }
    const plan = await applySubscription(userId, sub)
    await db.from('user_profiles').update({ razorpay_payment_id: p.razorpay_payment_id }).eq('id', userId)
    return c.json({ ok: true, plan })
  } catch (e) {
    log.error('billing verify failed', { userId, error: errMsg(e) })
    return c.json({ error: 'Payment received but activation is pending. It will apply within a minute.' }, 202)
  }
})

export async function cancelSubscription(userId: string, silent = false) {
  if (!rzp) return false
  const { data } = await db.from('user_profiles').select('razorpay_subscription_id, next_subscription_id').eq('id', userId).maybeSingle()
  if (!data?.razorpay_subscription_id) return false
  await rzp.subscriptions.cancel(data.razorpay_subscription_id, true) // at end of billing cycle
  // A user cancelling while a switch is waiting to start must not be charged for the plan they were switching to.
  if (!silent && data.next_subscription_id) {
    await rzp.subscriptions.cancel(data.next_subscription_id as string, false).catch((e: unknown) => log.warn('could not cancel scheduled plan', { userId, error: errMsg(e) }))
    await db.from('user_profiles').update({ next_plan: null, next_billing_cycle: null, next_plan_at: null, next_subscription_id: null }).eq('id', userId)
  }
  if (!silent) {
    await db.from('user_profiles').update({ plan_status: 'cancelling' }).eq('id', userId)
    await invalidateProfile(userId)
  }
  return true
}

billing.post('/cancel', async (c) => {
  try {
    const ok = await cancelSubscription(c.get('userId'))
    return ok ? c.json({ ok: true }) : c.json({ error: 'No active subscription found.' }, 404)
  } catch (e) {
    return c.json({ error: `Could not cancel: ${errMsg(e)}` }, 502)
  }
})

/** Receipts for the customer, newest first. Razorpay hosts the PDF/page; we only link to it. */
billing.get('/invoices', async (c) => {
  const userId = c.get('userId')
  if (!rzp) return c.json({ invoices: [] })
  const { data } = await db.from('user_profiles').select('razorpay_customer_id, razorpay_subscription_id').eq('id', userId).maybeSingle()
  const filter = data?.razorpay_customer_id ? { customer_id: data.razorpay_customer_id as string } : data?.razorpay_subscription_id ? { subscription_id: data.razorpay_subscription_id as string } : null
  if (!filter) return c.json({ invoices: [] })
  try {
    const res = (await rzp.invoices.all({ ...filter, count: 24 } as never)) as unknown as { items?: { id: string; amount?: number; amount_paid?: number; currency: string; status: string; issued_at?: number; paid_at?: number; short_url?: string; subscription_id?: string }[] }
    const mine = res.items ?? []
    return c.json({
      invoices: mine.map((i) => ({ id: i.id, amount: (i.amount_paid || i.amount || 0) / 100, currency: i.currency, status: i.status, date: new Date((i.paid_at ?? i.issued_at ?? 0) * 1000).toISOString(), url: i.short_url ?? null })),
    })
  } catch (e) {
    log.warn('invoice list failed', { userId, error: errMsg(e) })
    return c.json({ error: 'Could not load invoices right now.' }, 502)
  }
})

// ─── Webhook (mounted outside the authenticated router) ─────────────────────
export const razorpayWebhook = new Hono()

razorpayWebhook.post('/', async (c) => {
  const raw = await c.req.text()
  const sig = c.req.header('x-razorpay-signature') ?? ''
  const expected = createHmac('sha256', env.razorpayWebhookSecret || 'unset').update(raw).digest('hex')
  if (!env.razorpayWebhookSecret || !safeEq(expected, sig)) return c.json({ error: 'Invalid signature' }, 400)

  // Razorpay retries; process each event id once.
  const eventId = c.req.header('x-razorpay-event-id')
  if (eventId && (await redis.set(`rzp:event:${eventId}`, '1', { nx: true, ex: 7 * 86400 })) !== 'OK') return c.json({ received: true, duplicate: true })

  const event = JSON.parse(raw) as { event: string; payload?: { subscription?: { entity?: SubEntity } } }
  const sub = event.payload?.subscription?.entity
  if (!sub) return c.json({ received: true })

  try {
    const userId = noteOf(sub, 'user_id') ?? (await db.from('user_profiles').select('id').eq('razorpay_subscription_id', sub.id).maybeSingle()).data?.id
    if (!userId) return c.json({ received: true })

    if (event.event === 'subscription.activated' || event.event === 'subscription.charged' || event.event === 'subscription.resumed') {
      // Ignore late events from a subscription that has since been replaced, so an old plan never comes back.
      const { data: cur } = await db.from('user_profiles').select('razorpay_subscription_id, next_subscription_id').eq('id', userId).maybeSingle()
      const stale = isStaleEvent(cur, { id: sub.id, replaces: noteOf(sub, 'replaces') })
      if (!stale) await applySubscription(userId, sub)
    } else if (event.event === 'subscription.cancelled' || event.event === 'subscription.completed' || event.event === 'subscription.expired') {
      // Only downgrade if this is still the user's current subscription (they may have switched plans).
      const { data: prof } = await db.from('user_profiles').select('razorpay_subscription_id, next_subscription_id, next_plan_at').eq('id', userId).maybeSingle()
      // A switch at renewal is waiting to start: this is just the old plan ending, so do not downgrade in between.
      const switching = isSwitchPending(prof)
      if (prof?.razorpay_subscription_id === sub.id && !switching) {
        const endMs = sub.current_end ? sub.current_end * 1000 : 0
        if (endMs > Date.now()) {
          await db.from('user_profiles').update({ plan_status: 'cancelling', plan_expires_at: new Date(endMs).toISOString() }).eq('id', userId)
        } else {
          await db.from('user_profiles').update({ plan: 'free_trial', plan_status: 'active', plan_expires_at: null, razorpay_subscription_id: null }).eq('id', userId)
        }
        await invalidateProfile(userId)
      }
    } else if (event.event === 'subscription.halted' || event.event === 'subscription.pending') {
      await db.from('user_profiles').update({ plan_status: 'payment_failed' }).eq('id', userId)
      await invalidateProfile(userId)
      void notifyUser(userId, 'payment_failed', 'Your GoPinKaro payment did not go through', [
        'We could not collect your latest subscription payment, so your plan is at risk of ending.',
        'Update your payment method with Razorpay or choose a plan again to keep your access.',
      ], '/dashboard/billing')
    }
  } catch (e) {
    log.error('razorpay webhook failed', { event: event.event, error: errMsg(e) })
    return c.json({ error: 'processing failed' }, 500) // Razorpay will retry
  }
  return c.json({ received: true })
})
