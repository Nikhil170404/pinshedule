import { Hono } from 'hono'
import { z } from 'zod'
import { limit, type AppEnv } from '../lib/auth'
import { redis } from '../lib/clients'
import { createBoard, listBoards } from '../lib/pinterest'
import { withPinterest } from '../lib/tokens'
import { pinterestFailure } from '../lib/http-errors'
import { resolveConnection } from '../lib/connections'
import { ServiceError } from '../lib/service-error'

export const boards = new Hono<AppEnv>()
boards.use('*', limit('pinterest'))

const key = (u: string, conn: string) => `boards:${u}:${conn}`

export interface BoardOut {
  id: string; name: string; description: string; privacy: string; pin_count: number; follower_count: number; image_url: string | null; thumbnails: string[]
}

/** Boards for a user: Redis first (10 min), Pinterest on a miss. */
export async function loadBoards(userId: string, force = false, connectionId?: string | null): Promise<BoardOut[]> {
  const conn = await resolveConnection(userId, connectionId)
  if (!force) {
    const hit = await redis.get<BoardOut[]>(key(userId, conn)).catch(() => null)
    if (hit) return hit
  }
  const list = (await withPinterest(userId, listBoards, conn)).map((b) => ({
    id: b.id, name: b.name, description: b.description ?? '', privacy: b.privacy ?? 'PUBLIC',
    pin_count: b.pin_count ?? 0, follower_count: b.follower_count ?? 0,
    // Pinterest does not always send a cover; pin thumbnails make a good fallback.
    image_url: b.media?.image_cover_url ?? b.media?.pin_thumbnail_urls?.[0] ?? null,
    thumbnails: (b.media?.pin_thumbnail_urls ?? []).slice(0, 4),
  }))
  redis.set(key(userId, conn), list as never, { ex: 600 }).catch(() => {})
  return list
}

const fail = (c: import('hono').Context, e: unknown) => {
  if (e instanceof ServiceError) return c.json({ error: e.message }, e.status as 400)
  return pinterestFailure(c, e, 'boards')
}

boards.get('/', async (c) => {
  try {
    c.header('Cache-Control', 'private, max-age=30')
    return c.json({ boards: await loadBoards(c.get('userId'), c.req.query('refresh') === '1', c.req.query('connection')) })
  } catch (e) {
    return fail(c, e)
  }
})

const createBody = z.object({
  name: z.string().trim().min(1).max(50),
  description: z.string().trim().max(500).optional(),
  privacy: z.enum(['PUBLIC', 'SECRET']).default('PUBLIC'),
})

boards.post('/', async (c) => {
  const userId = c.get('userId')
  const parsed = createBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid board' }, 400)
  try {
    const conn = await resolveConnection(userId, c.req.query('connection'))
    const b = await withPinterest(userId, (t) => createBoard(t, parsed.data), conn)
    await redis.del(key(userId, conn)).catch(() => {})
    return c.json({ board: { id: b.id, name: b.name } })
  } catch (e) {
    return fail(c, e)
  }
})
