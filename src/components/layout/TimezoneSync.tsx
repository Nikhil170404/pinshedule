'use client'

import { useEffect } from 'react'
import { api } from '@/lib/api'
import { refreshSummary, useSummary } from '@/lib/hooks'

/** First visit: adopt the browser's timezone so "best time" slots land in the user's evenings. */
export function TimezoneSync() {
  const { summary } = useSummary()
  useEffect(() => {
    if (!summary || summary.timezone !== 'UTC') return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!tz || tz === 'UTC' || sessionStorage.getItem('tz-synced')) return
    sessionStorage.setItem('tz-synced', '1')
    api('/account/settings', { method: 'PATCH', body: { timezone: tz } }).then(() => refreshSummary()).catch(() => {})
  }, [summary])
  return null
}
