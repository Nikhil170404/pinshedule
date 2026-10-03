import { Hono } from 'hono'
import { z } from 'zod'
import { PLANS } from '@shared/plans'
import { limit, type AppEnv } from '../lib/auth'
import { aiEnabled, captionOptions } from '../lib/ai'
import { consumeUsage, getProfile, refundUsage } from '../lib/plan'
import { errMsg, log } from '../lib/log'

export const ai = new Hono<AppEnv>()
ai.use('*', limit('heavy'))

ai.post('/caption', async (c) => {
  const userId = c.get('userId')
  const parsed = z.object({ topic: z.string().trim().min(2).max(300) }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Describe what the pin is about (at least 2 characters).' }, 400)
  if (!aiEnabled()) return c.json({ error: 'AI writing is not available right now.' }, 503)

  const plan = PLANS[(await getProfile(userId)).plan]
  if (!(await consumeUsage(userId, 'ai', plan.ai_generations))) {
    return c.json({ error: `You have used all ${plan.ai_generations} AI generations on the ${plan.name} plan this month.`, upgrade_required: plan.id !== 'growth' }, 403)
  }
  try {
    return c.json({ options: await captionOptions(parsed.data.topic) })
  } catch (e) {
    await refundUsage(userId, 'ai').catch(() => {})
    log.error('ai caption failed', { error: errMsg(e) })
    return c.json({ error: 'AI could not write that. Try rephrasing.' }, 502)
  }
})
