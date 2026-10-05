'use client'

import Link from 'next/link'
import { Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Pencil, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { buttonStyles } from '@/components/ui/button-styles'
import { AccountAvatar } from '@/components/accounts/AccountAvatar'
import { api, errorText } from '@/lib/api'
import { accountName, refreshAccounts, useAccounts, type AccountInfo } from '@/lib/accounts'
import { refreshSummary } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { PLANS } from '@/types'

const ADD = '/api/auth/pinterest?add=1'

const ERRORS: Record<string, string> = {
  access_denied: 'Pinterest access was not granted. Try again and accept the permissions.',
  invalid_state: 'That sign-in session expired. Please try again.',
  auth_failed: 'We could not connect that account. Please try again.',
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null)
const needsAttention = (a: AccountInfo) => a.status === 'needs_reconnect' || a.stats.failed > 0

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={cn('mt-1.5 text-2xl font-semibold tabular-nums text-ink', tone)}>{value}</p>
    </div>
  )
}

function AccountsView() {
  const router = useRouter()
  const params = useSearchParams()
  const { data, accounts, active, setActive, loaded } = useAccounts()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'attention'>('all')
  const [renaming, setRenaming] = useState<AccountInfo | null>(null)
  const [label, setLabel] = useState('')
  const [removing, setRemoving] = useState<AccountInfo | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const q = useDeferredValue(query).trim().toLowerCase()

  // Show the result of the connect flow once, then clean the address bar.
  const handled = useRef(false)
  useEffect(() => {
    if (handled.current) return
    const err = params.get('error')
    const ok = params.get('connected')
    if (!err && !ok) return
    handled.current = true
    if (err === 'account_limit') toast.error('Your plan has reached its account limit. Upgrade to connect more.', { action: { label: 'Upgrade', onClick: () => router.push('/dashboard/upgrade') } })
    else if (err) toast.error(ERRORS[err] ?? 'Something went wrong. Please try again.')
    else { toast.success('Pinterest account connected.'); void refreshAccounts(); void refreshSummary() }
    router.replace('/dashboard/accounts')
  }, [params, router])

  const totals = useMemo(() => ({
    pending: accounts.reduce((t, a) => t + a.stats.pending, 0),
    failed: accounts.reduce((t, a) => t + a.stats.failed, 0),
    published: accounts.reduce((t, a) => t + a.stats.published_30d, 0),
    attention: accounts.filter(needsAttention).length,
  }), [accounts])

  const shown = useMemo(() => accounts
    .filter((a) => (filter === 'all' || needsAttention(a)) && (!q || accountName(a).toLowerCase().includes(q) || (a.username ?? '').toLowerCase().includes(q)))
    // Accounts that need you first, then the rest in their usual order.
    .sort((x, y) => Number(needsAttention(y)) - Number(needsAttention(x))), [accounts, filter, q])

  async function check(a: AccountInfo) {
    setBusy(a.id)
    try { await api(`/accounts/${a.id}/check`, { method: 'POST', body: {} }); toast.success(`${accountName(a)} is connected.`) }
    catch (e) { toast.error(errorText(e)) }
    await refreshAccounts()
    setBusy(null)
  }

  async function saveLabel() {
    if (!renaming) return
    setBusy(renaming.id)
    try { await api(`/accounts/${renaming.id}`, { method: 'PATCH', body: { label: label.trim() || null } }); setRenaming(null) }
    catch (e) { toast.error(errorText(e)) }
    await refreshAccounts()
    setBusy(null)
  }

  async function remove() {
    if (!removing) return
    setBusy(removing.id)
    try {
      await api(`/accounts/${removing.id}`, { method: 'DELETE' })
      toast.success('Account removed.')
      setRemoving(null)
    } catch (e) { toast.error(errorText(e)) }
    await Promise.all([refreshAccounts(), refreshSummary()])
    setBusy(null)
  }

  if (!loaded) return <div><PageHeader title="Pinterest accounts" /><Skeleton className="h-64" /></div>

  const canAdd = data?.can_add ?? false
  const limit = data?.limit ?? 1

  return (
    <div className="space-y-6">
      <PageHeader title="Pinterest accounts" description="Run every account from one dashboard. Pick the active one in the sidebar."
        actions={canAdd ? <a href={ADD} className={buttonStyles('primary')}><Plus size={16} aria-hidden /> Add account</a> : undefined} />

      {accounts.length === 0 ? (
        <Card><EmptyState icon={Users} title="No Pinterest account connected" description="Connect an account to start scheduling pins."
          action={<a href={ADD} className={buttonStyles('primary')}>Connect Pinterest</a>} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Accounts" value={`${accounts.length} of ${limit}`} />
            <Tile label="Scheduled" value={totals.pending.toLocaleString()} />
            <Tile label="Published (30 days)" value={totals.published.toLocaleString()} />
            <Tile label="Need attention" value={totals.attention.toLocaleString()} tone={totals.attention > 0 ? 'text-amber-700' : undefined} />
          </div>

          {!canAdd && (
            <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">
              Your {data?.plan_name} plan includes {limit} Pinterest account{limit === 1 ? '' : 's'}.{' '}
              {limit >= PLANS.growth.accounts
                ? 'That is the most any plan allows. Remove an account to connect a different one.'
                : <><Link href="/dashboard/upgrade" className="font-medium text-brand hover:underline">Upgrade to connect more</Link>.</>}
            </p>
          )}
          {canAdd && (
            <p className="text-xs text-muted">Pinterest connects whichever account you are signed in to there. To add a different one, sign in to it on pinterest.com first (a private window works well).</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search accounts" aria-label="Search accounts"
                className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-stone-400" />
            </div>
            <div className="inline-flex rounded-lg bg-stone-100 p-1" role="group" aria-label="Filter accounts">
              {([['all', `All (${accounts.length})`], ['attention', `Needs attention (${totals.attention})`]] as const).map(([k, text]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
                  className={cn('h-8 rounded-md px-3 text-[13px] font-medium transition-colors', filter === k ? 'bg-white text-ink shadow-sm' : 'text-stone-600')}>{text}</button>
              ))}
            </div>
          </div>

          <Card className="divide-y divide-line overflow-hidden">
            {shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">{filter === 'attention' ? 'Every account looks healthy.' : `No account matches “${query}”.`}</p>}
            {shown.map((a) => {
              const isActive = a.id === active?.id
              const next = when(a.stats.next_at)
              const last = when(a.stats.last_published_at)
              return (
                <div key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <AccountAvatar account={a} size={40} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-sm font-semibold text-ink">{accountName(a)}</p>
                        {isActive && <Badge tone="brand">Active</Badge>}
                        {a.is_primary && <Badge>Primary</Badge>}
                        {a.status === 'needs_reconnect'
                          ? <Badge tone="warning"><AlertTriangle size={11} aria-hidden /> Needs reconnect</Badge>
                          : <Badge tone="success"><CheckCircle2 size={11} aria-hidden /> Connected</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {a.label && a.username ? `@${a.username} · ` : ''}
                        {a.stats.pending} scheduled
                        {a.stats.failed > 0 && <span className="text-red-600"> · {a.stats.failed} failed</span>}
                        {` · ${a.stats.published_30d} published (30d)`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{next ? `Next pin ${next}` : 'Nothing scheduled'}{last ? ` · last published ${last}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {a.status === 'needs_reconnect'
                      ? <a href={ADD} className={buttonStyles('primary', 'sm')}>Reconnect</a>
                      : <Button size="sm" variant={isActive ? 'secondary' : 'outline'} onClick={() => { setActive(a.id); router.push('/dashboard') }}>{isActive ? 'Open dashboard' : 'Open'}</Button>}
                    <Button size="sm" variant="ghost" aria-label={`Rename ${accountName(a)}`} title="Rename" onClick={() => { setRenaming(a); setLabel(a.label ?? '') }}><Pencil size={14} aria-hidden /></Button>
                    <Button size="sm" variant="ghost" aria-label={`Check connection for ${accountName(a)}`} title="Check connection" loading={busy === a.id} onClick={() => check(a)}>{busy === a.id ? null : <RefreshCw size={14} aria-hidden />}</Button>
                    <Button size="sm" variant="ghost" aria-label={`Remove ${accountName(a)}`} title="Remove" className="hover:text-red-600" onClick={() => setRemoving(a)}><Trash2 size={14} aria-hidden /></Button>
                  </div>
                </div>
              )
            })}
          </Card>
        </>
      )}

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Name this account"
        footer={<><Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button><Button onClick={saveLabel} loading={busy === renaming?.id}>Save</Button></>}>
        <p className="mb-3 text-sm text-muted">A short name makes accounts easy to tell apart, for example a client or niche. Leave it empty to use the Pinterest username.</p>
        <Input aria-label="Account name" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder={renaming?.username ? `@${renaming.username}` : 'Client name'} />
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remove account"
        footer={<><Button variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button><Button variant="danger" onClick={remove} loading={busy === removing?.id}>Remove account</Button></>}>
        <p className="text-sm text-muted">
          Remove <strong className="text-ink">{removing ? accountName(removing) : ''}</strong> from GoPinKaro? Its {removing?.stats.pending ?? 0} scheduled pins, publishing history and analytics are deleted here.
          Nothing is deleted on Pinterest, and pins that already published stay there. You can connect the account again later.
        </p>
      </Modal>
    </div>
  )
}

export default function Page() {
  return <Suspense><AccountsView /></Suspense>
}
