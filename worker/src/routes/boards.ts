import { Hono } from 'hono'
import { z } from 'zod'
import { limit, type AppEnv } from '../lib/auth'
import { redis } from '../lib/clients'
import { createBoard, listBoards, PinterestError } from '../lib/pinterest'
import { NotConnectedError, withPinterest } from '../lib/tokens'

export const boards = new Hono<AppEnv>()
boards.use('*', limit('pinterest'))

const key = (u: string) => `boards:${u}`

export interface BoardOut {
  id: string; name: string; description: string; privacy: string; pin_count: number; follower_count: number; image_url: string | null
}

/** Boards for a user: Redis first (10 min), Pinterest on a miss. */
export async function loadBoards(userId: string, force = false): Promise<BoardOut[]> {
  if (!force) {
    const hit = await redis.get<BoardOut[]>(key(userId)).catch(() => null)
    if (hit) return hit
  }
  const list = (await withPinterest(userId, listBoards)).map((b) => ({
    id: b.id, name: b.name, description: b.description ?? '', privacy: b.privacy ?? 'PUBLIC',
    pin_count: b.pin_count ?? 0, follower_count: b.follower_count ?? 0, image_url: b.media?.image_cover_url ?? null,
  }))
  redis.set(key(userId), list as never, { ex: 600 }).catch(() => {})
  return list
}

function fail(c: import('hono').Context, e: unknown) {
  if (e instanceof NotConnectedError) return c.json({ error: e.message, reconnect: true }, 409)
  if (e instanceof PinterestError) return c.json({ error: e.message }, e.status === 429 ? 429 : 502)
  return c.json({ error: 'Could not reach Pinterest' }, 502)
}

boards.get('/', async (c) => {
  try {
    c.header('Cache-Control', 'private, max-age=30')
    return c.json({ boards: await loadBoards(c.get('userId'), c.req.query('refresh') === '1') })
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
    const b = await withPinterest(userId, (t) => createBoard(t, parsed.data))
    await redis.del(key(userId)).catch(() => {})
    return c.json({ board: { id: b.id, name: b.name } })
  } catch (e) {
    return fail(c, e)
  }
})
