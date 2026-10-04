import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { encrypt } from '@shared/crypto'
import { PLANS, type Plan } from '@shared/plans'
import { PINTEREST_API } from '@/lib/pinterest'

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
  const rawNext = request.cookies.get('pinterest_oauth_next')?.value ?? ''
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_state`)
  }

  // Build the response we'll write session cookies onto
  const response = NextResponse.redirect(`${appUrl}${next}`)
  response.cookies.delete('pinterest_oauth_state')
  response.cookies.delete('pinterest_oauth_next')
  response.cookies.delete('pinterest_oauth_mode')
  // Reuse `response` so the cookie changes made above are kept while the destination differs.
  const redirectTo = (url: string) => { response.headers.set('Location', url); return response }
  const addMode = request.cookies.get('pinterest_oauth_mode')?.value === 'add'

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

    const tokenRes = await fetch(`${PINTEREST_API}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${appUrl}/api/auth/pinterest/callback`,
        continuous_refresh: 'true', // long-lived refresh tokens so users stay connected
      }),
    })
    if (!tokenRes.ok) throw new Error('Pinterest token exchange failed')
    const tokens = await tokenRes.json()

    // 2. Get Pinterest user profile
    const userRes = await fetch(`${PINTEREST_API}/user_account`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!userRes.ok) throw new Error('Failed to fetch Pinterest user')
    const pinterestUser = await userRes.json()

    const pinterestId: string = pinterestUser.id
    const pinterestUsername: string = pinterestUser.username ?? pinterestId
    const pinterestAvatar: string | null = pinterestUser.profile_image ?? null

    // Adding another account to the signed-in user: store its tokens, never log in as it.
    if (addMode) {
      const { data: { user } } = await anonClient.auth.getUser()
      if (!user) return redirectTo(`${appUrl}/login?error=auth_failed`)
      const settings = `${appUrl}/dashboard/settings`
      const { data: profile } = await serviceClient.from('user_profiles').select('plan').eq('id', user.id).maybeSingle()
      const allowed = PLANS[(profile?.plan as Plan) in PLANS ? (profile?.plan as Plan) : 'free_trial'].accounts
      const { data: existing } = await serviceClient.from('pinterest_connections').select('pinterest_user_id').eq('user_id', user.id)
      const already = (existing ?? []).some((c) => c.pinterest_user_id === pinterestId)
      if (!already && (existing?.length ?? 0) >= allowed) return NextResponse.redirect(`${settings}?account=limit`)
      await serviceClient.from('pinterest_connections').upsert({
        user_id: user.id,
        pinterest_user_id: pinterestId,
        pinterest_username: pinterestUsername,
        access_token: await encrypt(tokens.access_token, process.env.ENCRYPTION_SECRET!),
        refresh_token: await encrypt(tokens.refresh_token ?? '', process.env.ENCRYPTION_SECRET!),
        expires_at: new Date(Date.now() + (tokens.expires_in ?? 2_592_000) * 1000).toISOString(),
        refresh_expires_at: tokens.refresh_token_expires_in ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString() : null,
        scope: tokens.scope ?? null,
        status: 'active',
        last_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,pinterest_user_id' })
      return redirectTo(`${settings}?account=connected`)
    }

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
      { id: userId },
      { onConflict: 'id', ignoreDuplicates: true }
    )

    // 9. Upsert pinterest_connections with fresh encrypted tokens
    const encryptedAccess = await encrypt(tokens.access_token, process.env.ENCRYPTION_SECRET!)
    const encryptedRefresh = await encrypt(tokens.refresh_token ?? '', process.env.ENCRYPTION_SECRET!)
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 2_592_000) * 1000).toISOString()

    // The login account is the primary one; any other connected accounts stay secondary.
    await serviceClient.from('pinterest_connections').update({ is_primary: false }).eq('user_id', userId).neq('pinterest_user_id', pinterestId)
    await serviceClient.from('pinterest_connections').upsert({
      user_id: userId,
      is_primary: true,
      pinterest_user_id: pinterestId,
      pinterest_username: pinterestUsername,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
      refresh_expires_at: tokens.refresh_token_expires_in
        ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString()
        : null,
      scope: tokens.scope ?? null,
      status: 'active',
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,pinterest_user_id' })

    return response
  } catch (err) {
    console.error('Pinterest auth callback error:', err)
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`)
  }
}
