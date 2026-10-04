import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'
import { allPages } from '@/content/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const core = ['', '/features', '/pricing', '/tools', '/tools/pin-title-description-checker', '/tools/pin-image-size-checker', '/login', '/privacy', '/terms'].map((p) => ({
    url: `${site.url}${p}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: p === '' ? 1 : p === '/features' || p === '/pricing' ? 0.8 : p.startsWith('/tools') ? 0.7 : 0.5,
  }))
  // Content pages carry the date their facts were last reviewed, not the build date.
  const content = allPages.map((p) => ({
    url: `${site.url}/${p.path}`,
    lastModified: new Date(p.updated),
    changeFrequency: 'monthly' as const,
    priority: p.kind === 'product' ? 0.9 : p.kind === 'comparison' ? 0.8 : 0.7,
  }))
  return [...core, ...content]
}
