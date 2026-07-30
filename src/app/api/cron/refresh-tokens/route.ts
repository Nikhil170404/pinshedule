import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { refreshPinterestToken } from '@/lib/pinterest'
import { encrypt, decrypt } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  // Refresh tokens expiring in the next 2 hours
  const soon = new Date(Date.now() + 2 * 3600 * 1000).toISOString()
  const { data: connections } = await supabase
    .from('pinterest_connections')
    .select('id, refresh_token')
    .lte('expires_at', soon)

  let refreshed = 0
  let errored = 0

  for (const conn of connections ?? []) {
    try {
      const refreshToken = await decrypt(conn.refresh_token, process.env.ENCRYPTION_SECRET!)
      const tokens = await refreshPinterestToken(refreshToken)

      const encAccess = await encrypt(tokens.access_token, process.env.ENCRYPTION_SECRET!)
      const encRefresh = tokens.refresh_token
        ? await encrypt(tokens.refresh_token, process.env.ENCRYPTION_SECRET!)
        : conn.refresh_token

      await supabase.from('pinterest_connections').update({
        access_token: encAccess,
        refresh_token: encRefresh,
        expires_at: new Date(Date.now() + (tokens.expires_in ?? 86400) * 1000).toISOString(),
      }).eq('id', conn.id)

      refreshed++
    } catch {
      errored++
    }
  }

  return NextResponse.json({ refreshed, errored })
}
