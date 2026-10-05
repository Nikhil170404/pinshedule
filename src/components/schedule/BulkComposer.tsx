'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { BoardSelect } from '@/components/pins/BoardSelect'
import { TimingNote } from '@/components/schedule/TimingNote'
import { UpgradeNote } from '@/components/pins/UpgradeNote'
import { api, ApiError, errorText } from '@/lib/api'
import { refreshSummary, useSummary } from '@/lib/hooks'
import { uploadImage } from '@/lib/upload'
import { SafeImage } from '@/components/ui/SafeImage'
import { mapLimit } from '@/lib/async'
import { PIN_LIMITS, PLANS } from '@/types'
import { toLocalInput } from '@/lib/utils'

export interface DraftRow {
  id: string
  /** Either a local file (uploaded on submit) or an already public https image. */
  file?: File
  imageUrl?: string
  preview: string
  title: string
  description: string
  link: string
  boardId?: string
  scheduledAt?: string
}

/**
 * Shared editor for "many pins at once": review each draft, pick a board and timing,
 * upload images, and schedule everything in one request.
 */
export function BulkComposer({ rows, setRows }: { rows: DraftRow[]; setRows: React.Dispatch<React.SetStateAction<DraftRow[]>> }) {
  const router = useRouter()
  const { summary } = useSummary()
  const plan = summary ? PLANS[summary.plan] : null

  const [board, setBoard] = useState({ id: '', name: '' })
  const [timing, setTiming] = useState<'best' | 'interval'>('interval')
  const [perDay, setPerDay] = useState('3')
  const [start, setStart] = useState(() => toLocalInput(new Date(Date.now() + 3600_000)))
  const [everyHours, setEveryHours] = useState('6')
  const [busy, setBusy] = useState<string | null>(null)

  const canAuto = !!plan?.smart_scheduler
  const mode = canAuto ? timing : 'interval'
  const update = (id: string, patch: Partial<DraftRow>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const remove = (id: string) => setRows((r) => r.filter((x) => x.id !== id))

  async function submit() {
    if (rows.length === 0) return
    if (!board.id) return toast.error('Choose a board.')
    if (mode === 'interval' && !start) return toast.error('Choose a start time.')
    const batchCap = plan?.bulk_upload ? 200 : 10
    if (rows.length > batchCap) return toast.error(`Your plan schedules up to ${batchCap} pins at a time.`)

    try {
      // 1. Upload local images (3 at a time) so Pinterest can fetch them from a public URL.
      const urls: string[] = []
      let done = 0
      setBusy(`Uploading images 0/${rows.filter((r) => r.file).length}`)
      await mapLimit(rows, 3, async (r, i) => {
        urls[i] = r.imageUrl ?? (await uploadImage(r.file!))
        if (r.file) setBusy(`Uploading images ${++done}/${rows.filter((x) => x.file).length}`)
      })

      // 2. One request: validated and quota-checked atomically on the server.
      setBusy('Scheduling')
      const stepMs = Math.max(0.25, Number(everyHours) || 6) * 3600_000
      const startMs = new Date(start).getTime()
      const pins = rows.map((r, i) => {
        const b = r.boardId ? { id: r.boardId } : board
        return {
          image_url: urls[i], title: r.title, description: r.description, board_id: b.id, board_name: b.id === board.id ? board.name : '',
          destination_url: r.link || null,
          ...(r.scheduledAt ? { scheduled_at: new Date(r.scheduledAt).toISOString() }
            : mode === 'interval' ? { scheduled_at: new Date(startMs + i * stepMs).toISOString() } : {}),
        }
      })
      const res = await api<{ created: number; warnings?: string[] }>('/pins/schedule', { body: { pins, ...(mode === 'best' ? { auto: { per_day: Number(perDay) } } : {}) } })
      toast.success(`${res.created} pins scheduled.`)
      for (const w of res.warnings ?? []) toast.warning(w, { duration: 12000 })
      void refreshSummary()
      router.push('/dashboard/pins')
    } catch (e) {
      toast.error(errorText(e), e instanceof ApiError && e.upgradeRequired ? { action: { label: 'Upgrade', onClick: () => router.push('/dashboard/upgrade') } } : undefined)
      setBusy(null)
    }
  }

  const lastAt = mode === 'interval' && start ? new Date(new Date(start).getTime() + (rows.length - 1) * Math.max(0.25, Number(everyHours) || 6) * 3600_000) : null

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-ink">Publishing settings</h2>
        <BoardSelect value={board.id} onChange={(id, name) => setBoard({ id, name })} label="Board for all pins" />
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Spacing</p>
          <div className="mb-3 inline-flex rounded-lg bg-stone-100 p-1" role="tablist">
            {([['interval', 'Fixed interval'], ['best', 'Best times']] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={mode === k} disabled={k === 'best' && !canAuto}
                onClick={() => setTiming(k)}
                className={`h-8 rounded-md px-3 text-[13px] font-medium transition-colors disabled:opacity-50 ${mode === k ? 'bg-white text-ink shadow-sm' : 'text-stone-600'}`}>
                {label}
              </button>
            ))}
          </div>
          {mode === 'interval' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="First pin" type="datetime-local" value={start} min={toLocalInput(new Date())} onChange={(e) => setStart(e.target.value)} />
              <Select label="Then one pin every" value={everyHours} onChange={(e) => setEveryHours(e.target.value)}>
                {[1, 2, 3, 4, 6, 8, 12, 24, 48].map((h) => <option key={h} value={h}>{h < 24 ? `${h} hour${h > 1 ? 's' : ''}` : `${h / 24} day${h > 24 ? 's' : ''}`}</option>)}
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Pins per day" value={perDay} onChange={(e) => setPerDay(e.target.value)}
                hint="Steady daily pinning beats big bursts. 1 to 5 a day is typical; we warn you above 15.">
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
              <p className="self-end pb-2 text-sm text-muted"><TimingNote perDay={Number(perDay)} /></p>
            </div>
          )}
          {!canAuto && summary && <div className="mt-3"><UpgradeNote>Best-time spacing is included in paid plans.</UpgradeNote></div>}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{rows.length} {rows.length === 1 ? 'pin' : 'pins'}</h2>
        {lastAt && rows.length > 1 && <p className="flex items-center gap-1.5 text-xs text-muted"><CalendarClock size={14} aria-hidden /> Last pin goes out {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(lastAt)}</p>}
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => (
          <Card key={r.id} className="flex gap-3 p-3 sm:gap-4 sm:p-4">
            <SafeImage src={r.preview} className="h-24 w-16 shrink-0 rounded-lg border border-line sm:h-32 sm:w-20" iconSize={20} />
            <div className="min-w-0 flex-1 space-y-2">
              <Input aria-label={`Title for pin ${i + 1}`} placeholder="Title" value={r.title} maxLength={PIN_LIMITS.title} onChange={(e) => update(r.id, { title: e.target.value })} />
              <Textarea aria-label={`Description for pin ${i + 1}`} placeholder="Description" rows={2} value={r.description} maxLength={PIN_LIMITS.description} onChange={(e) => update(r.id, { description: e.target.value })} className="min-h-[64px]" />
              <Input aria-label={`Destination link for pin ${i + 1}`} placeholder="Link (optional)" type="url" inputMode="url" value={r.link} onChange={(e) => update(r.id, { link: e.target.value })} />
            </div>
            <button type="button" onClick={() => remove(r.id)} aria-label={`Remove pin ${i + 1}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-red-600">
              <Trash2 size={16} />
            </button>
          </Card>
        ))}
      </div>

      <div className="sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-xl border border-line bg-white/95 p-3 pr-[4.5rem] shadow-lg backdrop-blur sm:pr-40 lg:bottom-4 xl:pr-3">
        <p className="text-sm text-muted">{busy ?? `${rows.length} ready to schedule`}</p>
        <Button size="lg" onClick={submit} loading={!!busy} disabled={rows.length === 0}>
          Schedule {rows.length} {rows.length === 1 ? 'pin' : 'pins'}
        </Button>
      </div>
    </div>
  )
}
