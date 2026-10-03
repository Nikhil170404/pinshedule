export { PLANS, PAID_PLANS, PIN_LIMITS, isPaidPlan, monthlyEquivalent } from '@shared/plans'
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
}

export interface PinterestBoard {
  id: string
  name: string
  description: string
  privacy: string
  pin_count: number
  follower_count: number
  image_url: string | null
}

export interface Summary {
  plan: 'free_trial' | 'starter' | 'pro' | 'growth'
  plan_name: string
  plan_status: string
  expires_at: string | null
  timezone: string
  limits: { pins: number; ai: number; imports: number }
  used: { pins: number; ai: number; imports: number }
  pinterest: { username: string | null; status: 'active' | 'needs_reconnect' } | null
}
