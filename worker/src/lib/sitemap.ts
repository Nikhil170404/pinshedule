import { safeFetchText } from './safe-fetch'
import { parseSitemapUrls } from './html'

/** Page URLs from a sitemap or sitemap index. Reads at most a few files and prefers post/product sitemaps. */
export async function listSitemapPages(input: string, maxPages = 500): Promise<string[]> {
  let start = input
  const u = new URL(start)
  if (!/\.xml(\.gz)?$/i.test(u.pathname)) start = `${u.origin}/sitemap.xml`
  const pages = new Set<string>()
  const queue = [start]
  const seen = new Set<string>()
  while (queue.length && seen.size < 6 && pages.size < maxPages) {
    const next = queue.shift()!
    if (seen.has(next)) continue
    seen.add(next)
    const { text } = await safeFetchText(next, { maxBytes: 5_000_000, accept: 'application/xml,text/xml' })
    const parsed = parseSitemapUrls(text)
    parsed.pages.forEach((p) => pages.size < maxPages && pages.add(p))
    queue.push(...parsed.sitemaps.sort((a, b) => Number(/post|product|article|blog/i.test(b)) - Number(/post|product|article|blog/i.test(a))))
  }
  return [...pages].filter((p) => !/\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(p))
}
