import { Badge } from '@/components/ui/Badge'
import { LogoMark } from '@/components/ui/Logo'
import { methodLabel, money, shortDate, type InvoiceData } from '@/lib/invoices'

const STATUS = {
  paid: { tone: 'success', label: 'Paid' },
  partially_refunded: { tone: 'warning', label: 'Partially refunded' },
  refunded: { tone: 'neutral', label: 'Refunded' },
} as const

/** The invoice as shown on screen. The PDF mirrors this layout. */
export function InvoiceSheet({ inv }: { inv: InvoiceData }) {
  const s = STATUS[inv.status]
  const c = inv.customer
  const period = inv.periodStart && inv.periodEnd ? `${shortDate(inv.periodStart)} - ${shortDate(inv.periodEnd)}` : 'Monthly'
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm" aria-label={`Invoice ${inv.number}`}>
      <div className="h-1.5 bg-brand" />
      <div className="p-6 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoMark size={44} />
            <div>
              <p className="text-xl font-bold tracking-tight text-ink">Go<span className="text-brand">Pin</span>Karo</p>
              <p className="text-xs text-muted">{inv.seller.website}</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-bold tracking-tight text-ink">INVOICE</p>
            <p className="mt-1 text-sm text-muted">No. {inv.number}</p>
            <Badge tone={s.tone} className="mt-2">{s.label}</Badge>
          </div>
        </header>

        <dl className="mt-8 grid grid-cols-1 gap-4 border-y border-line py-5 text-sm sm:grid-cols-3">
          {([['Issued', shortDate(inv.issuedAt)], ['Billing period', period], ['Payment method', methodLabel(inv.method)]] as const).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k}</dt>
              <dd className="mt-1 font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 grid grid-cols-1 gap-6 text-sm sm:grid-cols-2">
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">From</h2>
            <p className="mt-1.5 font-semibold text-ink">{inv.seller.name}</p>
            {inv.seller.address.map((l) => <p key={l} className="text-stone-600">{l}</p>)}
            {inv.seller.taxId && <p className="text-stone-600">{inv.seller.taxIdLabel}: {inv.seller.taxId}</p>}
            <p className="text-stone-600">{inv.seller.email}</p>
          </section>
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Bill to</h2>
            <p className="mt-1.5 font-semibold text-ink">{c.name || c.company || 'GoPinKaro customer'}</p>
            {c.name && c.company && <p className="text-stone-600">{c.company}</p>}
            {c.address.map((l) => <p key={l} className="text-stone-600">{l}</p>)}
            {c.country && <p className="text-stone-600">{c.country}</p>}
            {c.email && <p className="text-stone-600">{c.email}</p>}
            {c.taxId && <p className="text-stone-600">Tax ID: {c.taxId}</p>}
            {!c.name && !c.company && <p className="mt-1 text-xs text-muted">Add your name, company and tax ID under Invoice details on the billing page.</p>}
          </section>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-100 text-[11px] uppercase tracking-wider text-muted">
                <th className="rounded-l-lg px-3 py-2.5 text-left font-semibold">Description</th>
                <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Qty</th>
                <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Unit price</th>
                <th className="rounded-r-lg px-3 py-2.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="px-3 py-4">
                  <p className="font-semibold text-ink">{inv.description}</p>
                  {inv.periodStart && inv.periodEnd && <p className="mt-0.5 text-xs text-muted">{period}</p>}
                </td>
                <td className="hidden px-3 py-4 text-right text-stone-600 sm:table-cell">1</td>
                <td className="hidden px-3 py-4 text-right text-stone-600 sm:table-cell">{money(inv.subtotal, inv.currency)}</td>
                <td className="px-3 py-4 text-right font-semibold text-ink">{money(inv.subtotal, inv.currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-4 w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-stone-600">Subtotal</dt><dd>{money(inv.subtotal, inv.currency)}</dd></div>
          {inv.taxAmount > 0 && <div className="flex justify-between"><dt className="text-stone-600">{inv.taxName ?? 'Tax'} ({inv.taxRate}% included)</dt><dd>{money(inv.taxAmount, inv.currency)}</dd></div>}
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-ink"><dt>Total</dt><dd>{money(inv.total, inv.currency)}</dd></div>
          {inv.refunded > 0 ? (
            <>
              <div className="flex justify-between text-amber-700"><dt>Refunded</dt><dd>{money(-inv.refunded, inv.currency)}</dd></div>
              <div className="flex justify-between font-semibold text-ink"><dt>Net amount paid</dt><dd>{money(inv.total - inv.refunded, inv.currency)}</dd></div>
            </>
          ) : (
            <div className="flex justify-between font-semibold text-emerald-700"><dt>Amount paid</dt><dd>{money(inv.total, inv.currency)}</dd></div>
          )}
        </dl>

        <section className="mt-8 rounded-xl border border-line bg-stone-50 p-4 text-sm">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Payment</h2>
          <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-y-1">
            <dt className="text-muted">Paid on</dt><dd className="font-semibold text-ink">{shortDate(inv.issuedAt)} · {methodLabel(inv.method)}</dd>
            <dt className="text-muted">Payment ID</dt><dd className="break-all font-semibold text-ink">{inv.paymentId}</dd>
          </dl>
        </section>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          All amounts are in {inv.currency}.{inv.taxAmount > 0 ? ` ${inv.taxName ?? 'Tax'} is already included in the price.` : ''} Subscriptions renew until cancelled; you can cancel any time from Plan and billing.
        </p>
        <footer className="mt-6 border-t border-line pt-4 text-xs text-stone-600">
          Questions? <a className="font-medium text-ink hover:underline" href={`mailto:${inv.seller.email}`}>{inv.seller.email}</a> · Instagram <span className="font-medium text-ink">{inv.seller.instagram}</span> · {inv.seller.website}
        </footer>
      </div>
    </article>
  )
}
