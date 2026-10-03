import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { pageByPath } from '@/content/seo'

const featured = [
  'pinterest-scheduler', 'pinterest-bulk-scheduler', 'website-to-pinterest-pins', 'pinterest-automation-tool',
  'best-pinterest-tools', 'tailwind-alternative', 'free-pinterest-scheduler', 'guides/how-to-schedule-pinterest-pins',
]

export function Explore() {
  const pages = featured.map(pageByPath).filter((p): p is NonNullable<typeof p> => !!p)
  return (
    <section className="border-t border-line bg-white py-16 md:py-24" aria-labelledby="explore">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="explore" className="text-3xl font-semibold tracking-tight text-ink">Guides and comparisons</h2>
        <p className="mt-3 max-w-2xl text-stone-600">Plain answers about scheduling on Pinterest, how the tools compare, and how to get the most from each pin.</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pages.map((p) => (
            <li key={p.path}>
              <Link href={`/${p.path}`} className="group flex h-full flex-col rounded-xl border border-line bg-canvas p-4 transition-colors hover:border-stone-400">
                <span className="text-sm font-semibold text-ink">{p.label}</span>
                <span className="mt-1.5 line-clamp-3 text-sm text-muted">{p.description}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand">Read <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
