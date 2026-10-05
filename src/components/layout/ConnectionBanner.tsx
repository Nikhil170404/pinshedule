'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { useSummary } from '@/lib/hooks'

const ADD = '/api/auth/pinterest?add=1'

function Banner({ children, action }: { children: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
        <p>{children}</p>
      </div>
      {action}
    </div>
  )
}

const actionClass = 'shrink-0 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-950'

export function ConnectionBanner() {
  const { summary } = useSummary()
  if (!summary) return null
  const conn = summary.pinterest
  const over = summary.accounts.count > summary.accounts.limit
  return (
    <>
      {conn === null && <Banner action={<a href={ADD} className={actionClass}>Connect Pinterest</a>}>Connect your Pinterest account to publish pins.</Banner>}
      {conn?.status === 'needs_reconnect' && (
        <Banner action={<a href={ADD} className={actionClass}>Reconnect</a>}>
          Pinterest access expired for {conn.label || (conn.username ? `@${conn.username}` : 'this account')}, so its scheduled pins cannot publish. Sign in to that Pinterest account first, then reconnect.
        </Banner>
      )}
      {over && (
        <Banner action={<Link href="/dashboard/accounts" className={actionClass}>Manage accounts</Link>}>
          Your plan includes {summary.accounts.limit} Pinterest account{summary.accounts.limit === 1 ? '' : 's'} but {summary.accounts.count} are connected. Remove some or upgrade.
        </Banner>
      )}
    </>
  )
}
