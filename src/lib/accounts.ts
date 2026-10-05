'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { api } from '@/lib/api'
import { activeAccount } from '@/lib/account-store'
import { createStore } from '@/lib/store'

export interface AccountInfo {
  id: string
  username: string | null
  label: string | null
  avatar_url: string | null
  status: 'active' | 'needs_reconnect'
  last_error: string | null
  is_primary: boolean
  created_at: string
  stats: { pending: number; failed: number; published_30d: number; last_published_at: string | null; next_at: string | null }
}

export interface AccountsData { accounts: AccountInfo[]; limit: number; count: number; can_add: boolean; plan_name: string }

const dataStore = createStore<AccountsData>()
let inflight: Promise<void> | null = null

export const accountName = (a: Pick<AccountInfo, 'label' | 'username'> | null | undefined) =>
  a ? (a.label || (a.username ? `@${a.username}` : 'Pinterest account')) : 'No account'

export function refreshAccounts() {
  inflight ??= api<AccountsData>('/accounts')
    .then((d) => dataStore.set(d))
    .catch(() => {})
    .finally(() => { inflight = null })
  return inflight
}

// The API clears the selection when it names an account that no longer exists; reload the list when that happens.
if (typeof window !== 'undefined') window.addEventListener('gpk:accounts-stale', () => { void refreshAccounts() })

/** All accounts of this login plus the one currently selected (falls back to the primary account). */
export function useAccounts() {
  const data = useSyncExternalStore(dataStore.subscribe, dataStore.get, () => null)
  const activeId = useSyncExternalStore(activeAccount.subscribe, activeAccount.get, () => null)
  useEffect(() => { if (!dataStore.get()) void refreshAccounts() }, [])

  const accounts = data?.accounts ?? []
  const active = accounts.find((a) => a.id === activeId) ?? accounts[0] ?? null

  // Keep the remembered choice in step with what is actually shown.
  useEffect(() => {
    if (!data) return
    const want = active?.id ?? null
    if (want !== activeId) activeAccount.set(want)
  }, [data, active, activeId])

  return { data, accounts, active, loaded: data !== null, setActive: (id: string) => activeAccount.set(id), refresh: refreshAccounts }
}
