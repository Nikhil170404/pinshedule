import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { PLANS } from '@/types'
import type { Plan } from '@/types'

const ALLOWED_IMAGE_ORIGINS = [
  process.env.NEXT_PUBLIC_SUPABASE_URL,          // our own Supabase Storage
  'https://i.pinimg.com',                         // Pinterest CDN (for reconnect flows)
].filter(Boolean) as string[]

function isAllowedImageUrl(url: string): boolean {
  if (!url) return false
  // Allow any https:// image URL (Pinterest API will fetch it; we don't server-side fetch it)
  // Block data: URIs and javascript: to prevent XSS via stored content
  if (/^(data:|javascript:|vbscript:)/i.test(url)) return false
  return /^https?:\/\//.test(url)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit('default', user.id)
  if (!success) return rateLimitResponse()

  // Parse body — accepts a single pin object OR an array (bulk from import page)
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const pins: unknown[] = Array.isArray(body) ? body : [body]

  if (pins.length === 0) return NextResponse.json({ error: 'No pins provided' }, { status: 400 })
  if (pins.length > 12) return NextResponse.json({ error: 'Max 12 pins per request' }, { status: 400 })

  // --- Plan limits ---
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  const plan = (profile?.plan ?? 'free_trial') as Plan
  const planDetails = PLANS[plan]
  const monthLimit = planDetails.pins_per_month

  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
  const { count: monthlyCount, error: countErr } = await supabase
    .from('scheduled_pins')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('scheduled_at', monthStart)
    .in('status', ['pending', 'published', 'processing'])

  if (countErr) return NextResponse.json({ error: 'Could not verify plan limits' }, { status: 500 })

  const used = monthlyCount ?? 0
  const remaining = Math.max(0, monthLimit - used)

  if (pins.length > remaining) {
    return NextResponse.json({
      error: `Monthly pin limit reached. ${planDetails.name} plan: ${monthLimit}/mo, ${remaining} remaining this month.`,
      remaining,
      limit: monthLimit,
      upgrade_required: plan === 'free_trial' || plan === 'starter',
    }, { status: 403 })
  }

  // --- Validate and sanitize each pin ---
  const now = Date.now()
  const rows: Record<string, unknown>[] = []

  for (const item of pins) {
    const p = item as Record<string, unknown>

    const imageUrl = String(p.image_url ?? '').trim()
    if (!imageUrl || !isAllowedImageUrl(imageUrl)) {
      return NextResponse.json({ error: 'image_url is required and must be a valid https URL' }, { status: 400 })
    }

    const boardId = String(p.board_id ?? '').trim()
    if (!boardId) return NextResponse.json({ error: 'board_id is required' }, { status: 400 })

    const rawScheduledAt = String(p.scheduled_at ?? '')
    const scheduledAt = new Date(rawScheduledAt)
    if (isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: 'scheduled_at must be a valid ISO date' }, { status: 400 })
    }
    // Allow up to 1 minute in the past (clock skew)
    if (scheduledAt.getTime() < now - 60_000) {
      return NextResponse.json({ error: 'scheduled_at must be in the future' }, { status: 400 })
    }

    const destUrl = String(p.destination_url ?? '').trim()
    if (destUrl && !/^https?:\/\//.test(destUrl)) {
      return NextResponse.json({ error: 'destination_url must be a valid http/https URL' }, { status: 400 })
    }

    rows.push({
      user_id: user.id,
      image_url: imageUrl,
      title: String(p.title ?? '').trim().slice(0, 100),
      description: String(p.description ?? '').trim().slice(0, 500),
      board_id: boardId,
      board_name: String(p.board_name ?? '').trim().slice(0, 100) || null,
      destination_url: destUrl || null,
      scheduled_at: scheduledAt.toISOString(),
      status: 'pending',
    })
  }

  const { data, error } = await supabase.from('scheduled_pins').insert(rows).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ created: data?.length ?? rows.length, remaining: remaining - rows.length })
}
