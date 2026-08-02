import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { CTA } from '@/components/landing/CTA'
import {
  Calendar, Globe, Sparkles, Palette, BarChart3, Upload,
  Link2, Map, FileSpreadsheet, Shield
} from 'lucide-react'

export const metadata = {
  title: 'Features — Pinshedule',
  description: 'Scheduler, Website → Pins, AI, design, analytics, and imports. Everything built specifically for Pinterest.',
}

const deepFeatures = [
  {
    icon: Calendar,
    title: 'Scheduler',
    points: [
      'Drag & drop visual calendar — see your whole month at a glance',
      'Queue mode: pins auto-fill your next available slot',
      'Auto-retry failed pins so nothing falls through the cracks',
      'Bulk schedule: upload a spreadsheet and schedule hundreds at once',
      'Best posting time recommendations based on your audience',
      'Pin to multiple boards in one action',
      'Drafts so nothing is lost before it\'s ready',
    ],
  },
  {
    icon: Globe,
    title: 'Website → Pins',
    points: [
      'Paste any URL — blog post, product page, or landing page',
      'Auto-extracts title, images, and product details',
      'AI writes multiple Pinterest-optimized title options',
      'AI generates descriptions, keywords, and hashtags',
      'Schedule all extracted pins in one click',
      'Sitemap import: import all your pages at once (Pro+)',
      'Auto-spread pins over weeks or months from your sitemap',
    ],
  },
  {
    icon: Sparkles,
    title: 'Pinterest AI',
    points: [
      'SEO-optimized titles written for Pinterest search',
      'Descriptions that match Pinterest\'s algorithm preferences',
      'Keyword and hashtag suggestions for your niche',
      'ALT text generation for accessibility and SEO',
      'Duplicate checker so you never repost the same pin',
      'Rewrite tool to refresh existing copy',
      'Seasonal suggestions and board recommendations',
    ],
  },
  {
    icon: Palette,
    title: 'Design',
    points: [
      'Resize any image to the ideal Pinterest format (2:3)',
      'Ready-made templates for products, quotes, and blog pins',
      'Add your logo or watermark automatically',
      'Brand kit: save your colors and font presets (Pro+)',
      'Chrome extension to grab images from any website (Pro+)',
    ],
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    points: [
      'Track published and failed pins in one dashboard',
      'Live queue status so you always know what\'s next',
      'Click data where available via Pinterest API',
      'Best-performing boards ranked by engagement',
      'Growth trends over time',
      'Advanced analytics with breakdowns (Pro & Agency)',
    ],
  },
  {
    icon: Upload,
    title: 'Imports',
    points: [
      'CSV — download our template, fill in your pins, upload',
      'Excel — same flow, .xlsx supported',
      'ZIP — upload a folder of images with a manifest',
      'Website URL — paste a page and extract automatically',
      'Sitemap — import your whole site at once (Pro+)',
      'Shopify, WooCommerce, and WordPress integrations',
    ],
  },
  {
    icon: Shield,
    title: 'Safe & Compliant',
    points: [
      'Official Pinterest API v5 — no scraping, no hacks',
      'Your tokens encrypted with AES-256 at rest',
      'You choose every pin, board, and time consciously',
      'Follows all Pinterest developer terms of service',
    ],
  },
]

export default function FeaturesPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        <div className="py-16 text-center bg-gray-50 border-b border-gray-100">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-4">
            Built only for Pinterest
          </h1>
          <p className="text-xl text-gray-500 max-w-xl mx-auto">
            Not a generic scheduler. Every single feature was designed with Pinterest creators in mind.
          </p>
        </div>

        <Features />
        <HowItWorks />

        {/* Deep feature sections */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid md:grid-cols-2 gap-6">
              {deepFeatures.map(({ icon: Icon, title, points }, i) => (
                <div key={title} className="bg-white rounded-2xl p-7 border border-gray-100 hover:shadow-md transition-all duration-300">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                      <Icon size={18} className="text-[#E60023]" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                  </div>
                  <ul className="space-y-2.5">
                    {points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E60023] mt-1.5 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CTA />
      </main>
      <Footer />
    </>
  )
}
