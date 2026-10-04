'use client'

import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { CycleToggle, PlanCards } from '@/components/pricing/PlanCards'
import { api, errorText } from '@/lib/api'
import { refreshSummary, useSummary } from '@/lib/hooks'
import { PLANS, isPaidPlan, isUpgrade, type BillingCycle, type Plan } from '@/types'
import { formatDate } from '@/lib/utils'

declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } }
}

export default function UpgradePage() {
  const router = useRouter()
  const { summary } = useSummary()
  const [cycle, setCycle] = useState<BillingCycle>('yearly')
  const [loading, setLoading] = useState<string | null>(null)

  const [switching, setSwitching] = useState<{ plan: Plan; upgrade: boolean } | null>(null)
  const [when, setWhen] = useState<'now' | 'renewal'>('now')
  const subscribed = !!summary && summary.plan !== 'free_trial' && ['active', 'cancelling'].includes(summary.plan_status)
  const cycleNow: BillingCycle = summary?.billing_cycle ?? 'monthly'

  /** Entry point from a plan card: a first purchase goes straight to payment, a switch asks how to switch. */
  function choose(plan: Plan) {
    if (!subscribed || !summary) return void checkout(plan, 'now')
    const upgrade = isUpgrade({ plan: summary.plan, cycle: cycleNow }, { plan, cycle })
    setWhen(upgrade ? 'now' : 'renewal')
    setSwitching({ plan, upgrade })
  }

  async function checkout(plan: Plan, mode: 'now' | 'renewal') {
    if (!window.Razorpay) return toast.error('Payment form is still loading. Try again in a moment.')
    setSwitching(null)
    setLoading(plan)
    try {
      const { subscription_id, key_id, mode: applied, starts_at } = await api<{ subscription_id: string; key_id: string; mode: 'now' | 'renewal'; starts_at: string | null }>('/billing/checkout', { body: { plan, cycle, when: mode } })
      const rzp = new window.Razorpay({
        key: key_id,
        subscription_id,
        name: 'GoPinKaro',
        description: `${PLANS[plan].name} plan, billed ${cycle}${applied === 'renewal' && starts_at ? `, starts ${new Date(starts_at).toLocaleDateString()}` : ''}`,
        theme: { color: '#e60023' },
        modal: { ondismiss: () => setLoading(null) },
        handler: async (r: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          try {
            const out = await api<{ scheduled?: boolean; starts_at?: string; plan: string }>('/billing/verify', { body: r })
            await refreshSummary()
            toast.success(out.scheduled && out.starts_at ? `You will switch to ${PLANS[out.plan as Plan].name} on ${new Date(out.starts_at).toLocaleDateString()}.` : 'Your plan is active.')
            router.push('/dashboard/billing')
          } catch (e) { toast.error(errorText(e)) }
          setLoading(null)
        },
      })
      rzp.open()
    } catch (e) {
      toast.error(errorText(e))
      setLoading(null)
    }
  }

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <PageHeader title="Choose a plan" description="Cancel any time. You keep your plan until the end of the period you paid for." actions={<CycleToggle cycle={cycle} onChange={setCycle} />} />
      <PlanCards cycle={cycle} current={summary ? (summary.plan === 'free_trial' ? 'free_trial' : summary.billing_cycle === cycle ? summary.plan : undefined) : undefined}
        renderCta={(p, isCurrent) => p.id === 'free_trial' ? (
          <Button variant="outline" className="w-full" disabled>{isCurrent ? 'Current plan' : 'Free forever'}</Button>
        ) : (
          <Button className="w-full" variant={isCurrent ? 'outline' : 'primary'} disabled={isCurrent || !isPaidPlan(p.id)} loading={loading === p.id} onClick={() => choose(p.id)}>
            {isCurrent ? 'Current plan' : `Choose ${p.name}`}
          </Button>
        )} />
      {summary?.next_plan && <p className="mt-4 rounded-lg bg-stone-50 px-3 py-2.5 text-sm text-muted">You are switching to {PLANS[summary.next_plan.plan].name} on {formatDate(summary.next_plan.at, summary.timezone)}. Nothing else is needed.</p>}
      <p className="mt-6 text-xs text-muted">Payments are processed securely by Razorpay. Prices are in US dollars.</p>

      <Modal open={!!switching} onClose={() => setSwitching(null)} title={switching ? `Switch to ${PLANS[switching.plan].name}` : 'Switch plan'}
        footer={<><Button variant="ghost" onClick={() => setSwitching(null)}>Cancel</Button><Button onClick={() => switching && checkout(switching.plan, when)}>Continue to payment</Button></>}>
        {switching && summary && (
          <div className="space-y-3" role="radiogroup" aria-label="When to switch">
            {switching.upgrade && (
              <button type="button" role="radio" aria-checked={when === 'now'} onClick={() => setWhen('now')} className={`w-full rounded-xl border p-3 text-left ${when === 'now' ? 'border-ink bg-stone-50' : 'border-line'}`}>
                <p className="text-sm font-medium text-ink">Upgrade now</p>
                <p className="mt-0.5 text-xs text-muted">{PLANS[switching.plan].name} starts today and is charged now at ${cycle === 'yearly' ? `${PLANS[switching.plan].price_yearly_usd} a year` : `${PLANS[switching.plan].price_monthly_usd} a month`}. Your current subscription ends immediately, and Razorpay does not refund the unused time on it.</p>
              </button>
            )}
            <button type="button" role="radio" aria-checked={when === 'renewal'} onClick={() => setWhen('renewal')} className={`w-full rounded-xl border p-3 text-left ${when === 'renewal' ? 'border-ink bg-stone-50' : 'border-line'}`}>
              <p className="text-sm font-medium text-ink">Switch when my current period ends{summary.expires_at ? ` (${formatDate(summary.expires_at, summary.timezone)})` : ''}</p>
              <p className="mt-0.5 text-xs text-muted">You keep {summary.plan_name} until then, and {PLANS[switching.plan].name} starts automatically with no overlap. You are not charged twice for the same time.</p>
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
