import { PLANS } from '@shared/plans'
import { db, redis } from './clients'
import { getProfile } from './plan'
import { emailEnabled } from './email'
import { listConnections } from './connections'

/** Plan, usage and connection status in one object. Cached 30s and cleared by invalidateProfile(). */
export async function buildSummary(userId: string) {
  const hit = await redis.get<Record<string, unknown>>(`summary:${userId}`).catch(() => null)
  if (hit) return hit
  const profile = await getProfile(userId)
  const plan = PLANS[profile.plan]
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  const period = start.toISOString().slice(0, 7)

  const [pinsRes, usageRes, accounts, extraRes, autoRes] = await Promise.all([
    db.from('scheduled_pins').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      .in('status', ['pending', 'processing', 'published']).gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString()),
    db.from('usage_counters').select('kind, count').eq('user_id', userId).eq('period', period),
    listConnections(userId),
    db.from('user_profiles').select('notification_email, notification_email_verified, notifications_enabled, next_plan, next_billing_cycle, next_plan_at, billing_cycle').eq('id', userId).maybeSingle(),
    db.from('automations').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('enabled', true),
  ])
  const extra = extraRes.data
  const primary = accounts[0]
  const usage = Object.fromEntries((usageRes.data ?? []).map((u) => [u.kind, u.count as number]))
  const body = {
    plan: profile.plan, plan_name: plan.name, plan_status: profile.plan_status, expires_at: profile.expires_at, timezone: profile.timezone,
    limits: { pins: plan.pins_per_month, ai: plan.ai_generations, imports: plan.website_imports, accounts: plan.accounts, automations: plan.automations },
    used: { pins: pinsRes.count ?? 0, ai: usage.ai ?? 0, imports: usage.imports ?? 0, accounts: accounts.length, automations: autoRes.count ?? 0 },
    pinterest: primary ? { username: primary.username, status: primary.status } : null,
    accounts: accounts.map((a) => ({ id: a.id, username: a.username, status: a.status, is_primary: a.is_primary })),
    billing_cycle: (extra?.billing_cycle as string | null) ?? null,
    next_plan: extra?.next_plan ? { plan: extra.next_plan as string, cycle: extra.next_billing_cycle as string, at: extra.next_plan_at as string } : null,
    email: { address: (extra?.notification_email as string | null) ?? null, verified: extra?.notification_email_verified === true, enabled: extra?.notifications_enabled !== false, can_send: emailEnabled() },
  }
  redis.set(`summary:${userId}`, body as never, { ex: 30 }).catch(() => {})
  return body
}
