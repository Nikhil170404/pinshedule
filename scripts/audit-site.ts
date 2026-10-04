/**
 * Crawls a running copy of the site the way a search engine would and fails on anything that hurts indexing:
 * status codes, title/description, one h1, canonical, Open Graph, JSON-LD validity, image alt text, broken internal links,
 * and sitemap/robots consistency. Usage: npm run audit:site -- http://localhost:3100
 */
const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const problems: string[] = []
const flag = (url: string, msg: string) => problems.push(`${url.replace(base, '') || '/'}: ${msg}`)

const get = async (url: string) => {
  const r = await fetch(url, { redirect: 'manual' })
  return { status: r.status, text: await r.text(), headers: r.headers }
}
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1]
const metas = (html: string) => (html.match(/<meta\b[^>]*>/gi) ?? [])
const meta = (html: string, key: string, name: 'name' | 'property' = 'name') => {
  const tag = metas(html).find((m) => attr(m, name)?.toLowerCase() === key)
  return tag ? attr(tag, 'content') : undefined
}

async function main() {
  const sm = await get(`${base}/sitemap.xml`)
  if (sm.status !== 200) { console.error(`sitemap.xml returned ${sm.status}`); process.exit(1) }
  // Sitemap URLs carry the production origin; crawl the same paths on the server we were given.
  const paths = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/\/$/, '') || '/')
  if (new Set(paths).size !== paths.length) flag('sitemap.xml', 'contains duplicate URLs')

  const robots = await get(`${base}/robots.txt`)
  if (!/sitemap:/i.test(robots.text)) flag('robots.txt', 'does not point to the sitemap')
  if (/disallow:\s*\/\s*$/im.test(robots.text)) flag('robots.txt', 'blocks the whole site')
  for (const p of ['/dashboard']) if (!new RegExp(`disallow:\\s*${p}`, 'i').test(robots.text)) flag('robots.txt', `does not disallow ${p}`)

  const internal = new Map<string, string>() // link target -> first page that links to it
  const titles = new Map<string, string>()
  for (const path of paths) {
    const url = base + path
    const { status, text: html } = await get(url)
    if (status !== 200) { flag(url, `status ${status}`); continue }
    if (!/<html[^>]*\blang="[a-z-]+"/i.test(html)) flag(url, 'missing html lang')
    const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim()
    if (!title) flag(url, 'missing <title>')
    else {
      if (title.length > 65) flag(url, `title is ${title.length} characters`)
      if (titles.has(title)) flag(url, `same title as ${titles.get(title)}`)
      titles.set(title, path)
    }
    const desc = meta(html, 'description')
    if (!desc) flag(url, 'missing meta description')
    else if (desc.length < 70 || desc.length > 170) flag(url, `meta description is ${desc.length} characters`)
    const h1 = html.match(/<h1\b/gi)?.length ?? 0
    if (h1 !== 1) flag(url, `has ${h1} h1 elements`)
    const canonical = (html.match(/<link\b[^>]*rel="canonical"[^>]*>/i) ?? [])[0]
    if (!canonical) flag(url, 'missing canonical link')
    else if (new URL(attr(canonical, 'href')!, base).pathname.replace(/\/$/, '') !== (path === '/' ? '' : path)) flag(url, `canonical points to ${attr(canonical, 'href')}`)
    for (const key of ['og:title', 'og:description', 'og:image', 'og:url']) if (!meta(html, key, 'property')) flag(url, `missing ${key}`)
    if (!meta(html, 'twitter:card')) flag(url, 'missing twitter:card')
    if (/<meta[^>]*name="robots"[^>]*noindex/i.test(html)) flag(url, 'is marked noindex but is in the sitemap')
    for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { const j = JSON.parse(block[1]); if (!j['@context'] && !j['@graph']) flag(url, 'JSON-LD without @context') } catch { flag(url, 'invalid JSON-LD') }
    }
    for (const img of html.matchAll(/<img\b[^>]*>/gi)) if (!/\balt=/i.test(img[0])) flag(url, `image without alt text (${(attr(img[0], 'src') ?? '').slice(0, 50)})`)
    for (const a of html.matchAll(/<a\b[^>]*href="(\/[^"#?]*)[^"]*"/gi)) if (!internal.has(a[1])) internal.set(a[1], path)
  }

  // Every internal link a visitor can click must resolve (api and dashboard routes are not for crawlers).
  for (const [target, from] of internal) {
    if (/^\/(api|dashboard|_next)\b/.test(target) || /\.(png|jpg|svg|ico|webmanifest|txt|xml)$/.test(target)) continue
    const r = await fetch(base + target, { redirect: 'manual' })
    if (r.status >= 400) flag(`${base}${from}`, `links to ${target} which returns ${r.status}`)
  }

  // Public pages that are in no sitemap entry are invisible to crawlers.
  const linkedPublic = [...internal.keys()].filter((t) => !/^\/(api|dashboard|_next|login|signup)\b/.test(t) && !/\.[a-z]+$/.test(t))
  for (const t of linkedPublic) if (!paths.includes(t.replace(/\/$/, '') || '/')) flag('sitemap.xml', `does not list ${t}, which is linked from ${internal.get(t)}`)

  if (problems.length) { console.error(`Site audit failed (${problems.length}):\n  ${problems.join('\n  ')}`); process.exit(1) }
  console.log(`Site audit passed: ${paths.length} pages, ${internal.size} internal links checked`)

}
main().catch((e) => { console.error(e); process.exit(1) })
