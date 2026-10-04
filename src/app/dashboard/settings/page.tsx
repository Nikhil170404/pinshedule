'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertTriangle, Download, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader, Skeleton } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { UpgradeNote } from '@/components/pins/UpgradeNote'
import { api, errorText } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import { refreshSummary, useSummary } from '@/lib/hooks'

export default function SettingsPage() {
  const router = useRouter()
  const { summary } = useSummary()
  const [tzDraft, setTz] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)

  // Messages from the Pinterest and email-confirmation redirects.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const notes: Record<string, [boolean, string]> = {
      'account=connected': [true, 'Pinterest account connected.'],
      'account=limit': [false, 'Your plan does not allow more Pinterest accounts. Business supports 3.'],
      'email=verified': [true, 'Email confirmed. You will get alerts there.'],
      'email=invalid': [false, 'That confirmation link expired or was already used. Request a new one.'],
    }
    for (const [k, [ok, msg]] of Object.entries(notes)) {
      const [name, value] = k.split('=')
      if (q.get(name) === value) { (ok ? toast.success : toast.error)(msg); void refreshSummary() }
    }
    if (q.has('account') || q.has('email')) router.replace('/dashboard/settings')
  }, [router])

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

  async function disconnect(id: string, name: string | null, primary: boolean) {
    const others = (summary?.accounts.length ?? 1) > 1
    const warn = primary && others ? ' This is your login account; the other connected accounts stay.' : ''
    if (!confirm(`Disconnect ${name ? '@' + name : 'this account'}? Its scheduled pins are removed and nothing publishes there until you reconnect.${warn}`)) return
    setDisconnecting(id)
    try { await api('/account/disconnect', { method: 'POST', body: { connection_id: id } }); await refreshSummary(); toast.success('Pinterest account disconnected.') }
    catch (e) { toast.error(errorText(e)) }
    setDisconnecting(null)
  }

  async function saveEmail() {
    setEmailBusy(true)
    try { await api('/account/email', { body: { email: emailDraft } }); await refreshSummary(); setEmailDraft(''); toast.success('Check your inbox and click the link to confirm.') }
    catch (e) { toast.error(errorText(e)) }
    setEmailBusy(false)
  }
  async function removeEmail() {
    try { await api('/account/email', { method: 'DELETE' }); await refreshSummary() } catch (e) { toast.error(errorText(e)) }
  }
  async function setAlerts(enabled: boolean) {
    try { await api('/account/settings', { method: 'PATCH', body: { notifications_enabled: enabled } }); await refreshSummary() } catch (e) { toast.error(errorText(e)) }
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

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Settings" />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Pinterest accounts</h2>
          <span className="text-xs text-muted">{summary.used.accounts} of {summary.limits.accounts} connected</span>
        </div>
        {summary.accounts.length === 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Not connected. Connect to publish pins.</p>
            <a href="/api/auth/pinterest?next=/dashboard/settings" className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-stone-50">Connect Pinterest</a>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {summary.accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-2.5 text-sm">
                  {a.status === 'active' ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-hidden /> : <AlertTriangle size={18} className="shrink-0 text-amber-600" aria-hidden />}
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-ink"><span className="truncate">@{a.username ?? 'connected'}</span>{a.is_primary && <Badge>Login account</Badge>}</p>
                    <p className="text-xs text-muted">{a.status === 'active' ? 'Connected. Pins publish automatically.' : 'Access expired. Reconnect to resume publishing.'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {a.status !== 'active' && <a href={a.is_primary ? '/api/auth/pinterest?next=/dashboard/settings' : '/api/auth/pinterest?mode=add&next=/dashboard/settings'} className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-stone-50">Reconnect</a>}
                  <Button variant="ghost" size="sm" onClick={() => disconnect(a.id, a.username, a.is_primary)} loading={disconnecting === a.id}>Disconnect</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {summary.accounts.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            {summary.used.accounts < summary.limits.accounts ? (
              <a href="/api/auth/pinterest?mode=add&next=/dashboard/settings" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-stone-50"><Plus size={15} aria-hidden /> Add another Pinterest account</a>
            ) : summary.limits.accounts === 1 ? (
              <UpgradeNote>Managing several Pinterest accounts (up to 3) is included in the Business plan.</UpgradeNote>
            ) : (
              <p className="text-xs text-muted">You have connected the {summary.limits.accounts} accounts your plan includes.</p>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">Email alerts</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Get an email when a pin fails to publish, Pinterest access needs renewing, a payment fails or an automation pauses. We never send marketing email.</p>
        {!summary.email.can_send ? (
          <p className="text-sm text-muted">Email alerts are not switched on for this service yet.</p>
        ) : (
          <div className="space-y-3">
            {summary.email.address && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2"><span className="truncate font-medium text-ink">{summary.email.address}</span><Badge tone={summary.email.verified ? 'success' : 'warning'}>{summary.email.verified ? 'Confirmed' : 'Waiting for confirmation'}</Badge></span>
                <button onClick={removeEmail} className="text-xs font-medium text-muted hover:text-red-600">Remove</button>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input wrapperClassName="min-w-0 flex-1" type="email" inputMode="email" autoComplete="email" label={summary.email.address ? 'Use a different address' : 'Email address'} value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} placeholder="you@example.com" />
              <Button onClick={saveEmail} loading={emailBusy} disabled={!emailDraft.includes('@')}>Send confirmation</Button>
            </div>
            {summary.email.address && summary.email.verified && (
              <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={summary.email.enabled} onChange={(e) => setAlerts(e.target.checked)} className="h-4 w-4 accent-[#e60023]" /> Send me alerts</label>
            )}
          </div>
        )}
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
