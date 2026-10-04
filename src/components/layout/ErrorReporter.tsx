'use client'

import { useEffect } from 'react'
import { reportClientError } from '@/lib/report-error'

/** Reports uncaught browser errors and unhandled promise rejections. Renders nothing. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError(e.error ?? e.message)
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection) }
  }, [])
  return null
}
