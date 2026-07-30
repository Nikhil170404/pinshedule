import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createPin } from '@/lib/pinterest'
import { decrypt } from '@/lib/utils'

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
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', pin.user_id)
        .single()

      if (!conn) throw new Error('No Pinterest connection')

      const accessToken = await decrypt(conn.access_token, process.env.ENCRYPTION_SECRET!)

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
      const msg = err instanceof Error ? err.message : 'Unknown error'
      await supabase
        .from('scheduled_pins')
        .update({ status: 'failed', error_message: msg })
        .eq('id', pin.id)
      failed++
    }
  }

  return NextResponse.json({ published, failed })
}
