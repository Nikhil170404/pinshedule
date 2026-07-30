import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyPaymentSignature } from '@/lib/razorpay'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

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
    billing,
  } = await request.json()

  const valid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

  await supabase.from('user_profiles').upsert({
    id: user.id,
    plan,
    billing_cycle: billing,
    razorpay_payment_id,
    razorpay_order_id,
    plan_started_at: new Date().toISOString(),
    trial_ends_at: null,
  }, { onConflict: 'id' })

  return NextResponse.json({ ok: true })
}
