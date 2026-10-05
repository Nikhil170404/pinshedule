import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { PLANS } from '@shared/plans'
import { limit, type AppEnv } from '../lib/auth'
import { AccountError } from '../lib/accounts'
import { aiEnabled } from '../lib/ai'
import { consumeUsage, getProfile, invalidateProfile, refundUsage } from '../lib/plan'
import { assistantError, runAssistant, takeProposal } from '../lib/assistant'
import { commitProposal, toolContext } from '../lib/assistant-tools'
import { ServiceError } from '../lib/pin-service'
import { errMsg } from '../lib/log'

export const assistant = new Hono<AppEnv>()

const chatBody = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).min(1).max(40),
})

/**
 * Streams events as Server-Sent Events. One user message costs one AI action from the monthly allowance,
 * however many tools the assistant uses to answer it.
 */
assistant.post('/chat', limit('heavy'), async (c) => {
  const userId = c.get('userId')
  if (c.get('accountStale')) throw new AccountError('That Pinterest account is no longer connected. Choose another account.', 404, { account_missing: true })
  const connection = c.get('connection')
  const parsed = chatBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== 'user') return c.json({ error: 'Send a message first.' }, 400)
  if (!aiEnabled()) return c.json({ error: 'The assistant is not available right now.' }, 503)

  const plan = PLANS[(await getProfile(userId)).plan]
  if (!(await consumeUsage(userId, 'ai', plan.ai_generations))) {
    return c.json({ error: `You have used all ${plan.ai_generations} AI actions on the ${plan.name} plan this month.`, upgrade_required: plan.id !== 'growth' }, 403)
  }
  await invalidateProfile(userId)

  c.header('X-Accel-Buffering', 'no')
  return streamSSE(c, async (stream) => {
    const send = (data: unknown) => stream.writeSSE({ data: JSON.stringify(data) })
    let answered = false
    try {
      await runAssistant(userId, connection, parsed.data.messages, async (e) => {
        if (e.type === 'message') answered = true
        await send(e)
      })
    } catch (e) {
      await send({ type: 'message', text: assistantError(e) })
    }
    if (!answered) {
      await refundUsage(userId, 'ai').catch(() => {})
      await invalidateProfile(userId)
    }
    await send({ type: 'done' })
  })
})

/** The only way a proposed change is executed: an explicit user confirmation. Single use. */
assistant.post('/execute', limit('default'), async (c) => {
  const userId = c.get('userId')
  const parsed = z.object({ proposal_id: z.string().uuid() }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'proposal_id required' }, 400)
  const proposal = await takeProposal(userId, parsed.data.proposal_id)
  if (!proposal) return c.json({ error: 'This confirmation expired. Ask the assistant again.' }, 410)
  try {
    return c.json({ ok: true, message: await commitProposal(await toolContext(userId, c.get('accountStale') ? null : c.get('connection')), proposal.tool, proposal.payload) })
  } catch (e) {
    if (e instanceof ServiceError) return c.json({ error: e.message, ...e.extra }, e.status as 400)
    return c.json({ error: `That did not work: ${errMsg(e)}` }, 502)
  }
})
