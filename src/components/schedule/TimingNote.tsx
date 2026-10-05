'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useScope } from '@/lib/hooks'

interface Timing { source: 'personal' | 'general'; sample: number; confidence: 'low' | 'medium' | 'high' | null; needed: number; top_hours: number[]; timezone: string }

const hour = (h: number) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`

/** Says honestly how best-time slots are chosen for the selected account. */
export function TimingNote({ perDay }: { perDay?: number }) {
  const scope = useScope()
  const [t, setT] = useState<Timing | null>(null)

  useEffect(() => {
    if (!scope.ready || !scope.id) return
    let alive = true
    api<Timing>('/pins/timing').then((r) => { if (alive) setT(r) }).catch(() => {})
    return () => { alive = false }
  }, [scope.ready, scope.id])

  if (!t) return <>Starts after your last scheduled pin, in the evening and afternoon hours Pinterest is typically busiest.</>
  if (t.source === 'personal') {
    const top = t.top_hours.slice(0, Math.max(1, Math.min(perDay ?? 3, 5))).map(hour).join(', ')
    return <>Using this account&apos;s own results: pins did best around {top} ({t.timezone}). Based on {t.sample} published pins, {t.confidence} confidence. Results vary a lot between pins, so treat this as a nudge.</>
  }
  return <>Using the evening and afternoon hours Pinterest is typically busiest ({t.timezone}). Once this account has about {t.needed} published pins with results ({t.sample} so far), GoPinKaro starts choosing hours from its own results.</>
}
