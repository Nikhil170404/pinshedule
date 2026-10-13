import { db, mapLimit } from '../lib/clients'
import { refreshConnection, NotConnectedError } from '../lib/tokens'
import { errMsg, log } from '../lib/log'
import { notify } from '../lib/notify'

/** Refresh access tokens that expire within 3 days so publishing never hits an expired token. */
export async function refreshExpiring() {
  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString()
  const { data } = await db
    .from('pinterest_connections')
    .select('id')
    .eq('status', 'active')
    .lte('expires_at', soon)
    .limit(2000)
  let ok = 0
  let failed = 0
  await mapLimit(data ?? [], 4, async (c) => {
    try {
      await refreshConnection(c.id as string)
      ok++
    } catch (e) {
      failed++
      if (!(e instanceof NotConnectedError)) log.warn('token refresh failed', { connection: c.id, error: errMsg(e) })
    }
  })
  if (ok || failed) log.info('token refresh', { ok, failed })

  // A refresh token that is about to lapse cannot renew itself: ask the owner to reconnect before pins start failing.
  const week = new Date(Date.now() + 7 * 86_400_000).toISOString()
  const { data: lapsing } = await db.from('pinterest_connections').select('id, user_id, pinterest_username, refresh_expires_at')
    .eq('status', 'active').lte('refresh_expires_at', week).gt('refresh_expires_at', new Date().toISOString()).limit(500)
  for (const c of lapsing ?? []) {
    const when = new Date(c.refresh_expires_at as string)
    await notify(c.user_id as string, {
      kind: 'token_expiring', connectionId: c.id as string, link: '/dashboard/accounts', dedupeKey: `token_expiring:${c.id}:${when.toISOString().slice(0, 10)}`,
      title: 'Pinterest connection expires soon',
      body: `${c.pinterest_username ? `@${c.pinterest_username}` : 'A Pinterest account'} needs to be reconnected before ${when.toDateString()}, or its scheduled pins will stop publishing.`,
    })
  }
}
