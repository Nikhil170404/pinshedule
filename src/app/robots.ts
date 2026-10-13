import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'

const PRIVATE = ['/dashboard', '/admin', '/api']
// Search and answer-engine crawlers are welcome on the public pages. Listing them keeps that explicit and stable.
const AI_AND_SEARCH_BOTS = ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...AI_AND_SEARCH_BOTS.map((userAgent) => ({ userAgent, allow: '/', disallow: PRIVATE })),
      { userAgent: '*', allow: '/', disallow: PRIVATE },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  }
}
