import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { encrypt } from '@shared/crypto'
import { effectivePlan, PLANS } from '@shared/plans'
import { PINTEREST_API } from '@/lib/pinterest'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const adding = request.cookies.get('pinterest_oauth_mode')?.value === 'add'
  // Errors while adding an account return to the accounts page, not the login screen.
  const fail = (code: string) => NextResponse.redirect(`${appUrl}${adding ? '/dashboard/accounts' : '/login'}?error=${code}`)

  if (errorParam) return fail('access_denied')

  const storedState = request.cookies.get('pinterest_oauth_state')?.value
  const rawNext = request.cookies.get('pinterest_oauth_next')?.value ?? ''
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (!code || !state || state !== storedState) {
    return fail('invalid_state')
  }

  // Build the response we'll write session cookies onto
  const response = NextResponse.redirect(`${appUrl}${next}`)
  response.cookies.delete('pinterest_oauth_state')
  response.cookies.delete('pinterest_oauth_next')
  response.cookies.delete('pinterest_oauth_mode')

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

    const encryptedAccess = await encrypt(tokens.access_token, process.env.ENCRYPTION_SECRET!)
    const encryptedRefresh = await encrypt(tokens.refresh_token ?? '', process.env.ENCRYPTION_SECRET!)
    const tokenFields = {
      pinterest_username: pinterestUsername,
      avatar_url: pinterestAvatar,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: new Date(Date.now() + (tokens.expires_in ?? 2_592_000) * 1000).toISOString(),
      refresh_expires_at: tokens.refresh_token_expires_in
        ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString()
        : null,
      scope: tokens.scope ?? null,
      status: 'active',
      last_error: null,
      updated_at: new Date().toISOString(),
    }

    // Connection rows are matched per login: the same Pinterest account can be a secondary account in another
    // person's workspace (an agency managing a client) without that changing who can sign in where.
    const saveConnection = async (userId: string) => {
      const { data: mine } = await serviceClient.from('pinterest_connections').select('id').eq('user_id', userId).eq('pinterest_user_id', pinterestId).maybeSingle()
      if (mine) {
        await serviceClient.from('pinterest_connections').update(tokenFields).eq('id', mine.id)
        return { id: mine.id as string, created: false }
      }
      const { count } = await serviceClient.from('pinterest_connections').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      const { data: created, error } = await serviceClient.from('pinterest_connections')
        .insert({ ...tokenFields, user_id: userId, pinterest_user_id: pinterestId, is_primary: (count ?? 0) === 0 }).select('id').single()
      if (error || !created) throw new Error('Could not save the Pinterest account')
      return { id: created.id as string, created: true }
    }

    // ── Adding (or renewing) an account in the workspace you are signed in to ──
    if (adding) {
      const { data: { user } } = await anonClient.auth.getUser()
      if (!user) return NextResponse.redirect(`${appUrl}/login?redirect=${encodeURIComponent('/dashboard/accounts')}`)

      const { data: here } = await serviceClient.from('pinterest_connections').select('id').eq('user_id', user.id).eq('pinterest_user_id', pinterestId).maybeSingle()
      if (!here) {
        const { data: profile } = await serviceClient.from('user_profiles').select('plan, plan_expires_at').eq('id', user.id).maybeSingle()
        const allowed = PLANS[effectivePlan(profile?.plan, profile?.plan_expires_at)].accounts
        const { count } = await serviceClient.from('pinterest_connections').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
        if ((count ?? 0) >= allowed) return fail('account_limit')
      }
      const saved = await saveConnection(user.id)
      return NextResponse.redirect(`${appUrl}/dashboard/accounts?connected=${saved.id}`)
    }

    // ── Signing in ──
    // Who you are is decided only by the Pinterest account that signs in: it maps to its own login, created on first use.
    const loginEmail = `p_${pinterestId}@pin.pinshedule.internal`
    await serviceClient.auth.admin.createUser({
      email: loginEmail,
      email_confirm: true,
      user_metadata: { pinterest_id: pinterestId, pinterest_username: pinterestUsername, pinterest_avatar: pinterestAvatar },
    }) // "already exists" is expected on re-login and ignored

    // Generate a single-use magic-link token to establish the session
    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({ type: 'magiclink', email: loginEmail })
    if (linkError || !linkData?.properties?.action_link) throw new Error('Failed to generate auth link')
    const userId: string = linkData.user.id

    await serviceClient.auth.admin.updateUserById(userId, {
      user_metadata: { pinterest_id: pinterestId, pinterest_username: pinterestUsername, pinterest_avatar: pinterestAvatar },
    })

    // Exchange the magic-link token for a live session (writes cookies onto `response`)
    const actionUrl = new URL(linkData.properties.action_link)
    const tokenHash = actionUrl.searchParams.get('token')!
    const { error: otpError } = await anonClient.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
    if (otpError) throw new Error('OTP verification failed')

    // Profile row: insert on first login, ignore on re-login to preserve plan/settings
    await serviceClient.from('user_profiles').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })
    await saveConnection(userId)

    return response
  } catch (err) {
    console.error('Pinterest auth callback error:', err)
    return fail('auth_failed')
  }
}
