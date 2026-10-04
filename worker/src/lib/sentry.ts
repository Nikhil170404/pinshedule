import { randomUUID } from 'node:crypto'

/**
 * Minimal Sentry reporter over the public envelope API (no SDK). Active only when SENTRY_DSN is set.
 * Throttled so a failure loop cannot flood the project or the worker.
 */
const dsn = (() => {
  try {
    const u = new URL(process.env.SENTRY_DSN ?? '')
    const project = u.pathname.replace(/^\//, '')
    return u.username && project ? { key: u.username, url: `${u.protocol}//${u.host}/api/${project}/envelope/`, raw: process.env.SENTRY_DSN! } : null
  } catch { return null }
})()

const recent = new Map<string, number>()
let windowStart = 0
let windowCount = 0

export const sentryEnabled = () => dsn !== null

export function reportToSentry(message: string, extra: Record<string, unknown> = {}, error?: unknown) {
  if (!dsn) return
  const now = Date.now()
  if (now - windowStart > 60_000) { windowStart = now; windowCount = 0 }
  if (windowCount >= 30) return
  const fingerprint = `${message}|${(error instanceof Error ? error.message : String(extra.error ?? '')).slice(0, 80)}`
  if (now - (recent.get(fingerprint) ?? 0) < 60_000) return
  recent.set(fingerprint, now)
  if (recent.size > 500) recent.clear()
  windowCount++

  const eventId = randomUUID().replace(/-/g, '')
  const event = {
    event_id: eventId,
    timestamp: now / 1000,
    platform: 'node',
    level: 'error',
    server_name: 'gopinkaro-worker',
    environment: process.env.NODE_ENV || 'production',
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    message: { formatted: message },
    exception: error instanceof Error ? { values: [{ type: error.name, value: error.message, stacktrace: undefined }] } : undefined,
    extra,
    user: typeof extra.user === 'string' ? { id: extra.user } : undefined,
  }
  const body = `${JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: dsn.raw })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}`
  void fetch(dsn.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-sentry-envelope', 'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.key}, sentry_client=gopinkaro/1.0` },
    body,
    signal: AbortSignal.timeout(5000),
  }).catch(() => {})
}
