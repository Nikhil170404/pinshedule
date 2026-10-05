'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { api } from '@/lib/api'
import { activeAccount } from '@/lib/account-store'
import { useAccounts } from '@/lib/accounts'
import { createStore } from '@/lib/store'
import type { PinStatus, PinterestBoard, ScheduledPin, Summary } from '@/types'

/** The account the dashboard works on. `ready` is false until the account list has loaded, so nothing is fetched unscoped. */
export function useScope() {
  const { loaded, active } = useAccounts()
  return { ready: loaded, id: active?.id ?? null }
}

const summaryStore = createStore<Summary>()
let summaryInflight: Promise<void> | null = null

export function refreshSummary() {
  summaryInflight ??= api<Summary>('/account/summary')
    .then((s) => summaryStore.set(s))
    .catch(() => {})
    .finally(() => { summaryInflight = null })
  return summaryInflight
}

export function useSummary() {
  const summary = useSyncExternalStore(summaryStore.subscribe, summaryStore.get, () => null)
  const accountId = useSyncExternalStore(activeAccount.subscribe, activeAccount.get, () => null)
  // Refetch when the selected account changes: the summary names the active account and its connection status.
  useEffect(() => { void refreshSummary() }, [accountId])
  return { summary, refresh: refreshSummary }
}

// Boards belong to one Pinterest account, so they are cached per account id.
const boardsStore = createStore<Record<string, PinterestBoard[]>>()
const boardsInflight = new Map<string, Promise<void>>()

function fetchBoards(accountId: string, force: boolean) {
  const cur = boardsInflight.get(accountId)
  if (cur) return cur
  const p = api<{ boards: PinterestBoard[] }>(`/boards${force ? '?refresh=1' : ''}`)
    .then((r) => boardsStore.set({ ...(boardsStore.get() ?? {}), [accountId]: r.boards }))
    .finally(() => { boardsInflight.delete(accountId) })
  boardsInflight.set(accountId, p)
  return p
}

/** Refetch boards of the active account for everyone using them (e.g. after the assistant creates one). */
export function reloadBoards() {
  const id = activeAccount.get()
  return id ? fetchBoards(id, true).catch(() => {}) : Promise.resolve()
}

export function useBoards() {
  const scope = useScope()
  const all = useSyncExternalStore(boardsStore.subscribe, boardsStore.get, () => null)
  const boards = scope.id && all ? all[scope.id] ?? null : null
  const [error, setError] = useState<{ message: string; reconnect: boolean } | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (force = false) => {
    if (!scope.id || (!force && boardsStore.get()?.[scope.id])) return
    setLoading(true)
    try {
      await fetchBoards(scope.id, force)
      setError(null)
    } catch (e) {
      const err = e as { message: string; reconnect?: boolean }
      setError({ message: err.message, reconnect: !!err.reconnect })
    }
    setLoading(false)
  }, [scope.id])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and when the account changes; state is set when the request starts/finishes
  useEffect(() => { void load() }, [load])
  return { boards: boards ?? [], loaded: boards !== null, loading, error, reload: () => load(true) }
}

// ─── Realtime pins ───────────────────────────────────────────────────────────
interface PinQuery {
  statuses?: PinStatus[]
  from?: string
  to?: string
  ascending?: boolean
  pageSize?: number
}

const COLUMNS = 'id,user_id,connection_id,image_url,media_type,video_url,carousel_items,title,description,alt_text,board_id,board_name,destination_url,scheduled_at,status,pinterest_pin_id,error_message,published_at,created_at'

function matches(p: ScheduledPin, q: PinQuery, accountId: string | null) {
  if (accountId && p.connection_id !== accountId) return false
  if (q.statuses && !q.statuses.includes(p.status)) return false
  if (q.from && p.scheduled_at < q.from) return false
  if (q.to && p.scheduled_at >= q.to) return false
  return true
}

/**
 * Pins for the signed-in user that stay live: Supabase Realtime pushes every insert, update and
 * delete (including status flips made by the Railway worker) straight into the list.
 */
export function usePins(query: PinQuery) {
  const scope = useScope()
  const key = JSON.stringify({ query, account: scope.id, ready: scope.ready })
  const q = useMemo(() => (JSON.parse(key) as { query: PinQuery }).query, [key])
  const accountId = scope.id
  const ready = scope.ready
  const pageSize = q.pageSize ?? 30
  const [pins, setPins] = useState<ScheduledPin[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loading = !ready || loadedKey !== key
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pageRef = useRef(0)
  const qRef = useRef({ q, accountId })
  useEffect(() => { qRef.current = { q, accountId } }, [q, accountId])

  const fetchPage = useCallback(async (page: number) => {
    if (!ready) return []
    const supabase = createClient()
    let req = supabase.from('scheduled_pins').select(COLUMNS).order('scheduled_at', { ascending: q.ascending ?? true }).range(page * pageSize, page * pageSize + pageSize)
    if (accountId) req = req.eq('connection_id', accountId)
    if (q.statuses) req = req.in('status', q.statuses)
    if (q.from) req = req.gte('scheduled_at', q.from)
    if (q.to) req = req.lt('scheduled_at', q.to)
    const { data, error: err } = await req
    if (err) { setError('Could not load pins.'); return [] }
    setError(null)
    const rows = (data ?? []) as ScheduledPin[]
    setHasMore(rows.length > pageSize)
    return rows.slice(0, pageSize)
  }, [q, pageSize, accountId, ready])

  useEffect(() => {
    let cancelled = false
    pageRef.current = 0
    if (!ready) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the request resolves
    fetchPage(0).then((rows) => { if (!cancelled) { setPins(rows); setLoadedKey(key) } })
    return () => { cancelled = true }
  }, [fetchPage, key, ready])

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id
      if (!alive || !uid) return
      channel = supabase
        .channel(`pins:${uid}:${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_pins', filter: `user_id=eq.${uid}` }, (payload) => {
          const { q: query, accountId: acct } = qRef.current
          const asc = query.ascending ?? true
          setPins((prev) => {
            if (payload.eventType === 'DELETE') return prev.filter((p) => p.id !== (payload.old as { id: string }).id)
            const row = payload.new as ScheduledPin
            const rest = prev.filter((p) => p.id !== row.id)
            if (!matches(row, query, acct)) return rest
            const merged = [...rest, { ...prev.find((p) => p.id === row.id), ...row }]
            return merged.sort((a, b) => (asc ? 1 : -1) * a.scheduled_at.localeCompare(b.scheduled_at))
          })
        })
        .subscribe()
    })
    return () => { alive = false; if (channel) supabase.removeChannel(channel) }
  }, [])

  const loadMore = useCallback(async () => {
    const next = pageRef.current + 1
    const rows = await fetchPage(next)
    pageRef.current = next
    setPins((prev) => {
      const seen = new Set(prev.map((p) => p.id))
      return [...prev, ...rows.filter((r) => !seen.has(r.id))]
    })
  }, [fetchPage])

  return { pins, loading, hasMore, loadMore, error }
}

/** Per-status counts, refreshed (debounced) whenever any pin changes. */
export function usePinCounts() {
  const scope = useScope()
  // Keyed by account so the previous account's numbers never show while the new ones load.
  const [state, setState] = useState<{ id: string | null; counts: Record<PinStatus, number> } | null>(null)
  const accountId = scope.id
  const ready = scope.ready

  useEffect(() => {
    if (!ready) return
    const supabase = createClient()
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let channel: ReturnType<typeof supabase.channel> | null = null

    const load = async () => {
      const statuses: PinStatus[] = ['pending', 'processing', 'published', 'failed']
      const res = await Promise.all(statuses.map((s) => {
        const req = supabase.from('scheduled_pins').select('id', { count: 'exact', head: true }).eq('status', s)
        return accountId ? req.eq('connection_id', accountId) : req
      }))
      if (alive) setState({ id: accountId, counts: Object.fromEntries(statuses.map((s, i) => [s, res[i].count ?? 0])) as Record<PinStatus, number> })
    }
    void load()
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id
      if (!alive || !uid) return
      channel = supabase
        .channel(`counts:${uid}:${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_pins', filter: `user_id=eq.${uid}` }, () => {
          clearTimeout(timer)
          timer = setTimeout(load, 600)
        })
        .subscribe()
    })
    return () => { alive = false; clearTimeout(timer); if (channel) supabase.removeChannel(channel) }
  }, [ready, accountId])

  return ready && state && state.id === accountId ? state.counts : null
}
