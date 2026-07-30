'use client'

/**
 * Renders a timestamp in the **browser's local timezone**.
 *
 * Server components (pins, dashboard) run on Vercel which is UTC, so using
 * Intl.DateTimeFormat or .toLocaleString() there shows the wrong hour for
 * users in non-UTC timezones (e.g. IST = UTC+5:30, so 14:57 IST stored as
 * 09:27 UTC shows as "9:27 AM" instead of "2:57 PM").
 *
 * By marking this component 'use client', the format call runs in the browser
 * with the real local timezone. suppressHydrationWarning lets React silently
 * update from the server-rendered UTC string to the client-rendered local string
 * on hydration without throwing a mismatch warning.
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
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        ...options,
      }).format(new Date(iso))}
    </time>
  )
}
