import { expectedRazorpay, type BillingCycle, type PlanDetails } from '@shared/plans'

/** The fields of a Razorpay plan that decide what a customer is charged. */
export interface RazorpayPlanInfo {
  period?: string
  interval?: number
  item?: { amount?: number; currency?: string }
}

/**
 * Compare a Razorpay plan with what our price list says it must be. Returns a list of problems,
 * empty when it matches. Prevents a typo in the Razorpay dashboard from silently charging the wrong amount.
 */
export function razorpayPlanProblems(info: RazorpayPlanInfo, plan: PlanDetails, cycle: BillingCycle): string[] {
  const want = expectedRazorpay(plan, cycle)
  const problems: string[] = []
  if (info.item?.amount !== want.amount) problems.push(`amount is ${info.item?.amount} but should be ${want.amount} (cents)`)
  if (info.item?.currency !== want.currency) problems.push(`currency is ${info.item?.currency} but should be ${want.currency}`)
  if (info.period !== want.period) problems.push(`period is ${info.period} but should be ${want.period}`)
  if (info.interval !== want.interval) problems.push(`interval is ${info.interval} but should be ${want.interval}`)
  return problems
}
