import { db, mapLimit } from '../lib/clients'
import { refreshConnection, NotConnectedError } from '../lib/tokens'
import { errMsg, log } from '../lib/log'

/** Refresh access tokens that expire within 3 days so publishing never hits an expired token. */
export async function refreshExpiring() {
  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString()
  const { data } = await db
    .from('pinterest_connections')
    .select('id, user_id')
    .eq('status', 'active')
    .lte('expires_at', soon)
    .limit(500)
  let ok = 0
  let failed = 0
  await mapLimit(data ?? [], 4, async (c) => {
    try {
      await refreshConnection(c.user_id as string, c.id as string)
      ok++
    } catch (e) {
      failed++
      if (!(e instanceof NotConnectedError)) log.warn('token refresh failed', { user: c.user_id, error: errMsg(e) })
    }
  })
  if (ok || failed) log.info('token refresh', { ok, failed })
}
