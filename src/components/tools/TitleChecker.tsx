'use client'

import { useMemo, useState } from 'react'
import { PIN_LIMITS } from '@shared/plans'
import { Input, Textarea } from '@/components/ui/Input'
import { checkPinText } from '@/lib/pin-checks'
import { CheckList } from './CheckList'

const counter = (n: number, max: number) => <span className={n > max ? 'font-medium text-red-600' : 'text-muted'}>{n} / {max}</span>

export function TitleChecker() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const checks = useMemo(() => (title || description ? checkPinText(title, description) : []), [title, description])
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-line bg-white p-5">
        <div>
          <Input label="Pin title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Small kitchen storage ideas that work" />
          <p className="mt-1 text-right text-xs">{counter(title.length, PIN_LIMITS.title)}</p>
        </div>
        <div>
          <Textarea label="Pin description" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Smart ways to organise a small kitchen without a remodel. Save this for your next weekend project. #kitchen #organising" />
          <p className="mt-1 text-right text-xs">{counter(description.length, PIN_LIMITS.description)}</p>
        </div>
        <p className="text-xs text-muted">Everything runs in your browser. Nothing you type is sent or stored.</p>
      </div>
      <div className="rounded-xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Result</h2>
        {checks.length === 0 ? <p className="text-sm text-muted">Type a title or description to see what to fix.</p> : <CheckList checks={checks} />}
      </div>
    </div>
  )
}
