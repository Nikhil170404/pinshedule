import { createClient } from '@/lib/supabase/client'

// Limits follow Pinterest's video rules (MP4, MOV or M4V, 4 seconds to 15 minutes) and the 50 MB storage bucket
// defined in supabase-schema.sql. Raise the bucket limit there to allow longer videos.
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-m4v']
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const VIDEO_MIN_SECONDS = 4
export const VIDEO_MAX_SECONDS = 15 * 60
// Pinterest accepts aspect ratios (width / height) from 1:2 to 1.91:1.
export const VIDEO_MIN_RATIO = 0.5
export const VIDEO_MAX_RATIO = 1.91

export interface VideoMeta { duration: number; width: number; height: number }

export function validateVideoFile(file: File): string | null {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) return `${file.name}: use an MP4 or MOV video.`
  if (file.size > MAX_VIDEO_BYTES) return `${file.name}: larger than 50 MB. Compress it or trim it shorter.`
  return null
}

/** Rules that need the video's real length and shape. */
export function validateVideoMeta(m: VideoMeta): string | null {
  if (m.duration < VIDEO_MIN_SECONDS) return 'Pinterest needs videos of at least 4 seconds.'
  if (m.duration > VIDEO_MAX_SECONDS) return 'Pinterest videos can be at most 15 minutes long.'
  const ratio = m.width / m.height
  if (ratio < VIDEO_MIN_RATIO || ratio > VIDEO_MAX_RATIO) return 'This video is too tall or too wide for Pinterest. Use a ratio between 1:2 and 1.91:1.'
  return null
}

export const isVertical = (m: VideoMeta) => m.height / m.width >= 1.3

export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

function withVideo<T>(file: File, run: (v: HTMLVideoElement) => Promise<T>): Promise<T> {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.preload = 'metadata'
  v.muted = true
  v.playsInline = true
  v.src = url
  const done = <R,>(fn: () => R) => { URL.revokeObjectURL(url); return fn() }
  return new Promise<T>((resolve, reject) => {
    v.onerror = () => done(() => reject(new Error('This browser cannot read that video. Convert it to MP4 (H.264) and try again.')))
    v.onloadedmetadata = () => { run(v).then((r) => done(() => resolve(r)), (e) => done(() => reject(e))) }
  })
}

export function readVideoMeta(file: File): Promise<VideoMeta> {
  return withVideo(file, async (v) => ({ duration: v.duration, width: v.videoWidth, height: v.videoHeight }))
}

/** A JPEG frame from the video, used as the pin's cover image. */
export function extractCover(file: File, meta: VideoMeta): Promise<File> {
  return withVideo(file, (v) => new Promise<File>((resolve, reject) => {
    v.onseeked = () => {
      const scale = Math.min(1, 1080 / v.videoWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(v.videoWidth * scale)
      canvas.height = Math.round(v.videoHeight * scale)
      canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((b) => (b ? resolve(new File([b], 'cover.jpg', { type: 'image/jpeg' })) : reject(new Error('Could not make a cover image from the video. Choose one yourself.'))), 'image/jpeg', 0.9)
    }
    // A moment in, so the cover is not a black first frame.
    v.currentTime = Math.min(1, meta.duration * 0.25)
  }))
}

/** Upload to the user's folder in the public pin-videos bucket and return its public URL. */
export async function uploadVideo(file: File): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Please sign in again.')
  const ext = (file.name.split('.').pop() ?? 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4'
  const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('pin-videos').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) throw new Error(`Video upload failed: ${error.message}`)
  return supabase.storage.from('pin-videos').getPublicUrl(path).data.publicUrl
}
