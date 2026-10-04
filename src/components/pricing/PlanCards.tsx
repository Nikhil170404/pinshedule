import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PLANS, PAID_PLANS, monthlyEquivalent, monthsFree, type BillingCycle, type Plan, type PlanDetails } from '@/types'

const ORDER: Plan[] = ['free_trial', 'starter', 'pro', 'growth']

export function planFeatures(p: PlanDetails): { text: string; on: boolean }[] {
  return [
    { text: `${p.pins_per_month.toLocaleString()} pins per month`, on: true },
    { text: `${p.website_imports.toLocaleString()} website page imports`, on: true },
    { text: `${p.ai_generations.toLocaleString()} AI writing generations`, on: true },
    { text: `Up to ${p.batch_max} pins per scheduling batch`, on: true },
    { text: 'Bulk scheduling and CSV import', on: p.bulk_upload },
    { text: 'Best-time auto scheduling', on: p.smart_scheduler },
    { text: 'Sitemap import', on: p.sitemap_import },
    { text: `${p.analytics_days} days of analytics`, on: true },
    { text: `${p.support} support`, on: true },
  ]
}

export function PlanCards({ cycle, current, renderCta, highlight = 'pro' }: {
  cycle: BillingCycle
  current?: Plan
  renderCta: (plan: PlanDetails, isCurrent: boolean) => React.ReactNode
  highlight?: Plan
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {ORDER.map((id) => {
        const p = PLANS[id]
        const price = monthlyEquivalent(p, cycle)
        const isCurrent = current === id
        return (
          <div key={id} className={cn('flex flex-col rounded-xl border bg-white p-5', id === highlight ? 'border-ink ring-1 ring-ink' : 'border-line')}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">{p.name}</h3>
              {id === highlight && <span className="rounded-md bg-ink px-2 py-0.5 text-[11px] font-medium text-white">Most popular</span>}
            </div>
            <p className="mt-1 min-h-10 text-sm text-muted">{p.tagline}</p>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight text-ink">${price % 1 === 0 ? price : price.toFixed(2)}</span>
              <span className="text-sm text-muted">/month</span>
            </p>
            <p className="mt-1 h-4 text-xs text-muted">
              {id === 'free_trial' ? 'Free forever' : cycle === 'yearly' ? `Billed $${p.price_yearly_usd} a year` : 'Billed monthly'}
            </p>
            <div className="mt-5">{renderCta(p, isCurrent)}</div>
            <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm">
              {planFeatures(p).map((f) => (
                <li key={f.text} className={cn('flex items-start gap-2.5', f.on ? 'text-ink' : 'text-stone-400')}>
                  {f.on ? <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden /> : <Minus size={16} className="mt-0.5 shrink-0" aria-hidden />}
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/** Computed from the real prices, so the badge can never promise more than the plans give. */
const yearlyFreeMonths = Math.floor(Math.min(...PAID_PLANS.map((id) => monthsFree(PLANS[id]))))

export function CycleToggle({ cycle, onChange }: { cycle: BillingCycle; onChange: (c: BillingCycle) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-stone-100 p-1" role="tablist" aria-label="Billing period">
      {(['monthly', 'yearly'] as const).map((c) => (
        <button key={c} role="tab" aria-selected={cycle === c} onClick={() => onChange(c)}
          className={cn('h-9 rounded-md px-4 text-sm font-medium transition-colors', cycle === c ? 'bg-white text-ink shadow-sm' : 'text-stone-600')}>
          {c === 'monthly' ? 'Monthly' : 'Yearly'}{c === 'yearly' && <span className="ml-1.5 text-xs text-emerald-700">{yearlyFreeMonths} months free</span>}
        </button>
      ))}
    </div>
  )
}
