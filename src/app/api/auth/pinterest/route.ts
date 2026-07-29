import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPinterestAuthUrl } from '@/lib/pinterest'
import { generateState } from '@/lib/utils'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = generateState()

  const response = NextResponse.redirect(buildPinterestAuthUrl(state))
  response.cookies.set('pinterest_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
