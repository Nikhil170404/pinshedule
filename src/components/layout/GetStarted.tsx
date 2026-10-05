'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CheckCircle2, Circle, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { usePinCounts, useSummary } from '@/lib/hooks'

const KEY = 'gpk.getstarted.dismissed'

/** A short first-run checklist on the overview. Steps tick themselves off from real data and it hides when finished. */
export function GetStarted() {
  const { summary } = useSummary()
  const counts = usePinCounts()
  // Read once. The card renders nothing until summary and counts load, so this never causes a hydration mismatch.
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(KEY) === '1' } catch { return false }
  })

  if (!summary || !counts || dismissed) return null
  const total = counts.pending + counts.processing + counts.published + counts.failed

  const steps = [
    { done: !!summary.pinterest, title: 'Connect Pinterest', text: 'Connect the Pinterest account you want to schedule for.', href: '/dashboard/accounts', cta: 'Connect' },
    { done: total > 0, title: 'Make or add your first pin', text: 'Design one from a template, or upload an image you already have.', href: '/dashboard/design', cta: 'Open the designer' },
    { done: total >= 5, title: 'Fill your queue', text: 'Import a web page or bulk upload so the next week is covered.', href: '/dashboard/import', cta: 'Import a page' },
  ]
  if (steps.every((s) => s.done)) return null

  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(KEY, '1') } catch { /* private mode: it will simply show again next visit */ }
  }

  const next = steps.findIndex((s) => !s.done)
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Get started</h2>
          <p className="mt-0.5 text-xs text-muted">{steps.filter((s) => s.done).length} of {steps.length} done</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Hide this checklist" className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-ink"><X size={16} /></button>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            {s.done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-label="Done" /> : <Circle size={18} className="mt-0.5 shrink-0 text-stone-300" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className={s.done ? 'text-sm text-muted line-through' : 'text-sm font-medium text-ink'}>{s.title}</p>
              {i === next && <p className="mt-0.5 text-xs text-muted">{s.text}</p>}
            </div>
            {i === next && <Link href={s.href} className="shrink-0 text-xs font-medium text-brand hover:underline">{s.cta}</Link>}
          </li>
        ))}
      </ol>
    </Card>
  )
}
