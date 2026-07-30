import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createPin, refreshPinterestToken } from '@/lib/pinterest'
import { decrypt, encrypt } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()

  // Fetch all pending pins due now
  const { data: pins, error } = await supabase
    .from('scheduled_pins')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let published = 0
  let failed = 0

  for (const pin of pins ?? []) {
    try {
      const { data: conn } = await supabase
        .from('pinterest_connections')
        .select('id, access_token, refresh_token, expires_at')
        .eq('user_id', pin.user_id)
        .single()

      if (!conn) throw new Error('No Pinterest connection — reconnect Pinterest in Settings')

      let accessToken = await decrypt(conn.access_token, process.env.ENCRYPTION_SECRET!)

      // Refresh the token inline if it's expired or expiring within 5 minutes
      if (new Date(conn.expires_at) <= new Date(Date.now() + 5 * 60 * 1000)) {
        const refreshToken = await decrypt(conn.refresh_token, process.env.ENCRYPTION_SECRET!)
        const tokens = await refreshPinterestToken(refreshToken)
        accessToken = tokens.access_token

        const encAccess = await encrypt(tokens.access_token, process.env.ENCRYPTION_SECRET!)
        const encRefresh = tokens.refresh_token
          ? await encrypt(tokens.refresh_token, process.env.ENCRYPTION_SECRET!)
          : conn.refresh_token

        await supabase.from('pinterest_connections').update({
          access_token: encAccess,
          refresh_token: encRefresh,
          expires_at: new Date(Date.now() + (tokens.expires_in ?? 86400) * 1000).toISOString(),
        }).eq('id', conn.id)
      }

      await createPin(accessToken, {
        board_id: pin.board_id,
        title: pin.title,
        description: pin.description,
        image_url: pin.image_url,
        link: pin.destination_url,
      })

      await supabase
        .from('scheduled_pins')
        .update({ status: 'published' })
        .eq('id', pin.id)

      published++
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Unknown error'
      // Make Pinterest permission errors actionable for the user
      if (msg.includes('insufficient permissions') || msg.includes('boards:write') || msg.includes('pins:write')) {
        msg = 'Pinterest token is missing required permissions (boards:write, pins:write). Go to Settings → Reconnect Pinterest.'
      } else if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('invalid_token')) {
        msg = 'Pinterest token expired or revoked. Go to Settings → Reconnect Pinterest.'
      }
      await supabase
        .from('scheduled_pins')
        .update({ status: 'failed', error_message: msg })
        .eq('id', pin.id)
      failed++
    }
  }

  return NextResponse.json({ published, failed })
}
