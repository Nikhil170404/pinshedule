'use client'

import { Calendar, Globe, Sparkles, Palette, BarChart3, Upload } from 'lucide-react'

const features = [
  {
    icon: Calendar,
    title: 'Scheduler',
    desc: 'Calendar, drag & drop, queue, auto-retry, bulk scheduling, best posting times, and multi-board support.',
    color: '#E60023',
    bg: '#fff0f2',
  },
  {
    icon: Globe,
    title: 'Website → Pins',
    desc: 'Paste any URL. We extract images, titles, and products — then AI writes your pin copy and schedules it in one click.',
    color: '#7C3AED',
    bg: '#f5f3ff',
  },
  {
    icon: Sparkles,
    title: 'Pinterest AI',
    desc: 'SEO titles, descriptions, keywords, hashtags, and ALT text. Helpful suggestions — not AI that takes over.',
    color: '#059669',
    bg: '#ecfdf5',
  },
  {
    icon: Palette,
    title: 'Design',
    desc: 'Resize to Pinterest format, templates, logo and watermark, brand colors, and font presets.',
    color: '#D97706',
    bg: '#fffbeb',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    desc: 'Track published and failed pins, queue status, clicks, best-performing boards, and growth trends.',
    color: '#2563EB',
    bg: '#eff6ff',
  },
  {
    icon: Upload,
    title: 'Imports',
    desc: 'CSV, Excel, ZIP, website URLs, sitemap, Shopify, WooCommerce, and WordPress — bring your content from anywhere.',
    color: '#0891B2',
    bg: '#ecfeff',
  },
]

export function Features() {
  return (
    <section id="features" className="py-20 md:py-28 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-[#E60023] uppercase tracking-wider mb-3">Everything you need</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Built only for Pinterest
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Not a generic social media tool with Pinterest bolted on. Every feature is designed for Pinterest creators.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, desc, color, bg }, i) => (
            <div
              key={title}
              className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-300 group animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{ background: bg }}
              >
                <Icon size={20} style={{ color }} />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
