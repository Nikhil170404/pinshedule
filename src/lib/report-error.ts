const BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')
let sent = 0

/** Send a front-end crash to the API (which logs it and forwards it to Sentry when configured). Never throws. */
export function reportClientError(error: unknown, extra: { digest?: string } = {}) {
  if (!BASE || sent >= 3 || typeof window === 'undefined') return // a crash loop must not become a request loop
  sent++
  const e = error instanceof Error ? error : new Error(String(error))
  try {
    void fetch(`${BASE}/public/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: e.message.slice(0, 500), stack: e.stack?.slice(0, 4000), digest: extra.digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {})
  } catch { /* reporting is best effort */ }
}
