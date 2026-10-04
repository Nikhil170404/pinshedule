'use client'

import Link from 'next/link'
import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ListChecks, Plus, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/button-styles'
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Card'
import { PinRow } from '@/components/pins/PinRow'
import { PinEditModal } from '@/components/pins/PinEditModal'
import { api, errorText } from '@/lib/api'
import { refreshSummary, usePinCounts, usePins } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import type { PinStatus, ScheduledPin } from '@/types'

const tabs = [
  { key: 'upcoming', label: 'Upcoming', statuses: ['pending', 'processing'] as PinStatus[], asc: true },
  { key: 'published', label: 'Published', statuses: ['published'] as PinStatus[], asc: false },
  { key: 'failed', label: 'Failed', statuses: ['failed'] as PinStatus[], asc: false },
]

function PinsView() {
  const initial = useSearchParams().get('tab')
  const [tabKey, setTabKey] = useState(tabs.some((t) => t.key === initial) ? (initial as string) : 'upcoming')
  const tab = tabs.find((t) => t.key === tabKey)!
  const counts = usePinCounts()
  const { pins, loading, hasMore, loadMore, error } = usePins({ statuses: tab.statuses, ascending: tab.asc })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<ScheduledPin | null>(null)
  const [busy, setBusy] = useState(false)

  const tabCount = (k: string) => {
    if (!counts) return null
    return k === 'upcoming' ? counts.pending + counts.processing : k === 'published' ? counts.published : counts.failed
  }
  const ids = useMemo(() => [...selected].filter((id) => pins.some((p) => p.id === id)), [selected, pins])
  const allChecked = pins.length > 0 && ids.length === pins.filter((p) => p.status !== 'processing').length

  async function remove(list: string[]) {
    if (!confirm(`Delete ${list.length} pin${list.length > 1 ? 's' : ''}? This cannot be undone.`)) return
    setBusy(true)
    try {
      const r = await api<{ deleted: number }>('/pins/delete', { body: { ids: list } })
      toast.success(`${r.deleted} deleted.`)
      setSelected(new Set())
      void refreshSummary()
    } catch (e) { toast.error(errorText(e)) }
    setBusy(false)
  }

  async function retry(list: string[]) {
    setBusy(true)
    try {
      const r = await api<{ retried: number }>('/pins/retry', { body: { ids: list } })
      toast.success(`${r.retried} re-queued. They publish in a couple of minutes.`)
      setSelected(new Set())
    } catch (e) { toast.error(errorText(e)) }
    setBusy(false)
  }

  return (
    <div>
      <PageHeader title="Pins" description="Everything you have scheduled, published or that needs attention. Updates live."
        actions={<Link href="/dashboard/schedule" className={buttonStyles('primary', 'md')}><Plus size={16} aria-hidden /> New pin</Link>} />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tabKey === t.key} onClick={() => { setTabKey(t.key); setSelected(new Set()) }}
            className={cn('-mb-px flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap',
              tabKey === t.key ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink')}>
            {t.label}
            {tabCount(t.key) !== null && <span className={cn('rounded-full px-1.5 text-xs tabular-nums', t.key === 'failed' && (tabCount('failed') ?? 0) > 0 ? 'bg-red-50 text-red-700' : 'bg-stone-100 text-stone-600')}>{tabCount(t.key)}</span>}
          </button>
        ))}
      </div>

      {ids.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-sm text-white">
          <span className="mr-auto">{ids.length} selected</span>
          {tab.key === 'failed' && <Button size="sm" variant="secondary" onClick={() => retry(ids)} loading={busy}><RotateCw size={14} aria-hidden /> Retry</Button>}
          <Button size="sm" variant="danger" onClick={() => remove(ids)} loading={busy}><Trash2 size={14} aria-hidden /> Delete</Button>
        </div>
      )}

      <Card className="overflow-hidden">
        {pins.length > 0 && (
          <label className="flex items-center gap-3 border-b border-line bg-stone-50 px-4 py-2 text-xs text-muted">
            <input type="checkbox" className="h-4 w-4 accent-[#e60023]" checked={allChecked}
              onChange={(e) => setSelected(e.target.checked ? new Set(pins.filter((p) => p.status !== 'processing').map((p) => p.id)) : new Set())} />
            Select all
          </label>
        )}
        {loading ? (
          <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : error ? (
          <EmptyState icon={ListChecks} title="Could not load pins" description={error} />
        ) : pins.length === 0 ? (
          <EmptyState icon={ListChecks}
            title={tab.key === 'upcoming' ? 'Nothing scheduled' : tab.key === 'published' ? 'No published pins yet' : 'No failed pins'}
            description={tab.key === 'upcoming' ? 'Schedule a pin or import a page from your website.' : tab.key === 'failed' ? 'Pins that cannot be published show up here with the reason.' : 'Published pins appear here as soon as they go live.'}
            action={tab.key === 'upcoming' ? <Link href="/dashboard/schedule" className={buttonStyles('primary')}>Schedule a pin</Link> : undefined} />
        ) : (
          <div className="divide-y divide-line">
            {pins.map((p) => (
              <PinRow key={p.id} pin={p} selected={selected.has(p.id)}
                onSelect={(c) => setSelected((s) => { const n = new Set(s); if (c) n.add(p.id); else n.delete(p.id); return n })}
                onEdit={() => setEditing(p)} onDelete={() => remove([p.id])} onRetry={() => retry([p.id])} />
            ))}
          </div>
        )}
        {hasMore && !loading && <div className="border-t border-line p-3 text-center"><Button variant="ghost" size="sm" onClick={loadMore}>Load more</Button></div>}
      </Card>
      <PinEditModal pin={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

export default function PinsPage() {
  return <Suspense><PinsView /></Suspense>
}
