import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { bodyLimit } from 'hono/body-limit'
import { serve } from '@hono/node-server'
import { env } from './env'
import { requireUser, type AppEnv } from './lib/auth'
import { log, errMsg } from './lib/log'
import { redis, db } from './lib/clients'
import { startJobs } from './jobs'
import { pins } from './routes/pins'
import { boards } from './routes/boards'
import { importer } from './routes/import'
import { ai } from './routes/ai'
import { keywords } from './routes/keywords'
import { account } from './routes/account'
import { billing, razorpayWebhook } from './routes/billing'

const app = new Hono<AppEnv>()
const origins = new Set([env.appUrl, ...env.extraOrigins])

app.use('*', secureHeaders())
app.use('*', bodyLimit({ maxSize: 1024 * 1024, onError: (c) => c.json({ error: 'Request too large' }, 413) }))
// API responses are per-user: never let a shared cache keep them (routes may override with a private max-age).
app.use('/v1/*', async (c, next) => { await next(); if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store') })
app.use('/v1/*', cors({
  origin: (o) => (origins.has(o) ? o : null),
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  maxAge: 600,
}))

app.get('/health', async (c) => {
  const [r, d] = await Promise.allSettled([redis.ping(), db.from('user_profiles').select('id').limit(1)])
  const ok = r.status === 'fulfilled' && d.status === 'fulfilled'
  return c.json({ ok, redis: r.status === 'fulfilled', database: d.status === 'fulfilled' }, ok ? 200 : 503)
})

app.route('/webhooks/razorpay', razorpayWebhook as unknown as Hono<AppEnv>)

const v1 = new Hono<AppEnv>()
v1.use('*', requireUser)
v1.route('/pins', pins)
v1.route('/boards', boards)
v1.route('/import', importer)
v1.route('/ai', ai)
v1.route('/keywords', keywords)
v1.route('/account', account)
v1.route('/billing', billing)
app.route('/v1', v1)

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((e, c) => {
  log.error('unhandled', { path: c.req.path, error: errMsg(e) })
  return c.json({ error: 'Something went wrong. Please try again.' }, 500)
})

const server = serve({ fetch: app.fetch, port: env.port }, (i) => log.info('api listening', { port: i.port }))
const stopJobs = env.runJobs ? startJobs() : () => {}

// Railway sends SIGTERM on deploy: stop taking work, let in-flight requests finish.
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    log.info('shutting down', { sig })
    stopJobs()
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 15_000).unref()
  })
}
process.on('unhandledRejection', (e) => log.error('unhandledRejection', { error: errMsg(e) }))
