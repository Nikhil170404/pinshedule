import { Hono } from 'hono'
import { z } from 'zod'
import { PLANS } from '@shared/plans'
import { limit, type AppEnv } from '../lib/auth'
import { CONNECTION_COLUMNS, type Connection } from '../lib/accounts'
import { db, redis } from '../lib/clients'
import { getProfile, invalidateProfile } from '../lib/plan'
import { getUserAccount } from '../lib/pinterest'
import { NotConnectedError, withPinterest } from '../lib/tokens'
import { pinterestFailure } from '../lib/http-errors'

/** Manage the Pinterest accounts of one login. Adding happens through the OAuth flow (Next.js), not here. */
export const accounts = new Hono<AppEnv>()
accounts.use('*', limit('default'))

interface Stats { connection_id: string; pending: number; failed: number; published_30d: number; last_published_at: string | null; next_at: string | null }

async function owned(userId: string, id: string): Promise<Connection | null> {
  const { data } = await db.from('pinterest_connections').select(CONNECTION_COLUMNS).eq('id', id).eq('user_id', userId).maybeSingle()
  return (data as Connection | null) ?? null
}

/** Every account with its queue numbers, in one grouped query (built for dozens of accounts). */
accounts.get('/', async (c) => {
  const userId = c.get('userId')
  const profile = await getProfile(userId)
  const [conns, stats] = await Promise.all([
    db.from('pinterest_connections').select(CONNECTION_COLUMNS).eq('user_id', userId).order('is_primary', { ascending: false }).order('created_at'),
    db.rpc('account_stats', { p_user: userId }),
  ])
  if (conns.error) return c.json({ error: 'Could not load your accounts.' }, 500)
  const byId = new Map(((stats.data ?? []) as Stats[]).map((s) => [s.connection_id, s]))
  const list = ((conns.data ?? []) as Connection[]).map((a) => {
    const s = byId.get(a.id)
    return {
      id: a.id, username: a.pinterest_username, label: a.label, avatar_url: a.avatar_url, status: a.status, last_error: a.last_error,
      is_primary: a.is_primary, created_at: a.created_at,
      stats: { pending: Number(s?.pending ?? 0), failed: Number(s?.failed ?? 0), published_30d: Number(s?.published_30d ?? 0), last_published_at: s?.last_published_at ?? null, next_at: s?.next_at ?? null },
    }
  })
  const max = PLANS[profile.plan].accounts
  return c.json({ accounts: list, limit: max, count: list.length, can_add: list.length < max, plan_name: PLANS[profile.plan].name })
})

accounts.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const parsed = z.object({ label: z.string().trim().max(40).nullable() }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Names can be up to 40 characters.' }, 400)
  if (!(await owned(userId, c.req.param('id')))) return c.json({ error: 'Account not found.' }, 404)
  const { error } = await db.from('pinterest_connections').update({ label: parsed.data.label || null }).eq('id', c.req.param('id')).eq('user_id', userId)
  if (error) return c.json({ error: 'Could not rename the account.' }, 500)
  return c.json({ ok: true })
})

/** Remove an account together with its queue and history. */
accounts.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const conn = await owned(userId, id)
  if (!conn) return c.json({ error: 'Account not found.' }, 404)
  const { error } = await db.from('pinterest_connections').delete().eq('id', id).eq('user_id', userId)
  if (error) return c.json({ error: 'Could not remove the account.' }, 500)
  if (conn.is_primary) {
    // The oldest remaining account becomes the default one.
    const { data: next } = await db.from('pinterest_connections').select('id').eq('user_id', userId).order('created_at').limit(1).maybeSingle()
    if (next) await db.from('pinterest_connections').update({ is_primary: true }).eq('id', next.id)
  }
  await redis.del(`boards:${id}`).catch(() => {})
  await invalidateProfile(userId)
  return c.json({ ok: true })
})

/** Ask Pinterest whether the connection still works, and refresh the name and picture. */
accounts.post('/:id/check', limit('pinterest'), async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id') as string
  if (!(await owned(userId, id))) return c.json({ error: 'Account not found.' }, 404)
  try {
    const me = await withPinterest(id, getUserAccount)
    await db.from('pinterest_connections')
      .update({ status: 'active', last_error: null, pinterest_username: me.username ?? null, avatar_url: me.profile_image ?? null, updated_at: new Date().toISOString() })
      .eq('id', id)
    return c.json({ ok: true, username: me.username ?? null })
  } catch (e) {
    if (e instanceof NotConnectedError) return c.json({ ok: false, error: e.message, reconnect: true }, 409)
    return pinterestFailure(c, e, 'account check')
  }
})
