'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { canvasToFile, loadPhoto, PALETTES, renderPin, TEMPLATES, type TemplateId } from '@/lib/pin-design'
import { errorText } from '@/lib/api'
import { uploadImage, validateImage } from '@/lib/upload'
import { cn } from '@/lib/utils'

const HEADLINE_MAX = 90

export function PinDesigner() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [template, setTemplate] = useState<TemplateId>('headline')
  const [paletteId, setPaletteId] = useState(PALETTES[0].id)
  const [headline, setHeadline] = useState('')
  const [kicker, setKicker] = useState('')
  const [number, setNumber] = useState('')
  const [brand, setBrand] = useState('')
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [busy, setBusy] = useState(false)

  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]
  const meta = TEMPLATES.find((t) => t.id === template)!

  useEffect(() => {
    if (canvasRef.current) renderPin(canvasRef.current, { template, palette, headline, kicker, number, brand, photo })
  }, [template, palette, headline, kicker, number, brand, photo])

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const problem = validateImage(f)
    if (problem) return toast.error(problem)
    try {
      setPhoto(await loadPhoto(f))
      if (!TEMPLATES.find((t) => t.id === template)?.usesPhoto) setTemplate('card')
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  async function make() {
    if (!canvasRef.current) throw new Error('The design is not ready yet.')
    return canvasToFile(canvasRef.current, !!photo && meta.usesPhoto)
  }

  async function download() {
    try {
      const file = await make()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(file)
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  async function schedule() {
    if (!headline.trim()) return toast.error('Write a headline first.')
    setBusy(true)
    try {
      const url = await uploadImage(await make())
      const q = new URLSearchParams({ image: url, title: headline.trim(), alt: headline.trim() })
      router.push(`/dashboard/schedule?${q}`)
    } catch (err) {
      toast.error(errorText(err))
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="space-y-4">
        <Card className="p-4 sm:p-5">
          <p className="mb-2 text-sm font-medium text-ink">Layout</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" aria-pressed={template === t.id} onClick={() => setTemplate(t.id)}
                className={cn('rounded-lg border px-3 py-2.5 text-left transition-colors',
                  template === t.id ? 'border-brand bg-brand-soft' : 'border-line bg-white hover:border-stone-300')}>
                <span className="block text-[13px] font-medium text-ink">{t.name}</span>
                <span className="mt-0.5 block text-xs text-muted">{t.hint}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 p-4 sm:p-5">
          <Textarea label="Headline" rows={3} maxLength={HEADLINE_MAX} value={headline} onChange={(e) => setHeadline(e.target.value)}
            placeholder="Small kitchen storage ideas that actually work" hint={`${headline.length}/${HEADLINE_MAX}. Short and specific reads best on a pin.`} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Label (optional)" value={kicker} maxLength={24} onChange={(e) => setKicker(e.target.value)} placeholder="Home" />
            <Input label="Your site (optional)" value={brand} maxLength={32} onChange={(e) => setBrand(e.target.value)} placeholder="yourblog.com" autoCapitalize="none" autoCorrect="off" />
          </div>
          {template === 'number' && (
            <Input label="Number" value={number} maxLength={3} inputMode="numeric" onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="7" hint="Shown large above the headline." />
          )}
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Photo{meta.usesPhoto ? ' (optional)' : ''}</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPhoto} aria-label="Choose a photo" />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><ImagePlus size={15} aria-hidden /> {photo ? 'Change photo' : 'Add a photo'}</Button>
              {photo && <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto(null)}><X size={15} aria-hidden /> Remove</Button>}
            </div>
            {!meta.usesPhoto && <p className="mt-2 text-xs text-muted">The {meta.name.toLowerCase()} layout does not use a photo. Adding one switches to Photo card.</p>}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Colors</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Colors">
              {PALETTES.map((p) => (
                <button key={p.id} type="button" aria-label={p.name} aria-pressed={paletteId === p.id} title={p.name} onClick={() => setPaletteId(p.id)}
                  className={cn('h-9 w-9 rounded-full border-2 transition-shadow', paletteId === p.id ? 'border-ink shadow-[0_0_0_2px_#fff_inset]' : 'border-line')}
                  style={{ background: `linear-gradient(135deg, ${p.bg} 55%, ${p.accent} 55%)` }} />
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <canvas ref={canvasRef} role="img" aria-label="Preview of your pin"
          className="aspect-[2/3] w-full max-w-sm rounded-xl border border-line bg-white shadow-sm lg:max-w-none" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="lg" loading={busy} onClick={schedule}>Schedule this pin</Button>
          <Button type="button" variant="outline" size="lg" onClick={download}><Download size={16} aria-hidden /> Download</Button>
        </div>
        <p className="mt-3 text-xs text-muted">Saved at 1000 x 1500 pixels, the 2:3 size Pinterest recommends. You choose the board, text and time on the next screen.</p>
      </div>
    </div>
  )
}
