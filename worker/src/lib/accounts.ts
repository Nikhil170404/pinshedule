import { db } from './clients'

/** One connected Pinterest account. A login (workspace) owns many of these. */
export interface Connection {
  id: string
  user_id: string
  pinterest_user_id: string
  pinterest_username: string | null
  label: string | null
  avatar_url: string | null
  status: 'active' | 'needs_reconnect'
  is_primary: boolean
  created_at: string
  last_error: string | null
}

export const CONNECTION_COLUMNS = 'id, user_id, pinterest_user_id, pinterest_username, label, avatar_url, status, is_primary, created_at, last_error'

/** Raised when a request needs a Pinterest account and there is none (or the one named is gone). Mapped to HTTP in index.ts. */
export class AccountError extends Error {
  constructor(message: string, readonly status: 404 | 409, readonly extra: Record<string, unknown> = {}) {
    super(message)
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The account a request is about. If the browser names one (X-Account-Id) it must belong to this login,
 * otherwise `stale` is set and callers refuse rather than silently acting on a different account.
 * With no account named, the primary (oldest) one is used.
 */
export async function resolveConnection(userId: string, requested?: string | null): Promise<{ connection: Connection | null; stale: boolean }> {
  if (requested) {
    if (!UUID.test(requested)) return { connection: null, stale: true }
    const { data } = await db.from('pinterest_connections').select(CONNECTION_COLUMNS).eq('id', requested).eq('user_id', userId).maybeSingle()
    return { connection: (data as Connection | null) ?? null, stale: !data }
  }
  const { data } = await db.from('pinterest_connections').select(CONNECTION_COLUMNS).eq('user_id', userId)
    .order('is_primary', { ascending: false }).order('created_at').limit(1).maybeSingle()
  return { connection: (data as Connection | null) ?? null, stale: false }
}

export async function connectionCount(userId: string): Promise<number> {
  const { count } = await db.from('pinterest_connections').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  return count ?? 0
}

/** For pins created before accounts existed: safe to assume the account only when the login has exactly one. */
export async function soleConnectionId(userId: string): Promise<string | null> {
  const { data } = await db.from('pinterest_connections').select('id').eq('user_id', userId).limit(2)
  return data?.length === 1 ? (data[0].id as string) : null
}
