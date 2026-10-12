'use client'

import { useState } from 'react'
import { FACTS } from '@/content/seo/facts'

const TITLE_SHOWN = 40
const DESC_SHOWN = 60

function Bar({ n, max }: { n: number; max: number }) {
  const over = n > max
  return <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className={`h-full ${over ? 'bg-red-500' : 'bg-brand'}`} style={{ width: `${Math.min(100, (n / max) * 100)}%` }} /></div>
}

export function PinTextChecker() {
  const [kw, setKw] = useState('')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const k = kw.trim().toLowerCase()
  const has = (s: string) => k.length > 0 && s.toLowerCase().includes(k)
  const tips: { ok: boolean; text: string }[] = []
  if (title) {
    tips.push({ ok: title.length <= FACTS.titleMax, text: `Title is ${title.length} of ${FACTS.titleMax} characters.` })
    if (title.length > TITLE_SHOWN) tips.push({ ok: false, text: `Only the first ${TITLE_SHOWN} or so characters of a title usually show in the feed. Put the key words first.` })
  }
  if (desc) {
    tips.push({ ok: desc.length <= FACTS.descriptionMax, text: `Description is ${desc.length} of ${FACTS.descriptionMax} characters.` })
    tips.push({ ok: desc.length >= 100, text: desc.length >= 100 ? 'Good length for context.' : 'Short. A sentence or two describing the pin helps Pinterest understand it.' })
  }
  if (k) {
    if (title) tips.push({ ok: has(title), text: has(title) ? 'Keyword is in the title.' : 'Keyword is missing from the title.' })
    if (desc) tips.push({ ok: has(desc.slice(0, DESC_SHOWN * 2)), text: has(desc.slice(0, DESC_SHOWN * 2)) ? 'Keyword appears early in the description.' : 'Move the keyword into the first sentence of the description.' })
  }
  const field = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none'
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="kw" className="text-sm font-medium text-ink">Target keyword (optional)</label>
        <input id="kw" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="e.g. healthy meal prep" className={field} />
      </div>
      <div>
        <label htmlFor="t" className="flex justify-between text-sm font-medium text-ink">Pin title <span className="font-normal text-muted">{title.length}/{FACTS.titleMax}</span></label>
        <input id="t" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        <Bar n={title.length} max={FACTS.titleMax} />
      </div>
      <div>
        <label htmlFor="d" className="flex justify-between text-sm font-medium text-ink">Pin description <span className="font-normal text-muted">{desc.length}/{FACTS.descriptionMax}</span></label>
        <textarea id="d" rows={5} value={desc} onChange={(e) => setDesc(e.target.value)} className={field} />
        <Bar n={desc.length} max={FACTS.descriptionMax} />
      </div>
      {tips.length > 0 && (
        <ul className="space-y-2 rounded-xl border border-line bg-white p-4" aria-live="polite">
          {tips.map((t) => <li key={t.text} className="flex gap-2 text-sm text-stone-700"><span aria-hidden>{t.ok ? '✓' : '!'}</span><span className="sr-only">{t.ok ? 'Pass:' : 'Fix:'}</span>{t.text}</li>)}
        </ul>
      )}
    </div>
  )
}
