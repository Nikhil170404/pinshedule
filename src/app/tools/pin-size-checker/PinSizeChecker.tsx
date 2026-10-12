'use client'

import { useState } from 'react'
import { FACTS } from '@/content/seo/facts'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

type Verdict = { level: 'good' | 'ok' | 'bad'; text: string }
type Result = { name: string; w: number; h: number; mb: number; ratio: string; checks: Verdict[] }

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

function judge(w: number, h: number, mb: number): Verdict[] {
  const r = w / h
  const out: Verdict[] = []
  if (Math.abs(r - 2 / 3) < 0.01) out.push({ level: 'good', text: 'A 2:3 ratio, the vertical shape Pinterest guides recommend for standard pins.' })
  else if (r < 1) out.push({ level: 'ok', text: 'Vertical, but not 2:3. Pins outside 2:3 can be cropped or take less room in the feed. 1000 x 1500 px is the safest size.' })
  else if (r === 1) out.push({ level: 'ok', text: 'Square. Pinterest accepts it, but a tall 2:3 pin takes more room in the feed.' })
  else out.push({ level: 'bad', text: 'Landscape. It shows small among tall pins. A vertical 2:3 version usually gets more room.' })
  if (w >= 1000) out.push({ level: 'good', text: 'At least 1000 px wide, the width commonly recommended.' })
  else out.push({ level: 'ok', text: `${w} px wide. Guides recommend 1000 px or more, so a larger source image will look sharper.` })
  out.push(mb <= FACTS.imageMaxMb ? { level: 'good', text: `File size ${mb.toFixed(2)} MB is under GoPinKaro's ${FACTS.imageMaxMb} MB upload limit.` } : { level: 'bad', text: `File size ${mb.toFixed(1)} MB is over GoPinKaro's ${FACTS.imageMaxMb} MB upload limit. Compress it.` })
  return out
}

const icon = { good: <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />, ok: <AlertTriangle size={18} className="shrink-0 text-amber-600" />, bad: <XCircle size={18} className="shrink-0 text-red-600" /> }

export function PinSizeChecker() {
  const [results, setResults] = useState<Result[]>([])
  const [error, setError] = useState('')

  async function onFiles(files: FileList | null) {
    setError('')
    if (!files?.length) return
    const out: Result[] = []
    for (const f of Array.from(files).slice(0, 10)) {
      if (!f.type.startsWith('image/')) { setError(`${f.name} is not an image.`); continue }
      const url = URL.createObjectURL(f)
      try {
        const dims = await new Promise<{ w: number; h: number }>((res, rej) => {
          const img = new Image()
          img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight })
          img.onerror = () => rej(new Error('unreadable'))
          img.src = url
        })
        const d = gcd(dims.w, dims.h)
        out.push({ name: f.name, ...dims, mb: f.size / 1048576, ratio: `${dims.w / d}:${dims.h / d}`, checks: judge(dims.w, dims.h, f.size / 1048576) })
      } catch { setError(`Could not read ${f.name}.`) }
      finally { URL.revokeObjectURL(url) }
    }
    setResults(out)
  }

  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-white px-6 py-10 text-center hover:border-brand">
        <span className="text-sm font-medium text-ink">Choose up to 10 images</span>
        <span className="mt-1 text-xs text-muted">PNG, JPG or WebP. Checked in your browser, nothing is uploaded.</span>
        <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
      </label>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-6 space-y-4" aria-live="polite">
        {results.map((r, i) => (
          <div key={`${r.name}-${i}`} className="rounded-xl border border-line bg-white p-4">
            <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
            <p className="mt-0.5 text-xs text-muted">{r.w} x {r.h} px, ratio {r.ratio}, {r.mb.toFixed(2)} MB</p>
            <ul className="mt-3 space-y-2">
              {r.checks.map((c) => <li key={c.text} className="flex gap-2 text-sm text-stone-700">{icon[c.level]}<span>{c.text}</span></li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
