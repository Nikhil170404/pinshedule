import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { CTA } from '@/components/landing/CTA'
import {
  Sparkles, Calendar, BarChart3, Upload, Clock,
  FileSpreadsheet, Bell, Shield
} from 'lucide-react'

export const metadata = {
  title: 'Features — PinScheduleKaro',
  description: 'Everything you need to grow on Pinterest: AI captions, bulk upload, real analytics, and more.',
}

const deepFeatures = [
  {
    icon: Calendar,
    title: 'Smart Scheduling',
    points: [
      'Schedule pins to any board, any date and time',
      'Visual calendar view — see your whole month at a glance',
      'Edit or delete scheduled pins before they publish',
      'Best time recommendations based on your audience (Pro+)',
    ],
  },
  {
    icon: Sparkles,
    title: 'AI Caption Generator',
    points: [
      'Describe your image → get 3 caption options instantly',
      'Each caption is 150-200 chars with relevant hashtags',
      'Built with Claude Haiku — the best AI for short creative copy',
      'Edit any suggestion before using it',
    ],
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    points: [
      'Track impressions, saves, and link clicks per pin',
      '7-day and 30-day trend charts',
      'See your best performing pins at a glance',
      'Export analytics to PDF (Growth plan)',
    ],
  },
  {
    icon: FileSpreadsheet,
    title: 'Bulk CSV Upload',
    points: [
      'Download our template, fill it in with your pins',
      'Upload one CSV to schedule 50–500 pins at once',
      'Preview all pins before confirming — full control',
      'Available on Pro (50 pins) and Growth (500 pins)',
    ],
  },
  {
    icon: Clock,
    title: 'Keyword Tool',
    points: [
      'Enter your niche → see trending Pinterest keywords',
      'Relative popularity score for each keyword',
      'Click any keyword to add it to your caption instantly',
      'Updated monthly from Pinterest Trends API',
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
