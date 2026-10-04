'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { usePinCounts } from '@/lib/hooks'

/** Live alert when pins fail, on every dashboard page except the Pins page itself. */
export function FailedPinsBanner() {
  const counts = usePinCounts()
  const pathname = usePathname()
  if (!counts || counts.failed === 0 || pathname.startsWith('/dashboard/pins')) return null
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
      <div className="flex items-start gap-2.5">
        <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden />
        <p>{counts.failed} {counts.failed === 1 ? 'pin' : 'pins'} failed to publish. Review the reason and retry.</p>
      </div>
      <Link href="/dashboard/pins?tab=failed" className="shrink-0 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800">Review failed pins</Link>
    </div>
  )
}
