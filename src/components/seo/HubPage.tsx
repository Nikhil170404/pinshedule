import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { CTA } from '@/components/landing/CTA'
import { buttonStyles } from '@/components/ui/button-styles'
import { JsonLd } from './JsonLd'
import { allPages, pageUrl, siteUrl } from '@/content/seo'
import type { Hub } from '@/content/seo/hubs'
import { site } from '@/lib/site'

/** An index of every content page of one kind. Gives search engines and readers one place that links to all of them. */
export function HubPage({ hub }: { hub: Hub }) {
  const pages = allPages.filter((p) => p.kind === hub.kind)
  const url = pageUrl(hub.path)
  const updated = pages.map((p) => p.updated).sort().at(-1) ?? site.updated
  return (
    <>
      <Navbar />
      <main>
        <section className="mx-auto w-full max-w-5xl px-4 pb-6 pt-10 sm:px-6 sm:pt-14">
          <JsonLd data={{
            '@context': 'https://schema.org',
            '@graph': [
              { '@type': 'BreadcrumbList', itemListElement: [{ name: 'Home', item: siteUrl() }, { name: hub.label, item: url }].map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.name, item: b.item })) },
              {
                '@type': 'CollectionPage', name: hub.h1, description: hub.description, url, dateModified: updated,
                mainEntity: { '@type': 'ItemList', itemListElement: pages.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: pageUrl(p.path), name: p.h1 })) },
              },
            ],
          }} />
          <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/" className="hover:text-ink">Home</Link> <span aria-hidden>/</span> <span className="text-ink">{hub.label}</span></nav>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">{hub.h1}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-700">{hub.intro}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className={buttonStyles('primary', 'lg')}>Start free with Pinterest</Link>
            <Link href="/pricing" className={buttonStyles('outline', 'lg')}>See pricing</Link>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((p) => (
              <li key={p.path}>
                <Link href={`/${p.path}`} className="group flex h-full flex-col rounded-xl border border-line bg-white p-5 transition-colors hover:border-stone-400">
                  <span className="text-[15px] font-semibold leading-snug text-ink">{p.label}</span>
                  <span className="mt-2 line-clamp-4 text-sm leading-6 text-muted">{p.description}</span>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand">Read <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <CTA />
      </main>
      <Footer />
    </>
  )
}
