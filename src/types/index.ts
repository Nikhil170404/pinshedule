export { PLANS, PAID_PLANS, PIN_LIMITS, isPaidPlan, monthlyEquivalent, monthsFree, expectedRazorpay, PLAN_ORDER, nextPlan, isUpgrade } from '@shared/plans'
export type { Plan, PlanDetails, BillingCycle } from '@shared/plans'

export type PinStatus = 'pending' | 'processing' | 'published' | 'failed'

export interface ScheduledPin {
  id: string
  user_id: string
  image_url: string
  title: string | null
  description: string | null
  alt_text: string | null
  board_id: string
  board_name: string | null
  destination_url: string | null
  scheduled_at: string
  status: PinStatus
  pinterest_pin_id: string | null
  error_message: string | null
  published_at: string | null
  created_at: string
  connection_id?: string | null
}

export interface PinterestBoard {
  id: string
  name: string
  description: string
  privacy: string
  pin_count: number
  follower_count: number
  image_url: string | null
  thumbnails?: string[]
}

export interface PinterestAccount {
  id: string
  username: string | null
  status: 'active' | 'needs_reconnect'
  is_primary: boolean
}

export interface Summary {
  plan: 'free_trial' | 'starter' | 'pro' | 'growth'
  plan_name: string
  plan_status: string
  expires_at: string | null
  timezone: string
  billing_cycle: 'monthly' | 'yearly' | null
  limits: { pins: number; ai: number; imports: number; accounts: number; automations: number }
  used: { pins: number; ai: number; imports: number; accounts: number; automations: number }
  /** The primary (login) account. */
  pinterest: { username: string | null; status: 'active' | 'needs_reconnect' } | null
  accounts: PinterestAccount[]
  next_plan: { plan: Summary['plan']; cycle: 'monthly' | 'yearly'; at: string } | null
  email: { address: string | null; verified: boolean; enabled: boolean; can_send: boolean }
}

export interface Automation {
  id: string
  connection_id: string | null
  kind: 'sitemap' | 'evergreen'
  enabled: boolean
  config: { sitemap_url?: string; board_name?: string; per_day?: number; min_age_days?: number; best_first?: boolean }
  next_run_at: string
  last_run_at: string | null
  last_result: string | null
  total_created: number
  created_at: string
}
