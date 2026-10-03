import type { Context } from 'hono'
import { PinterestError } from './pinterest'
import { NotConnectedError } from './tokens'
import { errMsg, log } from './log'

/** Turn a failed Pinterest call into a useful, logged HTTP response. */
export function pinterestFailure(c: Context, e: unknown, what: string) {
  if (e instanceof NotConnectedError) return c.json({ error: e.message, reconnect: true }, 409)
  if (e instanceof PinterestError) {
    log.warn(`${what} failed`, { status: e.status, code: e.code, error: e.message })
    if (e.status === 401 || e.status === 403) {
      return c.json({ error: `Pinterest refused the request (${e.status}): ${e.message}. Reconnect your account and approve all permissions.`, reconnect: true }, 409)
    }
    return c.json({ error: `Pinterest said: ${e.message}`, pinterest_status: e.status }, e.status === 429 ? 429 : 502)
  }
  log.error(`${what} failed`, { error: errMsg(e) })
  return c.json({ error: `Could not complete the Pinterest request: ${errMsg(e)}` }, 502)
}
