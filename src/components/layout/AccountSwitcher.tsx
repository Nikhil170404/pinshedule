'use client'

import { AtSign } from 'lucide-react'
import { useActiveAccount } from '@/lib/accounts'
import { cn } from '@/lib/utils'

/** Which Pinterest account new pins, boards and automations apply to. Hidden when there is only one. */
export function AccountSwitcher({ className }: { className?: string }) {
  const { account, accounts, setActive, multiple } = useActiveAccount()
  if (!multiple || !account) return null
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">Pinterest account</span>
      <AtSign size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden />
      <select value={account.id} onChange={(e) => setActive(e.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-line bg-white pl-9 pr-3 text-sm font-medium text-ink focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200">
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.username ?? 'Pinterest account'}{a.status !== 'active' ? ' (reconnect)' : ''}</option>)}
      </select>
    </label>
  )
}
