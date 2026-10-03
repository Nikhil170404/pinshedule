'use client'

import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { api, ApiError, errorText } from '@/lib/api'
import { refreshSummary } from '@/lib/hooks'

export interface AiOption { title: string; description: string }

/** Button + options list. Calls the worker; the monthly AI allowance is enforced server-side. */
export function AiWriter({ topic, onPick, size = 'sm' }: { topic: string; onPick: (o: AiOption) => void; size?: 'sm' | 'md' }) {
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<AiOption[]>([])

  async function run() {
    if (topic.trim().length < 2) return toast.error('Add a title or a few words about the pin first.')
    setLoading(true)
    try {
      const res = await api<{ options: AiOption[] }>('/ai/caption', { body: { topic: topic.trim() } })
      setOptions(res.options)
      void refreshSummary()
    } catch (e) {
      toast.error(errorText(e), e instanceof ApiError && e.upgradeRequired ? { action: { label: 'Upgrade', onClick: () => (window.location.href = '/dashboard/upgrade') } } : undefined)
    }
    setLoading(false)
  }

  return (
    <div>
      <Button variant="outline" size={size} onClick={run} loading={loading}>
        {!loading && <Wand2 size={14} aria-hidden />} Write with AI
      </Button>
      {options.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted">Tap an option to use it. You can edit it afterwards.</p>
          {options.map((o, i) => (
            <button key={i} type="button" onClick={() => { onPick(o); setOptions([]) }}
              className="w-full rounded-lg border border-line bg-white p-3 text-left transition-colors hover:border-stone-400">
              <p className="text-sm font-medium text-ink">{o.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{o.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
