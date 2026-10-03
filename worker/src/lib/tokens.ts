import { decrypt, encrypt } from '@shared/crypto'
import { env } from '../env'
import { db, redis } from './clients'
import { OAuthError, refreshAccessToken } from './pinterest'
import { log } from './log'

export class NotConnectedError extends Error {}

interface Conn {
  access_token: string
  refresh_token: string
  expires_at: string
  status: string
}

async function load(userId: string): Promise<Conn> {
  const { data } = await db
    .from('pinterest_connections')
    .select('access_token, refresh_token, expires_at, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) throw new NotConnectedError('Pinterest is not connected. Reconnect your account.')
  if (data.status !== 'active') throw new NotConnectedError('Pinterest access was revoked. Reconnect your account.')
  return data as Conn
}

/** Refresh the stored tokens. Serialised per user so rotating refresh tokens are never used twice. */
export async function refreshConnection(userId: string): Promise<string> {
  const lock = `lock:refresh:${userId}`
  const got = await redis.set(lock, '1', { nx: true, ex: 30 })
  if (got !== 'OK') {
    // Another worker is refreshing: wait briefly, then re-read the result.
    await new Promise((r) => setTimeout(r, 2500))
    return decrypt((await load(userId)).access_token, env.encryptionSecret)
  }
  try {
    const conn = await load(userId)
    const refreshToken = await decrypt(conn.refresh_token, env.encryptionSecret)
    let tokens
    try {
      tokens = await refreshAccessToken(refreshToken)
    } catch (e) {
      if (e instanceof OAuthError && e.permanent) {
        await db
          .from('pinterest_connections')
          .update({ status: 'needs_reconnect', last_error: e.message, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        log.warn('pinterest connection needs reconnect', { userId, reason: e.message })
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
      .eq('user_id', userId)
    return tokens.access_token
  } finally {
    await redis.del(lock).catch(() => {})
  }
}

/** A valid access token for the user, refreshing it first when it is about to expire. */
export async function getAccessToken(userId: string): Promise<string> {
  const conn = await load(userId)
  if (new Date(conn.expires_at).getTime() - Date.now() < 5 * 60_000) return refreshConnection(userId)
  return decrypt(conn.access_token, env.encryptionSecret)
}

/** Run an API call; on 401 refresh the token once and retry. */
export async function withPinterest<T>(userId: string, fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getAccessToken(userId)
  try {
    return await fn(token)
  } catch (e) {
    if (e instanceof Error && 'unauthorized' in e && (e as { unauthorized: boolean }).unauthorized) {
      return fn(await refreshConnection(userId))
    }
    throw e
  }
}
