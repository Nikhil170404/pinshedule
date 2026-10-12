import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

/** Indian digit grouping (1,00,00,000), since admin counts can reach crores. */
export const n = (v: number | null | undefined) => (v ?? 0).toLocaleString('en-IN')
export const usd = (v: number) => `$${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
export const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never')

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' | 'bad' }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums text-ink', tone === 'warn' && 'text-amber-600', tone === 'bad' && 'text-red-600')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  )
}

export function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function PlanBadge({ plan, status }: { plan: string; status?: string }) {
  const bad = status === 'payment_failed'
  const warn = status === 'cancelling'
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', plan === 'free_trial' ? 'bg-stone-100 text-stone-600' : 'bg-emerald-50 text-emerald-700', bad && 'bg-red-50 text-red-700', warn && 'bg-amber-50 text-amber-700')}>
      {plan === 'free_trial' ? 'Free' : plan}{status && status !== 'active' ? ` · ${status.replace('_', ' ')}` : ''}
    </span>
  )
}
