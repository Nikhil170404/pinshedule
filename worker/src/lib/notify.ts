import { env } from '../env'
import { db } from './clients'
import { errMsg, log } from './log'

export type NotificationKind = 'pin_failed' | 'reconnect' | 'token_expiring' | 'feed_paused' | 'quota_low'

export interface NotifyInput {
  kind: NotificationKind
  title: string
  body?: string
  link?: string
  connectionId?: string | null
  /** Same key for the same user = shown once. Omit to always notify. */
  dedupeKey?: string
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

async function email(userId: string, n: NotifyInput): Promise<boolean> {
  if (!env.resendKey) return false
  const { data: prof } = await db.from('user_profiles').select('notifications_enabled').eq('id', userId).maybeSingle()
  if (prof?.notifications_enabled === false) return false
  const { data: auth } = await db.auth.admin.getUserById(userId)
  const to = auth?.user?.email
  if (!to) return false
  const url = n.link ? `${env.appUrl}${n.link}` : `${env.appUrl}/dashboard`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.emailFrom, to, subject: n.title,
      html: `<p>${esc(n.body ?? n.title)}</p><p><a href="${esc(url)}">Open GoPinKaro</a></p><p style="color:#888;font-size:12px">You can turn these emails off in Settings.</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Email provider responded ${res.status}`)
  return true
}

/** Record a notification and email it when configured. Best effort: it never throws into the caller. */
export async function notify(userId: string, n: NotifyInput): Promise<void> {
  try {
    const { data, error } = await db.from('notifications').upsert(
      { user_id: userId, connection_id: n.connectionId ?? null, kind: n.kind, title: n.title, body: n.body ?? null, link: n.link ?? null, dedupe_key: n.dedupeKey ?? null },
      { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
    ).select('id')
    if (error) throw new Error(error.message)
    const row = data?.[0]
    if (!row) return // already notified for this key
    try {
      if (await email(userId, n)) await db.from('notifications').update({ emailed_at: new Date().toISOString() }).eq('id', row.id)
    } catch (e) {
      log.warn('notification email failed', { error: errMsg(e) })
    }
  } catch (e) {
    log.warn('notify failed', { kind: n.kind, error: errMsg(e) })
  }
}

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10)
