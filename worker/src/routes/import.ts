import { Hono } from 'hono'
import { z } from 'zod'
import { PLANS } from '@shared/plans'
import { limit, type AppEnv } from '../lib/auth'
import { db, mapLimit } from '../lib/clients'
import { safeFetchText, assertPublicUrl } from '../lib/safe-fetch'
import { extractImages, metaContent, pageTitle, parseSitemapUrls } from '../lib/html'
import { aiEnabled, pinCopy } from '../lib/ai'
import { consumeUsage, getProfile, refundUsage } from '../lib/plan'
import { errMsg } from '../lib/log'

export const importer = new Hono<AppEnv>()
importer.use('*', limit('heavy'))

async function importOne(userId: string, url: string) {
  const { text: html, finalUrl } = await safeFetchText(url)
  const title = metaContent(html, 'property', 'og:title') || pageTitle(html) || new URL(finalUrl).hostname
  const description = metaContent(html, 'property', 'og:description') || metaContent(html, 'name', 'description') || ''
  const images = extractImages(html, finalUrl)

  const { count } = await db
    .from('scheduled_pins')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('destination_url', url)
  const is_duplicate = (count ?? 0) > 0

  let copy: { titles: string[]; description: string; alt_text: string } = {
    titles: [title.slice(0, 100)], description: description.slice(0, 500), alt_text: '',
  }
  if (aiEnabled()) {
    try { copy = await pinCopy({ title, description, url }) } catch { /* fall back to page metadata */ }
  }
  return { url, page_title: title, images, ai: copy, is_duplicate }
}

const urlSchema = z.string().trim().url().max(2048)

importer.post('/url', async (c) => {
  const userId = c.get('userId')
  const parsed = z.object({ url: urlSchema }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Enter a valid URL starting with https://' }, 400)

  const plan = PLANS[(await getProfile(userId)).plan]
  if (!(await consumeUsage(userId, 'imports', plan.website_imports))) {
    return c.json({ error: `You have used all ${plan.website_imports} website imports on the ${plan.name} plan this month.`, upgrade_required: plan.id !== 'growth' }, 403)
  }
  try {
    await assertPublicUrl(parsed.data.url)
    return c.json(await importOne(userId, parsed.data.url))
  } catch (e) {
    await refundUsage(userId, 'imports').catch(() => {})
    return c.json({ error: `Could not import that page: ${errMsg(e)}` }, 422)
  }
})

/** Several pages at once (sitemap picks, pasted lists). Failed pages are refunded. */
importer.post('/bulk', async (c) => {
  const userId = c.get('userId')
  const parsed = z.object({ urls: z.array(urlSchema).min(1).max(25) }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Provide 1 to 25 valid URLs.' }, 400)
  const profilePlan = PLANS[(await getProfile(userId)).plan]
  if (!profilePlan.bulk_upload) return c.json({ error: 'Bulk import is available on paid plans.', upgrade_required: true }, 403)

  const urls = [...new Set(parsed.data.urls)]
  if (!(await consumeUsage(userId, 'imports', profilePlan.website_imports, urls.length))) {
    return c.json({ error: `Not enough website imports left this month for ${urls.length} pages.`, upgrade_required: profilePlan.id !== 'growth' }, 403)
  }
  const results = await mapLimit(urls, 4, async (u) => {
    try { return { ok: true as const, ...(await importOne(userId, u)) } }
    catch (e) { return { ok: false as const, url: u, error: errMsg(e) } }
  })
  const failed = results.filter((r) => !r.ok).length
  if (failed) await refundUsage(userId, 'imports', failed).catch(() => {})
  return c.json({ results })
})

/** List page URLs from a sitemap (Pro and above). Reads at most a few sitemap files. */
importer.post('/sitemap', async (c) => {
  const userId = c.get('userId')
  const parsed = z.object({ url: urlSchema }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Enter a valid sitemap or website URL.' }, 400)
  if (!PLANS[(await getProfile(userId)).plan].sitemap_import) return c.json({ error: 'Sitemap import is available on the Pro plan and above.', upgrade_required: true }, 403)

  try {
    let start = parsed.data.url
    const u = new URL(start)
    if (!/\.xml(\.gz)?$/i.test(u.pathname)) start = `${u.origin}/sitemap.xml`
    const pages = new Set<string>()
    const queue = [start]
    const seen = new Set<string>()
    while (queue.length && seen.size < 6 && pages.size < 500) {
      const next = queue.shift()!
      if (seen.has(next)) continue
      seen.add(next)
      const { text } = await safeFetchText(next, { maxBytes: 5_000_000, accept: 'application/xml,text/xml' })
      const parsedXml = parseSitemapUrls(text)
      parsedXml.pages.forEach((p) => pages.size < 500 && pages.add(p))
      // Prefer post/product sitemaps over tag/category ones.
      queue.push(...parsedXml.sitemaps.sort((a, b) => Number(/post|product|article|blog/i.test(b)) - Number(/post|product|article|blog/i.test(a))))
    }
    const list = [...pages].filter((p) => !/\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(p))
    if (list.length === 0) return c.json({ error: 'No pages found in that sitemap.' }, 422)
    return c.json({ urls: list })
  } catch (e) {
    return c.json({ error: `Could not read the sitemap: ${errMsg(e)}` }, 422)
  }
})
