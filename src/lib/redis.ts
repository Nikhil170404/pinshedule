import { Redis } from '@upstash/redis'

export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try {
    return await redis.get<T>(key)
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis) return
  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch {}
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return
  try {
    await redis.del(...keys)
  } catch {}
}

// Monthly usage counters — keyed as "usage:{type}:{userId}:{YYYY-MM}"
// TTL = 35 days so the key outlives the month slightly for debugging.
// Returns null when Redis is unavailable (caller must fall back to DB count).
export async function monthlyUsageIncr(type: string, userId: string): Promise<number | null> {
  if (!redis) return null
  const key = usageKey(type, userId)
  try {
    const [count] = await redis.pipeline().incr(key).expire(key, 35 * 24 * 3600).exec()
    return typeof count === 'number' ? count : null
  } catch {
    return null
  }
}

export async function monthlyUsageGet(type: string, userId: string): Promise<number> {
  if (!redis) return 0
  try {
    const v = await redis.get<number>(usageKey(type, userId))
    return v ?? 0
  } catch {
    return 0
  }
}

function usageKey(type: string, userId: string) {
  const now = new Date()
  return `usage:${type}:${userId}:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}
