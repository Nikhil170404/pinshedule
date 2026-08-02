import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const BEST_HOURS_BY_DOW: Record<number, number[]> = {
  0: [13, 19], // Sun
  1: [15, 21], // Mon
  2: [14, 20], // Tue
  3: [14, 20], // Wed
  4: [14, 20], // Thu
  5: [14, 20], // Fri
  6: [13, 19], // Sat
}

const MIN_GAP_MS = 2 * 60 * 60 * 1000

function nextBestSlot(after: Date): Date {
  let candidate = new Date(after.getTime() + MIN_GAP_MS)

  for (let i = 0; i < 14 * 24; i++) {
    const dow = candidate.getUTCDay()
    const hour = candidate.getUTCHours()
    const bestHours = BEST_HOURS_BY_DOW[dow]

    if (bestHours.includes(hour)) return candidate

    const nextHour = bestHours.find((h) => h > hour) ?? bestHours[0]
    if (nextHour > hour) {
      candidate = new Date(Date.UTC(
        candidate.getUTCFullYear(),
        candidate.getUTCMonth(),
        candidate.getUTCDate(),
        nextHour, 0, 0, 0
      ))
    } else {
      const tomorrow = new Date(candidate)
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      const nextDow = tomorrow.getUTCDay()
      candidate = new Date(Date.UTC(
        tomorrow.getUTCFullYear(),
        tomorrow.getUTCMonth(),
        tomorrow.getUTCDate(),
        BEST_HOURS_BY_DOW[nextDow][0], 0, 0, 0
      ))
    }

    if (candidate.getTime() - after.getTime() >= MIN_GAP_MS) return candidate
  }

  return candidate
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit('default', user.id)
  if (!success) return rateLimitResponse()

  const count = Math.min(Math.max(1, parseInt(request.nextUrl.searchParams.get('count') ?? '1', 10)), 50)

  const { data: lastPin } = await supabase
    .from('scheduled_pins')
    .select('scheduled_at')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .single()

  const baseline = lastPin?.scheduled_at ? new Date(lastPin.scheduled_at) : new Date()
  const slots: string[] = []
  let cursor = baseline

  for (let i = 0; i < count; i++) {
    const slot = nextBestSlot(cursor)
    slots.push(slot.toISOString())
    cursor = slot
  }

  return NextResponse.json({ slots })
}
