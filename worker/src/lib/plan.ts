import { PLANS, type Plan } from '@shared/plans'
import { db, redis } from './clients'

const GRACE_MS = 3 * 86_400_000

export interface Profile {
  plan: Plan
  timezone: string
  expires_at: string | null
  subscription_id: string | null
  plan_status: string
}

/** Effective plan: a paid plan whose period lapsed (plus grace) falls back to Free. Cached 60s. */
export async function getProfile(userId: string): Promise<Profile> {
  const key = `profile:${userId}`
  try {
    const hit = await redis.get<Profile>(key)
    if (hit) return hit
  } catch {}
  const { data } = await db
    .from('user_profiles')
    .select('plan, timezone, plan_expires_at, razorpay_subscription_id, plan_status')
    .eq('id', userId)
    .maybeSingle()

  let plan = ((data?.plan as Plan) ?? 'free_trial') as Plan
  if (!(plan in PLANS)) plan = 'free_trial'
  const expires = data?.plan_expires_at ? new Date(data.plan_expires_at).getTime() : null
  if (plan !== 'free_trial' && expires && expires + GRACE_MS < Date.now()) plan = 'free_trial'

  const profile: Profile = {
    plan,
    timezone: data?.timezone || 'UTC',
    expires_at: data?.plan_expires_at ?? null,
    subscription_id: data?.razorpay_subscription_id ?? null,
    plan_status: data?.plan_status ?? 'active',
  }
  redis.set(key, profile as never, { ex: 60 }).catch(() => {})
  return profile
}

export const invalidateProfile = (userId: string) => redis.del(`profile:${userId}`, `summary:${userId}`).catch(() => {})

export async function consumeUsage(userId: string, kind: 'ai' | 'imports', limit: number, amount = 1): Promise<boolean> {
  const { data, error } = await db.rpc('consume_usage', { p_user: userId, p_kind: kind, p_limit: limit, p_amount: amount })
  if (error) throw new Error(error.message)
  return data === true
}

export async function refundUsage(userId: string, kind: 'ai' | 'imports', amount = 1): Promise<void> {
  await db.rpc('refund_usage', { p_user: userId, p_kind: kind, p_amount: amount })
}
