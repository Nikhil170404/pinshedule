import { Hono } from 'hono'
import { limit, type AppEnv } from '../lib/auth'
import { redis } from '../lib/clients'
import { PinterestError, trendingKeywords } from '../lib/pinterest'
import { NotConnectedError, withPinterest } from '../lib/tokens'

export const keywords = new Hono<AppEnv>()
keywords.use('*', limit('pinterest'))

const REGIONS = new Set(['US', 'CA', 'GB', 'IE', 'AU', 'FR', 'DE', 'IT', 'ES', 'BR', 'MX', 'JP', 'NL', 'SE'])

keywords.get('/', async (c) => {
  const userId = c.get('userId')
  const q = (c.req.query('q') ?? '').trim().toLowerCase().slice(0, 60)
  const region = (c.req.query('region') ?? 'US').toUpperCase()
  if (!REGIONS.has(region)) return c.json({ error: 'Unsupported region' }, 400)

  const ck = `kw:${region}:${q}`
  const hit = await redis.get(ck).catch(() => null)
  if (hit) return c.json({ keywords: hit })
  try {
    const list = await withPinterest(userId, (t) => trendingKeywords(t, region, q || undefined))
    redis.set(ck, list as never, { ex: 6 * 3600 }).catch(() => {})
    return c.json({ keywords: list })
  } catch (e) {
    if (e instanceof NotConnectedError) return c.json({ error: e.message, reconnect: true }, 409)
    if (e instanceof PinterestError) return c.json({ error: e.message }, e.status === 429 ? 429 : 502)
    return c.json({ error: 'Could not reach Pinterest' }, 502)
  }
})
