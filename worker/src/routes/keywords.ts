import { Hono } from 'hono'
import { connectionOf, limit, type AppEnv } from '../lib/auth'
import { redis } from '../lib/clients'
import { trendingKeywords, type TrendingKeyword } from '../lib/pinterest'
import { withPinterest } from '../lib/tokens'
import { pinterestFailure } from '../lib/http-errors'

export const keywords = new Hono<AppEnv>()
keywords.use('*', limit('pinterest'))

const REGIONS = new Set(['US', 'CA', 'GB', 'IE', 'AU', 'FR', 'DE', 'IT', 'ES', 'BR', 'MX', 'JP', 'NL', 'SE'])

/** Trending keywords, cached 6h per region and query (shared across users: the data is not personal). */
export async function getKeywords(connectionId: string, regionRaw: string, qRaw: string) {
  const q = qRaw.trim().toLowerCase().slice(0, 60)
  const region = regionRaw.toUpperCase()
  if (!REGIONS.has(region)) throw new Error('Unsupported region')
  const ck = `kw:${region}:${q}`
  const hit = await redis.get<TrendingKeyword[]>(ck).catch(() => null)
  if (hit) return hit
  const list = await withPinterest(connectionId, (t) => trendingKeywords(t, region, q || undefined))
  redis.set(ck, list as never, { ex: 6 * 3600 }).catch(() => {})
  return list
}

keywords.get('/', async (c) => {
  try {
    return c.json({ keywords: await getKeywords(connectionOf(c).id, c.req.query('region') ?? 'US', c.req.query('q') ?? '') })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unsupported region') return c.json({ error: e.message }, 400)
    return pinterestFailure(c, e, 'keywords')
  }
})
