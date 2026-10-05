'use client'

import Link from 'next/link'
import { useDeferredValue, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, ChevronsUpDown, Plus, Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Card'
import { AccountAvatar } from './AccountAvatar'
import { accountName, useAccounts, type AccountInfo } from '@/lib/accounts'
import { cn } from '@/lib/utils'
import { PLANS } from '@/types'

const ADD = '/api/auth/pinterest?add=1'

/** Choose which Pinterest account the whole dashboard works on. Searchable, so it stays usable at 100 accounts. */
export function AccountSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const { data, accounts, active, setActive, loaded } = useAccounts()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query).trim().toLowerCase()

  if (!loaded) return <Skeleton className={compact ? 'h-9 w-28' : 'h-12 w-full'} />
  if (accounts.length === 0) {
    return <a href={ADD} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-brand-dark"><Plus size={15} aria-hidden /> Connect Pinterest</a>
  }

  const shown = accounts.filter((a) => !q || accountName(a).toLowerCase().includes(q) || (a.username ?? '').toLowerCase().includes(q))
  const attention = (a: AccountInfo) => a.status === 'needs_reconnect'

  function choose(a: AccountInfo) {
    setActive(a.id)
    setOpen(false)
    setQuery('')
    router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Pinterest account: ${accountName(active)}. Change account`}
        className={cn('flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-white text-left transition-colors hover:bg-stone-50',
          compact ? 'h-9 max-w-[11rem] px-2' : 'w-full px-2.5 py-2')}>
        <AccountAvatar account={active} size={compact ? 22 : 30} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{accountName(active)}</span>
          {!compact && <span className="block truncate text-xs text-muted">{accounts.length === 1 ? 'Pinterest account' : `${accounts.length} accounts`}</span>}
        </span>
        {active && attention(active) && <AlertTriangle size={14} className="shrink-0 text-amber-600" aria-label="Needs reconnect" />}
        <ChevronsUpDown size={14} className="shrink-0 text-stone-400" aria-hidden />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Switch account"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Link href="/dashboard/accounts" onClick={() => setOpen(false)} className="text-sm font-medium text-ink hover:underline">Manage accounts</Link>
            {data?.can_add
              ? <a href={ADD} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-stone-50"><Plus size={15} aria-hidden /> Add account</a>
              : (data?.limit ?? 0) >= PLANS.growth.accounts
                ? <span className="text-xs text-muted">Account limit reached</span>
                : <Link href="/dashboard/upgrade" onClick={() => setOpen(false)} className="text-sm font-medium text-brand hover:underline">Upgrade for more accounts</Link>}
          </div>
        }>
        {accounts.length > 6 && (
          <div className="relative mb-3">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${accounts.length} accounts`} aria-label="Search accounts" autoFocus
              className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-stone-400" />
          </div>
        )}
        <ul className="-mx-2 max-h-[55dvh] space-y-0.5 overflow-y-auto px-2" role="listbox" aria-label="Pinterest accounts">
          {shown.map((a) => (
            <li key={a.id}>
              <button type="button" role="option" aria-selected={a.id === active?.id} onClick={() => choose(a)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-stone-50', a.id === active?.id && 'bg-stone-50')}>
                <AccountAvatar account={a} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{accountName(a)}</span>
                  <span className="block truncate text-xs text-muted">
                    {attention(a) ? <span className="text-amber-700">Needs reconnect</span> : `${a.stats.pending} scheduled`}
                    {a.stats.failed > 0 && <span className="text-red-600"> · {a.stats.failed} failed</span>}
                  </span>
                </span>
                {a.id === active?.id && <Check size={16} className="shrink-0 text-brand" aria-label="Selected" />}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">No account matches &ldquo;{query}&rdquo;.</li>}
        </ul>
      </Modal>
    </>
  )
}
