import { env } from '../env'
import { db } from './clients'
import { getMedia, PinterestError, registerVideoUpload, uploadMediaFile } from './pinterest'

/** The video is still being processed by Pinterest. The pin goes back in the queue for a short while. */
export class MediaPendingError extends PinterestError {
  constructor() { super('Pinterest is still processing the video', 0) }
}

/** Pinterest rejected the video itself. Retrying the same file will not help. */
export class MediaRejectedError extends Error {}

export const VIDEO_BUCKET = 'pin-videos'
export const MAX_VIDEO_BYTES = 52_428_800 // matches the storage bucket limit in supabase-schema.sql

/** Videos must come from our own storage: the worker fetches this URL, so it must never be an arbitrary address. */
export const ownVideoPrefix = () => `${env.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${VIDEO_BUCKET}/`
export const isOwnVideoUrl = (u: string) => u.startsWith(ownVideoPrefix())

async function download(url: string): Promise<{ bytes: Uint8Array; type: string }> {
  if (!isOwnVideoUrl(url)) throw new MediaRejectedError('The video was not uploaded through GoPinKaro.')
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new MediaRejectedError(`The uploaded video could not be read (HTTP ${res.status}). Upload it again.`)
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > MAX_VIDEO_BYTES) throw new MediaRejectedError('The video is larger than 50 MB.')
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength > MAX_VIDEO_BYTES) throw new MediaRejectedError('The video is larger than 50 MB.')
  return { bytes, type: res.headers.get('content-type') ?? 'video/mp4' }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Make sure Pinterest has this pin's video, processed and ready, and return its media id.
 * The media id is saved as soon as it exists, so a retry after a timeout polls instead of uploading again.
 */
export async function ensureVideo(token: string, pin: { id: string; video_url: string | null; media_id: string | null }, pollMs = Number(process.env.MEDIA_POLL_MS) || 3000, maxPolls = 12): Promise<string> {
  if (!pin.video_url) throw new MediaRejectedError('This video pin has no video file.')
  let mediaId = pin.media_id
  if (!mediaId) {
    const { bytes, type } = await download(pin.video_url)
    const reg = await registerVideoUpload(token)
    mediaId = reg.media_id
    await db.from('scheduled_pins').update({ media_id: mediaId }).eq('id', pin.id)
    await uploadMediaFile(reg, bytes, type)
  }
  for (let i = 0; i < maxPolls; i++) {
    const m = await getMedia(token, mediaId)
    if (m.status === 'succeeded') return mediaId
    if (m.status === 'failed') {
      await db.from('scheduled_pins').update({ media_id: null }).eq('id', pin.id)
      throw new MediaRejectedError('Pinterest could not process this video. Check the format (MP4 or MOV), length (4 seconds to 15 minutes) and shape, then upload it again.')
    }
    await sleep(pollMs)
  }
  throw new MediaPendingError()
}
