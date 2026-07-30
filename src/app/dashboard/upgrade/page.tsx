'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Check, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 399,
    yearly: 3840,
    perMonthYearly: 320,
    features: ['100 pins/month', '1 account', '50 AI captions', 'Basic analytics'],
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 999,
    yearly: 9600,
    perMonthYearly: 800,
    features: ['Unlimited pins', '3 accounts', 'Unlimited AI captions', 'Full analytics', 'Bulk upload (50 pins)', 'Best time suggestions'],
    popular: true,
  },
  {
    id: 'growth',
    name: 'Growth',
    monthly: 1999,
    yearly: 19200,
    perMonthYearly: 1600,
    features: ['Unlimited pins', '10 accounts', 'Unlimited AI captions', 'Full analytics + export', 'Bulk upload (500 pins)', 'White label reports', 'Priority chat support'],
    popular: false,
  },
]

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void }
  }
}

export default function UpgradePage() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  async function startCheckout(planId: string) {
    setLoading(planId)
    try {
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, billing }),
      })
      const order = await res.json()
      if (!res.ok) throw new Error(order.error ?? 'Order creation failed')

      // Load Razorpay SDK dynamically
      if (!window.Razorpay) {
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        document.head.appendChild(script)
        await new Promise((resolve) => { script.onload = resolve })
      }

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        name: 'PinScheduleKaro',
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} plan — ${billing}`,
        theme: { color: '#E60023' },
        handler: async (response: Record<string, string>) => {
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...response, plan: planId, billing }),
          })
          if (verifyRes.ok) {
            toast.success('Payment successful! Your plan is now active.')
            window.location.href = '/dashboard/billing'
          } else {
            toast.error('Payment verification failed. Contact support.')
          }
        },
      })
      rzp.open()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed')
    }
    setLoading(null)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upgrade your plan</h1>
        <p className="text-gray-500 text-sm mt-0.5">More pins, more accounts, more growth</p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['monthly', 'yearly'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 capitalize',
                billing === b ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {b}
              {b === 'yearly' && <span className="ml-1.5 text-xs text-green-600 font-semibold">−20%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {plans.map(({ id, name, monthly, yearly, perMonthYearly, features, popular }) => (
          <div
            key={id}
            className={cn(
              'relative bg-white rounded-2xl border p-6 transition-all duration-300',
              popular ? 'border-[#E60023] shadow-xl shadow-red-100 scale-[1.02]' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
            )}
          >
            {popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-1 bg-[#E60023] text-white text-xs font-bold px-3 py-1 rounded-full">
                  <Zap size={10} /> Most popular
                </div>
              </div>
            )}

            <h3 className="font-bold text-gray-900 text-lg mb-1">{name}</h3>
            <div className="flex items-end gap-1 mb-4">
              <span className="text-3xl font-bold text-gray-900">
                ₹{(billing === 'yearly' ? perMonthYearly : monthly).toLocaleString('en-IN')}
              </span>
              <span className="text-gray-400 mb-1">/mo</span>
            </div>
            {billing === 'yearly' && (
              <p className="text-xs text-gray-400 -mt-3 mb-4">₹{yearly.toLocaleString('en-IN')} billed yearly</p>
            )}

            <ul className="space-y-2.5 mb-6">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Button
              variant={popular ? 'primary' : 'outline'}
              className="w-full"
              loading={loading === id}
              onClick={() => startCheckout(id)}
            >
              Get {name}
            </Button>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-gray-400">
        Secure payment by Razorpay · Cancel anytime · Questions?{' '}
        <a href="mailto:support@pinschedulekaro.com" className="text-[#E60023] hover:underline">support@pinschedulekaro.com</a>
      </p>
    </div>
  )
}
