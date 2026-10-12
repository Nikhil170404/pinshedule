import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { z } from 'zod'
import { PLANS, type Plan } from '@shared/plans'
import { limit, type AppEnv } from '../lib/auth'
import { cached, db, redis } from '../lib/clients'
import { log, errMsg } from '../lib/log'

/**
 * Admin console API. Mounted at /v1/admin without the per-account middleware.
 * Safety rules: every request re-checks admin_users (cached 30s so a revoked admin loses access fast), non-admins get a
 * plain 404 so the area is not discoverable, the console is read-only, tokens are never selected, and every look at a user
 * or search is written to admin_audit_log.
 */
export const admin = new Hono<AppEnv>()

export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  const userId = c.get('userId')
  const key = `admin:${userId}`
  let isAdmin = await redis.get<number>(key).catch(() => null)
  if (isAdmin === null || isAdmin === undefined) {
    const { data, error } = await db.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle()
    if (error) { log.error('admin check failed', { error: error.message }); return c.json({ error: 'Not found' }, 404) }
    isAdmin = data ? 1 : 0
    redis.set(key, isAdmin, { ex: 30 }).catch(() => {})
  }
  if (!isAdmin) return c.json({ error: 'Not found' }, 404)
  await next()
}

admin.use('*', limit('default'))

const clientIp = (c: Context<AppEnv>) => (c.req.header('x-forwarded-for') ?? '').split(',')[0].trim() || null

async function audit(c: Context<AppEnv>, action: string, target: string | null, detail: Record<string, unknown> = {}) {
  const { error } = await db.from('admin_audit_log').insert({ admin_id: c.get('userId'), action, target_user: target, detail, ip: clientIp(c) })
  if (error) log.error('audit write failed', { action, error: error.message })
}

admin.get('/me', (c) => c.json({ ok: true }))

const PAYING = new Set(['active', 'cancelling'])

type PlanRow = { plan: Plan; status: string; cycle: string; n: number }

/** Revenue figures are an ESTIMATE from plan prices x active subscribers. There is no payments table, so Razorpay is the source of truth for cash. */
export function revenue(rows: PlanRow[], total: number) {
  const unit = (plan: Plan, cycle: string) => (cycle === 'yearly' ? PLANS[plan].price_yearly_usd / 12 : PLANS[plan].price_monthly_usd)
  let mrr = 0, paying = 0, atRisk = 0, atRiskUsers = 0, churning = 0, churningUsers = 0
  const byPlan: Record<string, { users: number; mrr: number }> = {}
  for (const r of rows) {
    if (!PLANS[r.plan]) continue
    byPlan[r.plan] ??= { users: 0, mrr: 0 }
    byPlan[r.plan].users += r.n
    if (r.plan === 'free_trial') continue
    const value = unit(r.plan, r.cycle) * r.n
    if (PAYING.has(r.status)) { mrr += value; paying += r.n; byPlan[r.plan].mrr += value }
    if (r.status === 'payment_failed') { atRisk += value; atRiskUsers += r.n }
    if (r.status === 'cancelling') { churning += value; churningUsers += r.n }
  }
  return {
    estimate: true,
    currency: 'USD',
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    paying_users: paying,
    arpu: paying ? Math.round((mrr / paying) * 100) / 100 : 0,
    conversion_pct: total ? Math.round((paying / total) * 10000) / 100 : 0,
    at_risk: { mrr: Math.round(atRisk * 100) / 100, users: atRiskUsers, note: 'payment failed' },
    churning: { mrr: Math.round(churning * 100) / 100, users: churningUsers, note: 'cancelled, active until period end' },
    by_plan: Object.entries(byPlan).map(([plan, v]) => ({ plan, name: PLANS[plan as Plan].name, users: v.users, mrr: Math.round(v.mrr * 100) / 100 })),
  }
}

admin.get('/overview', async (c) => {
  try {
    const data = await cached('admin:overview', 300, async () => {
      const { data, error } = await db.rpc('admin_overview')
      if (error) throw new Error(error.message)
      return data as { users: { total: number }; plans: PlanRow[] } & Record<string, unknown>
    })
    return c.json({ ...data, revenue: revenue(data.plans, data.users.total), cached_for_seconds: 300 })
  } catch (e) {
    log.error('admin overview failed', { error: errMsg(e) })
    return c.json({ error: 'Could not load the overview.' }, 500)
  }
})

admin.get('/users', limit('heavy'), async (c) => {
  const q = z.object({
    q: z.string().trim().max(120).optional(),
    plan: z.enum(['free_trial', 'starter', 'pro', 'growth']).optional(),
    before_at: z.string().datetime({ offset: true }).optional(),
    before_id: z.string().uuid().optional(),
  }).safeParse(c.req.query())
  if (!q.success) return c.json({ error: 'Invalid filters' }, 400)
  const PAGE = 25
  const { data, error } = await db.rpc('admin_list_users', {
    p_q: q.data.q || null, p_plan: q.data.plan ?? null,
    p_before_at: q.data.before_at ?? null, p_before_id: q.data.before_id ?? null, p_limit: PAGE + 1,
  })
  if (error) { log.error('admin users failed', { error: error.message }); return c.json({ error: 'Could not load users.' }, 500) }
  const rows = (data ?? []) as { id: string; created_at: string }[]
  const page = rows.slice(0, PAGE)
  if (q.data.q) await audit(c, 'users.search', null, { q: q.data.q, plan: q.data.plan ?? null })
  const last = page.at(-1)
  return c.json({ users: page, next: rows.length > PAGE && last ? { before_at: last.created_at, before_id: last.id } : null })
})

admin.get('/users/:id', async (c) => {
  const id = z.string().uuid().safeParse(c.req.param('id'))
  if (!id.success) return c.json({ error: 'Invalid user id' }, 400)
  const uid = id.data

  const [auth, profile, conns, usage, recent, failures, ...counts] = await Promise.all([
    db.auth.admin.getUserById(uid),
    db.from('user_profiles').select('plan, plan_status, billing_cycle, timezone, notifications_enabled, plan_started_at, plan_expires_at, trial_ends_at, razorpay_subscription_id, razorpay_customer_id, razorpay_payment_id, created_at').eq('id', uid).maybeSingle(),
    // Token columns are deliberately not selected.
    db.from('pinterest_connections').select('id, pinterest_user_id, pinterest_username, label, status, last_error, is_primary, expires_at, created_at, analytics_synced_at').eq('user_id', uid).order('created_at'),
    db.from('usage_counters').select('kind, period, count').eq('user_id', uid).order('period', { ascending: false }).limit(12),
    db.from('scheduled_pins').select('id, title, status, scheduled_at, published_at, attempts, error_message, connection_id').eq('user_id', uid).order('scheduled_at', { ascending: false }).limit(25),
    db.from('scheduled_pins').select('id, title, scheduled_at, attempts, error_message').eq('user_id', uid).eq('status', 'failed').order('scheduled_at', { ascending: false }).limit(10),
    ...(['pending', 'processing', 'published', 'failed'] as const).map((s) => db.from('scheduled_pins').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', s)),
  ])
  if (auth.error || !auth.data.user) return c.json({ error: 'User not found' }, 404)
  const u = auth.data.user
  await audit(c, 'user.view', uid)

  const plan = (profile.data?.plan ?? 'free_trial') as Plan
  return c.json({
    user: {
      id: u.id, email: u.email ?? null, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null, provider: u.app_metadata?.provider ?? null, banned_until: (u as { banned_until?: string }).banned_until ?? null,
    },
    profile: profile.data ?? null,
    plan_limits: PLANS[plan] ?? null,
    connections: conns.data ?? [],
    usage: usage.data ?? [],
    pin_counts: { pending: counts[0].count ?? 0, processing: counts[1].count ?? 0, published: counts[2].count ?? 0, failed: counts[3].count ?? 0 },
    recent_pins: recent.data ?? [],
    recent_failures: failures.data ?? [],
  })
})

admin.get('/logs', async (c) => {
  const [failed, conns, audits] = await Promise.all([
    db.from('scheduled_pins').select('id, user_id, title, scheduled_at, attempts, error_message').eq('status', 'failed').order('scheduled_at', { ascending: false }).limit(100),
    db.from('pinterest_connections').select('id, user_id, pinterest_username, status, last_error, updated_at').eq('status', 'needs_reconnect').order('updated_at', { ascending: false }).limit(50),
    db.from('admin_audit_log').select('id, admin_id, action, target_user, detail, ip, created_at').order('created_at', { ascending: false }).limit(100),
  ])
  const groups = new Map<string, number>()
  for (const f of failed.data ?? []) {
    const key = (f.error_message ?? 'No message').replace(/\d{6,}/g, '#').slice(0, 140)
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return c.json({
    failed_pins: failed.data ?? [],
    top_errors: [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([message, count]) => ({ message, count })),
    broken_connections: conns.data ?? [],
    audit: audits.data ?? [],
  })
})
