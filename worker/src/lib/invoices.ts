import { z } from 'zod'
import { PLANS, type Plan } from '@shared/plans'
import { COMPANY } from '@shared/company'
import { env } from '../env'
import { db } from './clients'

/** Everything an invoice or receipt shows. The same object feeds the in-app page and the PDF. */
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
  /** Shown instead of a tax line when no tax is charged. Empty when tax is included. */
  taxNote: string
  total: number
  refunded: number
  method: string | null
  seller: { name: string; address: string[]; taxIdLabel: string; taxId: string; email: string; instagram: string; website: string }
  customer: { name: string; company: string; email: string; address: string[]; country: string; taxId: string }
}

export const billingDetailsSchema = z.object({
  name: z.string().trim().max(100).default(''),
  company: z.string().trim().max(120).default(''),
  email: z.union([z.literal(''), z.string().trim().email().max(200)]).default(''),
  address: z.string().trim().max(400).default(''),
  country: z.string().trim().max(60).default(''),
  tax_id: z.string().trim().max(40).default(''),
})
export type BillingDetails = z.infer<typeof billingDetailsSchema>

const EMPTY: BillingDetails = { name: '', company: '', email: '', address: '', country: '', tax_id: '' }
// eslint-disable-next-line no-control-regex
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
const lines = (s: string) => clean(s).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6)

export async function getBillingDetails(userId: string): Promise<BillingDetails> {
  const { data } = await db.from('user_profiles').select('billing_details').eq('id', userId).maybeSingle()
  const parsed = billingDetailsSchema.safeParse(data?.billing_details ?? {})
  return parsed.success ? parsed.data : EMPTY
}

export async function saveBillingDetails(userId: string, details: BillingDetails): Promise<void> {
  await db.from('user_profiles').update({ billing_details: details }).eq('id', userId)
}

const PAYMENT_COLUMNS = 'payment_id, invoice_number, description, kind, amount, currency, status, method, refunded_amount, plan, paid_at, period_start, period_end, subtotal, tax_amount, tax_rate, tax_name, payer_email'

export async function getInvoice(userId: string, paymentId: string): Promise<InvoiceData | null> {
  const { data: p } = await db.from('billing_payments').select(PAYMENT_COLUMNS).eq('user_id', userId).eq('payment_id', paymentId).maybeSingle()
  if (!p) return null
  const details = await getBillingDetails(userId)
  const plan = PLANS[(p.plan as Plan) ?? 'free_trial']
  const total = p.amount as number
  const refunded = (p.refunded_amount as number) ?? 0
  const name = details.name || details.company || ''
  return {
    number: p.invoice_number as string,
    paymentId: p.payment_id as string,
    issuedAt: p.paid_at as string,
    status: refunded <= 0 ? 'paid' : refunded >= total ? 'refunded' : 'partially_refunded',
    description: (p.description as string | null) || `${plan.name} plan, monthly subscription`,
    planName: plan.name,
    periodStart: (p.period_start as string | null) ?? null,
    periodEnd: (p.period_end as string | null) ?? null,
    currency: (p.currency as string) || 'USD',
    subtotal: (p.subtotal as number | null) ?? total,
    taxAmount: (p.tax_amount as number) ?? 0,
    taxRate: Number(p.tax_rate ?? 0),
    taxName: (p.tax_name as string | null) ?? null,
    taxNote: ((p.tax_amount as number) ?? 0) > 0 ? '' : env.invoice.taxNote,
    total,
    refunded,
    method: (p.method as string | null) ?? null,
    seller: {
      name: env.invoice.legalName,
      address: env.invoice.address,
      taxIdLabel: env.invoice.taxIdLabel,
      taxId: env.invoice.taxId,
      email: COMPANY.supportEmail,
      instagram: `@${COMPANY.instagramHandle}`,
      website: COMPANY.website.replace(/^https?:\/\//, ''),
    },
    customer: {
      name,
      company: details.name ? details.company : '',
      email: details.email || (p.payer_email as string | null) || '',
      address: lines(details.address),
      country: clean(details.country),
      taxId: clean(details.tax_id),
    },
  }
}
