import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { razorpay } from '@/lib/razorpay'

const AMOUNTS: Record<string, Record<string, number>> = {
  starter: { monthly: 39900, yearly: 384000 },
  pro:     { monthly: 99900, yearly: 960000 },
  growth:  { monthly: 199900, yearly: 1920000 },
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, billing } = await request.json()
  const amount = AMOUNTS[plan]?.[billing]
  if (!amount) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const order = await razorpay.orders.create({
    amount,
    currency: 'INR',
    receipt: `order_${user.id}_${Date.now()}`,
    notes: { user_id: user.id, plan, billing },
  })

  return NextResponse.json(order)
}
