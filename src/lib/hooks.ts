'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { api } from '@/lib/api'
import type { PinStatus, PinterestBoard, ScheduledPin, Summary } from '@/types'

// ─── Tiny shared store: navigating between pages never re-flashes a skeleton ──
function createStore<T>() {
  let value: T | null = null
  const subs = new Set<() => void>()
  return {
    get: () => value,
    set(v: T) { value = v; subs.forEach((s) => s()) },
    subscribe(cb: () => void) { subs.add(cb); return () => { subs.delete(cb) } },
  }
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
  useEffect(() => { void refreshSummary() }, [])
  return { summary, refresh: refreshSummary }
}

const boardsStore = createStore<PinterestBoard[]>()
let boardsInflight: Promise<void> | null = null

export function useBoards() {
  const boards = useSyncExternalStore(boardsStore.subscribe, boardsStore.get, () => null)
  const [error, setError] = useState<{ message: string; reconnect: boolean } | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (force = false) => {
    if (!force && boardsStore.get()) return
    setLoading(true)
    boardsInflight ??= api<{ boards: PinterestBoard[] }>(`/boards${force ? '?refresh=1' : ''}`)
      .then((r) => { boardsStore.set(r.boards); setError(null) })
      .catch((e: { message: string; reconnect?: boolean }) => setError({ message: e.message, reconnect: !!e.reconnect }))
      .finally(() => { boardsInflight = null })
    await boardsInflight
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; state is set when the request starts/finishes
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

const COLUMNS = 'id,user_id,image_url,title,description,alt_text,board_id,board_name,destination_url,scheduled_at,status,pinterest_pin_id,error_message,published_at,created_at'

function matches(p: ScheduledPin, q: PinQuery) {
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
  const key = JSON.stringify(query)
  const q = useMemo(() => JSON.parse(key) as PinQuery, [key])
  const pageSize = q.pageSize ?? 30
  const [pins, setPins] = useState<ScheduledPin[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loading = loadedKey !== key
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pageRef = useRef(0)
  const qRef = useRef(q)
  useEffect(() => { qRef.current = q }, [q])

  const fetchPage = useCallback(async (page: number) => {
    const supabase = createClient()
    let req = supabase.from('scheduled_pins').select(COLUMNS).order('scheduled_at', { ascending: q.ascending ?? true }).range(page * pageSize, page * pageSize + pageSize)
    if (q.statuses) req = req.in('status', q.statuses)
    if (q.from) req = req.gte('scheduled_at', q.from)
    if (q.to) req = req.lt('scheduled_at', q.to)
    const { data, error: err } = await req
    if (err) { setError('Could not load pins.'); return [] }
    setError(null)
    const rows = (data ?? []) as ScheduledPin[]
    setHasMore(rows.length > pageSize)
    return rows.slice(0, pageSize)
  }, [q, pageSize])

  useEffect(() => {
    let cancelled = false
    pageRef.current = 0
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the request resolves
    fetchPage(0).then((rows) => { if (!cancelled) { setPins(rows); setLoadedKey(key) } })
    return () => { cancelled = true }
  }, [fetchPage, key])

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
          const query = qRef.current
          const asc = query.ascending ?? true
          setPins((prev) => {
            if (payload.eventType === 'DELETE') return prev.filter((p) => p.id !== (payload.old as { id: string }).id)
            const row = payload.new as ScheduledPin
            const rest = prev.filter((p) => p.id !== row.id)
            if (!matches(row, query)) return rest
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
  const [counts, setCounts] = useState<Record<PinStatus, number> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let channel: ReturnType<typeof supabase.channel> | null = null

    const load = async () => {
      const statuses: PinStatus[] = ['pending', 'processing', 'published', 'failed']
      const res = await Promise.all(statuses.map((s) => supabase.from('scheduled_pins').select('id', { count: 'exact', head: true }).eq('status', s)))
      if (alive) setCounts(Object.fromEntries(statuses.map((s, i) => [s, res[i].count ?? 0])) as Record<PinStatus, number>)
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
  }, [])

  return counts
}
