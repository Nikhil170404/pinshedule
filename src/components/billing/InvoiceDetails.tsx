'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { api, errorText } from '@/lib/api'

interface Details { name: string; company: string; email: string; address: string; country: string; tax_id: string }
const EMPTY: Details = { name: '', company: '', email: '', address: '', country: '', tax_id: '' }

/** What prints under "Bill to" on invoices and receipts. Applies to every invoice you open or download. */
export function InvoiceDetails() {
  const [d, setD] = useState<Details | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { api<Details>('/billing/details').then(setD).catch(() => setD(EMPTY)) }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!d) return
    setSaving(true)
    try {
      setD(await api<Details>('/billing/details', { method: 'PATCH', body: d }))
      toast.success('Invoice details saved.')
    } catch (err) { toast.error(errorText(err)) }
    setSaving(false)
  }

  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((v) => (v ? { ...v, [k]: e.target.value } : v))

  return (
    <Card className="mb-5 p-5">
      <h2 className="text-sm font-semibold text-ink">Invoice details</h2>
      <p className="mt-1 text-sm text-muted">Printed under &ldquo;Bill to&rdquo; on your invoices and receipts. Add your company name and tax ID if you need them for your records.</p>
      {!d ? <div className="mt-4 h-40 animate-pulse rounded-lg bg-stone-100" /> : (
        <form onSubmit={save} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Name" value={d.name} onChange={set('name')} maxLength={100} autoComplete="name" />
          <Input label="Company" value={d.company} onChange={set('company')} maxLength={120} autoComplete="organization" />
          <Input label="Email for invoices" type="email" value={d.email} onChange={set('email')} maxLength={200} autoComplete="email" wrapperClassName="sm:col-span-2" />
          <Textarea label="Billing address" value={d.address} onChange={set('address')} maxLength={400} rows={3} wrapperClassName="sm:col-span-2" autoComplete="street-address" />
          <Input label="Country" value={d.country} onChange={set('country')} maxLength={60} autoComplete="country-name" />
          <Input label="Tax ID (VAT, GST, EIN)" value={d.tax_id} onChange={set('tax_id')} maxLength={40} />
          <div className="sm:col-span-2"><Button type="submit" loading={saving}>Save invoice details</Button></div>
        </form>
      )}
    </Card>
  )
}
