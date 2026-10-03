const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ', '&apos;': "'" }
export const decodeEntities = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|#x27|nbsp|apos);/g, (m) => ENTITIES[m] ?? m)

export function metaContent(html: string, attr: 'property' | 'name', name: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const a = tag.match(new RegExp(`${attr}\\s*=\\s*["']${name}["']`, 'i'))
    if (!a) continue
    const c = tag.match(/content\s*=\s*("([^"]*)"|'([^']*)')/i)
    const v = c?.[2] ?? c?.[3]
    if (v) return decodeEntities(v.trim())
  }
  return null
}

export function pageTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]{1,300}?)<\/title>/i)
  return m ? decodeEntities(m[1].replace(/\s+/g, ' ').trim()) : null
}

const JUNK = /(logo|icon|sprite|avatar|favicon|pixel|tracking|badge|button|spinner|blank|placeholder|emoji|gravatar)/i

/** Candidate pin images: og/twitter images first, then <img> (incl. srcset and lazy-load attrs). */
export function extractImages(html: string, baseUrl: string, max = 24): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (raw: string | null | undefined) => {
    if (!raw) return
    const src = decodeEntities(raw.trim().split(/\s+/)[0])
    if (!src || src.startsWith('data:')) return
    let abs: string
    try { abs = new URL(src, baseUrl).href } catch { return }
    if (!/^https?:/i.test(abs) || /\.(svg|ico)(\?|$)/i.test(abs) || JUNK.test(abs)) return
    const key = abs.replace(/-\d{2,4}x\d{2,4}(?=\.\w+(\?|$))/, '')
    if (seen.has(key)) return
    seen.add(key)
    out.push(abs)
  }
  add(metaContent(html, 'property', 'og:image'))
  add(metaContent(html, 'name', 'twitter:image'))
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const w = Number(tag.match(/\bwidth\s*=\s*["']?(\d+)/i)?.[1] ?? 0)
    const h = Number(tag.match(/\bheight\s*=\s*["']?(\d+)/i)?.[1] ?? 0)
    if ((w && w < 200) || (h && h < 200)) continue
    const srcset = tag.match(/\bsrcset\s*=\s*["']([^"']+)["']/i)?.[1]
    let best: string | undefined
    if (srcset) {
      const cands = srcset.split(',').map((s) => s.trim().split(/\s+/)).map(([u, d]) => ({ u, w: parseInt(d ?? '0') || 0 }))
      best = cands.sort((a, b) => b.w - a.w)[0]?.u
    }
    add(best ?? tag.match(/\b(?:data-src|data-lazy-src|data-original|src)\s*=\s*["']([^"']+)["']/i)?.[1])
    if (out.length >= max) break
  }
  return out.slice(0, max)
}

export function parseSitemapUrls(xml: string): { pages: string[]; sitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]))
  const isIndex = /<sitemapindex/i.test(xml)
  return isIndex ? { pages: [], sitemaps: locs } : { pages: locs, sitemaps: [] }
}
