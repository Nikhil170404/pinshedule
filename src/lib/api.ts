import { createClient } from '@/lib/supabase/client'
import { activeAccount } from '@/lib/account-store'

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly data: Record<string, unknown> = {}) {
    super(message)
  }
  get upgradeRequired() { return this.data.upgrade_required === true }
  get reconnect() { return this.data.reconnect === true }
}

/** Call the Railway worker with the user's Supabase token. */
export async function api<T = Record<string, unknown>>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.location.href = '/login'
    throw new ApiError('Please sign in again.', 401)
  }
  let res: Response
  try {
    res = await fetch(`${BASE}/v1${path}`, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(activeAccount.get() ? { 'X-Account-Id': activeAccount.get() as string } : {}),
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0)
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.status === 404 && data.account_missing) {
    // That account was removed (maybe in another tab): forget it so the next call uses an account that exists.
    activeAccount.set(null)
    window.dispatchEvent(new Event('gpk:accounts-stale'))
  }
  if (!res.ok) throw new ApiError(typeof data.error === 'string' ? data.error : 'Something went wrong.', res.status, data)
  return data as T
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')
