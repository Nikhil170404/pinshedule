import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/razorpay'
import { createServiceClient } from '@/lib/supabase/server'
import { PLANS } from '@/types'
import type { Plan } from '@/types'

const VALID_PLANS = new Set<Plan>(['free_trial', 'starter', 'pro', 'growth'])

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body)
  const supabase = await createServiceClient()

  if (event.event === 'subscription.charged') {
    const notes = event.payload?.subscription?.entity?.notes ?? {}
    const userId = notes.user_id as string | undefined
    const rawPlan = notes.plan as string | undefined

    if (userId && rawPlan && VALID_PLANS.has(rawPlan as Plan) && rawPlan !== 'free_trial') {
      await supabase
        .from('user_profiles')
        .update({ plan: rawPlan as Plan, plan_started_at: new Date().toISOString() })
        .eq('id', userId)
    }
  }

  if (event.event === 'subscription.cancelled') {
    const notes = event.payload?.subscription?.entity?.notes ?? {}
    const userId = notes.user_id as string | undefined

    if (userId) {
      await supabase
        .from('user_profiles')
        .update({ plan: 'free_trial' as Plan })
        .eq('id', userId)
    }
  }

  return NextResponse.json({ received: true })
}
