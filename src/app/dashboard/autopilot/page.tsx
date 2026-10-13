'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Rss, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { BoardSelect } from '@/components/pins/BoardSelect'
import { UpgradeNote } from '@/components/pins/UpgradeNote'
import { SafeImage } from '@/components/ui/SafeImage'
import { api, errorText } from '@/lib/api'
import { useSummary } from '@/lib/hooks'
import { PIN_LIMITS, planOf } from '@/types'

interface Feed { id: string; url: string; board_id: string | null; board_name: string | null; active: boolean; last_checked_at: string | null; last_error: string | null }
interface Draft { id: string; feed_id: string; item_url: string; title: string | null; description: string | null; image_url: string | null }
interface Overview { feeds: Feed[]; drafts: Draft[]; feed_limit: number; feed_count: number; plan_name: string }

function DraftCard({ draft, defaultBoard, canAuto, onDone }: { draft: Draft; defaultBoard: { id: string; name: string }; canAuto: boolean; onDone: () => void }) {
  const [title, setTitle] = useState(draft.title ?? '')
  const [description, setDescription] = useState(draft.description ?? '')
  const [board, setBoard] = useState(defaultBoard)
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)

  async function approve() {
    if (!board.id) return toast.error('Choose a board first.')
    if (!canAuto && !when) return toast.error('Pick a date and time. Automatic best-time scheduling is on paid plans.')
    setBusy(true)
    try {
      await api(`/autopilot/drafts/${draft.id}`, { method: 'PATCH', body: { title, description } })
      await api(`/autopilot/drafts/${draft.id}/approve`, { method: 'POST', body: { board_id: board.id, board_name: board.name, scheduled_at: when ? new Date(when).toISOString() : undefined } })
      toast.success('Added to your publishing calendar.')
      onDone()
    } catch (e) { toast.error(errorText(e)); setBusy(false) }
  }
  async function reject() {
    setBusy(true)
    try { await api(`/autopilot/drafts/${draft.id}/reject`, { method: 'POST', body: {} }); onDone() } catch (e) { toast.error(errorText(e)); setBusy(false) }
  }

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row">
      <div className="w-full shrink-0 sm:w-32">
        {draft.image_url && <SafeImage src={draft.image_url} alt="" className="aspect-[2/3] w-full rounded-lg object-cover" />}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <a href={draft.item_url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-muted hover:underline">{draft.item_url}</a>
        <Input label="Title" value={title} maxLength={PIN_LIMITS.title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Description" rows={3} value={description} maxLength={PIN_LIMITS.description} onChange={(e) => setDescription(e.target.value)} />
        <BoardSelect value={board.id} onChange={(id, name) => setBoard({ id, name })} suggestText={`${title} ${description}`} />
        {!canAuto && <Input label="Publish at" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />}
        <div className="flex gap-2">
          <Button onClick={approve} loading={busy}><Check size={15} aria-hidden /> Approve and schedule</Button>
          <Button variant="secondary" onClick={reject} disabled={busy}><X size={15} aria-hidden /> Skip</Button>
        </div>
        {canAuto && <p className="text-xs text-muted">It goes to the next best-time slot on your calendar.</p>}
      </div>
    </Card>
  )
}

export default function AutopilotPage() {
  const { summary } = useSummary()
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [board, setBoard] = useState({ id: '', name: '' })
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setData(await api<Overview>('/autopilot')); setError(null) } catch (e) { setError(errorText(e)) }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load when the page opens or the account changes
  useEffect(() => { void load() }, [load, summary?.pinterest?.id])

  async function addFeed(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setBlocked(null)
    try {
      const r = await api<{ drafted: number }>('/autopilot/feeds', { body: { url, board_id: board.id || undefined, board_name: board.name || undefined } })
      toast.success(r.drafted ? `Connected. ${r.drafted} draft${r.drafted === 1 ? '' : 's'} ready to review.` : 'Connected. New posts will appear here for review.')
      setUrl(''); await load()
    } catch (err) {
      const msg = errorText(err)
      if ((err as { upgradeRequired?: boolean }).upgradeRequired) setBlocked(msg); else toast.error(msg)
    }
    setBusy(false)
  }
  async function toggle(f: Feed) { try { await api(`/autopilot/feeds/${f.id}`, { method: 'PATCH', body: { active: !f.active } }); await load() } catch (e) { toast.error(errorText(e)) } }
  async function remove(f: Feed) {
    if (!window.confirm('Stop watching this feed? Drafts waiting for review will be removed.')) return
    try { await api(`/autopilot/feeds/${f.id}`, { method: 'DELETE' }); await load() } catch (e) { toast.error(errorText(e)) }
  }

  const canAuto = summary ? planOf(summary).smart_scheduler : false
  const boardFor = (d: Draft) => {
    const f = data?.feeds.find((x) => x.id === d.feed_id)
    return { id: f?.board_id ?? '', name: f?.board_name ?? '' }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Autopilot" description="Connect your blog's RSS feed. New posts become pin drafts here, and nothing is published until you approve it." />

      {error ? <EmptyState icon={Rss} title="Could not load Autopilot" description={error} /> : !data ? <Skeleton className="h-40" /> : (
        <div className="space-y-6">
          {data.feed_limit === 0 ? (
            <UpgradeNote>RSS feeds are not included in the {data.plan_name} plan. <Link href="/dashboard/upgrade" className="font-medium underline">See plans</Link>.</UpgradeNote>
          ) : (
            <Card className="p-4">
              <form onSubmit={addFeed} className="space-y-3">
                <Input label="Feed address" placeholder="https://yourblog.com/feed" value={url} onChange={(e) => setUrl(e.target.value)} required
                  hint={`${data.feed_count} of ${data.feed_limit} feed${data.feed_limit === 1 ? '' : 's'} used on the ${data.plan_name} plan. WordPress blogs usually have one at /feed.`} />
                <BoardSelect label="Default board (optional)" value={board.id} onChange={(id, name) => setBoard({ id, name })} />
                <Button type="submit" loading={busy} disabled={!url.trim()}>Connect feed</Button>
                {blocked && <UpgradeNote>{blocked} <Link href="/dashboard/upgrade" className="font-medium underline">Upgrade</Link></UpgradeNote>}
              </form>
            </Card>
          )}

          {data.feeds.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink">Feeds on this account</h2>
              <Card className="divide-y divide-line">
                {data.feeds.map((f) => (
                  <div key={f.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{f.url}</p>
                      <p className={f.last_error ? 'text-xs text-red-700' : 'text-xs text-muted'}>
                        {f.last_error ? `Problem: ${f.last_error}${f.active ? '' : ' Paused after repeated failures.'}` : f.active ? (f.last_checked_at ? `Checked ${new Date(f.last_checked_at).toLocaleString()}` : 'Waiting for the first check') : 'Paused'}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => toggle(f)}>{f.active ? 'Pause' : 'Resume'}</Button>
                    <button aria-label="Remove feed" onClick={() => remove(f)} className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-red-700"><Trash2 size={15} /></button>
                  </div>
                ))}
              </Card>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink">Drafts to review ({data.drafts.length})</h2>
            {data.drafts.length === 0
              ? <EmptyState icon={Rss} title="No drafts waiting" description="When a connected feed publishes a new post, a pin draft appears here. Feeds are checked about every 30 minutes." />
              : <div className="space-y-3">{data.drafts.map((d) => <DraftCard key={d.id} draft={d} defaultBoard={boardFor(d)} canAuto={canAuto} onDone={load} />)}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
