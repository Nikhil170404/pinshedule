import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { buildPinterestAuthUrl } from '@/lib/pinterest'

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  // "add" connects another Pinterest account to the workspace you are already signed in to (or renews one).
  const add = params.get('add') === '1'
  if (add) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} },
    })
    const { data } = await supabase.auth.getClaims()
    if (!data?.claims?.sub) return NextResponse.redirect(`${appUrl}/login?redirect=${encodeURIComponent('/dashboard/accounts')}`)
  }

  const state = crypto.randomUUID()
  // Only same-site relative paths, to prevent open redirects.
  const rawNext = params.get('next') ?? ''
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('\\') ? rawNext : '/dashboard'

  const response = NextResponse.redirect(buildPinterestAuthUrl(state))
  const cookie = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 600, path: '/' }
  response.cookies.set('pinterest_oauth_state', state, cookie)
  response.cookies.set('pinterest_oauth_next', next, cookie)
  response.cookies.set('pinterest_oauth_mode', add ? 'add' : 'login', cookie)
  return response
}
