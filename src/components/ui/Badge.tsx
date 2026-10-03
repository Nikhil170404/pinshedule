import { cn } from '@/lib/utils'

const tones = {
  neutral: 'bg-stone-100 text-stone-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-sky-50 text-sky-700',
  brand: 'bg-brand-soft text-brand-dark',
}

export function Badge({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: keyof typeof tones; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

const statusMap = {
  pending: { tone: 'info', label: 'Scheduled' },
  processing: { tone: 'warning', label: 'Publishing' },
  published: { tone: 'success', label: 'Published' },
  failed: { tone: 'danger', label: 'Failed' },
} as const

export function StatusBadge({ status }: { status: keyof typeof statusMap }) {
  const s = statusMap[status] ?? statusMap.pending
  return <Badge tone={s.tone}>{s.label}</Badge>
}
