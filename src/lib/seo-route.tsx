import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { CTA } from '@/components/landing/CTA'
import { SeoArticle } from '@/components/seo/SeoArticle'
import { allPages, pageByPath } from '@/content/seo'
import { pageMeta } from '@/lib/site'

/** Slugs of the content pages that live directly under `prefix` ('' for top level). */
export function seoParams(prefix: string) {
  return allPages
    .filter((p) => (prefix ? p.path.startsWith(`${prefix}/`) : !p.path.includes('/')))
    .map((p) => ({ slug: prefix ? p.path.slice(prefix.length + 1) : p.path }))
}

const fullPath = (prefix: string, slug: string) => (prefix ? `${prefix}/${slug}` : slug)

export function seoMetadata(prefix: string, slug: string): Metadata {
  const page = pageByPath(fullPath(prefix, slug))
  if (!page) return {}
  const meta = pageMeta({ title: page.title, description: page.description, path: `/${page.path}` })
  // Guides are articles; everything else is a normal page. Share image and Twitter card come from the site config.
  return page.kind === 'guide' ? { ...meta, openGraph: { ...meta.openGraph, type: 'article', modifiedTime: page.updated } } : meta
}

export function SeoPageView({ prefix, slug }: { prefix: string; slug: string }) {
  const page = pageByPath(fullPath(prefix, slug))
  if (!page) notFound()
  return (
    <>
      <Navbar />
      <main id="main" tabIndex={-1} className="outline-none">
        <SeoArticle page={page} />
        <CTA />
      </main>
      <Footer />
    </>
  )
}
