import { isUpgrade, type BillingCycle, type Plan } from '@shared/plans'

type Sel = { plan: Plan; cycle: BillingCycle }

/**
 * How a purchase should start when the customer already has a subscription.
 * Upgrades may start now (their choice); downgrades and cycle reductions always wait for the paid period to end.
 */
export function decideStartMode(hasSub: boolean, current: Sel, target: Sel, when?: 'now' | 'renewal'): 'now' | 'renewal' {
  if (!hasSub) return 'now'
  if (!isUpgrade(current, target)) return 'renewal'
  return when === 'renewal' ? 'renewal' : 'now'
}

/**
 * A subscription event is stale when the customer has since moved to a different subscription and this event
 * is neither the one that replaced the current one nor the one waiting to start. Applying it would bring an old plan back.
 */
export function isStaleEvent(cur: { razorpay_subscription_id?: string | null; next_subscription_id?: string | null } | null, sub: { id: string; replaces?: string }): boolean {
  const current = cur?.razorpay_subscription_id
  if (!current || current === sub.id) return false
  return sub.replaces !== current && cur?.next_subscription_id !== sub.id
}

/** The end of the old plan must not downgrade the customer while the plan they are switching to is about to start. */
export function isSwitchPending(cur: { next_subscription_id?: string | null; next_plan_at?: string | null } | null, now = Date.now()): boolean {
  return !!cur?.next_subscription_id && !!cur.next_plan_at && new Date(cur.next_plan_at).getTime() < now + 3 * 86_400_000
}
