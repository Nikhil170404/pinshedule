import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPinterestTrendingKeywords } from '@/lib/pinterest'
import { decrypt } from '@/lib/utils'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { cacheGet, cacheSet } from '@/lib/redis'

const CACHE_TTL = 60 * 60 // 1 hour — keywords change slowly

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit('pinterest', user.id)
  if (!success) return rateLimitResponse()

  const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase()
  if (!q) return NextResponse.json({ error: 'q is required' }, { status: 400 })

  const cacheKey = `kw:${q}`
  const cached = await cacheGet<unknown[]>(cacheKey)
  if (cached) return NextResponse.json({ keywords: cached })

  const { data: connection } = await supabase
    .from('pinterest_connections')
    .select('access_token')
    .eq('user_id', user.id)
    .single()

  if (!connection) return NextResponse.json({ error: 'Pinterest not connected' }, { status: 400 })

  let accessToken: string
  try {
    accessToken = await decrypt(connection.access_token, process.env.ENCRYPTION_SECRET!)
  } catch {
    await supabase.from('pinterest_connections').delete().eq('user_id', user.id)
    return NextResponse.json({ error: 'Pinterest connection expired, please reconnect' }, { status: 400 })
  }

  const keywords = await getPinterestTrendingKeywords(accessToken, q)

  await cacheSet(cacheKey, keywords, CACHE_TTL)

  return NextResponse.json({ keywords })
}
