'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const PinterestIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
  </svg>
)

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Pinterest access was denied. Please try again.',
  invalid_state: 'Authentication session expired. Please try again.',
  auth_failed: 'Sign in failed. Please try again.',
}

function LoginContent() {
  const searchParams = useSearchParams()
  const errorKey = searchParams.get('error')
  const errorMsg = errorKey ? (ERROR_MESSAGES[errorKey] ?? 'Something went wrong. Please try again.') : null
  const redirect = searchParams.get('redirect')
  const authHref = redirect
    ? `/api/auth/pinterest?next=${encodeURIComponent(redirect)}`
    : '/api/auth/pinterest'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Sign in to Pinshedule</h1>
      <p className="text-sm text-gray-500 mb-8">
        Your Pinterest account <em>is</em> your Pinshedule account.<br />
        No email or password to remember.
      </p>

      {errorMsg && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <a
        href={authHref}
        className="flex items-center justify-center gap-3 w-full px-5 py-3 rounded-xl bg-[#E60023] text-white font-semibold text-sm hover:bg-[#c0001e] transition-colors shadow-sm"
      >
        <PinterestIcon />
        Continue with Pinterest
      </a>

      <p className="mt-6 text-xs text-gray-400">
        By signing in you agree to our{' '}
        <Link href="/terms" className="text-gray-600 hover:underline">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="text-gray-600 hover:underline">Privacy Policy</Link>.
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl bg-[#E60023] flex items-center justify-center shadow-sm">
            <PinterestIcon />
          </div>
          <span className="font-semibold text-gray-900 text-lg">Pinshedule</span>
        </Link>

        <Suspense fallback={<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 h-52 animate-pulse" />}>
          <LoginContent />
        </Suspense>
      </div>
    </div>
  )
}
