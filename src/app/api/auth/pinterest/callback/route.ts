import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { encrypt } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  if (errorParam) {
    return NextResponse.redirect(`${appUrl}/login?error=access_denied`)
  }

  const storedState = request.cookies.get('pinterest_oauth_state')?.value
  const next = request.cookies.get('pinterest_oauth_next')?.value ?? '/dashboard'

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_state`)
  }

  // Build the response we'll write session cookies onto
  const response = NextResponse.redirect(`${appUrl}${next}`)
  response.cookies.delete('pinterest_oauth_state')
  response.cookies.delete('pinterest_oauth_next')

  // Service-role client (admin operations — user creation, magic link)
  const serviceClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    }
  )

  // Anon client — verifyOtp will write the session cookies onto `response`
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    }
  )

  try {
    // 1. Exchange Pinterest code for tokens
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
    if (!tokenRes.ok) throw new Error('Pinterest token exchange failed')
    const tokens = await tokenRes.json()

    // 2. Get Pinterest user profile
    const userRes = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!userRes.ok) throw new Error('Failed to fetch Pinterest user')
    const pinterestUser = await userRes.json()

    const pinterestId: string = pinterestUser.id
    const pinterestUsername: string = pinterestUser.username ?? pinterestId
    const pinterestAvatar: string | null = pinterestUser.profile_image ?? null

    // 3. Derive a stable internal email from the Pinterest user ID
    const internalEmail = `p_${pinterestId}@pin.pinshedule.internal`

    // 4. Create the Supabase user if they don't exist yet (idempotent)
    await serviceClient.auth.admin.createUser({
      email: internalEmail,
      email_confirm: true,
      user_metadata: { pinterest_id: pinterestId, pinterest_username: pinterestUsername, pinterest_avatar: pinterestAvatar },
    })
    // Ignore "already exists" error — it's expected on re-login

    // 5. Generate a single-use magic-link token to establish the session
    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email: internalEmail,
    })
    if (linkError || !linkData?.properties?.action_link) {
      throw new Error('Failed to generate auth link')
    }

    const userId: string = linkData.user.id

    // 6. Always refresh Pinterest metadata on the Supabase user
    await serviceClient.auth.admin.updateUserById(userId, {
      user_metadata: { pinterest_id: pinterestId, pinterest_username: pinterestUsername, pinterest_avatar: pinterestAvatar },
    })

    // 7. Exchange the magic-link token for a live session (writes cookies onto `response`)
    const actionUrl = new URL(linkData.properties.action_link)
    const tokenHash = actionUrl.searchParams.get('token')!
    const { error: otpError } = await anonClient.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
    if (otpError) throw new Error('OTP verification failed')

    // 8. Upsert user_profiles — insert on first login, ignore on re-login to preserve plan/settings
    await serviceClient.from('user_profiles').upsert(
      { id: userId, plan: 'free_trial', timezone: 'UTC', notifications_enabled: true },
      { onConflict: 'id', ignoreDuplicates: true }
    )

    // 9. Upsert pinterest_connections with fresh encrypted tokens
    const encryptedAccess = await encrypt(tokens.access_token, process.env.ENCRYPTION_SECRET!)
    const encryptedRefresh = await encrypt(tokens.refresh_token ?? '', process.env.ENCRYPTION_SECRET!)
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 86400) * 1000).toISOString()

    await serviceClient.from('pinterest_connections').upsert({
      user_id: userId,
      pinterest_user_id: pinterestId,
      pinterest_username: pinterestUsername,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
    }, { onConflict: 'user_id' })

    return response
  } catch (err) {
    console.error('Pinterest auth callback error:', err)
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`)
  }
}
