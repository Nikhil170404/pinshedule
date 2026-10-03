'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { examplePins } from '@/components/landing/example-pins'

const PinterestMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
  </svg>
)

const ERRORS: Record<string, string> = {
  access_denied: 'Pinterest access was not granted. Please try again and accept the permissions.',
  invalid_state: 'Your sign-in session expired. Please try again.',
  auth_failed: 'We could not complete sign-in. Please try again.',
}

function LoginCard() {
  const params = useSearchParams()
  const err = params.get('error')
  const redirect = params.get('redirect')
  const href = redirect ? `/api/auth/pinterest?next=${encodeURIComponent(redirect)}` : '/api/auth/pinterest'
  return (
    <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-ink">Sign in to GoPinKaro</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">Your Pinterest account is your GoPinKaro account. New here? Signing in creates your free workspace.</p>
      {err && (
        <div className="mt-5 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />{ERRORS[err] ?? 'Something went wrong. Please try again.'}
        </div>
      )}
      <a href={href} className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-brand text-[15px] font-medium text-white transition-colors hover:bg-brand-dark">
        <PinterestMark />Continue with Pinterest
      </a>
      <p className="mt-5 text-xs leading-relaxed text-muted">
        We request permission to read your boards and create pins. We never post without a schedule you set. By continuing you agree to the{' '}
        <Link href="/terms" className="underline hover:text-ink">Terms</Link> and <Link href="/privacy" className="underline hover:text-ink">Privacy Policy</Link>.
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="grid w-full max-w-sm items-center gap-12 lg:max-w-4xl lg:grid-cols-2">
        <div>
          <div className="mb-6 flex justify-center"><Logo /></div>
          <Suspense fallback={<div className="h-64 rounded-2xl border border-line bg-white" />}><LoginCard /></Suspense>
        </div>
        <div className="hidden lg:block" aria-hidden>
          <div className="grid grid-cols-3 gap-3">
            {examplePins.map((p) => (
              <Image key={p.src} src={p.src} alt="" width={300} height={450} className="h-auto w-full rounded-xl border border-line" />
            ))}
          </div>
          <p className="mt-4 text-center text-sm text-muted">Plan a week of pins in one sitting. Example pins shown.</p>
        </div>
      </div>
    </div>
  )
}
