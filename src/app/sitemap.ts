import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'
import { allPages, hubs } from '@/content/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  // Core pages use the date they last changed. Content pages carry the date their facts were last reviewed,
  // and hubs the newest date of the pages they list, so lastModified never claims more than is true.
  const core = ['', '/features', '/pricing', '/login', '/privacy', '/terms'].map((p) => ({
    url: `${site.url}${p}`,
    lastModified: new Date(site.updated),
    changeFrequency: (p === '' || p === '/pricing' ? 'weekly' : 'monthly') as 'weekly' | 'monthly',
    priority: p === '' ? 1 : p === '/features' || p === '/pricing' ? 0.8 : 0.4,
  }))
  const hubEntries = hubs.map((h) => ({
    url: `${site.url}/${h.path}`,
    lastModified: new Date(allPages.filter((p) => p.kind === h.kind).map((p) => p.updated).sort().at(-1) ?? site.updated),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
  const content = allPages.map((p) => ({
    url: `${site.url}/${p.path}`,
    lastModified: new Date(p.updated),
    changeFrequency: 'monthly' as const,
    priority: p.kind === 'product' ? 0.9 : p.kind === 'comparison' ? 0.8 : 0.7,
  }))
  return [...core, ...hubEntries, ...content]
}
