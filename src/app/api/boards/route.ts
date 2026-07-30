import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPinterestBoards, refreshPinterestToken } from '@/lib/pinterest'
import { decrypt, encrypt } from '@/lib/utils'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit('pinterest', user.id)
  if (!success) return rateLimitResponse()

  const { data: connection } = await supabase
    .from('pinterest_connections')
    .select('id, access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .single()

  if (!connection) return NextResponse.json({ boards: [], error: 'Pinterest not connected' })

  let accessToken: string
  try {
    accessToken = await decrypt(connection.access_token, process.env.ENCRYPTION_SECRET!)
  } catch {
    await supabase.from('pinterest_connections').delete().eq('user_id', user.id)
    return NextResponse.json({ boards: [], error: 'Pinterest connection expired, please reconnect' })
  }

  // Refresh token inline if expired or expiring within 5 minutes
  if (new Date(connection.expires_at) <= new Date(Date.now() + 5 * 60 * 1000)) {
    try {
      const refreshToken = await decrypt(connection.refresh_token, process.env.ENCRYPTION_SECRET!)
      const tokens = await refreshPinterestToken(refreshToken)
      accessToken = tokens.access_token

      const encAccess = await encrypt(tokens.access_token, process.env.ENCRYPTION_SECRET!)
      const encRefresh = tokens.refresh_token
        ? await encrypt(tokens.refresh_token, process.env.ENCRYPTION_SECRET!)
        : connection.refresh_token

      await supabase.from('pinterest_connections').update({
        access_token: encAccess,
        refresh_token: encRefresh,
        expires_at: new Date(Date.now() + (tokens.expires_in ?? 86400) * 1000).toISOString(),
      }).eq('id', connection.id)
    } catch {
      // Token refresh failed — try with existing token anyway; Pinterest will 401 if truly expired
    }
  }

  try {
    const boards = await getPinterestBoards(accessToken)
    return NextResponse.json({ boards })
  } catch {
    return NextResponse.json({ boards: [], error: 'Failed to fetch boards — try reconnecting Pinterest' })
  }
}
