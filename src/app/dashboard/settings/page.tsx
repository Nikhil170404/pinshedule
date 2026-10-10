'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertTriangle, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/button-styles'
import { Card, PageHeader, Skeleton } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { api, errorText } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import { refreshSummary, useSummary } from '@/lib/hooks'

interface ProfileData { display_name: string | null; username: string | null; pronouns: string | null; bio: string | null; links: string[] }

const BIO_MAX = 160
const MAX_LINKS = 3

function ProfileCard() {
  const [saved, setSaved] = useState<ProfileData | null>(null)
  const [form, setForm] = useState({ name: '', username: '', pronouns: '', bio: '', links: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const toForm = (p: ProfileData) => ({ name: p.display_name ?? '', username: p.username ?? '', pronouns: p.pronouns ?? '', bio: p.bio ?? '', links: p.links })

  useEffect(() => {
    api<ProfileData>('/account/profile')
      .then((p) => { setSaved(p); setForm(toForm(p)) })
      .catch(() => setLoadError(true))
  }, [])

  const payload = { display_name: form.name, username: form.username, pronouns: form.pronouns, bio: form.bio, links: form.links.map((l) => l.trim()).filter(Boolean) }
  const dirty = !!saved && JSON.stringify(payload) !== JSON.stringify({ display_name: saved.display_name ?? '', username: saved.username ?? '', pronouns: saved.pronouns ?? '', bio: saved.bio ?? '', links: saved.links })

  async function save() {
    setSaving(true)
    try {
      await api('/account/profile', { method: 'PATCH', body: payload })
      const next = await api<ProfileData>('/account/profile')
      setSaved(next); setForm(toForm(next))
      toast.success('Profile saved.')
    } catch (e) { toast.error(errorText(e)) }
    setSaving(false)
  }

  const set = (k: 'name' | 'username' | 'pronouns' | 'bio') => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-ink">Profile</h2>
      <p className="mb-4 mt-1 text-sm text-muted">Tell people who you are. All fields are optional.</p>
      {loadError ? <p className="text-sm text-red-600">Could not load your profile. Refresh to try again.</p> : !saved ? <Skeleton className="h-64" /> : (
        <div className="space-y-4">
          <Input label="Name" value={form.name} maxLength={50} autoComplete="name" onChange={(e) => set('name')(e.target.value)} />
          <Input label="Username" value={form.username} maxLength={30} autoComplete="off" autoCapitalize="none" spellCheck={false}
            hint="3 to 30 characters: letters, numbers, periods and underscores." onChange={(e) => set('username')(e.target.value)} />
          <Input label="Pronouns" value={form.pronouns} maxLength={30} onChange={(e) => set('pronouns')(e.target.value)} />
          <Textarea label="Bio" value={form.bio} maxLength={BIO_MAX} rows={3} hint={`${form.bio.length}/${BIO_MAX}`} onChange={(e) => set('bio')(e.target.value)} />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Links</span>
              {form.links.length < MAX_LINKS && (
                <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, links: [...f.links, ''] }))}><Plus size={14} aria-hidden /> Add link</Button>
              )}
            </div>
            {form.links.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input wrapperClassName="min-w-0 flex-1" aria-label={`Link ${i + 1}`} type="url" inputMode="url" placeholder="https://example.com" value={l}
                  onChange={(e) => setForm((f) => ({ ...f, links: f.links.map((x, j) => (j === i ? e.target.value : x)) }))} />
                <Button variant="ghost" size="sm" aria-label={`Remove link ${i + 1}`} onClick={() => setForm((f) => ({ ...f, links: f.links.filter((_, j) => j !== i) }))}><X size={16} aria-hidden /></Button>
              </div>
            ))}
          </div>

          <Button onClick={save} loading={saving} disabled={!dirty}>Save profile</Button>
        </div>
      )}
    </Card>
  )
}

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

      <ProfileCard />

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
