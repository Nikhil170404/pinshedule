'use client'

import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/Card'
import { CycleToggle, PlanCards } from '@/components/pricing/PlanCards'
import { api, errorText } from '@/lib/api'
import { formatDate, openRazorpay, openUpgradePayment } from '@/lib/razorpay-checkout'
import { money } from '@/lib/invoices'
import { refreshSummary, useSummary } from '@/lib/hooks'
import { isPaidPlan, PLANS, YEARLY_BILLING, type BillingCycle } from '@/types'

export default function UpgradePage() {
  const router = useRouter()
  const { summary } = useSummary()
  const [cycle, setCycle] = useState<BillingCycle>(YEARLY_BILLING ? 'yearly' : 'monthly')
  const [loading, setLoading] = useState<string | null>(null)

  async function checkout(plan: string) {
    setLoading(plan)
    const name = PLANS[plan as keyof typeof PLANS]?.name ?? plan
    try {
      // Say exactly what will be charged before anything is.
      const q = await api<{ kind: 'new' | 'upgrade' | 'downgrade'; charge?: number; free?: boolean; days_left?: number; renews_at?: string; new_monthly?: number; effective_at?: string | null }>(`/billing/quote?plan=${encodeURIComponent(plan)}`)
      if (q.kind === 'upgrade') {
        const renews = q.renews_at ? formatDate(q.renews_at) : 'your next renewal'
        const message = q.free
          ? `Upgrade to ${name} now? There is nothing to pay today. From ${renews} you pay ${money(q.new_monthly ?? 0, 'USD')} a month.`
          : `Upgrade to ${name}? You pay ${money(q.charge ?? 0, 'USD')} today, only the difference for the ${q.days_left} days left in this period. From ${renews} you pay ${money(q.new_monthly ?? 0, 'USD')} a month.`
        if (!confirm(message)) { setLoading(null); return }
      } else if (q.kind === 'downgrade') {
        const when = q.effective_at ? formatDate(q.effective_at) : 'the end of this period'
        if (!confirm(`Switch to ${name}? You keep your current plan until ${when}. Then ${name} starts at its lower price. Nothing is charged today.`)) { setLoading(null); return }
      }

      const res = await api<{ changed?: boolean; effective?: 'now' | 'cycle_end'; effective_at?: string | null; subscription_id?: string; key_id?: string; starts_at?: string | null; upgrade?: { order_id: string; amount: number; currency: string; key_id: string } }>('/billing/checkout', { body: { plan, cycle } })
      if (res.changed) {
        await refreshSummary()
        toast.success(res.effective === 'now' ? `You are now on ${name}.` : `Your plan switches to ${name}${res.effective_at ? ` on ${formatDate(res.effective_at)}` : ' at the end of this period'}.`)
        router.push('/dashboard/billing')
        return
      }
      if (res.upgrade) {
        const done = await openUpgradePayment({ orderId: res.upgrade.order_id, amount: res.upgrade.amount, currency: res.upgrade.currency, keyId: res.upgrade.key_id, description: `Upgrade to ${name} (prorated)` })
        if (done === null) return // closed the payment window
        await refreshSummary()
        toast.success(`You are now on ${name}.`)
        router.push('/dashboard/billing')
        return
      }
      const result = await openRazorpay({ subscriptionId: res.subscription_id!, keyId: res.key_id!, description: `${name} plan, billed ${cycle}` })
      if (!result) return // closed the payment window
      await refreshSummary()
      toast.success(result.state === 'pending' && res.starts_at ? `Done. ${name} starts on ${formatDate(res.starts_at)}, when your current period ends.` : 'Your plan is active.')
      router.push('/dashboard/billing')
    } catch (e) { toast.error(errorText(e)); await refreshSummary().catch(() => {}) }
    finally { setLoading(null) }
  }

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <PageHeader title="Choose a plan" description="Upgrades start now and you pay only the difference for the days left. Downgrades start when your current period ends. Cancel any time." actions={YEARLY_BILLING ? <CycleToggle cycle={cycle} onChange={setCycle} /> : undefined} />
      <PlanCards cycle={cycle} current={summary?.plan}
        renderCta={(p, isCurrent) => p.id === 'free_trial' ? (
          <Button variant="outline" className="w-full" disabled>{isCurrent ? 'Current plan' : 'Free forever'}</Button>
        ) : (
          <Button className="w-full" variant={isCurrent ? 'outline' : 'primary'} disabled={isCurrent || !isPaidPlan(p.id)} loading={loading === p.id} onClick={() => checkout(p.id)}>
            {isCurrent ? 'Current plan' : `Choose ${p.name}`}
          </Button>
        )} />
      <p className="mt-6 text-xs text-muted">Payments are processed securely by Razorpay. Prices are in US dollars.</p>
    </div>
  )
}
