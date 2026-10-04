'use client'

import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/Card'
import { CycleToggle, PlanCards } from '@/components/pricing/PlanCards'
import { api, errorText } from '@/lib/api'
import { refreshSummary, useSummary } from '@/lib/hooks'
import { PLANS, isPaidPlan, type BillingCycle } from '@/types'

declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } }
}

export default function UpgradePage() {
  const router = useRouter()
  const { summary } = useSummary()
  const [cycle, setCycle] = useState<BillingCycle>('yearly')
  const [loading, setLoading] = useState<string | null>(null)

  async function checkout(plan: string) {
    if (!window.Razorpay) return toast.error('Payment form is still loading. Try again in a moment.')
    // Switching while subscribed: be explicit about what happens to the money.
    if (summary && summary.plan !== 'free_trial' && summary.plan !== plan && summary.plan_status === 'active') {
      const next = PLANS[plan as keyof typeof PLANS]
      const price = cycle === 'yearly' ? `$${next.price_yearly_usd} a year` : `$${next.price_monthly_usd} a month`
      const ok = confirm(`You are on ${summary.plan_name}. ${next.name} is charged now at ${price}. Your current subscription is cancelled at the end of its paid period and is not refunded for the unused time. Continue?`)
      if (!ok) return
    }
    setLoading(plan)
    try {
      const { subscription_id, key_id } = await api<{ subscription_id: string; key_id: string }>('/billing/checkout', { body: { plan, cycle } })
      const rzp = new window.Razorpay({
        key: key_id,
        subscription_id,
        name: 'GoPinKaro',
        description: `${plan} plan, billed ${cycle}`,
        theme: { color: '#e60023' },
        modal: { ondismiss: () => setLoading(null) },
        handler: async (r: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          try {
            await api('/billing/verify', { body: r })
            await refreshSummary()
            toast.success('Your plan is active.')
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
