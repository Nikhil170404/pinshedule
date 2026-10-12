'use client'

import { useState } from 'react'
import { DAILY_PIN_SOFT_MAX } from '@shared/pace'

const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0))

export function PinScheduleCalculator() {
  const [pins, setPins] = useState('120')
  const [days, setDays] = useState('30')
  const p = num(pins)
  const d = num(days)
  const per = d > 0 ? p / d : 0
  const minDays = Math.ceil(p / DAILY_PIN_SOFT_MAX)
  const field = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none'
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="p" className="text-sm font-medium text-ink">Pins to schedule</label><input id="p" inputMode="numeric" value={pins} onChange={(e) => setPins(e.target.value)} className={field} /></div>
        <div><label htmlFor="d" className="text-sm font-medium text-ink">Spread over (days)</label><input id="d" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className={field} /></div>
      </div>
      {p > 0 && d > 0 && (
        <div className="rounded-xl border border-line bg-white p-5" aria-live="polite">
          <p className="text-3xl font-bold text-ink">{per.toFixed(1)} <span className="text-base font-medium text-muted">pins a day</span></p>
          <p className="mt-2 text-sm text-stone-700">
            {per > DAILY_PIN_SOFT_MAX
              ? `That is above the ${DAILY_PIN_SOFT_MAX} a day that guides commonly suggest as a ceiling. Stretch it to at least ${minDays} days.`
              : per >= 5
                ? 'That sits inside the 5 to 15 pins a day range guides commonly suggest.'
                : 'That is a gentle pace. It is fine for steady, consistent posting.'}
          </p>
          <p className="mt-2 text-xs text-muted">Pinterest publishes no official daily limit. This range is common advice, not a rule.</p>
        </div>
      )}
    </div>
  )
}
