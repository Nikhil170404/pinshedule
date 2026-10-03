'use client'

import { Suspense, useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { BoardSelect } from '@/components/pins/BoardSelect'
import { AiWriter } from '@/components/pins/AiWriter'
import { UpgradeNote } from '@/components/pins/UpgradeNote'
import { SimilarNotice } from '@/components/pins/SimilarNotice'
import { api, ApiError, errorText } from '@/lib/api'
import { refreshSummary, useSummary } from '@/lib/hooks'
import { uploadImage, validateImage } from '@/lib/upload'
import { PIN_LIMITS, PLANS } from '@/types'
import { cn, toLocalInput } from '@/lib/utils'

function NewPin() {
  const router = useRouter()
  const params = useSearchParams()
  const { summary } = useSummary()
  const canAuto = summary ? PLANS[summary.plan].smart_scheduler : false

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [title, setTitle] = useState(params.get('title') ?? '')
  const [description, setDescription] = useState(params.get('description') ?? '')
  const [altText, setAltText] = useState('')
  const [link, setLink] = useState('')
  const [board, setBoard] = useState({ id: '', name: '' })
  const [mode, setMode] = useState<'best' | 'custom'>('custom')
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)

  const effectiveMode = canAuto ? mode : 'custom'

  const onDrop = useCallback((files: File[]) => {
    const f = files[0]
    if (!f) return
    const problem = validateImage(f)
    if (problem) return toast.error(problem)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, maxFiles: 1 })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return toast.error('Add an image first.')
    if (!board.id) return toast.error('Choose a board.')
    if (effectiveMode === 'custom' && !when) return toast.error('Pick a date and time.')
    if (link && !/^https?:\/\//i.test(link)) return toast.error('The destination link must start with https://')

    setBusy(true)
    try {
      const image_url = await uploadImage(file)
      const pin = {
        image_url, title, description, alt_text: altText, board_id: board.id, board_name: board.name,
        destination_url: link || null,
        ...(effectiveMode === 'custom' ? { scheduled_at: new Date(when).toISOString() } : {}),
      }
      await api('/pins/schedule', { body: { pins: [pin], ...(effectiveMode === 'best' ? { auto: { per_day: 2 } } : {}) } })
      toast.success('Pin scheduled.')
      void refreshSummary()
      router.push('/dashboard/pins')
    } catch (err) {
      toast.error(errorText(err), err instanceof ApiError && err.upgradeRequired ? { action: { label: 'Upgrade', onClick: () => router.push('/dashboard/upgrade') } } : undefined)
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="New pin" description="Upload an image, add the details and choose when it goes live." />
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Card className="p-4 sm:p-5">
          <p className="mb-2 text-sm font-medium text-ink">Image</p>
          {preview ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Selected pin" className="max-h-72 rounded-lg border border-line object-contain" />
              <button type="button" onClick={() => { setFile(null); setPreview('') }} aria-label="Remove image"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-stone-900/70 text-white hover:bg-stone-900">
                <X size={15} />
              </button>
            </div>
          ) : (
            <div {...getRootProps()} className={cn('flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center transition-colors',
              isDragActive ? 'border-brand bg-brand-soft' : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50')}>
              <input {...getInputProps()} />
              <ImagePlus size={24} className="mb-2 text-stone-400" aria-hidden />
              <p className="text-sm font-medium text-ink">{isDragActive ? 'Drop the image here' : 'Choose an image or drag it here'}</p>
              <p className="mt-1 text-xs text-muted">Vertical 2:3 images (for example 1000 x 1500) perform best. JPG, PNG, WEBP or GIF, up to 20 MB.</p>
            </div>
          )}
        </Card>

        <Card className="space-y-4 p-4 sm:p-5">
          <Input label="Title" value={title} maxLength={PIN_LIMITS.title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Keyword first, for example: Small kitchen storage ideas" hint={`${title.length}/${PIN_LIMITS.title}`} />
          <div>
            <Textarea label="Description" rows={4} value={description} maxLength={PIN_LIMITS.description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What the pin shows, with the words people search for." hint={`${description.length}/${PIN_LIMITS.description}`} />
            <div className="mt-3">
              <AiWriter topic={title || description} onPick={(o) => { setTitle(o.title); setDescription(o.description) }} />
            </div>
            <div className="mt-3"><SimilarNotice text={`${title}\n${description}`} /></div>
          </div>
          <Input label="Destination link (optional)" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" value={link}
            onChange={(e) => setLink(e.target.value)} placeholder="https://your-site.com/post" />
          <Input label="Alt text (optional)" value={altText} maxLength={PIN_LIMITS.altText} onChange={(e) => setAltText(e.target.value)}
            hint="Describes the image for screen readers and helps Pinterest search." />
        </Card>

        <Card className="space-y-4 p-4 sm:p-5">
          <BoardSelect value={board.id} onChange={(id, name) => setBoard({ id, name })} suggestText={`${title} ${description}`} />
          <div>
            <p className="mb-2 text-sm font-medium text-ink">When to publish</p>
            <div className="mb-3 inline-flex rounded-lg bg-stone-100 p-1" role="tablist">
              {([['custom', 'Pick a time'], ['best', 'Best time']] as const).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={effectiveMode === k} disabled={k === 'best' && !canAuto}
                  onClick={() => setMode(k)}
                  className={cn('h-8 rounded-md px-3 text-[13px] font-medium transition-colors disabled:opacity-50',
                    effectiveMode === k ? 'bg-white text-ink shadow-sm' : 'text-stone-600')}>
                  {label}
                </button>
              ))}
            </div>
            {effectiveMode === 'custom' ? (
              <Input aria-label="Publish date and time" type="datetime-local" value={when} min={toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value)} className="sm:max-w-xs" />
            ) : (
              <p className="text-sm text-muted">GoPinKaro picks the next high-engagement slot after your last scheduled pin, in {summary?.timezone ?? 'your'} time.</p>
            )}
            {!canAuto && summary && <div className="mt-3"><UpgradeNote>Best-time scheduling is included in paid plans.</UpgradeNote></div>}
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={busy} size="lg">Schedule pin</Button>
        </div>
      </form>
    </div>
  )
}

export default function Page() {
  return <Suspense><NewPin /></Suspense>
}
