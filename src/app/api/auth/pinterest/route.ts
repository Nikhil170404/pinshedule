import { NextRequest, NextResponse } from 'next/server'
import { buildPinterestAuthUrl } from '@/lib/pinterest'

export async function GET(request: NextRequest) {
  const state = crypto.randomUUID()
  // Only same-site relative paths, to prevent open redirects.
  const rawNext = new URL(request.url).searchParams.get('next') ?? ''
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('\\') ? rawNext : '/dashboard'

  // mode=add connects another Pinterest account to the signed-in user instead of logging in.
  const mode = new URL(request.url).searchParams.get('mode') === 'add' ? 'add' : 'login'

  const response = NextResponse.redirect(buildPinterestAuthUrl(state))
  const cookie = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 600, path: '/' }
  response.cookies.set('pinterest_oauth_state', state, cookie)
  response.cookies.set('pinterest_oauth_next', next, cookie)
  response.cookies.set('pinterest_oauth_mode', mode, cookie)
  return response
}
