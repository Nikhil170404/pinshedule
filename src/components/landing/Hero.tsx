'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

const bullets = [
  'No credit card required',
  '14-day free trial',
  'Cancel anytime',
]

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      {/* Background blobs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-red-50 via-pink-50 to-transparent rounded-full opacity-60 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-orange-50 to-transparent rounded-full opacity-40 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Text */}
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 bg-red-50 text-[#E60023] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E60023] animate-pulse" />
              Trusted by 1,000+ creators worldwide
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-5">
              Schedule Pinterest
              <span className="block gradient-text">Pins in Seconds</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-8 max-w-lg">
              AI captions. Bulk upload. Real analytics.{' '}
              <strong className="text-gray-800">All for ₹399/mo.</strong>{' '}
              Grow your Pinterest while you sleep.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link href="/signup">
                <Button size="lg" className="group w-full sm:w-auto">
                  Start free — no credit card
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
              <Link href="/features">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  See all features
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {bullets.map((b) => (
                <div key={b} className="flex items-center gap-1.5 text-sm text-gray-500">
                  <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                  {b}
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="animate-fade-in-up delay-200">
            <div className="relative">
              {/* Floating card 1 */}
              <div className="absolute -top-4 -left-4 z-10 bg-white rounded-2xl shadow-xl p-3 flex items-center gap-2.5 animate-float">
                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                  <CheckCircle2 size={18} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">Pin Published!</p>
                  <p className="text-[10px] text-gray-500">Just now · 247 impressions</p>
                </div>
              </div>

              {/* Floating card 2 */}
              <div className="absolute -bottom-4 -right-4 z-10 bg-white rounded-2xl shadow-xl p-3 animate-float delay-300">
                <p className="text-[10px] text-gray-500 mb-1">This week</p>
                <div className="flex items-end gap-1 h-8">
                  {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                    <div
                      key={i}
                      className="w-3 rounded-sm bg-[#E60023] opacity-80"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <p className="text-xs font-semibold text-gray-800 mt-1">+23% saves</p>
              </div>

              {/* Main mockup */}
              <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
                {/* Header bar */}
                <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {['#ff5f57','#febc2e','#28c840'].map((c) => (
                      <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="flex-1 mx-3 bg-gray-200 rounded-md px-3 py-1 text-[10px] text-gray-400">
                    pinschedulekaro.com/dashboard
                  </div>
                </div>

                {/* Dashboard content */}
                <div className="flex h-72">
                  {/* Sidebar */}
                  <div className="w-14 border-r border-gray-100 bg-white flex flex-col items-center py-4 gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#E60023] flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
                    </div>
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`w-8 h-8 rounded-xl flex items-center justify-center ${i === 0 ? 'bg-red-50' : 'hover:bg-gray-100'}`}>
                        <div className={`w-4 h-4 rounded ${i === 0 ? 'bg-[#E60023]' : 'bg-gray-300'}`} style={{ borderRadius: 4 }} />
                      </div>
                    ))}
                  </div>

                  {/* Main area */}
                  <div className="flex-1 p-4 overflow-hidden">
                    <div className="text-xs font-semibold text-gray-800 mb-3">Scheduled this week</div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {['#fce4ec','#e8f5e9','#e3f2fd'].map((bg, i) => (
                        <div key={i} className="rounded-xl aspect-square" style={{ background: bg }}>
                          <div className="w-full h-full rounded-xl" style={{ background: `linear-gradient(135deg, ${bg}, ${bg}dd)` }} />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: 'Impressions', val: '12.4K', color: '#E60023' },
                        { label: 'Saves', val: '847', color: '#00A400' },
                        { label: 'Clicks', val: '234', color: '#FF6B00' },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-500">{label}</span>
                          <span className="text-[10px] font-bold" style={{ color }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
