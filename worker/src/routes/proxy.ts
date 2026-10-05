import { Hono } from 'hono'
import { z } from 'zod'
import { limit, type AppEnv } from '../lib/auth'
import { safeFetchImage } from '../lib/safe-fetch'
import { errMsg } from '../lib/log'

/**
 * Lets the dashboard draw a web page's photo onto a canvas. Browsers refuse to read pixels from another site's
 * image, so the worker fetches it (SSRF-checked, size-capped, images only) and hands it back to the signed-in user.
 */
export const proxy = new Hono<AppEnv>()
proxy.use('*', limit('default'))

proxy.get('/image', async (c) => {
  const url = z.string().url().max(2048).safeParse(c.req.query('url'))
  if (!url.success) return c.json({ error: 'Provide an image URL.' }, 400)
  try {
    const { bytes, type } = await safeFetchImage(url.data)
    return c.body(new Uint8Array(bytes), 200, { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' })
  } catch (e) {
    return c.json({ error: errMsg(e) }, 422)
  }
})
