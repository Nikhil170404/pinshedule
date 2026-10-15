'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Download, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Card'
import { InvoiceSheet } from '@/components/billing/InvoiceSheet'
import { api, errorText } from '@/lib/api'
import { downloadPdf, type DocKind, type InvoiceData } from '@/lib/invoices'

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>()
  const [inv, setInv] = useState<InvoiceData | null>(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState<DocKind | null>(null)

  useEffect(() => {
    api<InvoiceData>(`/billing/invoices/${encodeURIComponent(id)}`).then(setInv).catch(() => setMissing(true))
  }, [id])

  async function download(kind: DocKind) {
    if (!inv) return
    setBusy(kind)
    try { await downloadPdf(inv.paymentId, inv.number, kind) } catch (e) { toast.error(errorText(e)) }
    setBusy(null)
  }

  const back = (
    <Link href="/dashboard/billing" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
      <ArrowLeft size={15} aria-hidden /> Plan and billing
    </Link>
  )

  if (missing) return <div className="max-w-3xl">{back}<p className="text-sm text-muted">We could not find that invoice.</p></div>
  if (!inv) return <div className="max-w-3xl">{back}<Skeleton className="h-[34rem]" /></div>

  return (
    <div className="max-w-3xl">
      {back}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Invoice {inv.number}</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => download('invoice')} loading={busy === 'invoice'}><Download size={15} aria-hidden /> Invoice PDF</Button>
          <Button variant="outline" onClick={() => download('receipt')} loading={busy === 'receipt'}><FileText size={15} aria-hidden /> Receipt PDF</Button>
        </div>
      </div>

      <InvoiceSheet inv={inv} />
    </div>
  )
}
