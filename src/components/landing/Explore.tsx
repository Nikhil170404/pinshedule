import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { hubs, pageByPath } from '@/content/seo'

const featured = [
  'pinterest-scheduler', 'best-pinterest-schedulers', 'manage-multiple-pinterest-accounts', 'pinterest-video-pin-scheduler',
  'cheapest-pinterest-scheduler', 'tailwind-alternative', 'pinboostr-alternative', 'safest-pinterest-scheduler',
  'guides/best-time-to-post-on-pinterest', 'guides/how-to-find-pinterest-keywords', 'pinterest-pin-maker', 'use-cases/agencies',
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
        <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {hubs.map((h) => <Link key={h.path} href={`/${h.path}`} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">All {h.label.toLowerCase()} <ArrowRight size={13} aria-hidden /></Link>)}
        </p>
      </div>
    </section>
  )
}
