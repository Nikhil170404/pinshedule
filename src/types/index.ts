// free_trial = permanent Free tier
// starter = $15/mo
// pro = $25/mo
// growth = $49/mo (Agency)
export type Plan = 'free_trial' | 'starter' | 'pro' | 'growth'

export interface User {
  id: string
  email: string
  plan: Plan
  created_at: string
  trial_ends_at?: string
  razorpay_subscription_id?: string
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
}

export type PinStatus = 'pending' | 'processing' | 'published' | 'failed'

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
  price_monthly_usd: number
  pins_per_month: number
  accounts: number
  website_imports: number
  ai_generations: number
  ai_image_credits: number
  bulk_upload: boolean
  sitemap_import: boolean
  brand_kit: boolean
  smart_scheduler: boolean
  team_users: number | 'unlimited'
  white_label: boolean
  api_access: boolean
  support: 'email' | 'priority' | 'priority_plus'
}

export const PLANS: Record<Plan, PlanDetails> = {
  free_trial: {
    id: 'free_trial',
    name: 'Free',
    price_monthly_usd: 0,
    pins_per_month: 100,
    accounts: 1,
    website_imports: 5,
    ai_generations: 20,
    ai_image_credits: 0,
    bulk_upload: false,
    sitemap_import: false,
    brand_kit: false,
    smart_scheduler: false,
    team_users: 1,
    white_label: false,
    api_access: false,
    support: 'email',
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price_monthly_usd: 15,
    pins_per_month: 1500,
    accounts: 1,
    website_imports: 200,
    ai_generations: 500,
    ai_image_credits: 30,
    bulk_upload: true,
    sitemap_import: false,
    brand_kit: false,
    smart_scheduler: false,
    team_users: 1,
    white_label: false,
    api_access: false,
    support: 'email',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price_monthly_usd: 25,
    pins_per_month: 10000,
    accounts: 5,
    website_imports: 2000,
    ai_generations: 3000,
    ai_image_credits: 150,
    bulk_upload: true,
    sitemap_import: true,
    brand_kit: true,
    smart_scheduler: true,
    team_users: 3,
    white_label: false,
    api_access: false,
    support: 'priority',
  },
  growth: {
    id: 'growth',
    name: 'Agency',
    price_monthly_usd: 49,
    pins_per_month: 50000,
    accounts: 20,
    website_imports: 10000,
    ai_generations: 15000,
    ai_image_credits: 750,
    bulk_upload: true,
    sitemap_import: true,
    brand_kit: true,
    smart_scheduler: true,
    team_users: 'unlimited',
    white_label: true,
    api_access: true,
    support: 'priority_plus',
  },
}
