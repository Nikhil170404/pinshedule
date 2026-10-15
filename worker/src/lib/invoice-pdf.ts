import PDFDocument from 'pdfkit'
import { formatMoney } from './billing-logic'
import type { InvoiceData } from './invoices'
import { LOGO_PNG_BASE64 } from './logo-data'

export type DocKind = 'invoice' | 'receipt'

const C = { ink: '#1c1917', body: '#44403c', muted: '#78716c', line: '#e7e5e4', soft: '#fafaf9', band: '#f5f5f4', brand: '#e60023' }
const PILL = {
  paid: { label: 'PAID', fg: '#047857', bg: '#ecfdf5' },
  partially_refunded: { label: 'PARTIALLY REFUNDED', fg: '#92400e', bg: '#fffbeb' },
  refunded: { label: 'REFUNDED', fg: '#44403c', bg: '#f5f5f4' },
} as const

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '')
const METHODS: Record<string, string> = { card: 'Card', upi: 'UPI', netbanking: 'Net banking', wallet: 'Wallet', emandate: 'E-mandate', paylater: 'Pay later' }
const methodLabel = (m: string | null) => (m ? METHODS[m] ?? m.charAt(0).toUpperCase() + m.slice(1) : 'Online payment via Razorpay')

export const invoiceFilename = (inv: Pick<InvoiceData, 'number'>, kind: DocKind) => `GoPinKaro-${kind === 'receipt' ? 'Receipt' : 'Invoice'}-${inv.number}.pdf`

export function renderInvoicePdf(inv: InvoiceData, kind: DocKind): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const M = 48
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: M, left: M, right: M, bottom: 36 },
      bufferPages: true,
      info: { Title: `${kind === 'receipt' ? 'Receipt' : 'Invoice'} ${inv.number}`, Author: inv.seller.name, Subject: `GoPinKaro ${inv.planName} plan`, Creator: 'GoPinKaro' },
    })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = doc.page.width
    const R = W - M // right edge
    const CW = R - M // content width
    const text = (s: string, x: number, y: number, o: { size?: number; font?: string; color?: string; width?: number; align?: 'left' | 'right' | 'center' } = {}) => {
      doc.font(o.font ?? 'Helvetica').fontSize(o.size ?? 10).fillColor(o.color ?? C.body)
      doc.text(s, x, y, { width: o.width ?? R - x, align: o.align ?? 'left', lineBreak: false })
    }
    const label = (s: string, x: number, y: number) => text(s.toUpperCase(), x, y, { size: 7.5, font: 'Helvetica-Bold', color: C.muted })

    // ── Brand bar and header ──
    doc.rect(0, 0, W, 5).fill(C.brand)
    doc.image(Buffer.from(LOGO_PNG_BASE64, 'base64'), M, 34, { width: 38, height: 38 })
    doc.font('Helvetica-Bold').fontSize(18).fillColor(C.ink).text('Go', M + 48, 40, { continued: true, lineBreak: false })
    doc.fillColor(C.brand).text('Pin', { continued: true, lineBreak: false })
    doc.fillColor(C.ink).text('Karo', { lineBreak: false })
    text(inv.seller.website, M + 48, 62, { size: 8.5, color: C.muted })

    text(kind === 'receipt' ? 'RECEIPT' : 'INVOICE', M, 36, { size: 22, font: 'Helvetica-Bold', color: C.ink, width: CW, align: 'right' })
    text(`No. ${inv.number}`, M, 64, { size: 10, color: C.muted, width: CW, align: 'right' })

    const pill = PILL[inv.status]
    doc.font('Helvetica-Bold').fontSize(8)
    const pw = doc.widthOfString(pill.label) + 18
    doc.roundedRect(R - pw, 82, pw, 18, 9).fill(pill.bg)
    text(pill.label, R - pw, 87, { size: 8, font: 'Helvetica-Bold', color: pill.fg, width: pw, align: 'center' })

    doc.moveTo(M, 116).lineTo(R, 116).lineWidth(0.75).strokeColor(C.line).stroke()

    // ── Key facts ──
    const facts: [string, string][] = [
      [kind === 'receipt' ? 'Payment date' : 'Issued', date(inv.issuedAt)],
      ['Billing period', inv.periodStart && inv.periodEnd ? `${date(inv.periodStart)} - ${date(inv.periodEnd)}` : 'Monthly'],
      ['Payment method', methodLabel(inv.method)],
    ]
    const colW = CW / 3
    facts.forEach(([k, v], i) => {
      label(k, M + i * colW, 132)
      text(v, M + i * colW, 146, { size: 10, font: 'Helvetica-Bold', color: C.ink, width: colW - 8 })
    })

    // ── From / Bill to ──
    const block = (title: string, x: number, rows: { s: string; bold?: boolean }[]) => {
      label(title, x, 186)
      let y = 201
      for (const r of rows) {
        text(r.s, x, y, { size: 10, font: r.bold ? 'Helvetica-Bold' : 'Helvetica', color: r.bold ? C.ink : C.body, width: CW / 2 - 16 })
        y += r.bold ? 15 : 13.5
      }
      return y
    }
    const from = [
      { s: inv.seller.name, bold: true },
      ...inv.seller.address.map((s) => ({ s })),
      ...(inv.seller.taxId ? [{ s: `${inv.seller.taxIdLabel}: ${inv.seller.taxId}` }] : []),
      { s: inv.seller.email },
    ]
    const cust = inv.customer
    const to = [
      ...(cust.name || cust.company ? [{ s: cust.name || cust.company, bold: true }] : [{ s: 'GoPinKaro customer', bold: true }]),
      ...(cust.name && cust.company ? [{ s: cust.company }] : []),
      ...cust.address.map((s) => ({ s })),
      ...(cust.country ? [{ s: cust.country }] : []),
      ...(cust.email ? [{ s: cust.email }] : []),
      ...(cust.taxId ? [{ s: `Tax ID: ${cust.taxId}` }] : []),
    ]
    const endFrom = block('From', M, from)
    const endTo = block('Bill to', M + CW / 2, to)

    // ── Line items ──
    let y = Math.max(endFrom, endTo) + 22
    doc.rect(M, y, CW, 24).fill(C.band)
    const cols = { desc: M + 12, qty: M + CW * 0.56, unit: M + CW * 0.66, amt: M + CW * 0.82 }
    const hdr = (s: string, x: number, w: number, align: 'left' | 'right') => text(s.toUpperCase(), x, y + 8, { size: 7.5, font: 'Helvetica-Bold', color: C.muted, width: w, align })
    hdr('Description', cols.desc, 220, 'left')
    hdr('Qty', cols.qty, 40, 'right')
    hdr('Unit price', cols.unit, 70, 'right')
    hdr('Amount', cols.amt, R - cols.amt - 12, 'right')
    y += 24
    text(inv.description, cols.desc, y + 14, { size: 10.5, font: 'Helvetica-Bold', color: C.ink, width: CW * 0.5 })
    if (inv.periodStart && inv.periodEnd) text(`${date(inv.periodStart)} - ${date(inv.periodEnd)}`, cols.desc, y + 30, { size: 8.5, color: C.muted, width: CW * 0.5 })
    text('1', cols.qty, y + 14, { width: 40, align: 'right' })
    text(formatMoney(inv.subtotal, inv.currency), cols.unit, y + 14, { width: 70, align: 'right' })
    text(formatMoney(inv.subtotal, inv.currency), cols.amt, y + 14, { width: R - cols.amt - 12, align: 'right', font: 'Helvetica-Bold', color: C.ink })
    y += 52
    doc.moveTo(M, y).lineTo(R, y).lineWidth(0.75).strokeColor(C.line).stroke()

    // ── Totals ──
    y += 14
    const tx = M + CW * 0.54
    const tw = R - tx
    const row = (k: string, v: string, o: { bold?: boolean; color?: string; big?: boolean } = {}) => {
      text(k, tx, y, { size: o.big ? 12 : 10, font: o.bold ? 'Helvetica-Bold' : 'Helvetica', color: o.color ?? (o.bold ? C.ink : C.body), width: tw * 0.55 })
      text(v, tx + tw * 0.45, y, { size: o.big ? 12 : 10, font: o.bold ? 'Helvetica-Bold' : 'Helvetica', color: o.color ?? (o.bold ? C.ink : C.body), width: tw * 0.55, align: 'right' })
      y += o.big ? 22 : 18
    }
    if (inv.taxAmount > 0) row('Subtotal', formatMoney(inv.subtotal, inv.currency))
    if (inv.taxAmount > 0) row(`${inv.taxName ?? 'Tax'} (${inv.taxRate}% included)`, formatMoney(inv.taxAmount, inv.currency))
    if (inv.taxAmount > 0) {
      doc.moveTo(tx, y - 4).lineTo(R, y - 4).lineWidth(0.75).strokeColor(C.line).stroke()
      y += 4
    }
    row('Total', formatMoney(inv.total, inv.currency), { bold: true, big: true })
    if (inv.refunded > 0) {
      row('Refunded', formatMoney(-inv.refunded, inv.currency), { color: '#b45309' })
      row('Net amount paid', formatMoney(inv.total - inv.refunded, inv.currency), { bold: true })
    } else {
      row(kind === 'receipt' ? 'Amount received' : 'Amount paid', formatMoney(inv.total, inv.currency), { bold: true, color: '#047857' })
    }

    // ── Payment panel ──
    y += 14
    const ph = kind === 'receipt' ? 84 : 62
    doc.roundedRect(M, y, CW, ph, 8).fill(C.soft)
    doc.roundedRect(M, y, CW, ph, 8).lineWidth(0.75).strokeColor(C.line).stroke()
    label(kind === 'receipt' ? 'Payment received' : 'Payment', M + 16, y + 14)
    const pay = [
      [`Paid on ${date(inv.issuedAt)}`, methodLabel(inv.method)],
      ['Payment ID', inv.paymentId],
      ...(kind === 'receipt' ? [['Invoice number', inv.number]] : []),
    ]
    pay.forEach(([k, v], i) => {
      text(k, M + 16, y + 30 + i * 16, { size: 9, color: C.muted, width: 120 })
      text(v, M + 140, y + 30 + i * 16, { size: 9, font: 'Helvetica-Bold', color: C.ink, width: CW - 160 })
    })
    y += ph + 22

    // ── Notes ──
    const notes = [
      `All amounts are in ${inv.currency}. ${inv.taxAmount > 0 ? `${inv.taxName ?? 'Tax'} is already included in the price.` : inv.taxNote}`.trim(),
      kind === 'receipt' ? 'This receipt confirms that the payment above was received. Thank you.' : inv.status === 'paid' ? 'Thank you for your business. This invoice has been paid in full.' : 'Thank you for your business. A refund has been issued for this payment.',
      'Subscriptions renew until cancelled. You can cancel any time from Plan and billing in your dashboard.',
    ]
    notes.forEach((n, i) => text(n, M, y + i * 14, { size: 8.5, color: C.muted, width: CW }))

    // ── Footer (inside the bottom margin so it never starts a second page) ──
    const fy = doc.page.height - 76
    doc.moveTo(M, fy).lineTo(R, fy).lineWidth(0.75).strokeColor(C.line).stroke()
    text(`Questions? ${inv.seller.email}   |   Instagram ${inv.seller.instagram}   |   ${inv.seller.website}`, M, fy + 10, { size: 8.5, color: C.body, width: CW })
    text('This is a computer-generated document and does not require a signature.', M, fy + 24, { size: 7.5, color: C.muted, width: CW })

    doc.end()
  })
}
