'use client'

import { AlertTriangle } from 'lucide-react'
import { useSummary } from '@/lib/hooks'

export function ConnectionBanner() {
  const { summary } = useSummary()
  if (!summary) return null
  const broken = summary.pinterest?.status === 'needs_reconnect'
  const missing = summary.pinterest === null
  if (!broken && !missing) return null
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
        <p>{broken ? 'Pinterest access expired, so scheduled pins cannot publish.' : 'Connect your Pinterest account to publish pins.'}</p>
      </div>
      <a href="/api/auth/pinterest?next=/dashboard" className="shrink-0 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-950">
        {broken ? 'Reconnect' : 'Connect Pinterest'}
      </a>
    </div>
  )
}
