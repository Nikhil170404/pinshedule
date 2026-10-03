'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, Loader2, Sparkles, Trash2, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { RichText } from './RichText'
import {
  clearChat, confirmProposal, dismissProposal, sendMessage, setAssistantOpen, useAssistant, type ChatMessage, type ProposalState,
} from '@/lib/assistant-store'

const SUGGESTIONS = [
  'Turn my latest blog post into 5 pins and schedule them',
  'What failed this week and why?',
  'How are my pins doing this month?',
  'Spread everything in my queue to 3 pins a day',
  'Find trending keywords for home decor',
  'Create a board called Weeknight Dinners',
]

function ProposalCard({ messageId, p }: { messageId: string; p: ProposalState }) {
  const finished = p.state === 'done' || p.state === 'dismissed' || p.state === 'error'
  return (
    <div className={cn('mt-2 rounded-xl border bg-white p-3', p.state === 'done' ? 'border-emerald-200' : p.state === 'error' ? 'border-red-200' : 'border-line')}>
      <p className="text-sm font-medium text-ink">{p.summary}</p>
      {p.details.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-xs text-muted">{p.details.map((d, i) => <li key={i} className="truncate">{d}</li>)}</ul>
      )}
      {p.state === 'pending' && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => confirmProposal(messageId, p.id)}><Check size={14} aria-hidden /> Confirm</Button>
          <Button size="sm" variant="ghost" onClick={() => dismissProposal(messageId, p.id)}>Dismiss</Button>
        </div>
      )}
      {p.state === 'running' && <p className="mt-3 flex items-center gap-2 text-xs text-muted"><Loader2 size={14} className="animate-spin" aria-hidden /> Working</p>}
      {p.state === 'done' && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700"><Check size={14} aria-hidden />{p.result}</p>}
      {p.state === 'error' && <p className="mt-2 text-xs font-medium text-red-700">{p.result}</p>}
      {p.state === 'dismissed' && <p className="mt-2 text-xs text-muted">Dismissed</p>}
      {finished && null}
    </div>
  )
}

function Bubble({ m }: { m: ChatMessage }) {
  const router = useRouter()
  if (m.role === 'user') {
    return <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-sm text-white">{m.text}</div>
  }
  return (
    <div className="max-w-[92%] text-sm leading-relaxed text-ink">
      {m.text && <RichText text={m.text} />}
      {m.proposals?.map((p) => <ProposalCard key={p.id} messageId={m.id} p={p} />)}
      {m.actions?.map((a, i) => (
        <button key={i} onClick={() => { setAssistantOpen(false); router.push(a.path) }}
          className="mt-2 mr-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[13px] font-medium text-ink hover:bg-stone-50">
          Open {a.label} <ArrowRight size={13} aria-hidden />
        </button>
      ))}
      {m.upgrade && <Link href="/dashboard/upgrade" onClick={() => setAssistantOpen(false)} className="mt-2 inline-block text-[13px] font-medium text-brand hover:underline">See plans</Link>}
    </div>
  )
}

export function AssistantChat({ onClose, className }: { onClose?: () => void; className?: string }) {
  const { messages, busy, status } = useAssistant()
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, status])

  function submit() {
    if (!input.trim() || busy) return
    void sendMessage(input)
    setInput('')
    if (areaRef.current) areaRef.current.style.height = 'auto'
  }

  return (
    <div className={cn('flex min-h-0 flex-col bg-white', className)}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles size={16} className="text-brand" aria-hidden /> Assistant</div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && <button onClick={clearChat} aria-label="Clear conversation" className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"><Trash2 size={16} /></button>}
          {onClose && <button onClick={onClose} aria-label="Close assistant" className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"><X size={18} /></button>}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div>
            <p className="text-sm font-medium text-ink">Ask me to do things in Pinshedule.</p>
            <p className="mt-1 text-sm text-muted">I can schedule pins in bulk, import pages from your site, fix failed pins, manage boards and settings, and report on performance. I always ask before changing anything.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => sendMessage(s)} disabled={busy}
                  className="rounded-lg border border-line bg-white px-3 py-2 text-left text-[13px] text-stone-700 hover:border-stone-400 disabled:opacity-50">{s}</button>
              ))}
            </div>
          </div>
        ) : messages.map((m) => (m.role === 'assistant' && !m.text && !m.proposals?.length && !m.actions?.length ? null : <Bubble key={m.id} m={m} />))}
        {busy && <p className="flex items-center gap-2 text-xs text-muted"><Loader2 size={14} className="animate-spin" aria-hidden />{status || 'Thinking'}...</p>}
        <div ref={endRef} />
      </div>

      <form className="safe-pb shrink-0 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className="flex items-end gap-2 rounded-xl border border-line bg-white p-1.5 focus-within:border-stone-400">
          <textarea ref={areaRef} value={input} rows={1} maxLength={4000} aria-label="Message the assistant"
            placeholder="Schedule, fix or ask anything"
            onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px` }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }}
            className="max-h-36 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:outline-none placeholder:text-stone-400" />
          <button type="submit" disabled={!input.trim() || busy} aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-dark disabled:bg-stone-200 disabled:text-stone-400">
            <ArrowUp size={18} />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-stone-400">Each message uses one AI action from your monthly allowance. Changes need your confirmation.</p>
      </form>
    </div>
  )
}
