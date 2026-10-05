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
  /** Pinterest accounts one login can connect and manage from a single dashboard. */
  accounts: number
  /** AI-generated pin backgrounds per month. */
  ai_images: number
  bulk_upload: boolean
  sitemap_import: boolean
  smart_scheduler: boolean
  analytics_days: number
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
    accounts: 1,
    ai_images: 3,
    bulk_upload: false,
    sitemap_import: false,
    smart_scheduler: false,
    analytics_days: 7,
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
    accounts: 3,
    ai_images: 25,
    bulk_upload: true,
    sitemap_import: false,
    smart_scheduler: true,
    analytics_days: 30,
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
    accounts: 10,
    ai_images: 100,
    bulk_upload: true,
    sitemap_import: true,
    smart_scheduler: true,
    analytics_days: 90,
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
    accounts: 100,
    ai_images: 400,
    bulk_upload: true,
    sitemap_import: true,
    smart_scheduler: true,
    analytics_days: 90,
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

/** After a paid period lapses there is a grace window before the account falls back to Free. */
export const PLAN_GRACE_MS = 3 * 86_400_000

/** The plan actually in force: a paid plan whose period (plus grace) has ended counts as Free. */
export function effectivePlan(plan: unknown, expiresAt: string | null | undefined, now = Date.now()): Plan {
  const p: Plan = typeof plan === 'string' && plan in PLANS ? (plan as Plan) : 'free_trial'
  const expires = expiresAt ? new Date(expiresAt).getTime() : null
  return p !== 'free_trial' && expires && expires + PLAN_GRACE_MS < now ? 'free_trial' : p
}
