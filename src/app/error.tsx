'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/button-styles'

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-4 text-center outline-none">
      <p className="text-sm font-semibold text-brand">Something went wrong</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">This page hit a problem</h1>
      <p className="mt-3 text-stone-600">Your pins and settings are safe. Try again, or go back to the start.</p>
      {error.digest && <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={reset}>Try again</Button>
        <Link href="/" className={buttonStyles('outline', 'lg')}>Go to the home page</Link>
      </div>
    </main>
  )
}
