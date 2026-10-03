import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { env } from '../env'

export const db = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const redis = new Redis({ url: env.redisUrl, token: env.redisToken })

/**
 * Run `fn` only if we win the lock. The lock is held for the full TTL (not released on completion)
 * so that several replicas running the same interval loop don't each execute the job.
 */
export async function withLock<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T | undefined> {
  const ok = await redis.set(`lock:${key}`, '1', { nx: true, ex: ttlSec })
  if (ok !== 'OK') return undefined
  return fn()
}

export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get<T>(key)
    if (hit !== null && hit !== undefined) return hit
  } catch {}
  const value = await load()
  redis.set(key, value as never, { ex: ttlSec }).catch(() => {})
  return value
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx])
      }
    })
  )
  return out
}
