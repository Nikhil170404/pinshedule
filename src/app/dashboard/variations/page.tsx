'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { BulkComposer, type DraftRow } from '@/components/schedule/BulkComposer'
import { UpgradeNote } from '@/components/pins/UpgradeNote'
import { api, apiBlob, ApiError, errorText } from '@/lib/api'
import { refreshSummary } from '@/lib/hooks'
import { canvasToFile, PALETTES, renderPin, photoFromBlob, tidyHeadline } from '@/lib/pin-design'
import { MAX_VARIATIONS, MIN_VARIATIONS, planDesigns, repeatedDesigns } from '@shared/variations'

interface Concept { angle: string; headline: string; title: string; description: string; alt_text: string; number: string }
interface Result { url: string; page_title: string; images: string[]; concepts: Concept[]; near_duplicates: [number, number][] }

export default function VariationsPage() {
  const [url, setUrl] = useState('')
  const [count, setCount] = useState(8)
  const [brand, setBrand] = useState('')
  const [palettes, setPalettes] = useState<string[]>(PALETTES.map((p) => p.id))
  const [busy, setBusy] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [rows, setRows] = useState<DraftRow[] | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const togglePalette = (id: string) => setPalettes((p) => (p.includes(id) ? (p.length > 1 ? p.filter((x) => x !== id) : p) : [...p, id]))

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    if (!/^https?:\/\//i.test(url.trim())) return toast.error('Enter a full page address starting with https://')
    setBlocked(null); setBusy('Reading the page and writing concepts')
    try {
      const res = await api<Result>('/variations', { body: { url: url.trim(), count } })
      void refreshSummary()

      // Plan a different look for each concept, then draw them in the browser. Photos come through the worker so the canvas stays clean.
      const photoIdx = res.images.slice(0, 8)
      const slots = planDesigns(res.concepts.length, photoIdx.length, palettes, res.concepts.map((c) => !!c.number))
      const host = brand.trim() || new URL(res.url).hostname.replace(/^www\./, '')
      const photos = new Map<number, HTMLImageElement | null>()
      const loadPhoto = async (i: number) => {
        if (!photos.has(i)) photos.set(i, await photoFromBlob(await apiBlob(`/proxy/image?url=${encodeURIComponent(photoIdx[i])}`)).catch(() => null))
        return photos.get(i)!
      }
      const out: DraftRow[] = []
      for (let i = 0; i < res.concepts.length; i++) {
        setBusy(`Designing pin ${i + 1} of ${res.concepts.length}`)
        const c = res.concepts[i], slot = slots[i]
        const photo = slot.usesPhoto ? await loadPhoto(slot.imageIndex) : null
        const canvas = document.createElement('canvas')
        renderPin(canvas, { template: slot.template, palette: PALETTES.find((p) => p.id === slot.paletteId) ?? PALETTES[0], headline: tidyHeadline(c.headline || c.title), kicker: '', number: c.number, brand: host, photo })
        const file = await canvasToFile(canvas, !!photo)
        out.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), title: c.title, description: c.description, altText: c.alt_text, link: res.url })
      }
      const notes: string[] = []
      for (const [a, b] of res.near_duplicates) notes.push(`Pins ${a + 1} and ${b + 1} read very much alike. Remove one or edit it.`)
      for (const [a, b] of repeatedDesigns(slots)) notes.push(`Pins ${a + 1} and ${b + 1} look alike.`)
      if (photoIdx.length === 0) notes.push('This page has no usable images, so the pins are text designs. Add photos in the review step if you like.')
      setWarnings(notes)
      setRows(out)
    } catch (err) {
      const msg = errorText(err)
      if (err instanceof ApiError && err.upgradeRequired) setBlocked(msg); else toast.error(msg)
    }
    setBusy(null)
  }

  if (rows) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Review your variations" description="Each pin takes a different angle and look. Edit or remove any, choose a board, then schedule."
          actions={<Button variant="ghost" size="sm" onClick={() => setRows(null)}>Back</Button>} />
        {warnings.length > 0 && <div className="mb-4 space-y-1">{warnings.map((w) => <UpgradeNote key={w}>{w}</UpgradeNote>)}</div>}
        <BulkComposer rows={rows} setRows={setRows as React.Dispatch<React.SetStateAction<DraftRow[]>>} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Pin variations" description="Paste one page and get several pins that each pitch it a different way, with a different look. You approve before anything is scheduled." />
      <Card className="p-4 sm:p-5">
        <form onSubmit={generate} className="space-y-4">
          <Input label="Page address" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://yourblog.com/best-pasta-recipes" value={url} onChange={(e) => setUrl(e.target.value)} required />
          <div>
            <label htmlFor="count" className="mb-1 block text-sm font-medium text-ink">How many pins: {count}</label>
            <input id="count" type="range" min={MIN_VARIATIONS} max={MAX_VARIATIONS} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-[var(--color-brand,#e60023)]" />
            <p className="mt-1 text-xs text-muted">Uses 1 page import and 1 AI generation from your monthly allowance, however many pins you choose.</p>
          </div>
          <Input label="Your site name on the pins (optional)" value={brand} maxLength={32} onChange={(e) => setBrand(e.target.value)} placeholder="yourblog.com" autoCapitalize="none" />
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Colors</p>
            <div className="flex flex-wrap gap-2">
              {PALETTES.map((p) => (
                <button key={p.id} type="button" aria-pressed={palettes.includes(p.id)} onClick={() => togglePalette(p.id)}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${palettes.includes(p.id) ? 'border-ink bg-white text-ink' : 'border-line bg-stone-50 text-muted'}`}>
                  <span className="h-4 w-4 rounded-full border border-line" style={{ background: p.bg }} aria-hidden />{p.name}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" loading={!!busy}><Sparkles size={15} aria-hidden /> {busy ?? 'Create variations'}</Button>
          {blocked && <UpgradeNote>{blocked}</UpgradeNote>}
        </form>
      </Card>
      <p className="mt-3 text-xs text-muted">Pins are drawn from your own page images and text with fixed layouts. Descriptions are written by AI from the page, so read them before you schedule.</p>
    </div>
  )
}
