'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/button-styles'
import { Download } from 'lucide-react'
import { Card, Meter, PageHeader, Skeleton } from '@/components/ui/Card'
import { InvoiceDetails } from '@/components/billing/InvoiceDetails'
import { api, errorText } from '@/lib/api'
import { refreshSummary, useSummary } from '@/lib/hooks'
import { formatDate, openRazorpay } from '@/lib/razorpay-checkout'
import { downloadPdf, money, type DocKind } from '@/lib/invoices'
import { PLANS } from '@/types'
import { COMPANY } from '@shared/company'

interface Payment { payment_id: string; invoice_number: string; amount: number; currency: string; status: string; refunded_amount: number; plan: string | null; paid_at: string }
interface History { payments: Payment[]; replacement_scheduled: boolean; scheduled_change?: { plan: keyof typeof PLANS; at: string | null } | null }
interface CheckoutResponse { subscription_id: string; key_id: string; starts_at: string | null }

export default function BillingPage() {
  const { summary } = useSummary()
  const [busy, setBusy] = useState<'cancel' | 'card' | 'resume' | null>(null)
  const [pdfBusy, setPdfBusy] = useState<string | null>(null)
  const [history, setHistory] = useState<History | null>(null)

  const loadHistory = useCallback(() => {
    api<History>('/billing/history').then(setHistory).catch(() => setHistory({ payments: [], replacement_scheduled: false }))
  }, [])
  useEffect(() => { loadHistory() }, [loadHistory])

  async function afterChange() {
    await refreshSummary()
    loadHistory()
  }

  async function pdf(p: Payment, kind: DocKind) {
    const key = `${p.payment_id}:${kind}`
    setPdfBusy(key)
    try { await downloadPdf(p.payment_id, p.invoice_number, kind) } catch (e) { toast.error(errorText(e)) }
    setPdfBusy(null)
  }

  async function cancel() {
    const until = summary?.expires_at ? formatDate(summary.expires_at) : 'the end of the current period'
    if (!confirm(`Cancel your subscription? You keep ${summary ? PLANS[summary.plan].name : 'your plan'} until ${until}. You will not be charged again, and you can restart any time before then.`)) return
    setBusy('cancel')
    try {
      await api('/billing/cancel', { method: 'POST', body: {} })
      await afterChange()
      toast.success(`Subscription canceled. Your plan stays active until ${until}.`)
    } catch (e) { toast.error(errorText(e)) }
    setBusy(null)
  }

  /** Authorise a replacement subscription (new card, or restarting after a cancellation) in Razorpay Checkout. */
  async function authorise(kind: 'card' | 'resume') {
    if (!summary) return
    setBusy(kind)
    try {
      const res = kind === 'card'
        ? await api<CheckoutResponse>('/billing/payment-method', { body: {} })
        : await api<CheckoutResponse>('/billing/checkout', { body: { plan: summary.plan, cycle: summary.billing_cycle ?? 'monthly' } })
      const result = await openRazorpay({ subscriptionId: res.subscription_id, keyId: res.key_id, description: `${PLANS[summary.plan].name} plan` })
      if (!result) { setBusy(null); return }
      await afterChange()
      toast.success(result.state === 'pending' && res.starts_at
        ? `Saved. It takes over on ${formatDate(res.starts_at)}, when your current period ends.`
        : kind === 'card' ? 'Payment method updated.' : 'Your subscription is active again.')
    } catch (e) { toast.error(errorText(e)) }
    setBusy(null)
  }

  if (!summary) return <div><PageHeader title="Plan and billing" /><Skeleton className="h-64" /></div>
  const plan = PLANS[summary.plan]
  const paid = summary.plan !== 'free_trial'
  const cancelling = summary.plan_status === 'cancelling'
  const failed = summary.plan_status === 'payment_failed'
  const replacement = history?.replacement_scheduled === true

  return (
    <div className="max-w-2xl">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <PageHeader title="Plan and billing" />
      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-ink">{plan.name}</h2>
              {cancelling && !replacement && <Badge tone="warning">Cancels at period end</Badge>}
              {cancelling && replacement && <Badge tone="info">New subscription scheduled</Badge>}
              {failed && <Badge tone="danger">Payment failed</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">
              {paid
                ? summary.expires_at
                  ? `${cancelling && !replacement ? 'Access until' : cancelling ? 'Current period ends' : 'Renews on'} ${formatDate(summary.expires_at)}${!cancelling && !failed ? ` · ${money((history?.scheduled_change ? PLANS[history.scheduled_change.plan] : plan).price_monthly_usd * 100, 'USD')} a month` : ''}`
                  : 'Active'
                : 'Free forever, no card on file.'}
            </p>
          </div>
          <Link href="/dashboard/upgrade" className={buttonStyles(paid ? 'outline' : 'primary')}>{paid ? 'Change plan' : 'Upgrade'}</Link>
        </div>
        {history?.scheduled_change && !cancelling && (
          <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Switching to {PLANS[history.scheduled_change.plan].name} on {history.scheduled_change.at ? formatDate(history.scheduled_change.at) : 'your next renewal'}. You keep {plan.name} until then and nothing is charged today.
          </p>
        )}
        {failed && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>Your last payment did not go through. Razorpay retries automatically, or you can add a different card now to keep your access.</p>
            <Button className="mt-2" onClick={() => authorise('card')} loading={busy === 'card'}>Update payment method</Button>
          </div>
        )}
        {cancelling && !replacement && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>Your subscription will not renew. Want to keep {plan.name}? Restart it now: you are not charged until your current period ends.</p>
            <Button className="mt-2" variant="outline" onClick={() => authorise('resume')} loading={busy === 'resume'}>Keep my subscription</Button>
          </div>
        )}
      </Card>

      <Card className="mb-5 space-y-4 p-5">
        <h2 className="text-sm font-semibold text-ink">Usage this month</h2>
        <Meter label="Pins scheduled" value={summary.used.pins} max={summary.limits.pins} />
        <Meter label="AI generations" value={summary.used.ai} max={summary.limits.ai} />
        <Meter label="Website imports" value={summary.used.imports} max={summary.limits.imports} />
        <p className="text-xs text-muted">Counters reset on the first day of each month (UTC).</p>
      </Card>

      {paid && (
        <Card className="mb-5 p-5">
          <h2 className="text-sm font-semibold text-ink">Payment history and invoices</h2>
          {!history ? <Skeleton className="mt-3 h-16" /> : history.payments.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No payments yet. They appear here after Razorpay confirms them.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {history.payments.map((p) => (
                <li key={p.payment_id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Link href={`/dashboard/billing/invoices/${encodeURIComponent(p.payment_id)}`} className="font-medium text-ink hover:underline">{p.invoice_number}</Link>
                      <p className="text-xs text-muted">{formatDate(p.paid_at)}{p.plan ? ` · ${PLANS[p.plan as keyof typeof PLANS]?.name ?? p.plan}` : ''}</p>
                    </div>
                    <span className="flex items-center gap-2">
                      {p.status === 'refunded' && <Badge tone="neutral">Refunded</Badge>}
                      {p.status === 'partially_refunded' && <Badge tone="neutral">{money(p.refunded_amount, p.currency)} refunded</Badge>}
                      <span className="font-semibold text-ink">{money(p.amount, p.currency)}</span>
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={`/dashboard/billing/invoices/${encodeURIComponent(p.payment_id)}`} className={buttonStyles('outline')}>View</Link>
                    <Button variant="outline" onClick={() => pdf(p, 'invoice')} loading={pdfBusy === `${p.payment_id}:invoice`}><Download size={14} aria-hidden /> Invoice PDF</Button>
                    <Button variant="outline" onClick={() => pdf(p, 'receipt')} loading={pdfBusy === `${p.payment_id}:receipt`}><Download size={14} aria-hidden /> Receipt PDF</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">Questions about a payment or a refund? Email {COMPANY.supportEmail} or message @{COMPANY.instagramHandle} on Instagram with the invoice number.</p>
        </Card>
      )}

      {paid && <InvoiceDetails />}

      {paid && !failed && (
        <Card className="mb-5 p-5">
          <h2 className="text-sm font-semibold text-ink">Payment method</h2>
          <p className="mt-1 text-sm text-muted">Switch to a different card or UPI account. The new one takes over at your next renewal, so you are not charged twice.</p>
          <Button variant="outline" className="mt-3" onClick={() => authorise('card')} loading={busy === 'card'} disabled={replacement}>
            {replacement ? 'Update already scheduled' : 'Update payment method'}
          </Button>
        </Card>
      )}

      {paid && !cancelling && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Cancel subscription</h2>
          <p className="mt-1 text-sm text-muted">You keep your current plan until the end of the period you already paid for. Scheduled pins stay in your queue.</p>
          <Button variant="outline" className="mt-3" onClick={cancel} loading={busy === 'cancel'}>Cancel subscription</Button>
        </Card>
      )}
    </div>
  )
}
