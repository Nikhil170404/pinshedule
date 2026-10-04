import { decrypt, encrypt } from '@shared/crypto'
import { env } from '../env'
import { db, redis } from './clients'
import { OAuthError, refreshAccessToken } from './pinterest'
import { log } from './log'
import { notifyUser } from './email'

export class NotConnectedError extends Error {}

interface Conn {
  id: string
  username: string | null
  access_token: string
  refresh_token: string
  expires_at: string
  status: string
}

/** One of the user's Pinterest accounts: the one asked for, otherwise the primary (login) account. */
async function load(userId: string, connectionId?: string | null): Promise<Conn> {
  let q = db
    .from('pinterest_connections')
    .select('id, pinterest_username, access_token, refresh_token, expires_at, status')
    .eq('user_id', userId)
  q = connectionId ? q.eq('id', connectionId) : q.order('is_primary', { ascending: false }).order('created_at', { ascending: true })
  const { data: rows } = await q.limit(1)
  const data = rows?.[0] ? { ...rows[0], username: rows[0].pinterest_username as string | null } : null
  if (!data) throw new NotConnectedError('Pinterest is not connected. Reconnect your account.')
  if (data.status !== 'active') throw new NotConnectedError('Pinterest access was revoked. Reconnect your account.')
  return data as Conn
}

/** Refresh the stored tokens. Serialised per user so rotating refresh tokens are never used twice. */
export async function refreshConnection(userId: string, connectionId?: string | null): Promise<string> {
  const first = await load(userId, connectionId)
  const lock = `lock:refresh:${first.id}`
  const got = await redis.set(lock, '1', { nx: true, ex: 30 })
  if (got !== 'OK') {
    // Another worker is refreshing: wait briefly, then re-read the result.
    await new Promise((r) => setTimeout(r, 2500))
    return open(first.id, (await load(userId, first.id)).access_token)
  }
  try {
    const conn = await load(userId, first.id)
    const refreshToken = await open(conn.id, conn.refresh_token)
    let tokens
    try {
      tokens = await refreshAccessToken(refreshToken)
    } catch (e) {
      if (e instanceof OAuthError && e.permanent) {
        await db
          .from('pinterest_connections')
          .update({ status: 'needs_reconnect', last_error: e.message, updated_at: new Date().toISOString() })
          .eq('id', conn.id)
        log.warn('pinterest connection needs reconnect', { userId, reason: e.message })
        void notifyReconnect(userId, conn.username)
        throw new NotConnectedError('Pinterest access expired. Reconnect your account.')
      }
      throw e
    }
    await db
      .from('pinterest_connections')
      .update({
        access_token: await encrypt(tokens.access_token, env.encryptionSecret),
        refresh_token: tokens.refresh_token ? await encrypt(tokens.refresh_token, env.encryptionSecret) : conn.refresh_token,
        expires_at: new Date(Date.now() + (tokens.expires_in ?? 2_592_000) * 1000).toISOString(),
        refresh_expires_at: tokens.refresh_token_expires_in
          ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString()
          : null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id)
    return tokens.access_token
  } finally {
    await redis.del(lock).catch(() => {})
  }
}

/** Decrypt a stored token. A failure means the secret changed or the data is corrupt: ask the user to reconnect. */
async function open(connId: string, value: string): Promise<string> {
  try {
    return await decrypt(value, env.encryptionSecret)
  } catch {
    await db.from('pinterest_connections')
      .update({ status: 'needs_reconnect', last_error: 'Stored token could not be decrypted (ENCRYPTION_SECRET changed?)', updated_at: new Date().toISOString() })
      .eq('id', connId)
    log.error('token decrypt failed: ENCRYPTION_SECRET on this service does not match the one used at login', { connId })
    throw new NotConnectedError('Your Pinterest connection needs to be renewed. Please reconnect your account.')
  }
}

/** A valid access token for the user, refreshing it first when it is about to expire. */
export async function getAccessToken(userId: string, connectionId?: string | null): Promise<string> {
  const conn = await load(userId, connectionId)
  if (new Date(conn.expires_at).getTime() - Date.now() < 5 * 60_000) return refreshConnection(userId, conn.id)
  return open(conn.id, conn.access_token)
}

function notifyReconnect(userId: string, username: string | null) {
  return notifyUser(userId, 'reconnect', 'Reconnect your Pinterest account', [
    `GoPinKaro can no longer post to ${username ? `@${username}` : 'your Pinterest account'} because Pinterest access expired or was removed.`,
    'Scheduled pins will not publish until you reconnect. It takes one click.',
  ], '/dashboard/settings')
}

/** Run an API call; on 401 refresh the token once and retry. */
export async function withPinterest<T>(userId: string, fn: (token: string) => Promise<T>, connectionId?: string | null): Promise<T> {
  const token = await getAccessToken(userId, connectionId)
  try {
    return await fn(token)
  } catch (e) {
    if (e instanceof Error && 'unauthorized' in e && (e as { unauthorized: boolean }).unauthorized) {
      return fn(await refreshConnection(userId, connectionId))
    }
    throw e
  }
}
