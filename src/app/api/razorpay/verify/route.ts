import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyPaymentSignature } from '@/lib/razorpay'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { PLANS } from '@/types'
import type { Plan } from '@/types'

const VALID_PAID_PLANS = new Set<Plan>(['starter', 'pro', 'growth'])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit('payment', user.id)
  if (!success) return rateLimitResponse()

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    plan,
  } = await request.json()

  // Validate plan is a real paid plan (not free_trial, not arbitrary string)
  if (!VALID_PAID_PLANS.has(plan as Plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const valid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

  await supabase.from('user_profiles').upsert({
    id: user.id,
    plan: plan as Plan,
    plan_started_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  return NextResponse.json({ ok: true, plan: PLANS[plan as Plan].name })
}
