import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Best posting hours in UTC (roughly 2pm ET / 11am PT / 8pm GMT)
// Tue–Fri: 14:00 and 20:00 UTC
// Sat–Sun: 13:00 and 19:00 UTC
// Mon: 15:00 and 21:00 UTC
const BEST_HOURS_BY_DOW: Record<number, number[]> = {
  0: [13, 19], // Sun
  1: [15, 21], // Mon
  2: [14, 20], // Tue
  3: [14, 20], // Wed
  4: [14, 20], // Thu
  5: [14, 20], // Fri
  6: [13, 19], // Sat
}

const MIN_GAP_MS = 2 * 60 * 60 * 1000 // 2 hours minimum between pins

function nextBestSlot(after: Date): Date {
  let candidate = new Date(after.getTime() + MIN_GAP_MS)

  // Try up to 14 days to find a best-time slot
  for (let i = 0; i < 14 * 24; i++) {
    const dow = candidate.getUTCDay()
    const hour = candidate.getUTCHours()
    const bestHours = BEST_HOURS_BY_DOW[dow]

    // Check if we're already in a good hour window (within same hour)
    if (bestHours.includes(hour)) return candidate

    // Advance to the next best hour
    const nextHour = bestHours.find((h) => h > hour) ?? bestHours[0]
    if (nextHour > hour) {
      candidate = new Date(Date.UTC(
        candidate.getUTCFullYear(),
        candidate.getUTCMonth(),
        candidate.getUTCDate(),
        nextHour,
        0, 0, 0
      ))
    } else {
      // Next best hour is tomorrow
      const tomorrow = new Date(candidate)
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      const nextDow = tomorrow.getUTCDay()
      const tomorrowBest = BEST_HOURS_BY_DOW[nextDow]
      candidate = new Date(Date.UTC(
        tomorrow.getUTCFullYear(),
        tomorrow.getUTCMonth(),
        tomorrow.getUTCDate(),
        tomorrowBest[0],
        0, 0, 0
      ))
    }

    // Ensure the gap is still respected
    if (candidate.getTime() - after.getTime() >= MIN_GAP_MS) return candidate
  }

  return candidate
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const count = Math.min(parseInt(request.nextUrl.searchParams.get('count') ?? '1', 10), 50)

  // Find the latest scheduled pending pin for this user
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
