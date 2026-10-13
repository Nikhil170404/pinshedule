import { Hono } from 'hono'
import { z } from 'zod'
import { anglesFor, clampCount, nearDuplicates } from '@shared/variations'
import { limit, type AppEnv } from '../lib/auth'
import { safeFetchText, assertPublicUrl } from '../lib/safe-fetch'
import { extractImages, metaContent, pageTitle } from '../lib/html'
import { aiEnabled, variationConcepts } from '../lib/ai'
import { consumeUsage, getProfile, invalidateProfile, refundUsage } from '../lib/plan'
import { errMsg, log } from '../lib/log'

export const variations = new Hono<AppEnv>()
variations.use('*', limit('heavy'))

const visibleText = (html: string) =>
  html.replace(/<(script|style|noscript|svg|nav|footer|header)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()

/**
 * 5 to 20 different pin concepts from one page. Costs one page import and one AI generation from the monthly
 * allowances (refunded if anything fails). Images are drawn in the browser, so no image model is called here.
 */
variations.post('/', async (c) => {
  const userId = c.get('userId')
  const parsed = z.object({ url: z.string().trim().url().max(2048), count: z.number().optional() }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Enter a valid page address starting with https://' }, 400)
  if (!aiEnabled()) return c.json({ error: 'AI is not available right now.' }, 503)
  const count = clampCount(parsed.data.count)

  const plan = (await getProfile(userId)).limits
  if (!(await consumeUsage(userId, 'imports', plan.website_imports))) {
    return c.json({ error: `You have used all ${plan.website_imports} website imports on the ${plan.name} plan this month.`, upgrade_required: plan.id !== 'growth' }, 403)
  }
  if (!(await consumeUsage(userId, 'ai', plan.ai_generations))) {
    await refundUsage(userId, 'imports').catch(() => {})
    await invalidateProfile(userId)
    return c.json({ error: `You have used all ${plan.ai_generations} AI generations on the ${plan.name} plan this month.`, upgrade_required: plan.id !== 'growth' }, 403)
  }
  try {
    await assertPublicUrl(parsed.data.url)
    const { text: html, finalUrl } = await safeFetchText(parsed.data.url)
    const title = metaContent(html, 'property', 'og:title') || pageTitle(html) || new URL(finalUrl).hostname
    const description = metaContent(html, 'property', 'og:description') || metaContent(html, 'name', 'description') || ''
    const images = extractImages(html, finalUrl)
    const concepts = await variationConcepts({ title, description, url: finalUrl, text: visibleText(html) }, anglesFor(count))
    await invalidateProfile(userId)
    return c.json({ url: finalUrl, page_title: title, images, concepts, near_duplicates: nearDuplicates(concepts) })
  } catch (e) {
    await refundUsage(userId, 'imports').catch(() => {})
    await refundUsage(userId, 'ai').catch(() => {})
    await invalidateProfile(userId)
    log.warn('variations failed', { error: errMsg(e) })
    return c.json({ error: `Could not create variations: ${errMsg(e)}` }, 422)
  }
})
