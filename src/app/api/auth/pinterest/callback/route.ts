import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { encrypt } from '@/lib/utils'

// Derive a deterministic, HMAC-keyed password from the Pinterest user ID.
// Never stored anywhere — re-derived from the server secret on every login.
async function deriveUserPassword(pinterestId: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode((process.env.ENCRYPTION_SECRET ?? '').padEnd(32, '0').slice(0, 32)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`pinshedule:${pinterestId}`))
  return Buffer.from(sig).toString('base64url')
}

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

  // The response we'll write session cookies onto before returning
  const response = NextResponse.redirect(`${appUrl}${next}`)
  response.cookies.delete('pinterest_oauth_state')
  response.cookies.delete('pinterest_oauth_next')

  // Cookie helpers — read from request, write to our response
  const cookieOpts = {
    getAll: () => request.cookies.getAll(),
    setAll: (cs: { name: string; value: string; options?: Record<string, unknown> }[]) =>
      cs.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
      ),
  }

  const serviceClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: cookieOpts }
  )

  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieOpts }
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
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      console.error('Pinterest token exchange failed:', tokenRes.status, errBody)
      throw new Error('Pinterest token exchange failed')
    }
    const tokens = await tokenRes.json()

    // 2. Get Pinterest user profile
    const userRes = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!userRes.ok) throw new Error('Failed to fetch Pinterest user profile')
    const pinterestUser = await userRes.json()

    const pinterestId: string = pinterestUser.id
    const pinterestUsername: string = pinterestUser.username ?? pinterestId
    const pinterestAvatar: string | null = pinterestUser.profile_image ?? null

    // 3. Derive stable internal identity
    const internalEmail = `p_${pinterestId}@pin.pinshedule.internal`
    const password = await deriveUserPassword(pinterestId)

    // 4. Create Supabase user (idempotent — ignore "already registered" error)
    const { error: createErr } = await serviceClient.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        pinterest_id: pinterestId,
        pinterest_username: pinterestUsername,
        pinterest_avatar: pinterestAvatar,
      },
    })
    if (createErr && !createErr.message.toLowerCase().includes('already')) {
      console.error('createUser error:', createErr.message)
      throw createErr
    }

    // 5. Sign in — this writes the session cookies onto `response` and gives us the user ID
    const { data: sessionData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: internalEmail,
      password,
    })
    if (signInErr || !sessionData?.user) {
      console.error('signInWithPassword error:', signInErr?.message)
      throw signInErr ?? new Error('Sign-in returned no user')
    }

    const userId = sessionData.user.id

    // 6. Refresh Pinterest metadata (keeps avatar/username current on re-login)
    await serviceClient.auth.admin.updateUserById(userId, {
      user_metadata: {
        pinterest_id: pinterestId,
        pinterest_username: pinterestUsername,
        pinterest_avatar: pinterestAvatar,
      },
    })

    // 7. Upsert user_profiles — sets free_trial only on first login
    await serviceClient.from('user_profiles').upsert(
      { id: userId, plan: 'free_trial', timezone: 'UTC', notifications_enabled: true },
      { onConflict: 'id', ignoreDuplicates: true }
    )

    // 8. Upsert pinterest_connections with fresh encrypted tokens
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
