export type Plan = 'free_trial' | 'starter' | 'pro' | 'growth'

export interface User {
  id: string
  email: string
  plan: Plan
  created_at: string
  trial_ends_at?: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  timezone: string
  notifications_enabled: boolean
}

export interface PinterestConnection {
  id: string
  user_id: string
  pinterest_user_id: string
  pinterest_username: string
  access_token: string
  refresh_token: string
  expires_at: string
  board_cache_updated_at?: string
}

export type PinStatus = 'pending' | 'published' | 'failed'

export interface ScheduledPin {
  id: string
  user_id: string
  image_url: string
  title: string
  description: string
  board_id: string
  board_name?: string
  destination_url?: string
  scheduled_at: string
  status: PinStatus
  pinterest_pin_id?: string
  error_message?: string
  created_at: string
}

export interface AnalyticsSnapshot {
  id: string
  user_id: string
  pin_id: string
  pinterest_pin_id: string
  impressions: number
  saves: number
  clicks: number
  snapshot_date: string
}

export interface PinterestBoard {
  id: string
  name: string
  description?: string
  pin_count?: number
  follower_count?: number
  image_url?: string
  privacy: 'PUBLIC' | 'PROTECTED' | 'SECRET'
}

export interface PlanDetails {
  id: Plan
  name: string
  price_monthly: number
  price_yearly: number
  pins_per_month: number | 'unlimited'
  accounts: number
  ai_captions: number | 'unlimited'
  bulk_upload: boolean
  bulk_limit?: number
  analytics: 'basic' | 'full'
  white_label: boolean
  best_time: boolean
  support: 'email' | 'priority_email' | 'priority_chat'
}

export const PLANS: Record<Plan, PlanDetails> = {
  free_trial: {
    id: 'free_trial',
    name: 'Free Trial',
    price_monthly: 0,
    price_yearly: 0,
    pins_per_month: 20,
    accounts: 1,
    ai_captions: 10,
    bulk_upload: false,
    analytics: 'basic',
    white_label: false,
    best_time: false,
    support: 'email',
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price_monthly: 5,
    price_yearly: 48,
    pins_per_month: 100,
    accounts: 1,
    ai_captions: 50,
    bulk_upload: false,
    analytics: 'basic',
    white_label: false,
    best_time: false,
    support: 'email',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price_monthly: 14,
    price_yearly: 134,
    pins_per_month: 'unlimited',
    accounts: 3,
    ai_captions: 'unlimited',
    bulk_upload: true,
    bulk_limit: 50,
    analytics: 'full',
    white_label: false,
    best_time: true,
    support: 'priority_email',
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price_monthly: 30,
    price_yearly: 288,
    pins_per_month: 'unlimited',
    accounts: 10,
    ai_captions: 'unlimited',
    bulk_upload: true,
    bulk_limit: 500,
    analytics: 'full',
    white_label: true,
    best_time: true,
    support: 'priority_chat',
  },
}
