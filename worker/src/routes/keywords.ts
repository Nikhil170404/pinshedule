import { Hono } from 'hono'
import { limit, type AppEnv } from '../lib/auth'
import { redis } from '../lib/clients'
import { PinterestError, trendingKeywords, type TrendingKeyword } from '../lib/pinterest'
import { NotConnectedError, withPinterest } from '../lib/tokens'

export const keywords = new Hono<AppEnv>()
keywords.use('*', limit('pinterest'))

const REGIONS = new Set(['US', 'CA', 'GB', 'IE', 'AU', 'FR', 'DE', 'IT', 'ES', 'BR', 'MX', 'JP', 'NL', 'SE'])

/** Trending keywords, cached 6h per region and query (shared across users: the data is not personal). */
export async function getKeywords(userId: string, regionRaw: string, qRaw: string) {
  const q = qRaw.trim().toLowerCase().slice(0, 60)
  const region = regionRaw.toUpperCase()
  if (!REGIONS.has(region)) throw new Error('Unsupported region')
  const ck = `kw:${region}:${q}`
  const hit = await redis.get<TrendingKeyword[]>(ck).catch(() => null)
  if (hit) return hit
  const list = await withPinterest(userId, (t) => trendingKeywords(t, region, q || undefined))
  redis.set(ck, list as never, { ex: 6 * 3600 }).catch(() => {})
  return list
}

keywords.get('/', async (c) => {
  try {
    return c.json({ keywords: await getKeywords(c.get('userId'), c.req.query('region') ?? 'US', c.req.query('q') ?? '') })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unsupported region') return c.json({ error: e.message }, 400)
    if (e instanceof NotConnectedError) return c.json({ error: e.message, reconnect: true }, 409)
    if (e instanceof PinterestError) return c.json({ error: e.message }, e.status === 429 ? 429 : 502)
    return c.json({ error: 'Could not reach Pinterest' }, 502)
  }
})
