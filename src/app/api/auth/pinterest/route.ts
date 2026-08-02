import { NextRequest, NextResponse } from 'next/server'
import { buildPinterestAuthUrl } from '@/lib/pinterest'
import { generateState } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const state = generateState()
  const reqUrl = new URL(request.url)
  // Validate `next` is a relative path to prevent open-redirect attacks
  const rawNext = reqUrl.searchParams.get('next') ?? ''
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  // Fall back to request origin so auth works even if NEXT_PUBLIC_APP_URL is unset
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${reqUrl.protocol}//${reqUrl.host}`

  const response = NextResponse.redirect(buildPinterestAuthUrl(state, appUrl))
  response.cookies.set('pinterest_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  response.cookies.set('pinterest_oauth_next', next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
