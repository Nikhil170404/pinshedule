'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const faqs = [
  {
    q: 'Is it safe to connect my Pinterest account?',
    a: 'Yes. We use Pinterest\'s official OAuth API. We never see your Pinterest password. You can revoke access anytime from Pinterest settings.',
  },
  {
    q: 'Will my account get banned for using this?',
    a: 'No. We follow Pinterest\'s developer guidelines and terms of service. Every pin you schedule is one you personally chose — we never auto-generate unsolicited content.',
  },
  {
    q: 'Do I need a credit card to start?',
    a: 'No. The Free plan is permanently free — 1 account, 100 pins/month, and 20 AI generations. No card ever required to use it.',
  },
  {
    q: 'What happens when I hit my pin limit?',
    a: 'Pins queue for the next billing month automatically. You can also upgrade anytime to get more — it takes 30 seconds.',
  },
  {
    q: 'Can I switch plans anytime?',
    a: 'Yes, upgrade or downgrade whenever you want. Upgrades are prorated so you only pay for what you use.',
  },
  {
    q: 'Is there a refund policy?',
    a: 'Monthly plans: cancel before renewal to avoid the next charge. Yearly plans: full refund within 7 days if you\'ve scheduled fewer than 50 pins.',
  },
  {
    q: 'Do you support multiple Pinterest accounts?',
    a: 'Yes. Free and Starter support 1 account. Pro supports 5 accounts. Agency supports 20. You can also add extra accounts as an add-on ($5/mo each).',
  },
  {
    q: 'What is Website → Pins?',
    a: 'Paste any URL from your website — a blog post, product page, or landing page. We extract the images, title, and content, then AI writes Pinterest-optimized titles, descriptions, keywords, and hashtags. One click to schedule all the pins.',
  },
  {
    q: 'How does the Sitemap import work?',
    a: 'On Pro and Agency, you can submit your sitemap URL. We import all your pages and automatically spread pins across weeks or months so your schedule stays full without daily effort.',
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-[#E60023] uppercase tracking-wider mb-3">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
            Questions answered
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map(({ q, a }, i) => (
            <div
              key={i}
              className="border border-gray-100 rounded-2xl overflow-hidden bg-white hover:border-gray-200 transition-colors"
            >
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="text-sm font-semibold text-gray-900 pr-4">{q}</span>
                <ChevronDown
                  size={18}
                  className={cn(
                    'text-gray-400 shrink-0 transition-transform duration-200',
                    open === i && 'rotate-180'
                  )}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-5 animate-fade-in">
                  <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
