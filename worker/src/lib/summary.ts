import { PLANS } from '@shared/plans'
import { db, redis } from './clients'
import { getProfile } from './plan'

/** Plan, usage and connection status in one object. Cached 30s and cleared by invalidateProfile(). */
export async function buildSummary(userId: string) {
  const hit = await redis.get<Record<string, unknown>>(`summary:${userId}`).catch(() => null)
  if (hit) return hit
  const profile = await getProfile(userId)
  const plan = PLANS[profile.plan]
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  const period = start.toISOString().slice(0, 7)

  const [pinsRes, usageRes, connRes] = await Promise.all([
    db.from('scheduled_pins').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      .in('status', ['pending', 'processing', 'published']).gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString()),
    db.from('usage_counters').select('kind, count').eq('user_id', userId).eq('period', period),
    db.from('pinterest_connections').select('pinterest_username, status').eq('user_id', userId).maybeSingle(),
  ])
  const usage = Object.fromEntries((usageRes.data ?? []).map((u) => [u.kind, u.count as number]))
  const body = {
    plan: profile.plan, plan_name: plan.name, plan_status: profile.plan_status, expires_at: profile.expires_at, timezone: profile.timezone,
    limits: { pins: plan.pins_per_month, ai: plan.ai_generations, imports: plan.website_imports },
    used: { pins: pinsRes.count ?? 0, ai: usage.ai ?? 0, imports: usage.imports ?? 0 },
    pinterest: connRes.data ? { username: connRes.data.pinterest_username, status: connRes.data.status } : null,
  }
  redis.set(`summary:${userId}`, body as never, { ex: 30 }).catch(() => {})
  return body
}
