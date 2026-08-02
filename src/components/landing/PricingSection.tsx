'use client'

import Link from 'next/link'
import { Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    desc: 'Try it out — no card needed',
    features: [
      '1 Pinterest account',
      '100 pins/month',
      '5 website imports',
      '20 AI generations',
      'Calendar',
      'Basic analytics',
    ],
    popular: false,
    cta: 'Get started free',
    highlight: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 15,
    desc: 'For bloggers & solo creators',
    features: [
      '1 Pinterest account',
      '1,500 pins/month',
      'Unlimited scheduling',
      '200 website imports',
      '500 AI generations',
      '30 AI image credits',
      'Bulk CSV & ZIP upload',
      'Queue & calendar',
      'Auto-retry failed pins',
      'SEO score',
      'Analytics',
    ],
    popular: false,
    cta: 'Start with Starter',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 25,
    desc: 'For growing businesses & sellers',
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
    cta: 'Start with Pro',
    highlight: true,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 49,
    desc: 'For agencies managing multiple clients',
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
    cta: 'Start with Agency',
    highlight: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-28 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-[#E60023] uppercase tracking-wider mb-3">Simple pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Start free. Upgrade when you grow.
          </h2>
          <p className="text-gray-500">No credit card required. Cancel anytime.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {plans.map(({ id, name, price, desc, features, popular, cta, highlight }, i) => (
            <div
              key={id}
              className={cn(
                'relative bg-white rounded-2xl border p-6 transition-all duration-300 animate-fade-in-up',
                highlight
                  ? 'border-[#E60023] shadow-xl shadow-red-100 scale-[1.02]'
                  : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
              )}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 bg-[#E60023] text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                    <Zap size={11} />
                    Most popular
                  </div>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-base font-bold text-gray-900 mb-1">{name}</h3>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>

              <div className="mb-5">
                <div className="flex items-end gap-1">
                  {price === 0 ? (
                    <span className="text-3xl font-bold text-gray-900">Free</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-gray-900">${price}</span>
                      <span className="text-gray-500 mb-1 text-sm">/mo</span>
                    </>
                  )}
                </div>
              </div>

              <Link href="/signup" className="block mb-5">
                <Button
                  variant={highlight ? 'primary' : 'outline'}
                  className="w-full"
                  size="md"
                >
                  {cta}
                </Button>
              </Link>

              <ul className="space-y-2.5">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500 mb-3">Need more? Add on what you need:</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              '100 AI images → $5',
              '500 AI text generations → $3',
              'Extra Pinterest account → $5/mo',
              'Extra 5,000 pins → $5/mo',
            ].map((addon) => (
              <span key={addon} className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-600">
                {addon}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
