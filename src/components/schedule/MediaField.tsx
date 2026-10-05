'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { ArrowLeft, ArrowRight, Film, ImagePlus, Images, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { uploadImage, validateImage } from '@/lib/upload'
import {
  extractCover, formatDuration, isVertical, readVideoMeta, uploadVideo, validateVideoFile, validateVideoMeta, type VideoMeta,
} from '@/lib/video'
import { errorText } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { MediaType } from '@/types'

/** What the schedule request needs once the files have been uploaded. */
export interface MediaPayload { media_type: MediaType; image_url: string; video_url?: string; carousel_items?: { url: string }[] }
export interface MediaFieldHandle {
  /** Uploads the chosen files and returns the pin media, or throws with a message to show the user. */
  resolve(): Promise<MediaPayload>
}

interface Pic { file: File; preview: string }

const TABS: { id: MediaType; label: string; icon: React.ElementType }[] = [
  { id: 'image', label: 'Image', icon: ImagePlus },
  { id: 'video', label: 'Video', icon: Film },
  { id: 'carousel', label: 'Carousel', icon: Images },
]
const MAX_CAROUSEL = 5

export const MediaField = forwardRef<MediaFieldHandle, { initialImageUrl?: string }>(function MediaField({ initialImageUrl = '' }, ref) {
  const [type, setType] = useState<MediaType>('image')
  const [image, setImage] = useState<Pic | null>(null)
  const [remote, setRemote] = useState(initialImageUrl) // an image already uploaded by the pin designer
  const [video, setVideo] = useState<{ file: File; preview: string; meta: VideoMeta } | null>(null)
  const [cover, setCover] = useState<Pic | null>(null)
  const [slides, setSlides] = useState<Pic[]>([])
  const coverInput = useRef<HTMLInputElement>(null)

  // Object URLs are released when the files they point at are replaced or the field goes away.
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.preview) }, [image])
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.preview) }, [video])
  useEffect(() => () => { if (cover) URL.revokeObjectURL(cover.preview) }, [cover])
  useEffect(() => () => slides.forEach((s) => URL.revokeObjectURL(s.preview)), [slides])

  const pic = (file: File): Pic => ({ file, preview: URL.createObjectURL(file) })

  const onImage = useCallback((files: File[]) => {
    const f = files[0]
    if (!f) return
    const problem = validateImage(f)
    if (problem) return toast.error(problem)
    setImage(pic(f)); setRemote('')
  }, [])

  const onVideo = useCallback(async (files: File[]) => {
    const f = files[0]
    if (!f) return
    const problem = validateVideoFile(f)
    if (problem) return toast.error(problem)
    try {
      const meta = await readVideoMeta(f)
      const bad = validateVideoMeta(meta)
      if (bad) return toast.error(bad)
      setVideo({ file: f, preview: URL.createObjectURL(f), meta })
    } catch (e) { toast.error(errorText(e)) }
  }, [])

  const onSlides = useCallback((files: File[]) => {
    const room = MAX_CAROUSEL - slides.length
    const ok: Pic[] = []
    for (const f of files.slice(0, room)) {
      const problem = validateImage(f)
      if (problem) { toast.error(problem); continue }
      ok.push(pic(f))
    }
    if (files.length > room) toast.error(`A carousel holds up to ${MAX_CAROUSEL} images.`)
    if (ok.length) setSlides((s) => [...s, ...ok])
  }, [slides.length])

  const imageDrop = useDropzone({ onDrop: onImage, accept: { 'image/*': [] }, maxFiles: 1 })
  const videoDrop = useDropzone({ onDrop: onVideo, accept: { 'video/mp4': [], 'video/quicktime': [], 'video/x-m4v': [] }, maxFiles: 1 })
  const slideDrop = useDropzone({ onDrop: onSlides, accept: { 'image/*': [] }, disabled: slides.length >= MAX_CAROUSEL })

  useImperativeHandle(ref, () => ({
    async resolve() {
      if (type === 'image') {
        if (image) return { media_type: 'image', image_url: await uploadImage(image.file) }
        if (remote) return { media_type: 'image', image_url: remote }
        throw new Error('Add an image first.')
      }
      if (type === 'video') {
        if (!video) throw new Error('Add a video first.')
        const coverFile = cover?.file ?? (await extractCover(video.file, video.meta))
        const [image_url, video_url] = await Promise.all([uploadImage(coverFile), uploadVideo(video.file)])
        return { media_type: 'video', image_url, video_url }
      }
      if (slides.length < 2) throw new Error('A carousel needs at least 2 images.')
      const urls = await Promise.all(slides.map((s) => uploadImage(s.file)))
      return { media_type: 'carousel', image_url: urls[0], carousel_items: urls.map((url) => ({ url })) }
    },
  }), [type, image, remote, video, cover, slides])

  const move = (i: number, d: -1 | 1) => setSlides((s) => {
    const j = i + d
    if (j < 0 || j >= s.length) return s
    const next = [...s]; [next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const drop = (g: ReturnType<typeof useDropzone>, icon: React.ReactNode, title: string, hint: string) => (
    <div {...g.getRootProps()} className={cn('flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center transition-colors',
      g.isDragActive ? 'border-brand bg-brand-soft' : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50')}>
      <input {...g.getInputProps()} />
      <span className="mb-2 text-stone-400">{icon}</span>
      <p className="text-sm font-medium text-ink">{g.isDragActive ? 'Drop it here' : title}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  )

  const preview = image?.preview ?? remote

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Media</p>
        <div className="inline-flex rounded-lg bg-stone-100 p-1" role="tablist" aria-label="Pin format">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={type === id} onClick={() => setType(id)}
              className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors', type === id ? 'bg-white text-ink shadow-sm' : 'text-stone-600')}>
              <Icon size={14} aria-hidden />{label}
            </button>
          ))}
        </div>
      </div>

      {type === 'image' && (preview ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected pin" className="max-h-72 rounded-lg border border-line object-contain" />
          <button type="button" onClick={() => { setImage(null); setRemote('') }} aria-label="Remove image"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-stone-900/70 text-white hover:bg-stone-900"><X size={15} /></button>
        </div>
      ) : drop(imageDrop, <ImagePlus size={24} aria-hidden />, 'Choose an image or drag it here', 'Vertical 2:3 images (for example 1000 x 1500) perform best. JPG, PNG, WEBP or GIF, up to 20 MB.'))}

      {type === 'video' && (
        <div className="space-y-3">
          {video ? (
            <>
              <div className="relative w-fit">
                <video src={video.preview} controls playsInline className="max-h-72 rounded-lg border border-line bg-black" />
                <button type="button" onClick={() => { setVideo(null); setCover(null) }} aria-label="Remove video"
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-stone-900/70 text-white hover:bg-stone-900"><X size={15} /></button>
              </div>
              <p className="text-xs text-muted">
                {formatDuration(video.meta.duration)} · {video.meta.width} x {video.meta.height} · {(video.file.size / 1048576).toFixed(1)} MB
                {!isVertical(video.meta) && ' · Vertical videos (9:16 or 2:3) fill more of the screen on Pinterest.'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a cover image"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const p = validateImage(f); if (p) return toast.error(p); setCover(pic(f)) }} />
                <Button type="button" variant="outline" size="sm" onClick={() => coverInput.current?.click()}>{cover ? 'Change cover' : 'Choose a cover image'}</Button>
                {cover
                  ? <><span className="text-xs text-muted">Using {cover.file.name}</span><Button type="button" variant="ghost" size="sm" onClick={() => setCover(null)}>Use a video frame instead</Button></>
                  : <span className="text-xs text-muted">The cover is taken from the video unless you choose one.</span>}
              </div>
            </>
          ) : drop(videoDrop, <Film size={24} aria-hidden />, 'Choose a video or drag it here', 'MP4 or MOV, 4 seconds to 15 minutes, up to 50 MB. Vertical 9:16 works best.')}
        </div>
      )}

      {type === 'carousel' && (
        <div className="space-y-3">
          {slides.length > 0 && (
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {slides.map((s, i) => (
                <li key={s.preview} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.preview} alt={`Carousel image ${i + 1}`} className="aspect-[2/3] w-full rounded-lg border border-line object-cover" />
                  <span className="absolute left-1.5 top-1.5 rounded bg-stone-900/70 px-1.5 text-xs font-medium text-white">{i + 1}</span>
                  <button type="button" onClick={() => setSlides((x) => x.filter((_, j) => j !== i))} aria-label={`Remove image ${i + 1}`}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-stone-900/70 text-white hover:bg-stone-900"><X size={13} /></button>
                  <div className="mt-1 flex justify-center gap-1">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move image ${i + 1} earlier`} className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30"><ArrowLeft size={14} /></button>
                    <button type="button" disabled={i === slides.length - 1} onClick={() => move(i, 1)} aria-label={`Move image ${i + 1} later`} className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30"><ArrowRight size={14} /></button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {slides.length < MAX_CAROUSEL && drop(slideDrop, <Images size={24} aria-hidden />, slides.length ? 'Add more images' : 'Choose 2 to 5 images', 'The first image is the cover. Images of the same size look best. JPG, PNG or WEBP.')}
          <p className="text-xs text-muted">{slides.length} of {MAX_CAROUSEL} images{slides.length === 1 ? '. Add at least one more.' : ''}</p>
        </div>
      )}
    </Card>
  )
})
