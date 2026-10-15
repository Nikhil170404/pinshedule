'use client'

import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/Card'
import { CycleToggle, PlanCards } from '@/components/pricing/PlanCards'
import { api, errorText } from '@/lib/api'
import { formatDate, openRazorpay } from '@/lib/razorpay-checkout'
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
      const res = await api<{ changed?: boolean; effective?: 'now' | 'cycle_end'; effective_at?: string | null; subscription_id?: string; key_id?: string; starts_at?: string | null }>('/billing/checkout', { body: { plan, cycle } })
      if (res.changed) {
        // An existing subscription was changed in place: no payment form, nothing to pay twice.
        await refreshSummary()
        toast.success(res.effective === 'now' ? `You are now on ${name}.` : `Your plan switches to ${name}${res.effective_at ? ` on ${formatDate(res.effective_at)}` : ' at the end of this period'}.`)
        router.push('/dashboard/billing')
        return
      }
      const result = await openRazorpay({ subscriptionId: res.subscription_id!, keyId: res.key_id!, description: `${name} plan, billed ${cycle}` })
      if (!result) return // closed the payment window
      await refreshSummary()
      toast.success(result.state === 'pending' && res.starts_at ? `Done. ${name} starts on ${formatDate(res.starts_at)}, when your current period ends.` : 'Your plan is active.')
      router.push('/dashboard/billing')
    } catch (e) { toast.error(errorText(e)) }
    finally { setLoading(null) }
  }

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <PageHeader title="Choose a plan" description="Cancel any time. Upgrades apply now; downgrades apply when your current period ends." actions={YEARLY_BILLING ? <CycleToggle cycle={cycle} onChange={setCycle} /> : undefined} />
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
