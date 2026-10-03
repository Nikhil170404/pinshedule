'use client'

import { Copy } from 'lucide-react'
import { useSimilarPins } from '@/lib/useAiHints'
import { formatDateTime } from '@/lib/utils'

/** Warns when a near-identical pin already exists. Reposting close duplicates can look like spam to Pinterest. */
export function SimilarNotice({ text }: { text: string }) {
  const matches = useSimilarPins(text)
  if (matches.length === 0) return null
  const m = matches[0]
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900" role="status">
      <Copy size={14} className="mt-0.5 shrink-0" aria-hidden />
      <span>Very similar to {m.status === 'published' ? 'a pin published' : 'a pin scheduled for'} {formatDateTime(m.scheduled_at)}{m.title ? `: "${m.title}"` : ''}. Consider changing the title or image so it reads as fresh content.</span>
    </p>
  )
}
