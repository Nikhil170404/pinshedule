import type { Metadata } from 'next'

export const site = {
  name: 'GoPinKaro',
  url: (process.env.NEXT_PUBLIC_APP_URL ?? 'https://gopinkaro.com').replace(/\/$/, ''),
  title: 'GoPinKaro: Pinterest scheduler for bulk pins',
  description: 'Schedule Pinterest pins in bulk, turn your website into pins, and publish at the best times. Free plan included.',
  ogImage: { url: '/og.png', width: 1200, height: 630, alt: 'GoPinKaro, the Pinterest scheduler for bulk pins' },
}

/** Per-page metadata. openGraph and twitter are replaced, not merged, by child segments, so every page sets them in full. */
export function pageMeta({ title, description = site.description, path }: { title?: string; description?: string; path: string }): Metadata {
  const full = title ? `${title} | ${site.name}` : site.title
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { title: full, description, url: path, type: 'website', siteName: site.name, locale: 'en_US', images: [site.ogImage] },
    twitter: { card: 'summary_large_image', title: full, description, images: [site.ogImage.url] },
  }
}
