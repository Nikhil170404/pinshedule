import { z } from 'zod'
import { PLANS } from '@shared/plans'
import { db, withLock } from './clients'
import { getProfile } from './plan'
import { commitSchedule, prepareSchedule } from './pin-service'
import { ServiceError } from './service-error'
import { listSitemapPages } from './sitemap'
import { importPageMetered } from '../routes/import'
import { notifyUser } from './email'
import { NotConnectedError } from './tokens'
import { errMsg, log } from './log'

export const sitemapConfig = z.object({
  sitemap_url: z.string().trim().url().max(2048),
  board_id: z.string().trim().min(1),
  board_name: z.string().trim().max(100).default(''),
  per_day: z.number().int().min(1).max(5).default(2),
})
export const evergreenConfig = z.object({
  min_age_days: z.number().int().min(30).max(365).default(60),
  per_day: z.number().int().min(1).max(5).default(1),
  /** Re-pin the pins that earned the most saves first (otherwise oldest first). */
  best_first: z.boolean().default(true),
})
export type SitemapConfig = z.infer<typeof sitemapConfig>
export type EvergreenConfig = z.infer<typeof evergreenConfig>

export interface AutomationRow {
  id: string; user_id: string; connection_id: string | null; kind: 'sitemap' | 'evergreen'; enabled: boolean
  config: Record<string, unknown>; total_created: number
}

const DAY = 86_400_000
/** Never let an automation queue more than a week ahead of itself (protects the monthly pin allowance). */
const MAX_AHEAD_DAYS = 7

/**
 * Order evergreen candidates. Pure so it can be tested: highest saves first when asked (ties broken by
 * impressions, then age), otherwise the oldest first.
 */
export function rankEvergreen<T extends { id: string; published_at: string }>(pins: T[], stats: Map<string, { saves: number; impressions: number }>, bestFirst: boolean): T[] {
  return [...pins].sort((a, b) => {
    if (bestFirst) {
      const sa = stats.get(a.id), sb = stats.get(b.id)
      const d = (sb?.saves ?? 0) - (sa?.saves ?? 0) || (sb?.impressions ?? 0) - (sa?.impressions ?? 0)
      if (d) return d
    }
    return a.published_at.localeCompare(b.published_at)
  })
}

async function pendingFromAutomation(id: string) {
  const { count } = await db.from('scheduled_pins').select('id', { count: 'exact', head: true }).eq('automation_id', id).eq('status', 'pending')
  return count ?? 0
}

async function runSitemap(a: AutomationRow, cfg: SitemapConfig): Promise<{ created: number; note: string }> {
  const pages = await listSitemapPages(cfg.sitemap_url)
  if (pages.length === 0) return { created: 0, note: 'The sitemap has no pages.' }

  // Skip pages already pinned by this user and pages this automation already handled (including ones with no usable image).
  const seen = new Set<string>()
  for (let i = 0; i < pages.length; i += 200) {
    const chunk = pages.slice(i, i + 200)
    const [pinned, handled] = await Promise.all([
      db.from('scheduled_pins').select('destination_url').eq('user_id', a.user_id).in('destination_url', chunk),
      db.from('automation_urls').select('url').eq('automation_id', a.id).in('url', chunk),
    ])
    pinned.data?.forEach((r) => seen.add(r.destination_url as string))
    handled.data?.forEach((r) => seen.add(r.url as string))
  }
  const fresh = pages.filter((p) => !seen.has(p))
  if (fresh.length === 0) return { created: 0, note: 'No new pages to pin. Waiting for new posts.' }

  const pins: { image_url: string; title: string; description: string; alt_text: string; board_id: string; board_name: string; destination_url: string; automation_id: string }[] = []
  const handled: { automation_id: string; url: string; outcome: string }[] = []
  let stopReason = ''
  for (const url of fresh.slice(0, cfg.per_day * 3)) {
    if (pins.length >= cfg.per_day) break
    try {
      const page = await importPageMetered(a.user_id, url)
      const image = page.images.find((i) => i.startsWith('https://'))
      if (!image) { handled.push({ automation_id: a.id, url, outcome: 'no_image' }); continue }
      pins.push({
        image_url: image, title: page.ai.titles[0] ?? page.page_title, description: page.ai.description, alt_text: page.ai.alt_text,
        board_id: cfg.board_id, board_name: cfg.board_name, destination_url: url, automation_id: a.id,
      })
      handled.push({ automation_id: a.id, url, outcome: 'scheduled' })
    } catch (e) {
      if (e instanceof ServiceError && e.status === 403) { stopReason = 'Out of website imports for this month.'; break }
      handled.push({ automation_id: a.id, url, outcome: 'unreadable' }) // do not retry a broken page forever
    }
  }
  if (pins.length === 0) {
    if (handled.length) await db.from('automation_urls').upsert(handled, { onConflict: 'automation_id,url' })
    return { created: 0, note: stopReason || 'The new pages had no usable image.' }
  }
  const prepared = await prepareSchedule(a.user_id, { pins, connection_id: a.connection_id ?? undefined, auto: { per_day: cfg.per_day } } as never)
  const out = await commitSchedule(a.user_id, prepared)
  await db.from('automation_urls').upsert(handled, { onConflict: 'automation_id,url' })
  return { created: out.created, note: `Scheduled ${out.created} new ${out.created === 1 ? 'page' : 'pages'}.${stopReason ? ' ' + stopReason : ''}` }
}

async function runEvergreen(a: AutomationRow, cfg: EvergreenConfig): Promise<{ created: number; note: string }> {
  const cutoff = new Date(Date.now() - cfg.min_age_days * DAY).toISOString()
  let q = db.from('scheduled_pins')
    .select('id, image_url, title, description, alt_text, board_id, board_name, destination_url, published_at')
    .eq('user_id', a.user_id).eq('status', 'published').is('recycled_from', null).lte('published_at', cutoff)
    .order('published_at', { ascending: true }).limit(300)
  if (a.connection_id) q = q.eq('connection_id', a.connection_id)
  const { data } = await q
  const candidates = (data ?? []) as { id: string; image_url: string; title: string; description: string; alt_text: string | null; board_id: string; board_name: string | null; destination_url: string | null; published_at: string }[]
  if (candidates.length === 0) return { created: 0, note: `No pins older than ${cfg.min_age_days} days yet.` }

  // A pin that was already re-pinned recently must wait its turn again.
  const ids = candidates.map((c) => c.id)
  const { data: kids } = await db.from('scheduled_pins').select('recycled_from').in('recycled_from', ids).gte('created_at', cutoff)
  const recent = new Set((kids ?? []).map((k) => k.recycled_from as string))
  const eligible = candidates.filter((c) => !recent.has(c.id) && c.image_url.startsWith('https://'))
  if (eligible.length === 0) return { created: 0, note: 'Everything eligible was re-pinned recently.' }

  const stats = new Map<string, { saves: number; impressions: number }>()
  if (cfg.best_first) {
    const { data: snaps } = await db.from('analytics_snapshots').select('pin_id, saves, impressions, snapshot_date').in('pin_id', eligible.map((e) => e.id)).order('snapshot_date', { ascending: false })
    for (const s of snaps ?? []) if (!stats.has(s.pin_id as string)) stats.set(s.pin_id as string, { saves: (s.saves as number) ?? 0, impressions: (s.impressions as number) ?? 0 })
  }
  const chosen = rankEvergreen(eligible, stats, cfg.best_first).slice(0, cfg.per_day)
  const pins = chosen.map((p) => ({
    image_url: p.image_url, title: p.title ?? '', description: p.description ?? '', alt_text: p.alt_text ?? '', board_id: p.board_id, board_name: p.board_name ?? '',
    destination_url: p.destination_url ?? '', automation_id: a.id, recycled_from: p.id,
  }))
  const prepared = await prepareSchedule(a.user_id, { pins, connection_id: a.connection_id ?? undefined, auto: { per_day: cfg.per_day } } as never)
  const out = await commitSchedule(a.user_id, prepared)
  return { created: out.created, note: `Re-pinned ${out.created} older ${out.created === 1 ? 'pin' : 'pins'}.` }
}

/** Run one automation now. Always records the outcome so the owner can see what happened. */
export async function runAutomation(a: AutomationRow) {
  const plan = PLANS[(await getProfile(a.user_id)).plan]
  let result = ''
  let created = 0
  let pause = ''
  try {
    if (a.kind === 'sitemap' && !plan.sitemap_import) pause = 'Paused: sitemap autopilot needs the Pro plan or higher.'
    else if (a.kind === 'evergreen' && !plan.smart_scheduler) pause = 'Paused: evergreen recycling needs a paid plan.'
    else if (await pendingFromAutomation(a.id) >= (a.config.per_day as number ?? 2) * MAX_AHEAD_DAYS) result = `Waiting: ${MAX_AHEAD_DAYS} days of pins are already queued.`
    else {
      const r = a.kind === 'sitemap' ? await runSitemap(a, sitemapConfig.parse(a.config)) : await runEvergreen(a, evergreenConfig.parse(a.config))
      created = r.created
      result = r.note
    }
  } catch (e) {
    if (e instanceof NotConnectedError) pause = 'Paused: the Pinterest account needs to be reconnected.'
    else if (e instanceof ServiceError) result = e.message
    else { result = `Could not run: ${errMsg(e).slice(0, 160)}`; log.warn('automation failed', { id: a.id, error: errMsg(e) }) }
  }
  await db.from('automations').update({
    last_run_at: new Date().toISOString(), last_result: pause || result, total_created: a.total_created + created,
    next_run_at: new Date(Date.now() + DAY).toISOString(), ...(pause ? { enabled: false } : {}),
  }).eq('id', a.id)
  if (pause) void notifyUser(a.user_id, 'automation_paused', 'An automation was paused', [pause, 'Fix the problem and turn it back on from the Automations page.'], '/dashboard/automations')
  return { created, result: pause || result }
}

/** Run everything that is due. Each automation is guarded by a lock so replicas never run it twice. */
export async function runDueAutomations() {
  const { data } = await db.from('automations').select('id, user_id, connection_id, kind, enabled, config, total_created')
    .eq('enabled', true).lte('next_run_at', new Date().toISOString()).order('next_run_at').limit(25)
  let ran = 0
  for (const a of (data ?? []) as AutomationRow[]) {
    const out = await withLock(`automation:${a.id}`, 600, () => runAutomation(a))
    if (out) ran++
  }
  if (ran) log.info('automations ran', { ran })
}
