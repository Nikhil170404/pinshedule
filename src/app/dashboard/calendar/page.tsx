'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScheduledPin } from '@/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function CalendarPage() {
  const [today] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [pins, setPins] = useState<ScheduledPin[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString()
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59).toISOString()
      const { data } = await supabase
        .from('scheduled_pins')
        .select('*')
        .gte('scheduled_at', start)
        .lte('scheduled_at', end)
        .order('scheduled_at')
      setPins(data ?? [])
    }
    load()
  }, [currentMonth])

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
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

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button
            onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-semibold text-gray-900">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-50">
          {DAYS.map((d) => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-gray-400">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const isToday = day !== null && today.getDate() === day && today.getMonth() === month && today.getFullYear() === year
            const dayPins = day !== null ? pinsForDay(day) : []
            return (
              <div
                key={i}
                className={cn(
                  'min-h-[80px] md:min-h-[100px] p-1.5 border-b border-r border-gray-50 last:border-r-0',
                  !day && 'bg-gray-50/50'
                )}
              >
                {day !== null && (
                  <>
                    <span className={cn(
                      'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium',
                      isToday ? 'bg-[#E60023] text-white' : 'text-gray-700'
                    )}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayPins.slice(0, 3).map((p) => (
                        <div
                          key={p.id}
                          className={cn(
                            'text-[9px] md:text-[10px] px-1.5 py-0.5 rounded-md truncate font-medium',
                            p.status === 'published' ? 'bg-green-100 text-green-800' :
                            p.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-red-50 text-[#E60023]'
                          )}
                        >
                          {p.title || 'Pin'}
                        </div>
                      ))}
                      {dayPins.length > 3 && (
                        <div className="text-[9px] text-gray-400 pl-1">+{dayPins.length - 3} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
