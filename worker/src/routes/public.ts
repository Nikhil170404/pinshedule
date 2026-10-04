import { createHash } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { env } from '../env'
import { redis } from '../lib/clients'
import { confirmEmail } from '../lib/email'
import { reportToSentry } from '../lib/sentry'
import { log } from '../lib/log'

/** Unauthenticated endpoints: email confirmation links and browser error reports. */
export const publicRoutes = new Hono()

publicRoutes.get('/verify-email', async (c) => {
  const token = c.req.query('token') ?? ''
  const ok = token.length >= 20 && token.length <= 80 && (await confirmEmail(token))
  return c.redirect(`${env.appUrl}/dashboard/settings?email=${ok ? 'verified' : 'invalid'}`)
})

const reportBody = z.object({
  message: z.string().max(500),
  stack: z.string().max(4000).optional(),
  digest: z.string().max(100).optional(),
  path: z.string().max(300).optional(),
})

/** Front-end crashes. Anonymous and tightly limited, so it cannot be used to flood logs or Sentry. */
publicRoutes.post('/client-errors', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const key = `rl:client-error:${createHash('sha256').update(ip).digest('hex').slice(0, 16)}`
  const n = await redis.incr(key).catch(() => 0)
  if (n === 1) await redis.expire(key, 60).catch(() => {})
  if (n > 5) return c.json({ ok: false }, 429)
  const parsed = reportBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ ok: false }, 400)
  log.warn('client error', { ...parsed.data, stack: parsed.data.stack?.slice(0, 1500) })
  reportToSentry(`client: ${parsed.data.message}`, { path: parsed.data.path, digest: parsed.data.digest, stack: parsed.data.stack })
  return c.json({ ok: true })
})
