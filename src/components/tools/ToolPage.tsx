import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { CTA } from '@/components/landing/CTA'
import { JsonLd } from '@/components/seo/JsonLd'
import { site } from '@/lib/site'

export interface ToolMeta { path: string; name: string; h1: string; intro: string }

/** Shared frame for the free tools: heading, the tool itself, a short explanation, and a link to the product. */
export function ToolPage({ tool, children, notes }: { tool: ToolMeta; children: React.ReactNode; notes: { title: string; body: string }[] }) {
  return (
    <>
      <Navbar />
      <main id="main" tabIndex={-1} className="outline-none">
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'WebApplication', name: tool.name, url: `${site.url}${tool.path}`, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' }, description: tool.intro },
            { '@type': 'BreadcrumbList', itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: site.url },
              { '@type': 'ListItem', position: 2, name: 'Free tools', item: `${site.url}/tools` },
              { '@type': 'ListItem', position: 3, name: tool.name, item: `${site.url}${tool.path}` },
            ] },
          ],
        }} />
        <article className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted"><Link href="/tools" className="hover:text-ink">Free tools</Link> / {tool.name}</nav>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{tool.h1}</h1>
          <p className="mt-3 max-w-2xl text-lg text-stone-600">{tool.intro}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            {notes.map((n) => (
              <section key={n.title}><h2 className="text-lg font-semibold text-ink">{n.title}</h2><p className="mt-2 text-sm leading-relaxed text-stone-600">{n.body}</p></section>
            ))}
          </div>
        </article>
        <CTA />
      </main>
      <Footer />
    </>
  )
}
