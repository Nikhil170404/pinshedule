import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPinterestTrendingKeywords } from '@/lib/pinterest'
import { decrypt } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'q is required' }, { status: 400 })

  const { data: connection } = await supabase
    .from('pinterest_connections')
    .select('access_token')
    .eq('user_id', user.id)
    .single()

  if (!connection) return NextResponse.json({ error: 'Pinterest not connected' }, { status: 400 })

  const accessToken = await decrypt(connection.access_token, process.env.ENCRYPTION_SECRET!)
  const keywords = await getPinterestTrendingKeywords(accessToken, q)

  return NextResponse.json({ keywords })
}
