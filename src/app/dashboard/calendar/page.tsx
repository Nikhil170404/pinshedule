'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Calendar, List, Clock, X, Image } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { ScheduledPin } from '@/types'

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const STATUS_PILL: Record<string, string> = {
  published: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-orange-50 text-orange-600 border-orange-200',
}

const STATUS_DOT: Record<string, string> = {
  published: 'bg-green-500',
  failed: 'bg-red-500',
  pending: 'bg-[#E60023]',
}

function PinCard({ pin }: { pin: ScheduledPin }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-gray-200 shrink-0 overflow-hidden">
        {pin.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pin.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image size={14} className="text-gray-400" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate leading-tight">{pin.title || 'Untitled pin'}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] text-gray-500 flex items-center gap-0.5">
            <Clock size={10} className="shrink-0" />
            {fmtTime(pin.scheduled_at)}
          </span>
          {pin.board_name && (
            <span className="text-[11px] text-gray-400 truncate">{pin.board_name}</span>
          )}
        </div>
      </div>
      <span className={cn(
        'text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 capitalize',
        STATUS_PILL[pin.status] ?? STATUS_PILL.pending
      )}>
        {pin.status}
      </span>
    </div>
  )
}

export default function CalendarPage() {
  const [today] = useState(() => new Date())
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [pins, setPins] = useState<ScheduledPin[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [view, setView] = useState<'month' | 'list'>('month')

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const start = new Date(year, month, 1).toISOString()
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
      const { data } = await supabase
        .from('scheduled_pins')
        .select('*')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at')
      if (active) {
        setPins(data ?? [])
        setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [year, month])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function pinsForDay(day: number) {
    return pins.filter((p) => {
      const d = new Date(p.scheduled_at)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  const selectedDayPins = selectedDay ? pinsForDay(selectedDay) : []

  function prevMonth() { setCurrentMonth(new Date(year, month - 1, 1)); setSelectedDay(null) }
  function nextMonth() { setCurrentMonth(new Date(year, month + 1, 1)); setSelectedDay(null) }
  function goToday() {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDay(today.getDate())
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  // For list view: group pins by day
  const pinsByDay = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .map((day) => ({ day, pins: pinsForDay(day) }))
    .filter(({ pins: dp }) => dp.length > 0)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? 'Loading…' : `${pins.length} pin${pins.length !== 1 ? 's' : ''} in ${MONTHS[month]}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setView('month')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                view === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Calendar size={13} /> Month
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <List size={13} /> List
            </button>
          </div>
          <button
            onClick={goToday}
            disabled={isCurrentMonth}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-gray-300 disabled:opacity-40 disabled:cursor-default transition-colors"
          >
            Today
          </button>
          <Link
            href="/dashboard/schedule"
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#E60023] rounded-xl hover:bg-[#c0001d] transition-colors"
          >
            + Schedule
          </Link>
        </div>
      </div>

      {/* Body: calendar + optional day panel */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Main calendar card */}
        <div className="w-full lg:flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-semibold text-gray-900 text-base sm:text-lg select-none">
              {MONTHS[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {view === 'month' ? (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-gray-50 bg-gray-50/50">
                {DAYS_SHORT.map((d) => (
                  <div key={d} className="py-2 text-center text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <span className="sm:hidden">{d[0]}</span>
                    <span className="hidden sm:inline">{d}</span>
                  </div>
                ))}
              </div>

              {/* Grid */}
              {loading ? (
                <div className="grid grid-cols-7">
                  {Array(35).fill(0).map((_, i) => (
                    <div key={i} className="min-h-[64px] sm:min-h-[90px] border-b border-r border-gray-50 p-1.5">
                      <div className="skeleton w-6 h-6 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7">
                  {cells.map((day, i) => {
                    const isToday = day !== null && isCurrentMonth && today.getDate() === day
                    const isSelected = day === selectedDay
                    const dayPins = day !== null ? pinsForDay(day) : []
                    return (
                      <div
                        key={i}
                        onClick={() => day && setSelectedDay(isSelected ? null : day)}
                        className={cn(
                          'min-h-[64px] sm:min-h-[90px] p-1 sm:p-1.5 border-b border-r border-gray-50 transition-colors last-of-type:border-r-0',
                          !day ? 'bg-gray-50/40' : 'cursor-pointer',
                          isSelected && day ? 'bg-red-50' : day ? 'hover:bg-gray-50' : ''
                        )}
                      >
                        {day !== null && (
                          <>
                            <span className={cn(
                              'inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs sm:text-sm font-medium leading-none',
                              isToday
                                ? 'bg-[#E60023] text-white'
                                : isSelected
                                  ? 'bg-[#E60023]/15 text-[#E60023] font-semibold'
                                  : 'text-gray-700'
                            )}>
                              {day}
                            </span>

                            {/* Desktop: pill labels */}
                            {dayPins.length > 0 && (
                              <div className="mt-0.5 space-y-0.5 hidden sm:block">
                                {dayPins.slice(0, 2).map((p) => (
                                  <div
                                    key={p.id}
                                    className={cn(
                                      'text-[9px] md:text-[10px] px-1 py-px rounded-md truncate font-medium border',
                                      STATUS_PILL[p.status] ?? STATUS_PILL.pending
                                    )}
                                  >
                                    {fmtTime(p.scheduled_at)} · {p.title || 'Pin'}
                                  </div>
                                ))}
                                {dayPins.length > 2 && (
                                  <p className="text-[9px] text-gray-400 pl-0.5">+{dayPins.length - 2} more</p>
                                )}
                              </div>
                            )}

                            {/* Mobile: dot indicators */}
                            {dayPins.length > 0 && (
                              <div className="flex gap-0.5 mt-1 sm:hidden flex-wrap">
                                {dayPins.slice(0, 3).map((p, pi) => (
                                  <div
                                    key={pi}
                                    className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[p.status] ?? STATUS_DOT.pending)}
                                  />
                                ))}
                                {dayPins.length > 3 && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            /* List view */
            <div className="divide-y divide-gray-50">
              {loading ? (
                <div className="py-16 text-center">
                  <div className="skeleton h-4 w-32 rounded mx-auto mb-3" />
                  <div className="space-y-2 px-6">
                    {[1,2,3].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
                  </div>
                </div>
              ) : pinsByDay.length === 0 ? (
                <div className="py-20 text-center">
                  <Calendar size={28} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium text-sm">No pins in {MONTHS[month]}</p>
                  <p className="text-gray-400 text-xs mt-1 mb-5">Schedule your first pin for this month</p>
                  <Link
                    href="/dashboard/schedule"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#E60023] text-white text-sm font-medium rounded-xl hover:bg-[#c0001d] transition-colors"
                  >
                    Schedule a pin
                  </Link>
                </div>
              ) : (
                pinsByDay.map(({ day, pins: dp }) => {
                  const date = new Date(year, month, day)
                  const isTodayRow = isCurrentMonth && today.getDate() === day
                  return (
                    <div key={day} className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                        {isTodayRow && (
                          <span className="text-[10px] font-semibold bg-[#E60023] text-white px-1.5 py-0.5 rounded-full">Today</span>
                        )}
                        <span className="text-xs text-gray-400">{dp.length} pin{dp.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-2">
                        {dp.map((p) => <PinCard key={p.id} pin={p} />)}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 sm:px-6 py-3 border-t border-gray-50 bg-gray-50/30">
            {[
              { label: 'Pending', dot: STATUS_DOT.pending },
              { label: 'Published', dot: STATUS_DOT.published },
              { label: 'Failed', dot: STATUS_DOT.failed },
            ].map(({ label, dot }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={cn('w-2 h-2 rounded-full', dot)} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day detail panel — slides in on desktop, shown below on mobile */}
        {selectedDay && (
          <div className="w-full lg:w-72 xl:w-80 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden sticky top-6">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {new Date(year, month, selectedDay).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedDayPins.length} pin{selectedDayPins.length !== 1 ? 's' : ''} scheduled
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="p-4 max-h-[50vh] lg:max-h-[60vh] overflow-y-auto">
                {selectedDayPins.length === 0 ? (
                  <div className="py-10 text-center">
                    <Clock size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No pins this day</p>
                    <Link
                      href={`/dashboard/schedule`}
                      className="mt-3 inline-block text-xs text-[#E60023] hover:underline font-medium"
                    >
                      Schedule a pin
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDayPins.map((p) => <PinCard key={p.id} pin={p} />)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
