'use client'

import { useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { api, ApiError } from '@/lib/api'
import { refreshSummary, reloadBoards } from '@/lib/hooks'
import { getStoredAccountId } from '@/lib/accounts'

export interface ProposalView { id: string; tool: string; summary: string; details: string[] }
export interface ProposalState extends ProposalView { state: 'pending' | 'running' | 'done' | 'dismissed' | 'error'; result?: string }
export interface UiAction { type: 'navigate'; path: string; label: string }
export interface ChatMessage { id: string; role: 'user' | 'assistant'; text: string; proposals?: ProposalState[]; actions?: UiAction[]; upgrade?: boolean }

interface State { messages: ChatMessage[]; busy: boolean; status: string; open: boolean }

const KEY = 'pinshedule.assistant.v1'
const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/$/, '')

function load(): ChatMessage[] {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null
    return raw ? (JSON.parse(raw) as ChatMessage[]).slice(-40) : []
  } catch { return [] }
}

let state: State = { messages: [], busy: false, status: '', open: false }
let hydrated = false
const subs = new Set<() => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  if (patch.messages) {
    try {
      // Proposals that were still waiting do not survive a reload (they expire server-side), so store them as dismissed.
      const clean = state.messages.slice(-40).map((m) => ({ ...m, proposals: m.proposals?.map((p) => (p.state === 'pending' || p.state === 'running' ? { ...p, state: 'dismissed' as const } : p)) }))
      window.localStorage.setItem(KEY, JSON.stringify(clean))
    } catch {}
  }
  subs.forEach((s) => s())
}

function hydrate() {
  if (hydrated || typeof window === 'undefined') return
  hydrated = true
  state = { ...state, messages: load() }
}

const uid = () => crypto.randomUUID()

function patchMessage(id: string, fn: (m: ChatMessage) => ChatMessage) {
  set({ messages: state.messages.map((m) => (m.id === id ? fn(m) : m)) })
}

/** What the model sees of earlier turns: plain text plus the outcome of any proposals. */
function toHistory() {
  return state.messages.filter((m) => m.text || m.proposals?.length).slice(-12).map((m) => ({
    role: m.role,
    content: [m.text, ...(m.proposals ?? []).map((p) => `[Proposal "${p.summary}": ${p.state === 'done' ? 'confirmed and done' : p.state === 'dismissed' ? 'dismissed by user' : p.state}]`)].filter(Boolean).join('\n').slice(0, 3900),
  }))
}

export async function sendMessage(text: string) {
  const clean = text.trim()
  if (!clean || state.busy) return
  const assistantId = uid()
  set({ busy: true, status: 'Thinking', messages: [...state.messages, { id: uid(), role: 'user', text: clean.slice(0, 4000) }, { id: assistantId, role: 'assistant', text: '' }] })

  try {
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    const res = await fetch(`${API}/v1/assistant/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ connection_id: getStoredAccountId() ?? undefined, messages: toHistory().slice(0, -1).concat({ role: 'user', content: clean.slice(0, 4000) }) }),
    })
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; upgrade_required?: boolean }
      patchMessage(assistantId, (m) => ({ ...m, text: body.error ?? 'The assistant is unavailable right now.', upgrade: body.upgrade_required }))
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let i
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i)
        buf = buf.slice(i + 2)
        const line = chunk.split('\n').find((l) => l.startsWith('data:'))
        if (!line) continue
        const ev = JSON.parse(line.slice(5).trim()) as
          | { type: 'status'; text: string } | { type: 'message'; text: string } | { type: 'proposal'; proposal: ProposalView } | { type: 'ui'; action: UiAction } | { type: 'done' }
        if (ev.type === 'status') set({ status: ev.text })
        else if (ev.type === 'message') patchMessage(assistantId, (m) => ({ ...m, text: m.text ? `${m.text}\n\n${ev.text}` : ev.text }))
        else if (ev.type === 'proposal') patchMessage(assistantId, (m) => ({ ...m, proposals: [...(m.proposals ?? []), { ...ev.proposal, state: 'pending' }] }))
        else if (ev.type === 'ui') patchMessage(assistantId, (m) => ({ ...m, actions: [...(m.actions ?? []), ev.action] }))
      }
    }
    void refreshSummary()
  } catch {
    patchMessage(assistantId, (m) => ({ ...m, text: m.text || 'Connection lost. Please try again.' }))
  } finally {
    set({ busy: false, status: '' })
  }
}

export async function confirmProposal(messageId: string, proposalId: string) {
  const setP = (p: Partial<ProposalState>) => patchMessage(messageId, (m) => ({ ...m, proposals: m.proposals?.map((x) => (x.id === proposalId ? { ...x, ...p } : x)) }))
  const tool = state.messages.find((m) => m.id === messageId)?.proposals?.find((p) => p.id === proposalId)?.tool
  setP({ state: 'running' })
  try {
    const r = await api<{ message: string }>('/assistant/execute', { body: { proposal_id: proposalId } })
    setP({ state: 'done', result: r.message })
    void refreshSummary()
    if (tool === 'create_board') void reloadBoards()
  } catch (e) {
    setP({ state: 'error', result: e instanceof ApiError ? e.message : 'That did not work. Please try again.' })
  }
}

export const dismissProposal = (messageId: string, proposalId: string) =>
  patchMessage(messageId, (m) => ({ ...m, proposals: m.proposals?.map((x) => (x.id === proposalId ? { ...x, state: 'dismissed' } : x)) }))

export const clearChat = () => set({ messages: [], status: '' })
export const setAssistantOpen = (open: boolean) => set({ open })

const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb) } }
const serverState: State = { messages: [], busy: false, status: '', open: false }

export function useAssistant() {
  hydrate()
  return useSyncExternalStore(subscribe, () => state, () => serverState)
}
