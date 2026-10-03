'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { AssistantChat } from './AssistantChat'
import { setAssistantOpen, useAssistant } from '@/lib/assistant-store'

/** Floating button and slide-over on every dashboard page. Cmd/Ctrl+K toggles it. */
export function AssistantLauncher() {
  const { open } = useAssistant()
  const pathname = usePathname()
  const onPage = pathname === '/dashboard/assistant'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAssistantOpen(!open) }
      else if (e.key === 'Escape' && open) setAssistantOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    if (window.innerWidth < 640) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (onPage) return null
  return (
    <>
      {!open && (
        <button onClick={() => setAssistantOpen(true)} aria-label="Open assistant (Ctrl+K)"
          className="fixed bottom-[4.75rem] right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-white shadow-lg transition-transform hover:scale-[1.03] lg:bottom-6 lg:right-6">
          <Sparkles size={17} aria-hidden /> <span className="hidden sm:inline">Assistant</span>
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[55]" role="dialog" aria-label="Assistant">
          <div className="anim-fade absolute inset-0 bg-stone-900/30 sm:bg-stone-900/20" onClick={() => setAssistantOpen(false)} />
          <AssistantChat onClose={() => setAssistantOpen(false)}
            className="anim-sheet absolute inset-0 sm:inset-y-3 sm:left-auto sm:right-3 sm:w-[440px] sm:rounded-2xl sm:border sm:border-line sm:shadow-2xl" />
        </div>
      )}
    </>
  )
}
