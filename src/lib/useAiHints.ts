'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

/** Debounced, fire-and-forget hint lookups. They never throw: hints are a nicety. */
function useDebouncedHint<T>(path: string, text: string, empty: T, minLength = 20): T {
  const [state, setState] = useState<{ text: string; value: T } | null>(null)
  const clean = text.trim()

  useEffect(() => {
    if (clean.length < minLength) return
    let cancelled = false
    const t = setTimeout(() => {
      api<Record<string, unknown>>(path, { body: { text: clean.slice(0, 1500) } })
        .then((r) => { if (!cancelled) setState({ text: clean, value: (Object.values(r)[0] ?? empty) as T }) })
        .catch(() => {})
    }, 900)
    return () => { cancelled = true; clearTimeout(t) }
  }, [clean, path, minLength, empty])

  return state && state.text === clean ? state.value : empty
}

export interface SimilarPin { pin_id: string; title: string | null; status: string; scheduled_at: string; similarity: number }
export interface BoardSuggestion { id: string; name: string; score: number }

const NO_PINS: SimilarPin[] = []
const NO_BOARDS: BoardSuggestion[] = []

export const useSimilarPins = (text: string) => useDebouncedHint<SimilarPin[]>('/ai/similar', text, NO_PINS)
export const useBoardSuggestions = (text: string) => useDebouncedHint<BoardSuggestion[]>('/ai/suggest-board', text, NO_BOARDS, 12)
