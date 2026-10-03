import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return ['', '/features', '/pricing', '/login', '/privacy', '/terms'].map((p) => ({
    url: `${site.url}${p}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: p === '' ? 1 : p === '/features' || p === '/pricing' ? 0.8 : 0.5,
  }))
}
