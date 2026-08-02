import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { encrypt } from '@/lib/utils'

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

  const response = NextResponse.redirect(`${appUrl}${next}`)
  response.cookies.delete('pinterest_oauth_state')
  response.cookies.delete('pinterest_oauth_next')

  const cookieOpts = {
    getAll: () => request.cookies.getAll(),
    setAll: (cs: { name: string; value: string; options?: Record<string, unknown> }[]) =>
      cs.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
      ),
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const anonClient = createServerClient(supabaseUrl, anonKey, { cookies: cookieOpts })
  const serviceClient = serviceKey
    ? createServerClient(supabaseUrl, serviceKey, { cookies: cookieOpts })
    : null

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

    // 4. Try sign in first — works immediately for returning users
    let signInResult = await anonClient.auth.signInWithPassword({ email: internalEmail, password })

    // 5. New user: create account, then sign in
    if (signInResult.error || !signInResult.data?.user) {
      const userMeta = {
        pinterest_id: pinterestId,
        pinterest_username: pinterestUsername,
        pinterest_avatar: pinterestAvatar,
      }

      if (serviceClient) {
        // Preferred: admin API confirms the email automatically
        const { error: createErr } = await serviceClient.auth.admin.createUser({
          email: internalEmail,
          password,
          email_confirm: true,
          user_metadata: userMeta,
        })
        if (createErr) {
          const msg = createErr.message.toLowerCase()
          // Treat "already exists" variants as success (idempotent)
          if (!msg.includes('already') && !msg.includes('email_exists') && !msg.includes('registered')) {
            console.error('createUser error:', createErr.message)
            throw createErr
          }
        }
      } else {
        // Fallback: requires "Email Confirmations" disabled in Supabase Auth settings
        console.warn('SUPABASE_SERVICE_ROLE_KEY not set — falling back to signUp; ensure email confirmation is disabled in Supabase')
        const { error: signUpErr } = await anonClient.auth.signUp({
          email: internalEmail,
          password,
          options: { data: userMeta },
        })
        if (signUpErr) {
          const msg = signUpErr.message.toLowerCase()
          if (!msg.includes('already') && !msg.includes('email_exists') && !msg.includes('registered')) {
            console.error('signUp error:', signUpErr.message)
            throw signUpErr
          }
        }
      }

      // Sign in after creation
      signInResult = await anonClient.auth.signInWithPassword({ email: internalEmail, password })
      if (signInResult.error || !signInResult.data?.user) {
        console.error('signInWithPassword failed after user creation:', signInResult.error?.message)
        throw signInResult.error ?? new Error('Sign-in failed after user creation')
      }
    }

    // Auth succeeded — session cookies are now set on `response`
    const userId = signInResult.data.user.id

    // 6. Enrichment (profile, tokens) — failures are logged but never block the redirect
    const enrich = async () => {
      if (!serviceClient) {
        console.warn('Skipping enrichment: SUPABASE_SERVICE_ROLE_KEY not set')
        return
      }

      await serviceClient.auth.admin.updateUserById(userId, {
        user_metadata: {
          pinterest_id: pinterestId,
          pinterest_username: pinterestUsername,
          pinterest_avatar: pinterestAvatar,
        },
      })

      await serviceClient
        .from('user_profiles')
        .upsert(
          { id: userId, plan: 'free_trial', timezone: 'UTC', notifications_enabled: true },
          { onConflict: 'id', ignoreDuplicates: true }
        )

      const encSecret = process.env.ENCRYPTION_SECRET
      if (!encSecret) {
        console.warn('ENCRYPTION_SECRET not set — Pinterest tokens not stored')
        return
      }

      const encryptedAccess = await encrypt(tokens.access_token, encSecret)
      const encryptedRefresh = await encrypt(tokens.refresh_token ?? '', encSecret)
      const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 86400) * 1000).toISOString()

      await serviceClient.from('pinterest_connections').upsert({
        user_id: userId,
        pinterest_user_id: pinterestId,
        pinterest_username: pinterestUsername,
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        expires_at: expiresAt,
      }, { onConflict: 'user_id' })
    }

    await enrich().catch(err => console.error('Enrichment error (non-fatal):', err))

    return response

  } catch (err) {
    console.error('Pinterest auth callback error:', err)
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`)
  }
}
