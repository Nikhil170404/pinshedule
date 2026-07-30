'use client'

import { useState, useEffect } from 'react'

const BASE: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}

function format(iso: string, opts?: Intl.DateTimeFormatOptions, tz?: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      ...BASE,
      ...opts,
      ...(tz ? { timeZone: tz } : {}),
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

/**
 * Renders a timestamp in the user's LOCAL timezone.
 *
 * Why this exists: Vercel servers run in UTC. Server components (pins page,
 * dashboard) that call Intl.DateTimeFormat without a timeZone option get UTC
 * results. A user in IST (UTC+5:30) who schedules 2:57 PM sees "9:27 AM"
 * because 14:57 IST = 09:27 UTC.
 *
 * Fix:
 *  - useState initializer uses timeZone:'UTC' so server and client produce
 *    the same initial string → no React hydration mismatch.
 *  - useEffect runs only in the browser after hydration and re-formats using
 *    the browser's real local timezone → shows the correct local time.
 *
 * Note: suppressHydrationWarning only suppresses the warning in React 19;
 * it does NOT re-render to the client value. That is why we use useEffect here.
 */
export function ClientTime({
  iso,
  options,
  className,
}: {
  iso: string
  options?: Intl.DateTimeFormatOptions
  className?: string
}) {
  // Both server and client start with UTC → identical initial render → no mismatch
  const [text, setText] = useState(() => format(iso, options, 'UTC'))

  useEffect(() => {
    // Now in the browser: re-format with the real local timezone
    setText(format(iso, options))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]) // options is always a static literal at each call site

  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  )
}
