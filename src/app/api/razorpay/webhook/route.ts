import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/razorpay'
import { createServiceClient } from '@/lib/supabase/server'

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
    if (notes.user_id) {
      await supabase
        .from('user_profiles')
        .update({ plan: notes.plan ?? 'pro' })
        .eq('id', notes.user_id)
    }
  }

  if (event.event === 'subscription.cancelled') {
    const notes = event.payload?.subscription?.entity?.notes ?? {}
    if (notes.user_id) {
      await supabase
        .from('user_profiles')
        .update({ plan: 'free_trial' })
        .eq('id', notes.user_id)
    }
  }

  return NextResponse.json({ received: true })
}

