import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createPin } from '@/lib/pinterest'
import { decrypt } from '@/lib/utils'

// Monthly pin limits per plan (matching types/index.ts PLANS)
const PLAN_PIN_LIMITS: Record<string, number> = {
  free_trial: 100,
  starter: 1500,
  pro: 10000,
  growth: 50000,
}

function parseAttempt(errorMessage: string | null | undefined): number {
  if (!errorMessage) return 0
  const m = errorMessage.match(/^\[attempt:(\d+)\]/)
  return m ? parseInt(m[1], 10) : 0
}

function isTransientError(msg: string): boolean {
  const lower = msg.toLowerCase()
  return (
    lower.includes('fetch') ||
    lower.includes('timeout') ||
    lower.includes('network') ||
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503')
  )
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const now = new Date().toISOString()

  // Atomically claim pending pins — single UPDATE ... RETURNING prevents double-publish
  // if two cron invocations overlap (Vercel occasionally runs crons concurrently).
  const { data: claimed, error: claimErr } = await supabase
    .from('scheduled_pins')
    .update({ status: 'processing' })
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .select()

  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 })
  if (!claimed || claimed.length === 0) return NextResponse.json({ published: 0, failed: 0, retried: 0 })

  // Fetch plan limits for every distinct user in the batch
  const userIds = [...new Set(claimed.map((p) => p.user_id as string))]
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, plan')
    .in('id', userIds)

  const planByUser = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.plan as string]))

  // Count published pins this month per user
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: monthlyCounts } = await supabase
    .from('scheduled_pins')
    .select('user_id')
    .in('user_id', userIds)
    .eq('status', 'published')
    .gte('scheduled_at', monthStart)

  const publishedThisMonth: Record<string, number> = {}
  for (const row of monthlyCounts ?? []) {
    publishedThisMonth[row.user_id] = (publishedThisMonth[row.user_id] ?? 0) + 1
  }

  // Batch-fetch Pinterest connections for all users
  const { data: connections } = await supabase
    .from('pinterest_connections')
    .select('user_id, access_token')
    .in('user_id', userIds)

  const connByUser = Object.fromEntries(
    (connections ?? []).map((c) => [c.user_id, c.access_token])
  )

  let published = 0
  let failed = 0
  let retried = 0
  let skipped = 0

  for (const pin of claimed) {
    const plan = planByUser[pin.user_id] ?? 'free_trial'
    const limit = PLAN_PIN_LIMITS[plan] ?? 100
    const count = publishedThisMonth[pin.user_id] ?? 0

    // Over monthly limit — put back to pending, scheduled for next month
    if (count >= limit) {
      const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
      await supabase
        .from('scheduled_pins')
        .update({ status: 'pending', scheduled_at: nextMonth.toISOString(), error_message: 'Monthly pin limit reached — rescheduled to next month' })
        .eq('id', pin.id)
      skipped++
      continue
    }

    const encToken = connByUser[pin.user_id]
    if (!encToken) {
      await supabase
        .from('scheduled_pins')
        .update({ status: 'failed', error_message: 'No Pinterest connection' })
        .eq('id', pin.id)
      failed++
      continue
    }

    try {
      const accessToken = await decrypt(encToken, process.env.ENCRYPTION_SECRET!)

      await createPin(accessToken, {
        board_id: pin.board_id,
        title: pin.title,
        description: pin.description,
        image_url: pin.image_url,
        link: pin.destination_url,
      })

      await supabase
        .from('scheduled_pins')
        .update({ status: 'published', error_message: null })
        .eq('id', pin.id)

      publishedThisMonth[pin.user_id] = count + 1
      published++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      const attempt = parseAttempt(pin.error_message) + 1

      if (isTransientError(msg) && attempt < 3) {
        // Exponential backoff: retry after 15, 30 min
        const backoffMs = attempt * 15 * 60 * 1000
        const retryAt = new Date(Date.now() + backoffMs).toISOString()
        await supabase
          .from('scheduled_pins')
          .update({
            status: 'pending',
            scheduled_at: retryAt,
            error_message: `[attempt:${attempt}] ${msg}`,
          })
          .eq('id', pin.id)
        retried++
      } else {
        await supabase
          .from('scheduled_pins')
          .update({ status: 'failed', error_message: msg })
          .eq('id', pin.id)
        failed++
      }
    }
  }

  return NextResponse.json({ published, failed, retried, skipped })
}
