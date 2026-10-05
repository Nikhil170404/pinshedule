import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { PLANS, type Plan } from '@shared/plans'
import { buttonStyles } from '@/components/ui/button-styles'
import { JsonLd } from './JsonLd'
import { allPages, pageUrl, siteUrl } from '@/content/seo'
import type { Block, SeoPage } from '@/content/seo/types'

/** Supports **bold** only; everything else is plain text, so authored copy can never inject markup. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : part
  )
}

const ORDER: Plan[] = ['free_trial', 'starter', 'pro', 'growth']

function PlansTable() {
  const rows: [string, (p: (typeof PLANS)[Plan]) => string][] = [
    ['Price per month', (p) => (p.price_monthly_usd === 0 ? 'Free' : `$${p.price_monthly_usd}`)],
    ['Price per year', (p) => (p.price_yearly_usd === 0 ? 'Free' : `$${p.price_yearly_usd}`)],
    ['Pins per month', (p) => p.pins_per_month.toLocaleString('en-US')],
    ['Pinterest accounts', (p) => p.accounts.toLocaleString('en-US')],
    ['Website page imports', (p) => p.website_imports.toLocaleString('en-US')],
    ['AI writing generations', (p) => p.ai_generations.toLocaleString('en-US')],
    ['AI background images', (p) => p.ai_images.toLocaleString('en-US')],
    ['Bulk scheduling and CSV', (p) => (p.bulk_upload ? 'Yes' : 'No (up to 10 pins at a time)')],
    ['Best-time auto scheduling', (p) => (p.smart_scheduler ? 'Yes' : 'No')],
    ['Sitemap import', (p) => (p.sitemap_import ? 'Yes' : 'No')],
    ['Analytics history', (p) => `${p.analytics_days} days`],
  ]
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line bg-stone-50 text-xs text-muted">
          <tr><th className="px-4 py-3 font-medium" scope="col">Plan</th>{ORDER.map((id) => <th key={id} className="px-4 py-3 font-semibold text-ink" scope="col">{PLANS[id].name}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(([label, fn]) => (
            <tr key={label}><th className="px-4 py-2.5 font-medium text-stone-600" scope="row">{label}</th>{ORDER.map((id) => <td key={id} className="px-4 py-2.5 text-ink">{fn(PLANS[id])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BlockView({ b }: { b: Block }) {
  switch (b.type) {
    case 'h2': return <h2 id={b.id} className="mt-12 scroll-mt-24 text-2xl font-semibold tracking-tight text-ink">{b.text}</h2>
    case 'h3': return <h3 className="mt-7 text-lg font-semibold text-ink">{b.text}</h3>
    case 'p': return <p className="mt-4 text-[17px] leading-8 text-stone-700">{inline(b.text)}</p>
    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul'
      return <Tag className={`mt-4 space-y-2 pl-6 text-[17px] leading-8 text-stone-700 ${b.ordered ? 'list-decimal' : 'list-disc'}`}>{b.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</Tag>
    }
    case 'steps':
      return (
        <ol className="mt-5 space-y-5">
          {b.items.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{i + 1}</span>
              <div><p className="font-semibold text-ink">{s.title}</p><p className="mt-1 text-[16px] leading-7 text-stone-700">{inline(s.text)}</p></div>
            </li>
          ))}
        </ol>
      )
    case 'table':
      return (
        <div className="my-6">
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-left text-[13px] sm:text-sm">
              <thead className="border-b border-line bg-stone-50 text-xs text-muted"><tr>{b.head.map((h) => <th key={h} className="px-3 py-3 font-semibold text-ink sm:px-4" scope="col">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => j === 0 ? <th key={j} className="px-3 py-3 align-top font-medium text-ink sm:px-4" scope="row">{inline(c)}</th> : <td key={j} className="px-3 py-3 align-top text-stone-700 sm:px-4">{inline(c)}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {b.note && <p className="mt-2 text-xs text-muted">{b.note}</p>}
        </div>
      )
    case 'callout':
      return <div className="my-6 rounded-xl border border-line bg-stone-50 p-5">{b.title && <p className="font-semibold text-ink">{b.title}</p>}<p className={`${b.title ? 'mt-1.5' : ''} text-[16px] leading-7 text-stone-700`}>{inline(b.text)}</p></div>
    case 'plans': return <PlansTable />
  }
}

const fmtDate = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

export function SeoArticle({ page }: { page: SeoPage }) {
  const url = pageUrl(page.path)
  const toc = page.blocks.filter((b): b is Extract<Block, { type: 'h2' }> => b.type === 'h2')
  const related = page.related.map((r) => allPages.find((x) => x.path === r)).filter((x): x is SeoPage => !!x)

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [{ name: 'Home', item: siteUrl() }, { name: page.label, item: url }].map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.name, item: b.item })),
    },
    page.kind === 'guide'
      ? { '@type': 'Article', headline: page.h1, description: page.description, dateModified: page.updated, datePublished: page.updated, mainEntityOfPage: url, author: { '@type': 'Organization', name: 'GoPinKaro' }, publisher: { '@type': 'Organization', name: 'GoPinKaro' } }
      : { '@type': 'WebPage', name: page.h1, description: page.description, url, dateModified: page.updated },
  ]
  if (page.kind !== 'guide') {
    graph.push({
      '@type': 'SoftwareApplication',
      name: 'GoPinKaro',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'Pinterest scheduler with bulk scheduling, website-to-pins import and an AI assistant.',
      url: siteUrl(),
      // Offers mirror the live plan data. No ratings or reviews are published because none exist yet.
      offers: (Object.values(PLANS)).map((pl) => ({ '@type': 'Offer', name: pl.name, price: pl.price_monthly_usd, priceCurrency: 'USD', url: pageUrl('pricing') })),
    })
  }
  if (page.faqs.length) {
    graph.push({ '@type': 'FAQPage', mainEntity: page.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) })
  }

  return (
    <article className="mx-auto w-full max-w-3xl px-4 pb-6 pt-10 sm:px-6 sm:pt-14">
      <JsonLd data={{ '@context': 'https://schema.org', '@graph': graph }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/" className="hover:text-ink">Home</Link> <span aria-hidden>/</span> <span className="text-ink">{page.label}</span></nav>
      <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">{page.h1}</h1>
      <p className="mt-5 text-lg leading-8 text-stone-700">{inline(page.intro)}</p>
      <p className="mt-3 text-sm text-muted">Facts reviewed {fmtDate(page.updated)}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/login" className={buttonStyles('primary', 'lg')}>Start free with Pinterest</Link>
        <Link href="/pricing" className={buttonStyles('outline', 'lg')}>See pricing</Link>
      </div>

      {toc.length > 2 && (
        <nav aria-label="On this page" className="mt-8 rounded-xl border border-line bg-white p-5">
          <p className="text-sm font-semibold text-ink">On this page</p>
          <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">{toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className="text-stone-600 hover:text-brand">{t.text}</a></li>)}</ul>
        </nav>
      )}

      {page.blocks.map((b, i) => <BlockView key={i} b={b} />)}

      {page.faqs.length > 0 && (
        <section aria-labelledby="faq">
          <h2 id="faq" className="mt-12 scroll-mt-24 text-2xl font-semibold tracking-tight text-ink">Frequently asked questions</h2>
          <div className="mt-5 divide-y divide-line rounded-xl border border-line bg-white">
            {page.faqs.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">{f.q}<ChevronDown size={16} className="shrink-0 text-stone-400 transition-transform group-open:rotate-180" aria-hidden /></summary>
                <p className="mt-3 text-[15px] leading-7 text-stone-700">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {page.sources && page.sources.length > 0 && (
        <section aria-labelledby="sources" className="mt-12">
          <h2 id="sources" className="text-lg font-semibold text-ink">Sources consulted</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-stone-600">
            {page.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-stone-300 underline-offset-2 hover:text-ink">{s.label}</a></li>)}
          </ul>
          <p className="mt-2 text-xs text-muted">Facts about other products can change. Always confirm current limits and prices on their own sites.</p>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-12">
          <h2 id="related" className="text-lg font-semibold text-ink">Keep reading</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.path}><Link href={`/${r.path}`} className="block h-full rounded-xl border border-line bg-white p-4 transition-colors hover:border-stone-400"><p className="text-sm font-semibold text-ink">{r.label}</p><p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p></Link></li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
