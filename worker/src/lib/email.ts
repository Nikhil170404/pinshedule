import { randomBytes } from 'node:crypto'
import { env } from '../env'
import { db, redis } from './clients'
import { errMsg, log } from './log'

/** Transactional email through Resend's HTTP API. Without RESEND_API_KEY nothing is sent (and the UI says so). */
export const emailEnabled = () => env.resendKey !== ''

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function layout(title: string, paragraphs: string[], cta?: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#44403c">${esc(p)}</p>`).join('')
  const button = cta ? `<p style="margin:22px 0 6px"><a href="${esc(cta.url)}" style="background:#e60023;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:10px;display:inline-block">${esc(cta.label)}</a></p>` : ''
  return `<!doctype html><html><body style="margin:0;background:#fafaf9;padding:24px"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:14px;padding:26px">
<p style="margin:0 0 18px;font-size:13px;font-weight:700;color:#e60023;letter-spacing:.02em">GoPinKaro</p>
<h1 style="margin:0 0 14px;font-size:19px;color:#1c1917">${esc(title)}</h1>${body}${button}
<p style="margin:22px 0 0;font-size:12px;color:#78716c">You get this because notifications are on in your GoPinKaro settings. You can turn them off at any time.</p></div></body></html>`
}

export async function sendEmail(to: string, subject: string, paragraphs: string[], cta?: { label: string; url: string }): Promise<boolean> {
  if (!emailEnabled()) { log.info('email skipped (RESEND_API_KEY not set)', { subject }); return false }
  try {
    const res = await fetch(env.resendUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.emailFrom, to, subject, html: layout(subject, paragraphs, cta), text: `${paragraphs.join('\n\n')}${cta ? `\n\n${cta.label}: ${cta.url}` : ''}` }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return true
  } catch (e) {
    log.warn('email failed', { error: errMsg(e) })
    return false
  }
}

export type NotificationKind = 'pins_failed' | 'reconnect' | 'payment_failed' | 'automation_paused'

/** Minimum gap between two emails of the same kind to the same user. */
const QUIET_SEC: Record<NotificationKind, number> = { pins_failed: 6 * 3600, reconnect: 24 * 3600, payment_failed: 24 * 3600, automation_paused: 24 * 3600 }

/** Email a user about something that needs attention. Respects their setting and never sends more than one per kind per quiet period. */
export async function notifyUser(userId: string, kind: NotificationKind, subject: string, paragraphs: string[], path = '/dashboard') {
  try {
    if (!emailEnabled()) return
    const { data } = await db.from('user_profiles').select('notification_email, notification_email_verified, notifications_enabled').eq('id', userId).maybeSingle()
    if (!data?.notification_email || !data.notification_email_verified || data.notifications_enabled === false) return
    if ((await redis.set(`notify:${kind}:${userId}`, '1', { nx: true, ex: QUIET_SEC[kind] })) !== 'OK') return
    await sendEmail(data.notification_email as string, subject, paragraphs, { label: 'Open GoPinKaro', url: `${env.appUrl}${path}` })
  } catch (e) {
    log.warn('notify failed', { kind, error: errMsg(e) })
  }
}

// ─── Email verification (login is Pinterest-only, so an address must be proven before we use it) ───
export async function startEmailVerification(userId: string, address: string) {
  const token = randomBytes(24).toString('base64url')
  await redis.set(`emailverify:${token}`, JSON.stringify({ userId, address }), { ex: 24 * 3600 })
  await db.from('user_profiles').update({ notification_email: address, notification_email_verified: false }).eq('id', userId)
  const link = `${env.publicUrl}/public/verify-email?token=${token}`
  return sendEmail(address, 'Confirm your email for GoPinKaro', ['Confirm this address to get alerts when a pin fails to publish or your Pinterest connection needs attention.', 'This link works once and expires in 24 hours. If you did not ask for it, ignore this email.'], { label: 'Confirm email', url: link })
}

export async function confirmEmail(token: string): Promise<boolean> {
  const raw = await redis.getdel<string | { userId: string; address: string }>(`emailverify:${token}`).catch(() => null)
  if (!raw) return false
  const { userId, address } = typeof raw === 'string' ? JSON.parse(raw) : raw
  const { error } = await db.from('user_profiles').update({ notification_email_verified: true }).eq('id', userId).eq('notification_email', address)
  return !error
}
