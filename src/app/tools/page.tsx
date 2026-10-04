import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Image as ImageIcon, Type } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { pageMeta } from '@/lib/site'

export const metadata: Metadata = pageMeta({
  title: 'Free Pinterest tools',
  description: 'Free Pinterest tools that run in your browser: a pin title and description checker and an image size checker. No sign-up and nothing is uploaded.',
  path: '/tools',
})

const tools = [
  { href: '/tools/pin-title-description-checker', name: 'Pin title and description checker', text: 'Check length limits, hashtags and keyword habits before you publish.', icon: Type },
  { href: '/tools/pin-image-size-checker', name: 'Pinterest image size checker', text: 'See whether an image has the right shape, size and weight for a pin.', icon: ImageIcon },
]

export default function ToolsPage() {
  return (
    <>
      <Navbar />
      <main id="main" tabIndex={-1} className="outline-none">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16">
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Free Pinterest tools</h1>
          <p className="mt-3 max-w-2xl text-lg text-stone-600">Small tools that run in your browser. No sign-up, and nothing you type or choose leaves your device.</p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tools.map((t) => (
              <Link key={t.href} href={t.href} className="group rounded-xl border border-line bg-white p-5 transition-colors hover:border-stone-400">
                <t.icon size={22} className="text-brand" aria-hidden />
                <h2 className="mt-3 text-base font-semibold text-ink">{t.name}</h2>
                <p className="mt-1 text-sm text-muted">{t.text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand">Open <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
