import { apiBlob } from '@/lib/api'

export interface InvoiceData {
  number: string
  paymentId: string
  issuedAt: string
  status: 'paid' | 'partially_refunded' | 'refunded'
  description: string
  planName: string
  periodStart: string | null
  periodEnd: string | null
  currency: string
  subtotal: number
  taxAmount: number
  taxRate: number
  taxName: string | null
  taxNote: string
  total: number
  refunded: number
  method: string | null
  seller: { name: string; address: string[]; taxIdLabel: string; taxId: string; email: string; instagram: string; website: string }
  customer: { name: string; company: string; email: string; address: string[]; country: string; taxId: string }
}

export type DocKind = 'invoice' | 'receipt'

/** Amounts arrive in minor units (cents). */
export const money = (minor: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100)

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export const methodLabel = (m: string | null) => {
  const names: Record<string, string> = { card: 'Card', upi: 'UPI', netbanking: 'Net banking', wallet: 'Wallet', emandate: 'E-mandate', paylater: 'Pay later' }
  return m ? names[m] ?? m.charAt(0).toUpperCase() + m.slice(1) : 'Online payment via Razorpay'
}

/** Fetch the PDF through the worker (it needs the sign-in token) and hand it to the browser as a download. */
export async function downloadPdf(paymentId: string, number: string, kind: DocKind) {
  const blob = await apiBlob(`/billing/invoices/${encodeURIComponent(paymentId)}/pdf?kind=${kind}`, 'Could not create the PDF right now. Please try again.')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `GoPinKaro-${kind === 'receipt' ? 'Receipt' : 'Invoice'}-${number}.pdf`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
