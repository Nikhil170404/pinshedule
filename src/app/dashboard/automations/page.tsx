'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Pause, Play, Plus, Recycle, Repeat, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { BoardSelect } from '@/components/pins/BoardSelect'
import { UpgradeNote } from '@/components/pins/UpgradeNote'
import { api, ApiError, errorText } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import { connectionParam, useActiveAccount } from '@/lib/accounts'
import { refreshSummary, useSummary } from '@/lib/hooks'
import { PLANS, type Automation } from '@/types'
import { formatDateTime } from '@/lib/utils'

const KIND = {
  sitemap: { label: 'Sitemap autopilot', icon: Globe, blurb: 'Pins new pages from your sitemap on a steady schedule, with AI-written titles and descriptions.' },
  evergreen: { label: 'Evergreen recycling', icon: Recycle, blurb: 'Re-pins your best older pins after a cooling-off period, so good content keeps earning.' },
} as const

export default function AutomationsPage() {
  const router = useRouter()
  const { summary } = useSummary()
  const { account, accounts, multiple } = useActiveAccount()
  const [list, setList] = useState<Automation[] | null>(null)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'sitemap' | 'evergreen'>('sitemap')
  const [sitemap, setSitemap] = useState('')
  const [board, setBoard] = useState({ id: '', name: '' })
  const [perDay, setPerDay] = useState('2')
  const [minAge, setMinAge] = useState('60')
  const [bestFirst, setBestFirst] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api<{ automations: Automation[] }>('/automations').then((r) => setList(r.automations)).catch((e) => { toast.error(errorText(e)); setList([]) }), [])
  useEffect(() => { void load() }, [load])

  // A finished run (or a pause) updates the cards live instead of waiting for a refresh.
  useEffect(() => {
    const supabase = createClient()
    let alive = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id
      if (!alive || !uid) return
      channel = supabase.channel(`automations:${uid}:${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'automations', filter: `user_id=eq.${uid}` }, () => { void load(); void refreshSummary() })
        .subscribe()
    })
    return () => { alive = false; if (channel) supabase.removeChannel(channel) }
  }, [load])

  const plan = summary ? PLANS[summary.plan] : null
  const allowedKinds = plan ? ([plan.sitemap_import && 'sitemap', plan.smart_scheduler && 'evergreen'].filter(Boolean) as ('sitemap' | 'evergreen')[]) : []
  const chosen = allowedKinds.includes(kind) ? kind : (allowedKinds[0] ?? 'sitemap')
  const atLimit = !!summary && summary.used.automations >= summary.limits.automations

  async function create() {
    if (chosen === 'sitemap' && (!sitemap.trim() || !board.id)) return toast.error('Add your sitemap or website address and choose a board.')
    setBusy(true)
    try {
      await api('/automations', {
        body: {
          kind: chosen, connection_id: connectionParam(account),
          config: chosen === 'sitemap' ? { sitemap_url: sitemap.trim(), board_id: board.id, board_name: board.name, per_day: Number(perDay) } : { min_age_days: Number(minAge), per_day: Number(perDay), best_first: bestFirst },
        },
      })
      toast.success('Automation created. The first run starts within a few minutes.')
      setOpen(false); setSitemap('')
      void refreshSummary(); await load()
    } catch (e) {
      toast.error(errorText(e), e instanceof ApiError && e.upgradeRequired ? { action: { label: 'See plans', onClick: () => router.push('/dashboard/upgrade') } } : undefined)
    }
    setBusy(false)
  }

  async function toggle(a: Automation) {
    try { await api(`/automations/${a.id}`, { method: 'PATCH', body: { enabled: !a.enabled } }); void refreshSummary(); await load() }
    catch (e) { toast.error(errorText(e), e instanceof ApiError && e.upgradeRequired ? { action: { label: 'See plans', onClick: () => router.push('/dashboard/upgrade') } } : undefined) }
  }
  async function runNow(a: Automation) {
    try {
      await api(`/automations/${a.id}/run`, { body: {} })
      toast.success('Running now. The result appears on the card in a moment.')
      setTimeout(load, 4000); setTimeout(load, 12000)
    } catch (e) { toast.error(errorText(e)) }
  }
  async function remove(a: Automation) {
    if (!confirm('Delete this automation? Pins it already scheduled stay in your queue.')) return
    try { await api(`/automations/${a.id}`, { method: 'DELETE' }); void refreshSummary(); await load() } catch (e) { toast.error(errorText(e)) }
  }

  const accountName = (id: string | null) => accounts.find((x) => x.id === id)?.username

  return (
    <div className="max-w-3xl">
      <PageHeader title="Automations" description="Keep your boards active without doing the work every day. Each automation runs once a day and uses your normal monthly allowance."
        actions={<Button onClick={() => setOpen(true)} disabled={!allowedKinds.length || atLimit}><Plus size={16} aria-hidden /> New automation</Button>} />

      {summary && allowedKinds.length === 0 && <div className="mb-5"><UpgradeNote>Automations are included in paid plans. Sitemap autopilot needs Pro.</UpgradeNote></div>}
      {summary && allowedKinds.length > 0 && atLimit && <div className="mb-5"><UpgradeNote>Your {plan?.name} plan runs {summary.limits.automations} automation{summary.limits.automations === 1 ? '' : 's'} at once. Pause one to add another.</UpgradeNote></div>}

      {list === null ? <Skeleton className="h-40" /> : list.length === 0 ? (
        <Card><EmptyState icon={Repeat} title="No automations yet" description="Start with sitemap autopilot to pin every new post, or evergreen recycling to bring your best pins back."
          action={allowedKinds.length ? <Button onClick={() => setOpen(true)}>New automation</Button> : undefined} /></Card>
      ) : (
        <div className="space-y-3">
          {list.map((a) => {
            const K = KIND[a.kind]
            return (
              <Card key={a.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600"><K.icon size={18} aria-hidden /></div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-ink">{K.label}</h2>
                        <Badge tone={a.enabled ? 'success' : 'neutral'}>{a.enabled ? 'On' : 'Paused'}</Badge>
                        {multiple && accountName(a.connection_id) && <Badge>@{accountName(a.connection_id)}</Badge>}
                      </div>
                      <p className="mt-1 break-words text-sm text-muted">
                        {a.kind === 'sitemap'
                          ? `${a.config.sitemap_url} to "${a.config.board_name}", ${a.config.per_day} a day`
                          : `Pins older than ${a.config.min_age_days} days, ${a.config.per_day} a day, ${a.config.best_first ? 'best performing first' : 'oldest first'}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    {a.enabled && <button onClick={() => runNow(a)} aria-label="Run now" title="Run now" className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-ink"><Zap size={16} /></button>}
                    <button onClick={() => toggle(a)} aria-label={a.enabled ? 'Pause' : 'Turn on'} title={a.enabled ? 'Pause' : 'Turn on'} className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-ink">{a.enabled ? <Pause size={16} /> : <Play size={16} />}</button>
                    <button onClick={() => remove(a)} aria-label="Delete" title="Delete" className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-2 border-t border-line pt-3 text-xs sm:grid-cols-3">
                  <div><dt className="text-muted">Pins created</dt><dd className="font-medium tabular-nums text-ink">{a.total_created}</dd></div>
                  <div><dt className="text-muted">Last run</dt><dd className="font-medium text-ink">{a.last_run_at ? formatDateTime(a.last_run_at, summary?.timezone) : 'Not yet'}</dd></div>
                  <div><dt className="text-muted">Next run</dt><dd className="font-medium text-ink">{a.enabled ? formatDateTime(a.next_run_at, summary?.timezone) : 'Paused'}</dd></div>
                </dl>
                {a.last_result && <p className="mt-2 text-xs text-muted">{a.last_result}</p>}
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New automation"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} loading={busy}>Create</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Automation type">
            {allowedKinds.map((k) => {
              const K = KIND[k]
              return (
                <button key={k} type="button" role="radio" aria-checked={chosen === k} onClick={() => setKind(k)}
                  className={`rounded-xl border p-3 text-left transition-colors ${chosen === k ? 'border-ink bg-stone-50' : 'border-line hover:border-stone-300'}`}>
                  <K.icon size={18} className="mb-1.5 text-stone-600" aria-hidden />
                  <p className="text-sm font-medium text-ink">{K.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{K.blurb}</p>
                </button>
              )
            })}
          </div>
          {multiple && account && <p className="text-xs text-muted">Runs on @{account.username}. Switch accounts in the sidebar first to change this.</p>}
          {chosen === 'sitemap' ? (
            <>
              <Input label="Sitemap or website address" value={sitemap} onChange={(e) => setSitemap(e.target.value)} placeholder="https://yourblog.com/sitemap.xml" inputMode="url" />
              <BoardSelect value={board.id} onChange={(id, name) => setBoard({ id, name })} label="Pin to board" />
            </>
          ) : (
            <>
              <Select label="Only re-pin pins older than" value={minAge} onChange={(e) => setMinAge(e.target.value)} hint="Pinterest favors fresh content, so let pins rest before they return.">
                {[30, 45, 60, 90, 120, 180].map((d) => <option key={d} value={d}>{d} days</option>)}
              </Select>
              <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={bestFirst} onChange={(e) => setBestFirst(e.target.checked)} className="h-4 w-4 accent-[#e60023]" /> Best performing pins first (by saves)</label>
            </>
          )}
          <Select label="Pins per day" value={perDay} onChange={(e) => setPerDay(e.target.value)} hint="Each pin uses one from your monthly allowance. 1 to 3 a day is plenty.">
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
      </Modal>
    </div>
  )
}
