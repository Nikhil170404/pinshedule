import { useCallback, useSyncExternalStore } from 'react'
import { useSummary } from '@/lib/hooks'
import type { PinterestAccount } from '@/types'

const KEY = 'gopinkaro.account'
const subs = new Set<() => void>()

function read(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}
const subscribe = (cb: () => void) => { subs.add(cb); window.addEventListener('storage', cb); return () => { subs.delete(cb); window.removeEventListener('storage', cb) } }

/**
 * The Pinterest account the user is working in. Stored per browser; falls back to the primary account
 * when nothing is stored or the stored account was disconnected.
 */
export function useActiveAccount() {
  const { summary } = useSummary()
  const stored = useSyncExternalStore(subscribe, read, () => null)
  const accounts: PinterestAccount[] = summary?.accounts ?? []
  const account = accounts.find((a) => a.id === stored) ?? accounts[0] ?? null
  const setActive = useCallback((id: string) => {
    try { localStorage.setItem(KEY, id) } catch { /* private mode: selection lasts until reload */ }
    subs.forEach((s) => s())
  }, [])
  return { account, accounts, setActive, multiple: accounts.length > 1 }
}

/** Value for the `connection` field/query: omitted for the primary account so single-account users send nothing extra. */
export const connectionParam = (account: PinterestAccount | null) => (account && !account.is_primary ? account.id : undefined)

/** For code outside React (the assistant store). The worker ignores an id that no longer exists. */
export const getStoredAccountId = read
