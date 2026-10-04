'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertTriangle, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader, Skeleton } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { api, errorText } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import { refreshSummary, useSummary } from '@/lib/hooks'

export default function SettingsPage() {
  const router = useRouter()
  const { summary } = useSummary()
  const [tzDraft, setTz] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const zones = useMemo(() => {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? ['UTC']
    return supported.includes('UTC') ? supported : ['UTC', ...supported]
  }, [])
  const tz = tzDraft ?? summary?.timezone ?? 'UTC'

  async function saveTz() {
    setSaving(true)
    try { await api('/account/settings', { method: 'PATCH', body: { timezone: tz } }); await refreshSummary(); setTz(null); toast.success('Timezone saved.') }
    catch (e) { toast.error(errorText(e)) }
    setSaving(false)
  }

  async function disconnect() {
    if (!confirm('Disconnect Pinterest? Scheduled pins will not publish until you reconnect.')) return
    setDisconnecting(true)
    try { await api('/account/disconnect', { method: 'POST', body: {} }); await refreshSummary(); toast.success('Pinterest disconnected.') }
    catch (e) { toast.error(errorText(e)) }
    setDisconnecting(false)
  }

  async function exportData() {
    setExporting(true)
    try {
      const data = await api('/account/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `gopinkaro-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Your data was downloaded.')
    } catch (e) { toast.error(errorText(e)) }
    setExporting(false)
  }

  async function deleteAccount() {
    setDeleting(true)
    try {
      await api('/account/delete', { body: { confirm: 'DELETE' } })
      await createClient().auth.signOut()
      router.push('/')
    } catch (e) { toast.error(errorText(e)); setDeleting(false) }
  }

  if (!summary) return <div><PageHeader title="Settings" /><Skeleton className="h-64" /></div>
  const conn = summary.pinterest

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Settings" />

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Pinterest connection</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm">
            {conn?.status === 'active' ? <CheckCircle2 size={18} className="text-emerald-600" aria-hidden /> : <AlertTriangle size={18} className="text-amber-600" aria-hidden />}
            <div>
              <p className="font-medium text-ink">{conn ? `@${conn.username ?? 'connected'}` : 'Not connected'}</p>
              <p className="text-xs text-muted">{conn?.status === 'active' ? 'Connected. Pins publish automatically.' : conn ? 'Access expired. Reconnect to resume publishing.' : 'Connect to publish pins.'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <a href="/api/auth/pinterest?next=/dashboard/settings" className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-stone-50">{conn ? 'Reconnect' : 'Connect Pinterest'}</a>
            {conn && <Button variant="ghost" onClick={disconnect} loading={disconnecting}>Disconnect</Button>}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Timezone</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Best-time scheduling uses this to pick evening and afternoon slots for you.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Select wrapperClassName="min-w-0 flex-1" aria-label="Timezone" value={tz} onChange={(e) => setTz(e.target.value)}>
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
          </Select>
          <Button onClick={saveTz} loading={saving} disabled={tz === summary.timezone}>Save</Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Your data</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Download a copy of everything we hold about you as a JSON file: profile, pins, analytics and usage. Pinterest access tokens are never included.</p>
        <Button variant="outline" onClick={exportData} loading={exporting}>{!exporting && <Download size={15} aria-hidden />} Download my data</Button>
      </Card>

      <Card className="border-red-200 p-5">
        <h2 className="text-sm font-semibold text-ink">Delete account</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Permanently removes your pins, uploaded images, analytics and Pinterest connection, and cancels any subscription at the end of the paid period. This cannot be undone.</p>
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>Delete my account</Button>
      </Card>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account"
        footer={<><Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" onClick={deleteAccount} loading={deleting} disabled={confirmText !== 'DELETE'}>Delete everything</Button></>}>
        <p className="mb-4 text-sm text-muted">Type <strong className="text-ink">DELETE</strong> to confirm.</p>
        <Input aria-label="Type DELETE to confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
      </Modal>
    </div>
  )
}
