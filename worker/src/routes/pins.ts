import { Hono } from 'hono'
import { z } from 'zod'
import { limit, type AppEnv } from '../lib/auth'
import { NotConnectedError } from '../lib/tokens'
import { deletePins, patchBody, previewSlots, retryPins, schedulePins, scheduleBody, ServiceError, updatePin } from '../lib/pin-service'

export const pins = new Hono<AppEnv>()
pins.use('*', limit('default'))

/** Map service errors to HTTP responses. */
async function run<T>(c: import('hono').Context, fn: () => Promise<T>) {
  try {
    return c.json((await fn()) as never)
  } catch (e) {
    if (e instanceof ServiceError) return c.json({ error: e.message, ...e.extra }, e.status as 400)
    if (e instanceof NotConnectedError) return c.json({ error: e.message, reconnect: true }, 409)
    throw e
  }
}

pins.post('/schedule', async (c) => {
  const parsed = scheduleBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request', path: parsed.error.issues[0]?.path }, 400)
  return run(c, () => schedulePins(c.get('userId'), parsed.data))
})

pins.patch('/:id', async (c) => {
  const parsed = patchBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, 400)
  return run(c, async () => { await updatePin(c.get('userId'), c.req.param('id'), parsed.data); return { ok: true } })
})

const idsBody = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) })

pins.post('/delete', async (c) => {
  const parsed = idsBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'ids required' }, 400)
  return run(c, async () => ({ deleted: await deletePins(c.get('userId'), parsed.data.ids) }))
})

pins.post('/retry', async (c) => {
  const parsed = idsBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'ids required' }, 400)
  return run(c, async () => ({ retried: await retryPins(c.get('userId'), parsed.data.ids) }))
})

/** Preview best-time slots. */
pins.get('/slots', async (c) => {
  const count = Math.min(Math.max(1, Number(c.req.query('count') ?? 1) || 1), 200)
  const perDay = Math.min(Math.max(1, Number(c.req.query('per_day') ?? 2) || 2), 10)
  return run(c, () => previewSlots(c.get('userId'), count, perDay, c.req.query('connection')))
})
