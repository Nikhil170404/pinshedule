// Single source of truth for plans. Imported by the Next.js frontend (pricing UI)
// and by the Railway worker (limit enforcement), so the two can never drift.

export type Plan = 'free_trial' | 'starter' | 'pro' | 'growth'
export type BillingCycle = 'monthly' | 'yearly'

export interface PlanDetails {
  id: Plan
  name: string
  tagline: string
  price_monthly_usd: number
  /** Total charged per year when billed yearly (2 months free). */
  price_yearly_usd: number
  pins_per_month: number
  website_imports: number
  ai_generations: number
  /** Most pins that can be scheduled in one request or bulk batch. */
  batch_max: number
  bulk_upload: boolean
  sitemap_import: boolean
  smart_scheduler: boolean
  analytics_days: number
  /** Pinterest accounts that can be connected to one login. */
  accounts: number
  /** Active automations (sitemap autopilot, evergreen recycling). */
  automations: number
  support: string
}

export const PLANS: Record<Plan, PlanDetails> = {
  free_trial: {
    id: 'free_trial',
    name: 'Free',
    tagline: 'Try it on one board, no card needed.',
    price_monthly_usd: 0,
    price_yearly_usd: 0,
    pins_per_month: 30,
    website_imports: 5,
    ai_generations: 15,
    batch_max: 10,
    bulk_upload: false,
    sitemap_import: false,
    smart_scheduler: false,
    analytics_days: 7,
    accounts: 1,
    automations: 0,
    support: 'Email',
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    tagline: 'For a blog or shop pinning every day.',
    price_monthly_usd: 9,
    price_yearly_usd: 90,
    pins_per_month: 300,
    website_imports: 100,
    ai_generations: 300,
    batch_max: 200,
    bulk_upload: true,
    sitemap_import: false,
    smart_scheduler: true,
    analytics_days: 30,
    accounts: 1,
    automations: 1,
    support: 'Email',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For creators who publish at volume.',
    price_monthly_usd: 19,
    price_yearly_usd: 190,
    pins_per_month: 1500,
    website_imports: 600,
    ai_generations: 1500,
    batch_max: 200,
    bulk_upload: true,
    sitemap_import: true,
    smart_scheduler: true,
    analytics_days: 90,
    accounts: 1,
    automations: 3,
    support: 'Priority',
  },
  growth: {
    id: 'growth',
    name: 'Business',
    tagline: 'For large catalogs and content teams.',
    price_monthly_usd: 39,
    price_yearly_usd: 390,
    pins_per_month: 6000,
    website_imports: 3000,
    ai_generations: 6000,
    batch_max: 200,
    bulk_upload: true,
    sitemap_import: true,
    smart_scheduler: true,
    analytics_days: 90,
    accounts: 3,
    automations: 10,
    support: 'Priority',
  },
}

export const PAID_PLANS: Plan[] = ['starter', 'pro', 'growth']

export function isPaidPlan(p: unknown): p is Exclude<Plan, 'free_trial'> {
  return typeof p === 'string' && (PAID_PLANS as string[]).includes(p)
}

export function monthlyEquivalent(plan: PlanDetails, cycle: BillingCycle): number {
  return cycle === 'yearly' ? Math.round((plan.price_yearly_usd / 12) * 100) / 100 : plan.price_monthly_usd
}

/** Pinterest field limits (API v5). */
export const PIN_LIMITS = { title: 100, description: 800, altText: 500, link: 2048 } as const

/** Months you do not pay for when billed yearly (the "2 months free" shown in the UI is computed, not typed). */
export function monthsFree(plan: PlanDetails): number {
  return plan.price_monthly_usd === 0 ? 0 : Math.round((12 - plan.price_yearly_usd / plan.price_monthly_usd) * 100) / 100
}

/** What a Razorpay plan must look like for a given plan and cycle (amounts are in cents, USD). */
export function expectedRazorpay(plan: PlanDetails, cycle: BillingCycle) {
  return {
    amount: (cycle === 'yearly' ? plan.price_yearly_usd : plan.price_monthly_usd) * 100,
    currency: 'USD',
    period: cycle === 'yearly' ? 'yearly' : 'monthly',
    interval: 1,
  }
}

export const PLAN_ORDER: Plan[] = ['free_trial', 'starter', 'pro', 'growth']

/** The next plan up, or null on the top plan. Used by "you are almost at your limit" prompts. */
export function nextPlan(plan: Plan): Plan | null {
  return PLAN_ORDER[PLAN_ORDER.indexOf(plan) + 1] ?? null
}

/**
 * Switching plans while subscribed. An upgrade can start now; anything else (a downgrade, or
 * yearly to monthly) is scheduled for the end of the paid period so nobody is billed twice for the same time.
 */
export function isUpgrade(from: { plan: Plan; cycle: BillingCycle }, to: { plan: Plan; cycle: BillingCycle }): boolean {
  const a = PLAN_ORDER.indexOf(from.plan)
  const b = PLAN_ORDER.indexOf(to.plan)
  if (b !== a) return b > a
  return from.cycle === 'monthly' && to.cycle === 'yearly'
}
