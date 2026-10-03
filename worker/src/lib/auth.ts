import { createHash } from 'node:crypto'
import type { Context, Next } from 'hono'
import { Ratelimit } from '@upstash/ratelimit'
import { db, redis } from './clients'

export type AppEnv = { Variables: { userId: string } }

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
