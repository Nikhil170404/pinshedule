'use client'

import { useMemo, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Card'
import { PinRow } from '@/components/pins/PinRow'
import { PinEditModal } from '@/components/pins/PinEditModal'
import { usePins } from '@/lib/hooks'
import { api, errorText } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ScheduledPin } from '@/types'

export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())
  const [editing, setEditing] = useState<ScheduledPin | null>(null)

  const gridStart = startOfWeek(month)
  const gridEnd = endOfWeek(endOfMonth(month))
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd])
  const { pins, loading } = usePins({ from: gridStart.toISOString(), to: new Date(gridEnd.getTime() + 86_400_000).toISOString(), ascending: true, pageSize: 500 })

  const byDay = useMemo(() => {
    const m = new Map<string, ScheduledPin[]>()
    for (const p of pins) {
      const k = format(new Date(p.scheduled_at), 'yyyy-MM-dd')
      m.set(k, [...(m.get(k) ?? []), p])
    }
    return m
  }, [pins])

  const dayPins = byDay.get(format(selected, 'yyyy-MM-dd')) ?? []

  async function remove(id: string) {
    if (!confirm('Delete this pin?')) return
    try { await api('/pins/delete', { body: { ids: [id] } }) } catch (e) { toast.error(errorText(e)) }
  }

  return (
    <div>
      <PageHeader title="Calendar" description="Tap a day to see or edit its pins." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="p-3 sm:p-4 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{format(month, 'MMMM yyyy')}</h2>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft size={16} /></Button>
              <Button variant="outline" size="sm" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(new Date()) }}>Today</Button>
              <Button variant="outline" size="sm" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight size={16} /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-stone-500">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          {loading ? <Skeleton className="mt-1 h-72" /> : (
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
              {days.map((d) => {
                const list = byDay.get(format(d, 'yyyy-MM-dd')) ?? []
                const active = isSameDay(d, selected)
                const failed = list.some((p) => p.status === 'failed')
                return (
                  <button key={d.toISOString()} onClick={() => setSelected(d)} aria-label={`${format(d, 'EEEE, MMMM d')}, ${list.length} pins`} aria-pressed={active}
                    className={cn('flex h-14 flex-col items-start gap-1 bg-white p-1.5 text-left sm:h-20', !isSameMonth(d, month) && 'bg-stone-50 text-stone-400', active && 'ring-2 ring-inset ring-brand')}>
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-xs', isToday(d) && 'bg-brand font-medium text-white')}>{format(d, 'd')}</span>
                    {list.length > 0 && (
                      <span className={cn('rounded px-1 text-[11px] font-medium tabular-nums', failed ? 'bg-red-50 text-red-700' : 'bg-stone-100 text-stone-700')}>{list.length}<span className="hidden sm:inline"> pin{list.length > 1 ? 's' : ''}</span></span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        <section className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-ink">{format(selected, 'EEEE, MMMM d')}</h2>
          <Card className="overflow-hidden">
            {dayPins.length === 0 ? <EmptyState icon={CalendarDays} title="No pins this day" description="Pick another day or schedule something new." />
              : <div className="divide-y divide-line">{dayPins.map((p) => <PinRow key={p.id} pin={p} onEdit={() => setEditing(p)} onDelete={() => remove(p.id)} />)}</div>}
          </Card>
        </section>
      </div>
      <PinEditModal pin={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
