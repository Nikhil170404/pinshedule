'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/button-styles'
import { Card, Meter, PageHeader, Skeleton } from '@/components/ui/Card'
import { api, errorText } from '@/lib/api'
import { refreshSummary, useSummary } from '@/lib/hooks'
import { PLANS } from '@/types'
import { FileText } from 'lucide-react'

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

interface Invoice { id: string; amount: number; currency: string; status: string; date: string; url: string | null }
const money = (n: number, c: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n)

export default function BillingPage() {
  const { summary } = useSummary()
  const [busy, setBusy] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [invoiceError, setInvoiceError] = useState(false)
  const paidPlan = !!summary && summary.plan !== 'free_trial'

  useEffect(() => {
    if (!paidPlan) return
    api<{ invoices: Invoice[] }>('/billing/invoices').then((r) => setInvoices(r.invoices)).catch(() => setInvoiceError(true))
  }, [paidPlan])

  async function cancel() {
    if (!confirm('Cancel your subscription? You keep your plan until the end of the current period.')) return
    setBusy(true)
    try {
      await api('/billing/cancel', { method: 'POST', body: {} })
      await refreshSummary()
      toast.success('Subscription cancelled. Your plan stays active until the period ends.')
    } catch (e) { toast.error(errorText(e)) }
    setBusy(false)
  }

  if (!summary) return <div><PageHeader title="Plan and billing" /><Skeleton className="h-64" /></div>
  const plan = PLANS[summary.plan]
  const paid = summary.plan !== 'free_trial'

  return (
    <div className="max-w-2xl">
      <PageHeader title="Plan and billing" />
      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-ink">{plan.name}</h2>
              {summary.plan_status === 'cancelling' && <Badge tone="warning">Cancels at period end</Badge>}
              {summary.plan_status === 'payment_failed' && <Badge tone="danger">Payment failed</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">
              {paid ? (summary.expires_at ? `${summary.plan_status === 'cancelling' ? 'Access until' : 'Renews on'} ${fmt(summary.expires_at)}` : 'Active') : 'Free forever, no card on file.'}
            </p>
          </div>
          <Link href="/dashboard/upgrade" className={buttonStyles(paid ? 'outline' : 'primary')}>{paid ? 'Change plan' : 'Upgrade'}</Link>
        </div>
        {summary.next_plan && (
          <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-muted">You are switching to <strong className="text-ink">{PLANS[summary.next_plan.plan].name}</strong> ({summary.next_plan.cycle}) on {fmt(summary.next_plan.at)}. Until then you keep {plan.name}. You are not charged twice for the same time.</p>
        )}
        {summary.plan_status === 'payment_failed' && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Your last payment did not go through. Update your payment method with Razorpay or choose a plan again to keep your access.</p>
        )}
      </Card>

      <Card className="mb-5 space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink">Usage this month</h2>
        <Meter label="Pins scheduled" value={summary.used.pins} max={summary.limits.pins} />
        <Meter label="AI generations" value={summary.used.ai} max={summary.limits.ai} />
        <Meter label="Website imports" value={summary.used.imports} max={summary.limits.imports} />
        <p className="text-xs text-muted">Counters reset on the first day of each month (UTC).</p>
        <div className="space-y-4 border-t border-line pt-4">
          <Meter label="Pinterest accounts" value={summary.used.accounts} max={summary.limits.accounts} />
          <Meter label="Active automations" value={summary.used.automations} max={summary.limits.automations} />
        </div>
      </Card>

      {paid && (
        <Card className="mb-5 p-5">
          <h2 className="text-sm font-semibold text-ink">Invoices</h2>
          {invoiceError ? <p className="mt-2 text-sm text-muted">Could not load invoices right now. Razorpay also emails a receipt for every payment.</p>
            : invoices === null ? <Skeleton className="mt-3 h-16" />
            : invoices.length === 0 ? <p className="mt-2 text-sm text-muted">No invoices yet. They appear here after your first payment.</p>
            : (
              <ul className="mt-2 divide-y divide-line">
                {invoices.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2.5"><FileText size={16} className="shrink-0 text-stone-400" aria-hidden /><span className="truncate text-ink">{fmt(i.date)}</span><Badge tone={i.status === 'paid' ? 'success' : 'neutral'}>{i.status}</Badge></span>
                    <span className="flex shrink-0 items-center gap-3"><span className="tabular-nums text-ink">{money(i.amount, i.currency)}</span>{i.url && <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand hover:underline">View</a>}</span>
                  </li>
                ))}
              </ul>
            )}
        </Card>
      )}

      {paid && summary.plan_status !== 'cancelling' && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Cancel subscription</h2>
          <p className="mt-1 text-sm text-muted">You keep your current plan until the end of the period you already paid for. Scheduled pins stay in your queue.</p>
          <Button variant="outline" className="mt-3" onClick={cancel} loading={busy}>Cancel subscription</Button>
        </Card>
      )}
    </div>
  )
}
