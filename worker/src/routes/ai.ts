import { Hono } from 'hono'
import { z } from 'zod'
import { PLANS } from '@shared/plans'
import { limit, type AppEnv } from '../lib/auth'
import { db } from '../lib/clients'
import { aiEnabled, captionOptions, cosine, embed } from '../lib/ai'
import { consumeUsage, getProfile, invalidateProfile, refundUsage } from '../lib/plan'
import { PinterestError } from '../lib/pinterest'
import { NotConnectedError } from '../lib/tokens'
import { loadBoards } from './boards'
import { errMsg, log } from '../lib/log'

export const ai = new Hono<AppEnv>()
ai.use('*', limit('default'))

ai.post('/caption', limit('heavy'), async (c) => {
  const userId = c.get('userId')
  const parsed = z.object({ topic: z.string().trim().min(2).max(300) }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Describe what the pin is about (at least 2 characters).' }, 400)
  if (!aiEnabled()) return c.json({ error: 'AI writing is not available right now.' }, 503)

  const plan = PLANS[(await getProfile(userId)).plan]
  if (!(await consumeUsage(userId, 'ai', plan.ai_generations))) {
    return c.json({ error: `You have used all ${plan.ai_generations} AI generations on the ${plan.name} plan this month.`, upgrade_required: plan.id !== 'growth' }, 403)
  }
  await invalidateProfile(userId)
  try {
    return c.json({ options: await captionOptions(parsed.data.topic) })
  } catch (e) {
    await refundUsage(userId, 'ai').catch(() => {})
    await invalidateProfile(userId)
    log.error('ai caption failed', { error: errMsg(e) })
    return c.json({ error: 'AI could not write that. Try rephrasing.' }, 502)
  }
})

const textBody = z.object({ text: z.string().trim().min(8).max(1500) })

/** Vector search: has this user already pinned something very close to this? */
ai.post('/similar', async (c) => {
  const userId = c.get('userId')
  const parsed = textBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success || !aiEnabled()) return c.json({ matches: [] })
  try {
    const [vec] = await embed([parsed.data.text])
    const { data, error } = await db.rpc('match_pins', { p_user: userId, p_embedding: JSON.stringify(vec), p_threshold: 0.86, p_limit: 3 })
    if (error) throw new Error(error.message)
    return c.json({ matches: data ?? [] })
  } catch (e) {
    log.warn('similar failed', { error: errMsg(e) })
    return c.json({ matches: [] }) // a warning is a nicety; never block scheduling
  }
})

/** Vector search: which of the user's boards fits this pin best? */
ai.post('/suggest-board', async (c) => {
  const userId = c.get('userId')
  const parsed = textBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success || !aiEnabled()) return c.json({ suggestions: [] })
  try {
    const boards = (await loadBoards(userId)).slice(0, 100)
    if (boards.length < 2) return c.json({ suggestions: [] })
    const vecs = await embed([parsed.data.text, ...boards.map((b) => `${b.name}. ${b.description}`)])
    const ranked = boards
      .map((b, i) => ({ id: b.id, name: b.name, score: cosine(vecs[0], vecs[i + 1]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter((r) => r.score >= 0.25)
    return c.json({ suggestions: ranked.map((r) => ({ ...r, score: Math.round(r.score * 100) / 100 })) })
  } catch (e) {
    if (e instanceof NotConnectedError || e instanceof PinterestError) return c.json({ suggestions: [] })
    log.warn('suggest-board failed', { error: errMsg(e) })
    return c.json({ suggestions: [] })
  }
})
