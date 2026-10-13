import { Hono } from 'hono'
import { z } from 'zod'
import { limit, type AppEnv } from '../lib/auth'
import { db } from '../lib/clients'

export const notifications = new Hono<AppEnv>()
notifications.use('*', limit('default'))

notifications.get('/', async (c) => {
  const userId = c.get('userId')
  const [list, unread] = await Promise.all([
    db.from('notifications').select('id, kind, title, body, link, read_at, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null),
  ])
  return c.json({ notifications: list.data ?? [], unread: unread.count ?? 0 })
})

notifications.post('/read', async (c) => {
  const parsed = z.object({ ids: z.array(z.string().uuid()).max(100).optional() }).safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)
  let q = db.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', c.get('userId')).is('read_at', null)
  if (parsed.data.ids?.length) q = q.in('id', parsed.data.ids)
  await q
  return c.json({ ok: true })
})
