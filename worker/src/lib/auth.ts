import { createHash } from 'node:crypto'
import type { Context, Next } from 'hono'
import { Ratelimit } from '@upstash/ratelimit'
import { db, redis } from './clients'
import { AccountError, resolveConnection, type Connection } from './accounts'

export type AppEnv = { Variables: { userId: string; connection: Connection | null; accountStale: boolean } }

/** Verifies the Supabase access token sent by the browser. Positive results are cached for 60s. */
export async function requireUser(c: Context<AppEnv>, next: Next) {
  const header = c.req.header('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const key = `auth:${createHash('sha256').update(token).digest('hex')}`
  let userId = await redis.get<string>(key).catch(() => null)
  if (!userId) {
    const { data, error } = await db.auth.getUser(token)
    if (error || !data.user) return c.json({ error: 'Unauthorized' }, 401)
    userId = data.user.id
    redis.set(key, userId, { ex: 60 }).catch(() => {})
  }
  c.set('userId', userId)
  await next()
}

/**
 * Works out which Pinterest account the request is for (X-Account-Id, else the primary). Never rejects by
 * itself: routes that need an account call connectionOf(), so account-free routes (plans, billing) keep working.
 */
export async function withAccount(c: Context<AppEnv>, next: Next) {
  const requested = c.req.header('x-account-id') || null
  const { connection, stale } = await resolveConnection(c.get('userId'), requested)
  c.set('connection', connection)
  c.set('accountStale', stale)
  await next()
}

/** The account this request acts on, or an AccountError the app turns into a clear 404/409. */
export function connectionOf(c: Context<AppEnv>): Connection {
  if (c.get('accountStale')) throw new AccountError('That Pinterest account is no longer connected. Choose another account.', 404, { account_missing: true })
  const conn = c.get('connection')
  if (!conn) throw new AccountError('Connect a Pinterest account first.', 409, { reconnect: true })
  return conn
}

const limiters = {
  default: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1 m'), prefix: 'rl:default' }),
  heavy: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m'), prefix: 'rl:heavy' }),
  pinterest: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(40, '1 m'), prefix: 'rl:pinterest' }),
  payment: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'rl:payment' }),
}

export function limit(name: keyof typeof limiters) {
  return async (c: Context<AppEnv>, next: Next) => {
    try {
      const { success, reset } = await limiters[name].limit(c.get('userId'))
      if (!success) {
        c.header('Retry-After', String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))))
        return c.json({ error: 'Too many requests. Please slow down.' }, 429)
      }
    } catch {
      // Redis outage must not take the API down.
    }
    await next()
  }
}
