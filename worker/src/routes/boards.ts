import { Hono } from 'hono'
import { z } from 'zod'
import { connectionOf, limit, type AppEnv } from '../lib/auth'
import { redis } from '../lib/clients'
import { createBoard, listBoards } from '../lib/pinterest'
import { withPinterest } from '../lib/tokens'
import { pinterestFailure } from '../lib/http-errors'

export const boards = new Hono<AppEnv>()
boards.use('*', limit('pinterest'))

const key = (connectionId: string) => `boards:${connectionId}`

export interface BoardOut {
  id: string; name: string; description: string; privacy: string; pin_count: number; follower_count: number; image_url: string | null; thumbnails: string[]
}

/** Boards of one Pinterest account: Redis first (10 min), Pinterest on a miss. */
export async function loadBoards(connectionId: string, force = false): Promise<BoardOut[]> {
  if (!force) {
    const hit = await redis.get<BoardOut[]>(key(connectionId)).catch(() => null)
    if (hit) return hit
  }
  const list = (await withPinterest(connectionId, listBoards)).map((b) => ({
    id: b.id, name: b.name, description: b.description ?? '', privacy: b.privacy ?? 'PUBLIC',
    pin_count: b.pin_count ?? 0, follower_count: b.follower_count ?? 0,
    // Pinterest does not always send a cover; pin thumbnails make a good fallback.
    image_url: b.media?.image_cover_url ?? b.media?.pin_thumbnail_urls?.[0] ?? null,
    thumbnails: (b.media?.pin_thumbnail_urls ?? []).slice(0, 4),
  }))
  redis.set(key(connectionId), list as never, { ex: 600 }).catch(() => {})
  return list
}

const fail = (c: import('hono').Context, e: unknown) => pinterestFailure(c, e, 'boards')

boards.get('/', async (c) => {
  try {
    c.header('Cache-Control', 'private, max-age=30')
    return c.json({ boards: await loadBoards(connectionOf(c).id, c.req.query('refresh') === '1') })
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
  const connectionId = connectionOf(c).id
  const parsed = createBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid board' }, 400)
  try {
    const b = await withPinterest(connectionId, (t) => createBoard(t, parsed.data))
    await redis.del(key(connectionId)).catch(() => {})
    return c.json({ board: { id: b.id, name: b.name } })
  } catch (e) {
    return fail(c, e)
  }
})
