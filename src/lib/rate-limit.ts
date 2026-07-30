import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

const limiters = {
  // expensive: calls a paid third-party API (Anthropic)
  ai: redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'rl:ai' }),
  // proxies to Pinterest's API, which has its own rate limits
  pinterest: redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'), prefix: 'rl:pinterest' }),
  // money-moving endpoints
  payment: redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'rl:payment' }),
  // general authenticated API traffic
  default: redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m'), prefix: 'rl:default' }),
} as const

type LimiterName = keyof typeof limiters

/**
 * Rate-limits by the given key (typically a user id). No-ops with a console
 * warning if Upstash isn't configured, so local dev works without it.
 */
export async function rateLimit(name: LimiterName, key: string) {
  const limiter = limiters[name]
  if (!limiter) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`Rate limiting disabled (no UPSTASH_REDIS_REST_URL/TOKEN) — allowing request for "${name}"`)
    }
    return { success: true as const }
  }
  return limiter.limit(key)
}

export function rateLimitResponse() {
  return NextResponse.json({ error: 'Too many requests, please slow down.' }, { status: 429 })
}
