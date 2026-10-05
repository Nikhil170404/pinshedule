'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/button-styles'
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
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

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
        <h2 className="text-sm font-semibold text-ink">Pinterest accounts</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm">
            {conn?.status === 'active' ? <CheckCircle2 size={18} className="text-emerald-600" aria-hidden /> : <AlertTriangle size={18} className="text-amber-600" aria-hidden />}
            <div>
              <p className="font-medium text-ink">{conn ? (conn.label || `@${conn.username ?? 'connected'}`) : 'Not connected'}</p>
              <p className="text-xs text-muted">
                {summary.accounts ? `${summary.accounts.count} of ${summary.accounts.limit} account${summary.accounts.limit === 1 ? '' : 's'} connected.` : ''}
                {conn?.status === 'needs_reconnect' ? ' The selected account needs to be reconnected.' : ''}
              </p>
            </div>
          </div>
          <Link href="/dashboard/accounts" className={buttonStyles('outline')}>Manage accounts</Link>
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

      <Card className="border-red-200 p-5">
        <h2 className="text-sm font-semibold text-ink">Delete account</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Permanently removes your pins, uploaded images and videos, analytics and every connected Pinterest account, and cancels any subscription at the end of the paid period. This cannot be undone.</p>
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
