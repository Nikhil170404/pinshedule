'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Gauge, X } from 'lucide-react'
import { useSummary } from '@/lib/hooks'
import { nudgeFor } from '@/lib/usage-nudge'
import { cn } from '@/lib/utils'

const keyFor = (meter: string, level: string) => `gopinkaro.nudge.${new Date().toISOString().slice(0, 7)}.${meter}.${level}`

/** Heads-up before a plan limit blocks the user. Dismissing hides that warning for the rest of the month. */
export function UsageNudge() {
  const { summary } = useSummary()
  const nudge = nudgeFor(summary)
  const [hidden, setHidden] = useState<string | null>(null)
  if (!nudge) return null
  const key = keyFor(nudge.meter, nudge.level)
  let dismissed = hidden === key
  try { dismissed = dismissed || localStorage.getItem(key) === '1' } catch { /* storage blocked: still show it */ }
  if (dismissed) return null

  const limit = nudge.level === 'limit'
  return (
    <div className={cn('mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm', limit ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900')} role="status">
      <div className="flex items-start gap-2.5"><Gauge size={18} className="mt-0.5 shrink-0" aria-hidden /><p>{nudge.message}</p></div>
      <div className="flex shrink-0 items-center gap-1">
        {nudge.upgradeTo && <Link href="/dashboard/upgrade" className={cn('rounded-lg px-3 py-1.5 text-xs font-medium text-white', limit ? 'bg-red-700 hover:bg-red-800' : 'bg-amber-900 hover:bg-amber-950')}>See plans</Link>}
        <button type="button" aria-label="Dismiss" onClick={() => { try { localStorage.setItem(key, '1') } catch {} setHidden(key) }}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/5"><X size={15} aria-hidden /></button>
      </div>
    </div>
  )
}
