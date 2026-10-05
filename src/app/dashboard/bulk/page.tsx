'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { parse } from 'csv-parse/browser/esm/sync'
import { Download, FileSpreadsheet, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { Card, PageHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { UpgradeNote } from '@/components/pins/UpgradeNote'
import { BulkComposer, type DraftRow } from '@/components/schedule/BulkComposer'
import { useSummary } from '@/lib/hooks'
import { validateImage } from '@/lib/upload'
import { PLANS } from '@/types'
import { cn } from '@/lib/utils'

const TEMPLATE = 'image_url,title,description,link\nhttps://example.com/images/pin-1.jpg,"Small kitchen storage ideas","Smart ways to organize a small kitchen. Save for later.",https://example.com/blog/kitchen-storage\n'

const fileName = (f: File) => f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()

export default function BulkPage() {
  const { summary } = useSummary()
  const allowed = summary ? PLANS[summary.plan].bulk_upload : true
  const [rows, setRows] = useState<DraftRow[]>([])

  const onImages = useCallback((files: File[]) => {
    const next: DraftRow[] = []
    for (const f of files) {
      const problem = validateImage(f)
      if (problem) { toast.error(problem); continue }
      next.push({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f), title: fileName(f), description: '', link: '' })
    }
    setRows((r) => [...r, ...next].slice(0, 200))
  }, [])

  const onCsv = useCallback(async (files: File[]) => {
    const f = files[0]
    if (!f) return
    try {
      const records = parse(await f.text(), { columns: (h: string[]) => h.map((x) => x.trim().toLowerCase()), skip_empty_lines: true, trim: true, bom: true }) as Record<string, string>[]
      const out: DraftRow[] = []
      records.forEach((rec, i) => {
        const url = rec.image_url || rec.image || rec.url
        if (!url || !/^https:\/\//i.test(url)) { toast.error(`Row ${i + 2}: image_url must be an https link.`); return }
        out.push({ id: crypto.randomUUID(), imageUrl: url, preview: url, title: rec.title ?? '', description: rec.description ?? '', link: rec.link || rec.destination_url || '' })
      })
      if (out.length) { setRows((r) => [...r, ...out].slice(0, 200)); toast.success(`${out.length} rows loaded.`) }
    } catch {
      toast.error('Could not read that CSV. Download the template to see the expected columns.')
    }
  }, [])

  const img = useDropzone({ onDrop: onImages, accept: { 'image/*': [] }, disabled: !allowed })
  const csv = useDropzone({ onDrop: onCsv, accept: { 'text/csv': ['.csv'] }, maxFiles: 1, disabled: !allowed })

  function downloadTemplate() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }))
    a.download = 'pinshedule-template.csv'
    a.click()
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Bulk schedule" description="Add many pins at once, review them, and spread them across days automatically." />
      {!allowed && <div className="mb-5"><UpgradeNote>Bulk scheduling is included in paid plans.</UpgradeNote></div>}

      {rows.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { dz: img, icon: ImagePlus, title: 'Upload images', text: 'Select up to 200 images, then write titles and descriptions.' },
            { dz: csv, icon: FileSpreadsheet, title: 'Import a CSV', text: 'Columns: image_url, title, description, link. Images must be public https links.' },
          ].map(({ dz, icon: Icon, title, text }) => (
            <Card key={title} className={cn('p-0', !allowed && 'opacity-60')}>
              <div {...dz.getRootProps()} className={cn('flex h-full min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors', dz.isDragActive ? 'border-brand bg-brand-soft' : 'border-transparent hover:bg-stone-50')}>
                <input {...dz.getInputProps()} />
                <Icon size={26} className="mb-3 text-stone-400" aria-hidden />
                <p className="text-sm font-medium text-ink">{title}</p>
                <p className="mt-1 text-xs text-muted">{text}</p>
                {dz === csv && <Button variant="ghost" size="sm" className="mt-3" onClick={(e) => { e.stopPropagation(); downloadTemplate() }}><Download size={14} aria-hidden /> Template</Button>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => img.open()}><ImagePlus size={14} aria-hidden /> Add images</Button>
            <Button variant="ghost" size="sm" onClick={() => setRows([])}>Clear all</Button>
            <input {...img.getInputProps()} />
          </div>
          <BulkComposer rows={rows} setRows={setRows} />
        </>
      )}
    </div>
  )
}
