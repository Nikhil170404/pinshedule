import Razorpay from 'razorpay'
import crypto from 'crypto'

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export const PLANS = {
  starter_monthly: { amount: 500, currency: 'INR', plan: 'starter' },
  pro_monthly: { amount: 1400, currency: 'INR', plan: 'pro' },
  growth_monthly: { amount: 3000, currency: 'INR', plan: 'growth' },
  starter_yearly: { amount: 4800, currency: 'INR', plan: 'starter' },
  pro_yearly: { amount: 13400, currency: 'INR', plan: 'pro' },
  growth_yearly: { amount: 28800, currency: 'INR', plan: 'growth' },
} as const

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')
  return expected === signature
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')
  return expected === signature
}
