'use client'

import Link from 'next/link'
import { useState, useSyncExternalStore } from 'react'
import { Check, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { usePinCounts, useSummary } from '@/lib/hooks'
import { cn } from '@/lib/utils'

const KEY = 'gopinkaro.getstarted.dismissed'
const read = () => { try { return window.localStorage.getItem(KEY) === '1' } catch { return false } }
const subscribe = (cb: () => void) => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb) }

/** First-run checklist. Each step ticks itself from real data, and the card disappears when all are done. */
export function GetStarted() {
  const { summary } = useSummary()
  const counts = usePinCounts()
  const dismissed = useSyncExternalStore(subscribe, read, () => true)
  const [hidden, setHidden] = useState(false)
  if (!summary || !counts || dismissed || hidden) return null

  const total = counts.pending + counts.processing + counts.published + counts.failed
  const steps = [
    { done: summary.pinterest?.status === 'active', title: 'Connect your Pinterest account', text: 'Needed to read your boards and publish pins.', href: '/dashboard/settings', cta: 'Connect' },
    { done: total > 0, title: 'Schedule your first pin', text: 'Upload an image, or import a page from your website.', href: '/dashboard/schedule', cta: 'New pin' },
    { done: counts.published > 0, title: 'See your first pin go live', text: 'Published pins show up here and on Pinterest.', href: '/dashboard/pins', cta: 'View pins' },
    { done: summary.used.imports > 0, title: 'Turn a web page into pins', text: 'Paste a blog post or product page and review the drafts.', href: '/dashboard/import', cta: 'Import' },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Get started</h2>
          <p className="mt-0.5 text-xs text-muted">{doneCount} of {steps.length} done</p>
        </div>
        <button onClick={() => { try { window.localStorage.setItem(KEY, '1') } catch {} setHidden(true) }} aria-label="Hide this checklist"
          className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100"><X size={16} /></button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuenow={doneCount} aria-valuemax={steps.length} aria-label="Setup progress">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-4 divide-y divide-line">
        {steps.map((s) => (
          <li key={s.title} className="flex items-center gap-3 py-3">
            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border', s.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-stone-300')} aria-hidden>{s.done && <Check size={14} />}</span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium', s.done ? 'text-muted line-through' : 'text-ink')}>{s.title}</p>
              {!s.done && <p className="text-xs text-muted">{s.text}</p>}
            </div>
            {!s.done && <Link href={s.href} className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-stone-50">{s.cta}</Link>}
          </li>
        ))}
      </ul>
    </Card>
  )
}
