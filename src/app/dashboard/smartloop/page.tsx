'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Pause, Play, Repeat, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { SafeImage } from '@/components/ui/SafeImage'
import { UpgradeNote } from '@/components/pins/UpgradeNote'
import { api, ApiError, errorText } from '@/lib/api'
import { useSummary } from '@/lib/hooks'
import { cn } from '@/lib/utils'

interface LoopRow { id: string; name: string; active: boolean; paused_reason: string | null; interval_days: number; max_per_day: number; window_start: number; window_end: number; require_approval: boolean; refresh_text: boolean; item_count: number }
interface Review { id: string; loop_id: string; title: string | null; description: string | null; note: string | null; image_url: string | null }
interface Hist { id: string; status: string; title: string | null; scheduled_at: string | null; note: string | null; created_at: string }
interface Overview { loops: LoopRow[]; reviews: Review[]; history: Hist[] }
interface Cand { id: string; image_url: string; title: string | null; board_name: string | null }

const hour = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`

function ReviewCard({ r, onDone }: { r: Review; onDone: () => void }) {
  const [title, setTitle] = useState(r.title ?? '')
  const [description, setDescription] = useState(r.description ?? '')
  const [busy, setBusy] = useState(false)
  async function act(kind: 'approve' | 'reject') {
    setBusy(true)
    try {
      const res = await api<{ scheduled_at?: string }>(`/loops/runs/${r.id}/${kind}`, { method: 'POST', body: kind === 'approve' ? { title, description } : {} })
      toast.success(kind === 'approve' ? `Scheduled for ${new Date(res.scheduled_at!).toLocaleString()}.` : 'Skipped.')
      onDone()
    } catch (e) { toast.error(errorText(e)); setBusy(false) }
  }
  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row">
      <SafeImage src={r.image_url} className="aspect-[2/3] w-full shrink-0 rounded-lg border border-line sm:w-28" iconSize={16} />
      <div className="min-w-0 flex-1 space-y-3">
        <Input label="Title" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Description" rows={3} value={description} maxLength={800} onChange={(e) => setDescription(e.target.value)} />
        {r.note && <p className="text-xs text-muted">{r.note} The image is the same as before, so a fresh image would help it stand out.</p>}
        <div className="flex gap-2">
          <Button onClick={() => act('approve')} loading={busy}><Check size={15} aria-hidden /> Approve and schedule</Button>
          <Button variant="secondary" onClick={() => act('reject')} disabled={busy}><X size={15} aria-hidden /> Skip</Button>
        </div>
      </div>
    </Card>
  )
}

function AddPins({ loopId, onDone }: { loopId: string; onDone: () => void }) {
  const [pins, setPins] = useState<Cand[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  useEffect(() => { api<{ pins: Cand[] }>('/loops/candidates').then((r) => setPins(r.pins)).catch((e) => { toast.error(errorText(e)); setPins([]) }) }, [])
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else if (n.size < 50) n.add(id); return n })
  async function add() {
    setBusy(true)
    try { const r = await api<{ added: number }>(`/loops/${loopId}/items`, { body: { pin_ids: [...picked] } }); toast.success(`${r.added} pin${r.added === 1 ? '' : 's'} added.`); onDone() }
    catch (e) { toast.error(errorText(e)); setBusy(false) }
  }
  return (
    <div className="mt-3 rounded-lg border border-line bg-stone-50 p-3">
      <p className="mb-2 text-sm font-medium text-ink">Choose evergreen pins that did well (up to 50 at a time)</p>
      {!pins ? <Skeleton className="h-24" /> : pins.length === 0 ? <p className="text-sm text-muted">No published pins available yet. Pins you publish through GoPinKaro show up here.</p> : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {pins.map((p) => (
            <button key={p.id} type="button" aria-pressed={picked.has(p.id)} onClick={() => toggle(p.id)} title={p.title ?? ''}
              className={cn('relative overflow-hidden rounded-lg border-2', picked.has(p.id) ? 'border-brand' : 'border-transparent')}>
              <SafeImage src={p.image_url} className="aspect-[2/3] w-full" iconSize={14} />
              {picked.has(p.id) && <span className="absolute right-1 top-1 rounded-full bg-brand p-0.5 text-white"><Check size={12} aria-hidden /></span>}
            </button>
          ))}
        </div>
      )}
      <Button className="mt-3" onClick={add} loading={busy} disabled={picked.size === 0}>Add {picked.size || ''} to loop</Button>
    </div>
  )
}

export default function SmartLoopPage() {
  const { summary } = useSummary()
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gated, setGated] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', interval_days: '30', max_per_day: '2', window_start: '9', window_end: '21', require_approval: true })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setData(await api<Overview>('/loops')); setError(null); setGated(false) }
    catch (e) { if (e instanceof ApiError && e.upgradeRequired) setGated(true); else setError(errorText(e)) }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load when the page opens or the account changes
  useEffect(() => { void load() }, [load, summary?.pinterest?.id])

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true)
    try {
      await api('/loops', { body: { name: form.name, interval_days: Number(form.interval_days), max_per_day: Number(form.max_per_day), window_start: Number(form.window_start), window_end: Number(form.window_end), require_approval: form.require_approval } })
      setForm((f) => ({ ...f, name: '' })); await load()
    } catch (err) { toast.error(errorText(err)) }
    setBusy(false)
  }
  const patch = async (id: string, body: Record<string, unknown>) => { try { await api(`/loops/${id}`, { method: 'PATCH', body }); await load() } catch (e) { toast.error(errorText(e)) } }
  async function remove(l: LoopRow) {
    if (!window.confirm(`Delete "${l.name}"? Pins already on your calendar stay there.`)) return
    try { await api(`/loops/${l.id}`, { method: 'DELETE' }); await load() } catch (e) { toast.error(errorText(e)) }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="SmartLoop" description="Bring your best evergreen pins back on a slow schedule, with fresh wording and your approval. Quality first: a pin never returns sooner than every 14 days." />
      {gated ? <UpgradeNote>SmartLoop is available on paid plans. <Link href="/dashboard/upgrade" className="font-medium underline">See plans</Link>.</UpgradeNote>
        : error ? <EmptyState icon={Repeat} title="Could not load SmartLoop" description={error} />
        : !data ? <Skeleton className="h-40" /> : (
        <div className="space-y-6">
          {data.reviews.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink">Waiting for your approval ({data.reviews.length})</h2>
              <div className="space-y-3">{data.reviews.map((r) => <ReviewCard key={r.id} r={r} onDone={load} />)}</div>
            </div>
          )}

          <Card className="p-4">
            <form onSubmit={create} className="space-y-3">
              <h2 className="text-sm font-semibold text-ink">New loop</h2>
              <Input label="Name" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Best dinner recipes" required />
              <div className="grid gap-3 sm:grid-cols-4">
                <Select label="Repeat each pin every" value={form.interval_days} onChange={(e) => setForm({ ...form, interval_days: e.target.value })}>
                  {[14, 21, 30, 45, 60, 90, 180].map((d) => <option key={d} value={d}>{d} days</option>)}
                </Select>
                <Select label="Most per day" value={form.max_per_day} onChange={(e) => setForm({ ...form, max_per_day: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
                <Select label="Not before" value={form.window_start} onChange={(e) => setForm({ ...form, window_start: e.target.value })}>{Array.from({ length: 23 }, (_, h) => <option key={h} value={h}>{hour(h)}</option>)}</Select>
                <Select label="Not after" value={form.window_end} onChange={(e) => setForm({ ...form, window_end: e.target.value })}>{Array.from({ length: 23 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{hour(h)}</option>)}</Select>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={form.require_approval} onChange={(e) => setForm({ ...form, require_approval: e.target.checked })} />
                Ask me to approve each recycled pin before it is scheduled (recommended)
              </label>
              <p className="text-xs text-muted">Times are random inside your window, in your timezone, and kept at least 45 minutes apart.</p>
              <Button type="submit" loading={busy}>Create loop</Button>
            </form>
          </Card>

          {data.loops.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{l.name} <span className={cn('ml-1 rounded-full px-2 py-0.5 text-xs', l.active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>{l.active ? 'Running' : 'Paused'}</span></p>
                  <p className="text-xs text-muted">{l.item_count} pin{l.item_count === 1 ? '' : 's'}, each every {l.interval_days} days, up to {l.max_per_day} a day between {hour(l.window_start)} and {hour(l.window_end)}{l.require_approval ? ', with approval' : ', automatic'}</p>
                  {!l.active && l.paused_reason && <p className="mt-1 text-xs text-amber-800">{l.paused_reason}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setAdding(adding === l.id ? null : l.id)}>Add pins</Button>
                  <Button variant="secondary" size="sm" onClick={() => patch(l.id, { active: !l.active })}>{l.active ? <><Pause size={14} aria-hidden /> Pause</> : <><Play size={14} aria-hidden /> Resume</>}</Button>
                  <button aria-label={`Delete ${l.name}`} onClick={() => remove(l)} className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-red-700"><Trash2 size={15} /></button>
                </div>
              </div>
              {adding === l.id && <AddPins loopId={l.id} onDone={() => { setAdding(null); void load() }} />}
            </Card>
          ))}

          {data.history.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink">History</h2>
              <Card className="divide-y divide-line">
                {data.history.map((h) => (
                  <div key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', h.status === 'scheduled' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600')}>{h.status}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{h.title || 'Untitled pin'}</span>
                    <span className="text-xs text-muted">{h.scheduled_at ? new Date(h.scheduled_at).toLocaleString() : new Date(h.created_at).toLocaleDateString()}</span>
                    {h.note && h.status === 'skipped' && <span className="w-full text-xs text-amber-800">{h.note}</span>}
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
