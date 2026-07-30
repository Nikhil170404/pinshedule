import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPinterestBoards } from '@/lib/pinterest'
import { decrypt } from '@/lib/utils'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit('pinterest', user.id)
  if (!success) return rateLimitResponse()

  const { data: connection } = await supabase
    .from('pinterest_connections')
    .select('access_token')
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

  const boards = await getPinterestBoards(accessToken)

  return NextResponse.json({ boards })
}
