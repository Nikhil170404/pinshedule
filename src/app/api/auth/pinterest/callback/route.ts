import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = request.cookies.get('pinterest_oauth_state')?.value

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=pinterest_auth_failed`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${appUrl}/login`)

  try {
    // Exchange code for tokens
    const credentials = Buffer.from(
      `${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`
    ).toString('base64')

    const tokenRes = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${appUrl}/api/auth/pinterest/callback`,
      }),
    })

    if (!tokenRes.ok) throw new Error('Token exchange failed')
    const tokens = await tokenRes.json()

    // Get Pinterest user info
    const userRes = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const pinterestUser = await userRes.json()

    const encryptedAccess = await encrypt(tokens.access_token, process.env.ENCRYPTION_SECRET!)
    const encryptedRefresh = await encrypt(tokens.refresh_token ?? '', process.env.ENCRYPTION_SECRET!)

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 86400) * 1000).toISOString()

    await supabase.from('pinterest_connections').upsert({
      user_id: user.id,
      pinterest_user_id: pinterestUser.id,
      pinterest_username: pinterestUser.username ?? pinterestUser.id,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
    }, { onConflict: 'user_id' })

    const response = NextResponse.redirect(`${appUrl}/dashboard?connected=pinterest`)
    response.cookies.delete('pinterest_oauth_state')
    return response
  } catch (err) {
    console.error('Pinterest callback error:', err)
    return NextResponse.redirect(`${appUrl}/dashboard?error=pinterest_connect_failed`)
  }
}
