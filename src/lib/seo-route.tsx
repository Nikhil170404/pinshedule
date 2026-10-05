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
  const base = pageMeta({ title: page.title, description: page.description, path: `/${page.path}` })
  // No explicit images: the page's own opengraph-image route supplies a share image with its headline.
  const openGraph: Record<string, unknown> = { ...base.openGraph }
  const twitter: Record<string, unknown> = { ...base.twitter }
  delete openGraph.images // removed (not set to undefined) so Next adds the generated image
  delete twitter.images
  const meta = { ...base, openGraph, twitter } as Metadata
  // Guides are articles; everything else is a normal page. Share image and Twitter card come from the site config.
  const authors = [{ name: 'GoPinKaro' }]
  return page.kind === 'guide'
    ? { ...meta, authors, openGraph: { ...meta.openGraph, type: 'article', publishedTime: page.published ?? page.updated, modifiedTime: page.updated, authors: ['GoPinKaro'] } }
    : { ...meta, authors }
}

export function SeoPageView({ prefix, slug }: { prefix: string; slug: string }) {
  const page = pageByPath(fullPath(prefix, slug))
  if (!page) notFound()
  return (
    <>
      <Navbar />
      <main>
        <SeoArticle page={page} />
        <CTA />
      </main>
      <Footer />
    </>
  )
}
