import type { Metadata } from 'next'
import Link from 'next/link'
import { pageMeta } from '@/lib/site'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export const metadata: Metadata = pageMeta({
  title: 'Free Pinterest tools',
  description: 'Free Pinterest tools: pin size checker and title and description checker. No sign-up, and nothing is uploaded.',
  path: '/tools',
})

const tools = [
  { href: '/tools/pin-size-checker', name: 'Pin size checker', blurb: 'Check ratio, resolution and file size against Pinterest rules.' },
  { href: '/tools/pin-text-checker', name: 'Title and description checker', blurb: 'Count characters and check where your keyword sits.' },
]

export default function ToolsPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">Free Pinterest tools</h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">Small, fast tools for getting pins right before you schedule them. No account needed.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {tools.map((t) => (
            <Link key={t.href} href={t.href} className="rounded-xl border border-line bg-white p-5 hover:border-brand">
              <h2 className="font-semibold text-ink">{t.name}</h2>
              <p className="mt-1 text-sm text-stone-600">{t.blurb}</p>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </>
  )
}
