'use client'

import { useState } from 'react'
import { Check, Globe, Map, Search, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, PageHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { UpgradeNote } from '@/components/pins/UpgradeNote'
import { BulkComposer, type DraftRow } from '@/components/schedule/BulkComposer'
import { api, apiBlob, errorText } from '@/lib/api'
import { designPinFile, layoutFor, PALETTES, photoFromBlob, tidyHeadline, type AutoLayout } from '@/lib/pin-design'
import { refreshSummary, useSummary } from '@/lib/hooks'
import { PLANS } from '@/types'
import { cn } from '@/lib/utils'

interface Imported {
  url: string
  page_title: string
  images: string[]
  ai: { titles: string[]; description: string; alt_text: string }
  is_duplicate: boolean
}
type PageState = Imported & { selected: Set<string>; title: string }

export default function ImportPage() {
  const { summary } = useSummary()
  const plan = summary ? PLANS[summary.plan] : null
  const [mode, setMode] = useState<'page' | 'sitemap'>('page')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [sitemapUrls, setSitemapUrls] = useState<string[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [pages, setPages] = useState<PageState[]>([])
  const [rows, setRows] = useState<DraftRow[] | null>(null)
  // Optional: turn each page photo into a designed pin (photo + headline) instead of using it as it is.
  const [autoDesign, setAutoDesign] = useState(false)
  const [layout, setLayout] = useState<AutoLayout>('mixed')
  const [paletteId, setPaletteId] = useState(PALETTES[0].id)
  const [designing, setDesigning] = useState<{ done: number; total: number } | null>(null)

  const toPage = (r: Imported): PageState => ({ ...r, selected: new Set(r.images.slice(0, 1)), title: r.ai.titles[0] ?? r.page_title })

  async function importPage() {
    if (!/^https?:\/\//i.test(url.trim())) return toast.error('Enter a full URL starting with https://')
    setBusy(true)
    try {
      const res = await api<Imported>('/import/url', { body: { url: url.trim() } })
      setPages([toPage(res)])
      void refreshSummary()
      if (res.is_duplicate) toast.message('You already have pins linking to this page.')
    } catch (e) { toast.error(errorText(e)) }
    setBusy(false)
  }

  async function readSitemap() {
    if (!/^https?:\/\//i.test(url.trim())) return toast.error('Enter your website address, for example https://example.com')
    setBusy(true)
    try {
      const res = await api<{ urls: string[] }>('/import/sitemap', { body: { url: url.trim() } })
      setSitemapUrls(res.urls)
      setPicked(new Set())
    } catch (e) { toast.error(errorText(e)) }
    setBusy(false)
  }

  async function importPicked() {
    const urls = [...picked].slice(0, 25)
    setBusy(true)
    try {
      const res = await api<{ results: ({ ok: true } & Imported | { ok: false; url: string; error: string })[] }>('/import/bulk', { body: { urls } })
      const ok = res.results.filter((r): r is { ok: true } & Imported => r.ok)
      setPages(ok.map(toPage))
      const failed = res.results.length - ok.length
      if (failed) toast.error(`${failed} page${failed > 1 ? 's' : ''} could not be read.`)
      void refreshSummary()
    } catch (e) { toast.error(errorText(e)) }
    setBusy(false)
  }

  function toggleImage(i: number, src: string) {
    setPages((all) => all.map((p, idx) => {
      if (idx !== i) return p
      const s = new Set(p.selected)
      if (s.has(src)) s.delete(src)
      else s.add(src)
      return { ...p, selected: s }
    }))
  }

  async function build() {
    const base: DraftRow[] = pages.flatMap((p) => [...p.selected].map((src) => ({
      id: crypto.randomUUID(), imageUrl: src, preview: src, title: p.title, description: p.ai.description, link: p.url,
    })))
    if (base.length === 0) return toast.error('Select at least one image.')
    const picked = base.slice(0, 200)
    if (!autoDesign) return setRows(picked)

    // Draw each pin in the browser: fetch the photo through the worker (so the canvas stays clean), lay the
    // headline over it, and keep the result as a local file that is uploaded when the batch is scheduled.
    const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0]
    const total = picked.length
    let done = 0
    let failed = 0
    setDesigning({ done, total })
    const out: DraftRow[] = new Array(total)
    let next = 0
    await Promise.all(Array.from({ length: Math.min(3, total) }, async () => {
      while (next < total) {
        const i = next++
        const row = picked[i]
        try {
          const photo = await photoFromBlob(await apiBlob(`/proxy/image?url=${encodeURIComponent(row.imageUrl!)}`))
          const file = await designPinFile({
            template: layoutFor(i, layout), palette, headline: tidyHeadline(row.title), kicker: '', number: '',
            brand: new URL(row.link).hostname.replace(/^www\./, ''), photo,
          })
          out[i] = { ...row, file, imageUrl: undefined, preview: URL.createObjectURL(file) }
        } catch {
          failed++
          out[i] = row // keep the original image for this one rather than losing the pin
        }
        setDesigning({ done: ++done, total })
      }
    }))
    setDesigning(null)
    if (failed) toast.message(`${failed} image${failed > 1 ? 's' : ''} could not be designed, so the original ${failed > 1 ? 'images are' : 'image is'} used.`)
    setRows(out)
  }

  if (rows) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Review and schedule" description="Edit anything you like, then pick a board and spacing." actions={<Button variant="ghost" size="sm" onClick={() => setRows(null)}>Back</Button>} />
        <BulkComposer rows={rows} setRows={setRows as React.Dispatch<React.SetStateAction<DraftRow[]>>} />
      </div>
    )
  }

  const visible = sitemapUrls.filter((u) => u.toLowerCase().includes(filter.toLowerCase()))
  return (
    <div className="max-w-3xl">
      <PageHeader title="From website" description="Paste a page or a sitemap. We pull the images and write Pinterest-ready titles and descriptions." />

      {pages.length === 0 && (
        <Card className="space-y-4 p-4 sm:p-5">
          <div className="inline-flex rounded-lg bg-stone-100 p-1" role="tablist">
            {([['page', 'Single page', Globe], ['sitemap', 'Whole sitemap', Map]] as const).map(([k, label, Icon]) => (
              <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
                className={cn('flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium', mode === k ? 'bg-white text-ink shadow-sm' : 'text-stone-600')}>
                <Icon size={14} aria-hidden />{label}
              </button>
            ))}
          </div>

          <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); void (mode === 'page' ? importPage() : readSitemap()) }}>
            <Input wrapperClassName="min-w-0 flex-1" label={mode === 'page' ? 'Page URL' : 'Website or sitemap URL'} type="url" inputMode="url" autoCapitalize="none" autoCorrect="off"
              placeholder={mode === 'page' ? 'https://yourblog.com/best-pasta-recipes' : 'https://yourblog.com'} value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button type="submit" loading={busy} disabled={mode === 'sitemap' && !!plan && !plan.sitemap_import}>{mode === 'page' ? 'Import page' : 'Read sitemap'}</Button>
          </form>
          {mode === 'sitemap' && plan && !plan.sitemap_import && <UpgradeNote>Sitemap import is included in the Pro plan and above.</UpgradeNote>}
          {plan && <p className="text-xs text-muted">{plan.website_imports - (summary?.used.imports ?? 0)} of {plan.website_imports} page imports left this month.</p>}

          {sitemapUrls.length > 0 && (
            <div className="space-y-3 border-t border-line pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden />
                  <input aria-label="Filter pages" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter pages"
                    className="h-9 w-full rounded-lg border border-line pl-8 pr-3 text-sm focus:border-stone-400 focus:outline-none" />
                </div>
                <p className="text-xs text-muted">{picked.size}/25 selected of {sitemapUrls.length} found</p>
              </div>
              <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                {visible.slice(0, 300).map((u) => (
                  <li key={u}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-stone-50">
                      <input type="checkbox" className="h-4 w-4 accent-[#e60023]" checked={picked.has(u)}
                        onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(u)) n.delete(u); else if (n.size < 25) n.add(u); return n })} />
                      <span className="min-w-0 truncate">{u.replace(/^https?:\/\//, '')}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <Button onClick={importPicked} loading={busy} disabled={picked.size === 0}>Import {picked.size || ''} selected</Button>
            </div>
          )}
        </Card>
      )}

      {pages.length > 0 && (
        <div className="space-y-4">
          {pages.map((p, i) => (
            <Card key={p.url} className="p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.page_title}</p>
                {p.is_duplicate && <Badge tone="warning">Already pinned</Badge>}
              </div>
              <p className="mb-3 truncate text-xs text-muted">{p.url}</p>
              <div className="mb-4 flex flex-col gap-3">
                <Input label="Pin title" value={p.title} maxLength={100} onChange={(e) => setPages((all) => all.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                {p.ai.titles.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.ai.titles.map((t) => (
                      <button key={t} type="button" onClick={() => setPages((all) => all.map((x, j) => (j === i ? { ...x, title: t } : x)))}
                        className="max-w-full truncate rounded-md border border-line px-2 py-1 text-xs text-stone-600 hover:border-stone-400">{t}</button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mb-2 text-sm font-medium text-ink">Images to pin ({p.selected.size} selected)</p>
              {p.images.length === 0 ? (
                <p className="text-sm text-muted">No usable images were found on that page.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {p.images.map((src) => {
                    const on = p.selected.has(src)
                    return (
                      <button key={src} type="button" onClick={() => toggleImage(i, src)} aria-pressed={on}
                        className={cn('relative aspect-[2/3] overflow-hidden rounded-lg border-2 bg-stone-100', on ? 'border-brand' : 'border-transparent')}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
                        {on && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white"><Check size={12} /></span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>
          ))}
          <Card className="p-4 sm:p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#e60023]" checked={autoDesign} onChange={(e) => setAutoDesign(e.target.checked)} />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink"><Wand2 size={15} aria-hidden /> Design each pin automatically</span>
                <span className="mt-0.5 block text-xs text-muted">Puts the page title over each photo as a finished 1000 x 1500 pin. Not AI: it is a template layout, and you can still edit everything on the next screen.</span>
              </span>
            </label>
            {autoDesign && (
              <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-line pt-4">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-ink">Layout</p>
                  <div className="inline-flex rounded-lg bg-stone-100 p-1" role="group" aria-label="Layout">
                    {([['mixed', 'Mixed'], ['card', 'Photo card'], ['split', 'Photo + panel']] as const).map(([k, label]) => (
                      <button key={k} type="button" aria-pressed={layout === k} onClick={() => setLayout(k)}
                        className={cn('h-8 rounded-md px-3 text-[13px] font-medium', layout === k ? 'bg-white text-ink shadow-sm' : 'text-stone-600')}>{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-ink">Colors</p>
                  <div className="flex gap-2" role="group" aria-label="Colors">
                    {PALETTES.map((p) => (
                      <button key={p.id} type="button" aria-label={p.name} aria-pressed={paletteId === p.id} title={p.name} onClick={() => setPaletteId(p.id)}
                        className={cn('h-8 w-8 rounded-full border-2', paletteId === p.id ? 'border-ink' : 'border-line')} style={{ background: `linear-gradient(135deg, ${p.bg} 55%, ${p.accent} 55%)` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPages([])} disabled={!!designing}>Start over</Button>
            <Button size="lg" onClick={build} loading={!!designing}>{designing ? `Designing ${designing.done} of ${designing.total}` : 'Continue'}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
