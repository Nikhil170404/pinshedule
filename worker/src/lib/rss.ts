import { decodeEntities } from './html'

export interface FeedItem { url: string; title: string; description: string; image: string | null }

const CDATA = /<!\[CDATA\[([\s\S]*?)\]\]>/g
const unwrap = (s: string) => s.replace(CDATA, '$1')
const stripTags = (s: string) => decodeEntities(unwrap(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

/** Text of the first <tag>…</tag> in a block (tag may carry a namespace prefix), still containing markup. */
function inner(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? unwrap(m[1]) : null
}

function absolute(raw: string | null | undefined, base: string): string | null {
  if (!raw) return null
  try {
    const u = new URL(decodeEntities(raw.trim()), base)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch { return null }
}

function linkOf(block: string, base: string): string | null {
  // Atom: <link rel="alternate" href="..."/> (rel defaults to alternate). RSS: <link>url</link>.
  const atom = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)].map((m) => m[1])
  for (const attrs of atom) {
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1]
    const rel = attrs.match(/rel\s*=\s*["']([^"']+)["']/i)?.[1] ?? 'alternate'
    if (href && rel === 'alternate') return absolute(href, base)
  }
  const text = inner(block, 'link')?.trim()
  return absolute(text || inner(block, 'guid')?.trim(), base)
}

function imageOf(block: string, html: string, base: string): string | null {
  const media = block.match(/<media:(?:content|thumbnail)\b[^>]*?url\s*=\s*["']([^"']+)["']/i)?.[1]
  const enclosure = block.match(/<enclosure\b[^>]*?>/i)?.[0]
  const encUrl = enclosure && /type\s*=\s*["']image\//i.test(enclosure) ? enclosure.match(/url\s*=\s*["']([^"']+)["']/i)?.[1] : null
  const inline = decodeEntities(html).match(/<img\b[^>]*?src\s*=\s*["']([^"']+)["']/i)?.[1]
  return absolute(media ?? encUrl ?? inline, base)
}

/** Parse an RSS 2.0 or Atom feed. Items without a usable link are skipped. */
export function parseFeed(xml: string, feedUrl: string, max = 50): FeedItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => m[2])
  const out: FeedItem[] = []
  const seen = new Set<string>()
  for (const b of blocks) {
    const url = linkOf(b, feedUrl)
    if (!url || seen.has(url)) continue
    seen.add(url)
    const html = inner(b, 'content:encoded') ?? inner(b, 'content') ?? inner(b, 'description') ?? inner(b, 'summary') ?? ''
    out.push({
      url,
      title: stripTags(inner(b, 'title') ?? '').slice(0, 100),
      description: stripTags(inner(b, 'description') ?? inner(b, 'summary') ?? html).slice(0, 500),
      image: imageOf(b, html, feedUrl),
    })
    if (out.length >= max) break
  }
  return out
}
