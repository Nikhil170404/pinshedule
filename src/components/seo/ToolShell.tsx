import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { buttonStyles } from '@/components/ui/button-styles'
import { JsonLd } from './JsonLd'
import { site } from '@/lib/site'

export type ToolFaq = { q: string; a: string }

/** Page frame for the free tools: header, schema (WebApplication, FAQ, breadcrumbs), FAQ list and a signup nudge. */
export function ToolShell({ name, path, h1, intro, faq, sources, children }: {
  name: string
  path: string
  h1: string
  intro: string
  faq: ToolFaq[]
  sources?: { label: string; url: string }[]
  children: React.ReactNode
}) {
  const url = `${site.url}${path}`
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@graph': [
              { '@type': 'WebApplication', name, url, description: intro, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', isAccessibleForFree: true, offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' }, publisher: { '@type': 'Organization', name: site.name, url: site.url } },
              { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
              { '@type': 'BreadcrumbList', itemListElement: [
                { '@type': 'ListItem', position: 1, name: site.name, item: site.url },
                { '@type': 'ListItem', position: 2, name: 'Free Pinterest tools', item: `${site.url}/tools` },
                { '@type': 'ListItem', position: 3, name, item: url },
              ] },
            ],
          }}
        />
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted">
          <Link href="/" className="hover:text-ink">Home</Link> / <Link href="/tools" className="hover:text-ink">Free tools</Link> / {name}
        </nav>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">{h1}</h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">{intro}</p>
        <div className="mt-8">{children}</div>

        <section className="mt-12" aria-labelledby="faq">
          <h2 id="faq" className="text-xl font-semibold text-ink">Frequently asked questions</h2>
          <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-white">
            {faq.map((f) => (
              <details key={f.q} className="group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-ink">
                  {f.q}<ChevronDown size={16} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {sources && sources.length > 0 && (
          <p className="mt-6 text-xs leading-relaxed text-muted">
            Sources: {sources.map((s, i) => <span key={s.url}>{i > 0 && ', '}<a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">{s.label}</a></span>)}. Pinterest changes its rules, so check the pin creation screen before you publish.
          </p>
        )}

        <aside className="mt-12 rounded-2xl border border-line bg-white p-6 text-center">
          <h2 className="text-lg font-semibold text-ink">Schedule these pins in bulk</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-600">{site.name} publishes up to 200 pins at a time at the right time of day. The free plan needs no card.</p>
          <Link href="/login" className={`${buttonStyles('primary', 'lg')} mt-4`}>Start free</Link>
        </aside>
      </main>
      <Footer />
    </>
  )
}
