import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { razorpay } from '@/lib/razorpay'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

// Amounts in USD cents (Razorpay supports USD)
const AMOUNTS_USD: Record<string, number> = {
  starter: 1500, // $15.00
  pro:     2500, // $25.00
  growth:  4900, // $49.00
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit('payment', user.id)
  if (!success) return rateLimitResponse()

  const { plan } = await request.json()
  const amount = AMOUNTS_USD[plan]
  if (!amount) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const order = await razorpay.orders.create({
    amount,
    currency: 'USD',
    receipt: `order_${user.id}_${Date.now()}`,
    notes: { user_id: user.id, plan },
  })

  return NextResponse.json(order)
}
