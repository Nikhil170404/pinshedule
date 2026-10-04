import { Hono } from 'hono'
import { z } from 'zod'
import { PLANS } from '@shared/plans'
import { limit, type AppEnv } from '../lib/auth'
import { db, withLock } from '../lib/clients'
import { getProfile } from '../lib/plan'
import { resolveConnection } from '../lib/connections'
import { ServiceError } from '../lib/service-error'
import { listSitemapPages } from '../lib/sitemap'
import { assertPublicUrl } from '../lib/safe-fetch'
import { evergreenConfig, runAutomation, sitemapConfig, type AutomationRow } from '../lib/automations'
import { loadBoards } from './boards'
import { NotConnectedError } from '../lib/tokens'
import { errMsg } from '../lib/log'

export const automations = new Hono<AppEnv>()
automations.use('*', limit('default'))

const COLUMNS = 'id, connection_id, kind, enabled, config, next_run_at, last_run_at, last_result, total_created, created_at'

automations.get('/', async (c) => {
  const { data } = await db.from('automations').select(COLUMNS).eq('user_id', c.get('userId')).order('created_at')
  return c.json({ automations: data ?? [] })
})

const createBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('sitemap'), connection_id: z.string().uuid().optional(), config: sitemapConfig }),
  z.object({ kind: z.literal('evergreen'), connection_id: z.string().uuid().optional(), config: evergreenConfig }),
])

/** Create an automation after checking the plan, the account, the board and (for sitemaps) that the sitemap works. */
export async function createAutomation(userId: string, input: z.infer<typeof createBody>) {
  const plan = PLANS[(await getProfile(userId)).plan]
  if (input.kind === 'sitemap' && !plan.sitemap_import) throw new ServiceError('Sitemap autopilot is available on the Pro plan and above.', 403, { upgrade_required: true })
  if (input.kind === 'evergreen' && !plan.smart_scheduler) throw new ServiceError('Evergreen recycling is available on paid plans.', 403, { upgrade_required: true })
  const { count } = await db.from('automations').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('enabled', true)
  if ((count ?? 0) >= plan.automations) throw new ServiceError(`Your ${plan.name} plan runs up to ${plan.automations} automation${plan.automations === 1 ? '' : 's'} at once.`, 403, { upgrade_required: plan.id !== 'growth' })

  const connectionId = await resolveConnection(userId, input.connection_id)
  let config: Record<string, unknown> = input.config
  if (input.kind === 'sitemap') {
    const boards = await loadBoards(userId, false, connectionId)
    const board = boards.find((b) => b.id === input.config.board_id)
    if (!board) throw new ServiceError('That board was not found on the selected Pinterest account.')
    try {
      await assertPublicUrl(input.config.sitemap_url)
      const pages = await listSitemapPages(input.config.sitemap_url, 50)
      if (pages.length === 0) throw new Error('no pages found')
    } catch (e) {
      throw new ServiceError(`Could not read that sitemap: ${errMsg(e)}`, 422)
    }
    config = { ...input.config, board_name: board.name }
  }
  const { data, error } = await db.from('automations').insert({ user_id: userId, connection_id: connectionId, kind: input.kind, config }).select(COLUMNS).single()
  if (error) throw new ServiceError('Could not create the automation.', 500)
  return data
}

automations.post('/', async (c) => {
  const parsed = createBody.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid automation' }, 400)
  try {
    return c.json({ automation: await createAutomation(c.get('userId'), parsed.data) })
  } catch (e) {
    if (e instanceof ServiceError) return c.json({ error: e.message, ...e.extra }, e.status as 400)
    if (e instanceof NotConnectedError) return c.json({ error: e.message, reconnect: true }, 409)
    throw e
  }
})

automations.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const body = z.object({ enabled: z.boolean().optional(), per_day: z.number().int().min(1).max(5).optional(), min_age_days: z.number().int().min(30).max(365).optional(), best_first: z.boolean().optional() })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Invalid change' }, 400)
  const { data: cur } = await db.from('automations').select('id, kind, config').eq('id', c.req.param('id')).eq('user_id', userId).maybeSingle()
  if (!cur) return c.json({ error: 'Automation not found.' }, 404)

  const patch: Record<string, unknown> = {}
  if (body.data.enabled !== undefined) {
    if (body.data.enabled) {
      const plan = PLANS[(await getProfile(userId)).plan]
      const { count } = await db.from('automations').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('enabled', true).neq('id', cur.id)
      if ((count ?? 0) >= plan.automations) return c.json({ error: `Your ${plan.name} plan runs up to ${plan.automations} automation${plan.automations === 1 ? '' : 's'} at once.`, upgrade_required: plan.id !== 'growth' }, 403)
      if (cur.kind === 'sitemap' && !plan.sitemap_import) return c.json({ error: 'Sitemap autopilot is available on the Pro plan and above.', upgrade_required: true }, 403)
      if (cur.kind === 'evergreen' && !plan.smart_scheduler) return c.json({ error: 'Evergreen recycling is available on paid plans.', upgrade_required: true }, 403)
      patch.next_run_at = new Date().toISOString()
    }
    patch.enabled = body.data.enabled
  }
  const { per_day, min_age_days, best_first } = body.data
  if (per_day !== undefined || min_age_days !== undefined || best_first !== undefined) {
    const next = { ...(cur.config as Record<string, unknown>) }
    if (per_day !== undefined) next.per_day = per_day
    if (cur.kind === 'evergreen') { if (min_age_days !== undefined) next.min_age_days = min_age_days; if (best_first !== undefined) next.best_first = best_first }
    patch.config = next
  }
  await db.from('automations').update(patch).eq('id', cur.id).eq('user_id', userId)
  return c.json({ ok: true })
})

automations.delete('/:id', async (c) => {
  await db.from('automations').delete().eq('id', c.req.param('id')).eq('user_id', c.get('userId'))
  return c.json({ ok: true })
})

/** Run now (once every 5 minutes per automation). Returns immediately; the result appears on the card. */
automations.post('/:id/run', async (c) => {
  const userId = c.get('userId')
  const { data } = await db.from('automations').select('id, user_id, connection_id, kind, enabled, config, total_created').eq('id', c.req.param('id')).eq('user_id', userId).maybeSingle()
  if (!data) return c.json({ error: 'Automation not found.' }, 404)
  if (!data.enabled) return c.json({ error: 'Turn this automation on first.' }, 409)
  const started = await withLock(`automation-manual:${data.id}`, 300, async () => { void withLock(`automation:${data.id}`, 600, () => runAutomation(data as AutomationRow)); return true })
  if (!started) return c.json({ error: 'It just ran. Try again in a few minutes.' }, 429)
  return c.json({ ok: true })
})
