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
    price: 15,
    features: [
      '1 Pinterest account',
      '1,500 pins/month',
      '200 website imports',
      '500 AI generations',
      '30 AI image credits',
      'Bulk CSV & ZIP upload',
      'Auto-retry failed pins',
      'SEO score',
    ],
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 25,
    features: [
      '5 Pinterest accounts',
      '10,000 pins/month',
      '2,000 website imports',
      '3,000 AI generations',
      '150 AI image credits',
      'Sitemap import',
      'Website → Pins automation',
      'Smart scheduler',
      'Brand kit & templates',
      'Chrome extension',
      'Advanced analytics',
      'Team (3 users)',
    ],
    popular: true,
  },
  {
    id: 'growth',
    name: 'Agency',
    price: 49,
    features: [
      '20 Pinterest accounts',
      '50,000 pins/month',
      '10,000 website imports',
      '15,000 AI generations',
      '750 AI image credits',
      'Unlimited team',
      'White label',
      'API access',
      'Priority support',
    ],
    popular: false,
  },
]

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void }
  }
}

export default function UpgradePage() {
  const [loading, setLoading] = useState<string | null>(null)

  async function startCheckout(planId: string) {
    setLoading(planId)
    try {
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, billing: 'monthly' }),
      })
      const order = await res.json()
      if (!res.ok) throw new Error(order.error ?? 'Order creation failed')

      if (!window.Razorpay) {
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        document.head.appendChild(script)
        await new Promise((resolve) => { script.onload = resolve })
      }

      const plan = plans.find((p) => p.id === planId)
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        name: 'Pinshedule',
        description: `${plan?.name ?? planId} plan — monthly`,
        theme: { color: '#E60023' },
        handler: async (response: Record<string, string>) => {
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...response, plan: planId, billing: 'monthly' }),
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
        <p className="text-gray-500 text-sm mt-0.5">More pins, more automation, more traffic</p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {plans.map(({ id, name, price, features, popular }) => (
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
            <div className="flex items-end gap-1 mb-5">
              <span className="text-3xl font-bold text-gray-900">${price}</span>
              <span className="text-gray-400 mb-1">/mo</span>
            </div>

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
        Secure payment · Cancel anytime · Questions?{' '}
        <a href="mailto:support@pinshedule.com" className="text-[#E60023] hover:underline">support@pinshedule.com</a>
      </p>
    </div>
  )
}
