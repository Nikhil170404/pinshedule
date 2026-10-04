import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Check } from '@/lib/pin-checks'

const style = {
  error: { icon: AlertCircle, cls: 'text-red-600', label: 'Problem' },
  warn: { icon: AlertTriangle, cls: 'text-amber-600', label: 'Tip' },
  ok: { icon: CheckCircle2, cls: 'text-emerald-600', label: 'Good' },
} as const

export function CheckList({ checks }: { checks: Check[] }) {
  const order = { error: 0, warn: 1, ok: 2 } as const
  return (
    <ul className="space-y-2.5" aria-live="polite">
      {[...checks].sort((a, b) => order[a.level] - order[b.level]).map((c, i) => {
        const S = style[c.level]
        return (
          <li key={i} className="flex items-start gap-2.5 text-sm text-stone-700">
            <S.icon size={17} className={`mt-0.5 shrink-0 ${S.cls}`} aria-hidden />
            <span><span className="sr-only">{S.label}: </span>{c.text}</span>
          </li>
        )
      })}
    </ul>
  )
}
