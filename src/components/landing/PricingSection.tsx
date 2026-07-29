'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: { monthly: 399, yearly: 3840 },
    yearlyPerMonth: 320,
    desc: 'Perfect for bloggers & personal creators',
    features: [
      '100 scheduled pins/month',
      '1 Pinterest account',
      'AI captions (50/month)',
      'Basic analytics',
      'Keyword suggestions',
      'Email support',
    ],
    popular: false,
    cta: 'Start with Starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: 999, yearly: 9600 },
    yearlyPerMonth: 800,
    desc: 'For Etsy sellers & small businesses',
    features: [
      'Unlimited scheduled pins',
      '3 Pinterest accounts',
      'Unlimited AI captions',
      'Full analytics dashboard',
      'Bulk CSV upload (50 pins)',
      'Best time recommendations',
      'Priority email support',
    ],
    popular: true,
    cta: 'Start with Pro',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: { monthly: 1999, yearly: 19200 },
    yearlyPerMonth: 1600,
    desc: 'For agencies & power users',
    features: [
      'Unlimited scheduled pins',
      '10 Pinterest accounts',
      'Unlimited AI captions',
      'Full analytics + PDF export',
      'Bulk CSV upload (500 pins)',
      'White label reports',
      'Custom posting schedule',
      'Priority chat support',
    ],
    popular: false,
    cta: 'Start with Growth',
  },
]

export function PricingSection() {
  const [yearly, setYearly] = useState(false)

  return (
    <section id="pricing" className="py-20 md:py-28 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-[#E60023] uppercase tracking-wider mb-3">Simple pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Start free. Upgrade when ready.
          </h2>
          <p className="text-gray-500 mb-8">14-day free trial. No credit card. Cancel anytime.</p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-1">
            <button
              onClick={() => setYearly(false)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                !yearly ? 'bg-[#E60023] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >Monthly</button>
            <button
              onClick={() => setYearly(true)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2',
                yearly ? 'bg-[#E60023] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Yearly
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                yearly ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
              )}>Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-start">
          {plans.map(({ id, name, price, yearlyPerMonth, desc, features, popular, cta }, i) => (
            <div
              key={id}
              className={cn(
                'relative bg-white rounded-2xl border p-7 transition-all duration-300 animate-fade-in-up',
                popular
                  ? 'border-[#E60023] shadow-xl shadow-red-100 scale-[1.02]'
                  : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
              )}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 bg-[#E60023] text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                    <Zap size={11} />
                    Most popular
                  </div>
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{name}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold text-gray-900">
                    ₹{yearly ? yearlyPerMonth.toLocaleString('en-IN') : price.monthly.toLocaleString('en-IN')}
                  </span>
                  <span className="text-gray-500 mb-1">/mo</span>
                </div>
                {yearly && (
                  <p className="text-xs text-gray-400 mt-1">
                    ₹{price.yearly.toLocaleString('en-IN')} billed yearly
                  </p>
                )}
              </div>

              <Link href="/signup" className="block mb-6">
                <Button
                  variant={popular ? 'primary' : 'outline'}
                  className="w-full"
                  size="md"
                >
                  {cta}
                </Button>
              </Link>

              <ul className="space-y-3">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <Check size={15} className="text-green-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-gray-500 mt-8">
          All plans include a <strong>14-day free trial</strong> with 20 scheduled pins — no card required.
        </p>
      </div>
    </section>
  )
}
