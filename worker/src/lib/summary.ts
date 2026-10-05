import { PLANS, type Plan } from '@shared/plans'
import { db, redis } from './clients'
import { connectionCount, type Connection } from './accounts'
import { getProfile } from './plan'

interface Base {
  plan: Plan; plan_name: string; plan_status: string; expires_at: string | null; timezone: string
  limits: { pins: number; ai: number; imports: number; ai_images: number }
  used: { pins: number; ai: number; imports: number; ai_images: number }
}

/**
 * Plan, usage and connection status in one object. The plan and usage part is cached 30s and cleared by
 * invalidateProfile(); the account part is read fresh because it depends on which account the request is for.
 */
export async function buildSummary(userId: string, connection: Connection | null = null) {
  let base = await redis.get<Base>(`summary:${userId}`).catch(() => null)
  const profile = await getProfile(userId)
  const plan = PLANS[profile.plan]
  if (!base) {
    const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
    const period = start.toISOString().slice(0, 7)

    const [pinsRes, usageRes] = await Promise.all([
      db.from('scheduled_pins').select('id', { count: 'exact', head: true }).eq('user_id', userId)
        .in('status', ['pending', 'processing', 'published']).gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString()),
      db.from('usage_counters').select('kind, count').eq('user_id', userId).eq('period', period),
    ])
    const usage = Object.fromEntries((usageRes.data ?? []).map((u) => [u.kind, u.count as number]))
    base = {
      plan: profile.plan, plan_name: plan.name, plan_status: profile.plan_status, expires_at: profile.expires_at, timezone: profile.timezone,
      limits: { pins: plan.pins_per_month, ai: plan.ai_generations, imports: plan.website_imports, ai_images: plan.ai_images },
      used: { pins: pinsRes.count ?? 0, ai: usage.ai ?? 0, imports: usage.imports ?? 0, ai_images: usage.ai_images ?? 0 },
    }
    redis.set(`summary:${userId}`, base as never, { ex: 30 }).catch(() => {})
  }
  return {
    ...base,
    pinterest: connection ? { id: connection.id, username: connection.pinterest_username, label: connection.label, status: connection.status } : null,
    accounts: { count: await connectionCount(userId), limit: plan.accounts },
  }
}
