import { env } from '../env'

export class PinterestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly retryAfterSec?: number
  ) {
    super(message)
  }
  /** Worth retrying later: rate limits, 5xx, network. */
  get transient() {
    return this.status === 429 || this.status >= 500 || this.status === 0
  }
  get unauthorized() {
    return this.status === 401
  }
}

async function call<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${env.pinterestApi}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(25_000),
    })
  } catch (e) {
    throw new PinterestError(`Network error talking to Pinterest: ${e instanceof Error ? e.message : e}`, 0)
  }
  if (res.ok) return (res.status === 204 ? ({} as T) : ((await res.json()) as T))
  const body = (await res.json().catch(() => ({}))) as { message?: string; code?: number }
  const retry = Number(res.headers.get('retry-after')) || undefined
  throw new PinterestError(body.message ?? `Pinterest returned HTTP ${res.status}`, res.status, body.code, retry)
}

export interface Board {
  id: string
  name: string
  description?: string
  privacy?: string
  pin_count?: number
  follower_count?: number
  media?: { image_cover_url?: string }
}

export async function listBoards(token: string): Promise<Board[]> {
  const boards: Board[] = []
  let bookmark: string | undefined
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ page_size: '250' })
    if (bookmark) q.set('bookmark', bookmark)
    const data = await call<{ items?: Board[]; bookmark?: string | null }>(`/boards?${q}`, token)
    boards.push(...(data.items ?? []))
    if (!data.bookmark) break
    bookmark = data.bookmark
  }
  return boards
}

export function createBoard(token: string, b: { name: string; description?: string; privacy?: 'PUBLIC' | 'SECRET' }) {
  return call<Board>('/boards', token, { method: 'POST', body: JSON.stringify(b) })
}

export interface NewPin {
  board_id: string
  title?: string | null
  description?: string | null
  alt_text?: string | null
  link?: string | null
  image_url: string
}

export function createPin(token: string, pin: NewPin) {
  const body: Record<string, unknown> = {
    board_id: pin.board_id,
    media_source: { source_type: 'image_url', url: pin.image_url },
  }
  if (pin.title) body.title = pin.title
  if (pin.description) body.description = pin.description
  if (pin.alt_text) body.alt_text = pin.alt_text
  if (pin.link) body.link = pin.link
  return call<{ id: string }>('/pins', token, { method: 'POST', body: JSON.stringify(body) })
}

export function getUserAccount(token: string) {
  return call<{ id: string; username?: string; profile_image?: string }>('/user_account', token)
}

type Metrics = Record<string, number | undefined>
interface AnalyticsResponse {
  all?: {
    daily_metrics?: { date: string; metrics?: Metrics }[]
    summary_metrics?: Metrics
    lifetime_metrics?: Metrics
  }
}

const METRICS = 'IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK,ENGAGEMENT'

export async function accountAnalytics(token: string, start: string, end: string) {
  const q = new URLSearchParams({ start_date: start, end_date: end, metric_types: METRICS, split_field: 'NO_SPLIT' })
  const data = await call<AnalyticsResponse>(`/user_account/analytics?${q}`, token)
  return data.all?.daily_metrics ?? []
}

export async function pinAnalytics(token: string, pinId: string, start: string, end: string) {
  const q = new URLSearchParams({ start_date: start, end_date: end, metric_types: 'IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK' })
  const data = await call<AnalyticsResponse>(`/pins/${encodeURIComponent(pinId)}/analytics?${q}`, token)
  return data.all?.summary_metrics ?? data.all?.lifetime_metrics ?? {}
}

export interface TrendingKeyword { keyword: string; pct_growth_wow?: number; pct_growth_mom?: number; pct_growth_yoy?: number }

export async function trendingKeywords(token: string, region: string, q?: string) {
  const params = new URLSearchParams({ limit: '50' })
  if (q) params.set('include_keywords', q)
  const data = await call<{ trends?: TrendingKeyword[] }>(`/trends/keywords/${region}/top/monthly?${params}`, token)
  return data.trends ?? []
}

// ─── OAuth ──────────────────────────────────────────────────────────────────
interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
  scope?: string
}

export class OAuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
  /** Refresh token is dead or revoked: user must reconnect. */
  get permanent() {
    return this.status === 400 || this.status === 401 || this.status === 403
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const basic = Buffer.from(`${env.pinterestClientId}:${env.pinterestClientSecret}`).toString('base64')
  let res: Response
  try {
    res = await fetch(`${env.pinterestApi}/oauth/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, refresh_on: 'true' }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    throw new OAuthError(`Network error refreshing token: ${e instanceof Error ? e.message : e}`, 0)
  }
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { message?: string }
    throw new OAuthError(b.message ?? `Token refresh failed (HTTP ${res.status})`, res.status)
  }
  return (await res.json()) as TokenResponse
}
