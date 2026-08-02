import { NextRequest, NextResponse } from 'next/server'
import { buildPinterestAuthUrl } from '@/lib/pinterest'
import { generateState } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const state = generateState()
  // Validate `next` is a relative path to prevent open-redirect attacks
  const rawNext = new URL(request.url).searchParams.get('next') ?? ''
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  const response = NextResponse.redirect(buildPinterestAuthUrl(state))
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
