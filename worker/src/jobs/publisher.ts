import { db, mapLimit } from '../lib/clients'
import { claimDue, enqueue } from '../lib/queue'
import { createPin, PinterestError } from '../lib/pinterest'
import { NotConnectedError, withPinterest } from '../lib/tokens'
import { soleConnectionId } from '../lib/accounts'
import { ensureVideo, MediaPendingError, MediaRejectedError } from '../lib/media'
import { errMsg, log } from '../lib/log'

const MAX_ATTEMPTS = 4
// A video can legitimately take a while to process on Pinterest's side: allow many short waits instead of a few long ones.
const MEDIA_PENDING_ATTEMPTS = 12
const MEDIA_PENDING_DELAY_MS = 90_000
const BACKOFF_MIN = [5, 15, 60] // minutes before attempt 2, 3, 4

interface PinRow {
  id: string
  user_id: string
  connection_id: string | null
  image_url: string
  media_type: 'image' | 'video' | 'carousel'
  video_url: string | null
  carousel_items: { url: string }[] | null
  media_id: string | null
  title: string | null
  description: string | null
  alt_text: string | null
  board_id: string
  destination_url: string | null
  attempts: number
}

async function publishOne(pin: PinRow) {
  try {
    // Pins queued before accounts existed carry no account: use it only when the login has exactly one.
    const connectionId = pin.connection_id ?? (await soleConnectionId(pin.user_id))
    if (!connectionId) throw new NotConnectedError('The Pinterest account for this pin was removed. Delete the pin or add the account again.')
    const res = await withPinterest(connectionId, async (token) => {
      // Videos are uploaded and processed by Pinterest first; the pin is created once that has finished.
      const videoId = pin.media_type === 'video' ? await ensureVideo(token, pin) : null
      return createPin(token, {
        board_id: pin.board_id,
        title: pin.title,
        description: pin.description,
        alt_text: pin.alt_text,
        link: pin.destination_url,
        image_url: pin.image_url,
        media_type: pin.media_type,
        video_media_id: videoId,
        carousel_items: pin.carousel_items,
      })
    })
    await db
      .from('scheduled_pins')
      .update({ status: 'published', pinterest_pin_id: res.id, published_at: new Date().toISOString(), error_message: null })
      .eq('id', pin.id)
    return 'published' as const
  } catch (e) {
    const msg = errMsg(e)
    const permanent = e instanceof NotConnectedError || e instanceof MediaRejectedError
    const pending = e instanceof MediaPendingError
    const transient = e instanceof PinterestError && e.transient

    if (!permanent && transient && pin.attempts < (pending ? MEDIA_PENDING_ATTEMPTS : MAX_ATTEMPTS)) {
      const retryAfter = e instanceof PinterestError && e.retryAfterSec ? e.retryAfterSec * 1000 : 0
      const delay = pending ? MEDIA_PENDING_DELAY_MS : Math.max(retryAfter, BACKOFF_MIN[Math.min(pin.attempts - 1, BACKOFF_MIN.length - 1)] * 60_000)
      const at = new Date(Date.now() + delay)
      await db
        .from('scheduled_pins')
        .update({ status: 'pending', scheduled_at: at.toISOString(), processing_started_at: null, error_message: `Retrying: ${msg}` })
        .eq('id', pin.id)
      await enqueue([{ id: pin.id, at }])
      return 'retried' as const
    }
    await db
      .from('scheduled_pins')
      .update({ status: 'failed', processing_started_at: null, error_message: msg.slice(0, 500) })
      .eq('id', pin.id)
    log.warn('pin failed', { pin: pin.id, user: pin.user_id, error: msg })
    return 'failed' as const
  }
}

/** Claim everything that is due and publish it. Pins of one Pinterest account run in order; accounts run in parallel. */
export async function dispatchDue() {
  const ids = await claimDue(60)
  if (ids.length === 0) return { published: 0, failed: 0, retried: 0 }

  // Atomic DB claim: only rows still pending and actually due flip to processing.
  // Rows that were cancelled/rescheduled since being queued simply don't match.
  const { data: rows, error } = await db
    .from('scheduled_pins')
    .select('id')
    .in('id', ids)
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
  if (error) {
    // DB hiccup: put them back so nothing is lost.
    await enqueue(ids.map((id) => ({ id, at: new Date() })))
    throw error
  }
  const dueIds = (rows ?? []).map((r) => r.id as string)
  if (dueIds.length === 0) return { published: 0, failed: 0, retried: 0 }

  const { data: claimed } = await db.rpc('claim_pins', { p_ids: dueIds })
  const pins = (claimed ?? []) as PinRow[]

  const byAccount = new Map<string, PinRow[]>()
  for (const p of pins) { const k = p.connection_id ?? p.user_id; byAccount.set(k, [...(byAccount.get(k) ?? []), p]) }

  const tally = { published: 0, failed: 0, retried: 0 }
  await mapLimit([...byAccount.values()], 12, async (list) => {
    for (const pin of list) {
      tally[await publishOne(pin)]++
      if (list.length > 1) await new Promise((r) => setTimeout(r, 400)) // small gap per account
    }
  })
  if (pins.length) log.info('dispatch', { claimed: pins.length, ...tally })
  return tally
}
