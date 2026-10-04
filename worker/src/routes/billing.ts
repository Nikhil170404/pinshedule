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

billing.post('/checkout', async (c) => {
  const userId = c.get('userId')
  if (!rzp) return c.json({ error: 'Payments are not configured yet.' }, 503)
  const parsed = z.object({ plan: z.string().refine(isPaidPlan), cycle: z.enum(['monthly', 'yearly']) }).safeParse(await c.req.json().catch(() => null))
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

  // One active subscription at a time: switching plans cancels the old one at the end of its period.
  const { data: prof } = await db.from('user_profiles').select('razorpay_subscription_id, plan, plan_status').eq('id', userId).maybeSingle()
  if (prof?.razorpay_subscription_id && prof.plan !== 'free_trial' && prof.plan_status === 'active') {
    await cancelSubscription(userId, true).catch(() => {})
  }

  const sub = await rzp.subscriptions.create({
    plan_id: rzpPlanId,
    total_count: cycle === 'yearly' ? 10 : 120,
    customer_notify: 1,
    notes: { user_id: userId, plan, cycle },
  })
  return c.json({ subscription_id: sub.id, key_id: env.razorpayKeyId })
})

async function applySubscription(userId: string, sub: { id: string; plan_id: string; status: string; current_end?: number | null; customer_id?: string | null }) {
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
  }).eq('id', userId)
  await invalidateProfile(userId)
  return mapped.plan
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
    const sub = (await rzp.subscriptions.fetch(p.razorpay_subscription_id)) as unknown as { id: string; plan_id: string; status: string; current_end?: number; customer_id?: string; notes?: Record<string, string> }
    if (sub.notes?.user_id !== userId) return c.json({ error: 'This subscription belongs to another account' }, 403)
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
  const { data } = await db.from('user_profiles').select('razorpay_subscription_id').eq('id', userId).maybeSingle()
  if (!data?.razorpay_subscription_id) return false
  await rzp.subscriptions.cancel(data.razorpay_subscription_id, true) // at end of billing cycle
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

  const event = JSON.parse(raw) as { event: string; payload?: { subscription?: { entity?: { id: string; plan_id: string; status: string; current_end?: number; customer_id?: string; notes?: Record<string, string> } } } }
  const sub = event.payload?.subscription?.entity
  if (!sub) return c.json({ received: true })

  try {
    const userId = sub.notes?.user_id ?? (await db.from('user_profiles').select('id').eq('razorpay_subscription_id', sub.id).maybeSingle()).data?.id
    if (!userId) return c.json({ received: true })

    if (event.event === 'subscription.activated' || event.event === 'subscription.charged' || event.event === 'subscription.resumed') {
      await applySubscription(userId, sub)
    } else if (event.event === 'subscription.cancelled' || event.event === 'subscription.completed' || event.event === 'subscription.expired') {
      // Only downgrade if this is still the user's current subscription (they may have switched plans).
      const { data: prof } = await db.from('user_profiles').select('razorpay_subscription_id').eq('id', userId).maybeSingle()
      if (prof?.razorpay_subscription_id === sub.id) {
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
    }
  } catch (e) {
    log.error('razorpay webhook failed', { event: event.event, error: errMsg(e) })
    return c.json({ error: 'processing failed' }, 500) // Razorpay will retry
  }
  return c.json({ received: true })
})
