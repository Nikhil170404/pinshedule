import { PLAN_GRACE_MS } from '@shared/plans'
import { db } from '../lib/clients'
import { invalidateProfile } from '../lib/plan'
import { errMsg, log } from '../lib/log'
import { cancelQuietly, rzp, syncSubscription } from '../lib/subscriptions'

/**
 * Safety net for missed webhooks. Any paid account whose period has ended is re-checked against Razorpay
 * (a renewal we never heard about moves the period forward; a cancellation we missed ends it). What is still
 * lapsed after the grace window goes back to Free, so the database never keeps showing a paid plan nobody pays for.
 */
export async function expireLapsedPlans() {
  const now = Date.now()
  const { data: due } = await db.from('user_profiles')
    .select('id, razorpay_subscription_id')
    .neq('plan', 'free_trial')
    .lt('plan_expires_at', new Date(now).toISOString())
    .limit(200)

  let downgraded = 0
  for (const row of due ?? []) {
    const userId = row.id as string
    const subId = row.razorpay_subscription_id as string | null
    if (subId && rzp) await syncSubscription(userId, subId).catch((e) => log.warn('expiry sync failed', { userId, error: errMsg(e) }))

    const { data: after } = await db.from('user_profiles').select('plan, plan_expires_at').eq('id', userId).maybeSingle()
    const lapsed = after && after.plan !== 'free_trial' && after.plan_expires_at && new Date(after.plan_expires_at as string).getTime() + PLAN_GRACE_MS < now
    if (!lapsed) continue
    if (subId) await cancelQuietly(subId, false) // a halted subscription must not be left dangling on Razorpay
    await db.from('user_profiles')
      .update({ plan: 'free_trial', plan_status: 'active', plan_expires_at: null, razorpay_subscription_id: null, billing_cycle: 'monthly' })
      .eq('id', userId)
    await invalidateProfile(userId)
    downgraded++
  }
  if (downgraded) log.info('expired lapsed plans', { downgraded })
}
