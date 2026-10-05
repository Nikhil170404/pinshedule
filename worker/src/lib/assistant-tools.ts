import { z } from 'zod'
import { PIN_LIMITS, PLANS, type Plan } from '@shared/plans'
import { isValidTimeZone } from '@shared/schedule'
import { db, redis } from './clients'
import { captionOptions, cosine, embed, aiEnabled } from './ai'
import { getProfile, invalidateProfile } from './plan'
import { buildSummary } from './summary'
import { createBoard } from './pinterest'
import { withPinterest } from './tokens'
import {
  commitSchedule, deletePins, patchBody, prepareSchedule, previewSlots, retryPins, ServiceError, updatePin, type Prepared, type PreparedRow,
} from './pin-service'
import { loadBoards } from '../routes/boards'
import { AccountError, type Connection } from './accounts'
import { getKeywords } from '../routes/keywords'
import { importPageMetered } from '../routes/import'

export interface Proposal {
  id: string
  tool: string
  summary: string
  /** Short human-readable preview lines shown on the confirmation card. */
  details: string[]
}

export interface UiAction { type: 'navigate'; path: string; label: string }

type Json = Record<string, unknown>
/** `connection` is the Pinterest account the user has selected in the app: every tool acts on it only. */
interface Ctx { userId: string; connection: Connection | null; tz: string; planId: Plan }

interface ReadTool { kind: 'read'; label: string; run: (ctx: Ctx, args: Json) => Promise<unknown> }
interface WriteTool {
  kind: 'write'
  label: string
  prepare: (ctx: Ctx, args: Json) => Promise<{ summary: string; details: string[]; payload: unknown }>
  commit: (ctx: Ctx, payload: never) => Promise<string>
}
interface UiTool { kind: 'ui'; label: string; run: (args: Json) => UiAction }

function account(c: Ctx): Connection {
  if (!c.connection) throw new AccountError('Connect a Pinterest account first.', 409)
  return c.connection
}

const fmt = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
const clip = (s: string | null | undefined, n: number) => (s && s.length > n ? s.slice(0, n - 1) + '...' : (s ?? ''))

async function resolveBoard(connectionId: string, ref: string): Promise<{ id: string; name: string }> {
  const boards = await loadBoards(connectionId)
  const r = ref.trim().toLowerCase()
  const exact = boards.find((b) => b.id === ref.trim()) ?? boards.find((b) => b.name.toLowerCase() === r)
  if (exact) return { id: exact.id, name: exact.name }
  const partial = boards.filter((b) => b.name.toLowerCase().includes(r))
  if (partial.length === 1) return { id: partial[0].id, name: partial[0].name }
  const names = boards.slice(0, 15).map((b) => b.name).join(', ')
  throw new ServiceError(partial.length > 1
    ? `"${ref}" matches several boards (${partial.map((b) => b.name).join(', ')}). Ask the user which one.`
    : `No board named "${ref}". Available boards: ${names || 'none'}.`)
}

const isoDate = z.string().datetime({ offset: true })

// ───────────────────────── read tools ─────────────────────────
const readTools: Record<string, ReadTool> = {
  get_account_summary: { kind: 'read', label: 'Checking your account', run: (c) => buildSummary(c.userId, c.connection) },

  list_boards: {
    kind: 'read', label: 'Loading your boards',
    run: async (c) => (await loadBoards(account(c).id)).map((b) => ({ id: b.id, name: b.name, pins: b.pin_count, privacy: b.privacy, about: clip(b.description, 80) })),
  },

  list_pins: {
    kind: 'read', label: 'Looking through your pins',
    run: async (c, a) => {
      const args = z.object({
        statuses: z.array(z.enum(['pending', 'processing', 'published', 'failed'])).optional(),
        from: isoDate.optional(), to: isoDate.optional(), search: z.string().max(80).optional(),
        newest_first: z.boolean().optional(), limit: z.number().int().min(1).max(30).optional(),
      }).parse(a)
      let q = db.from('scheduled_pins').select('id,title,status,scheduled_at,board_name,error_message', { count: 'exact' }).eq('connection_id', account(c).id)
        .order('scheduled_at', { ascending: !args.newest_first }).limit(args.limit ?? 15)
      if (args.statuses?.length) q = q.in('status', args.statuses)
      if (args.from) q = q.gte('scheduled_at', args.from)
      if (args.to) q = q.lt('scheduled_at', args.to)
      if (args.search) q = q.ilike('title', `%${args.search.replace(/[%_]/g, ' ')}%`)
      const { data, count, error } = await q
      if (error) throw new ServiceError('Could not read pins')
      return {
        total_matching: count ?? 0,
        pins: (data ?? []).map((p) => ({ id: p.id, title: clip(p.title, 60), status: p.status, at: p.scheduled_at, board: p.board_name, error: clip(p.error_message, 100) || undefined })),
      }
    },
  },

  get_queue_stats: {
    kind: 'read', label: 'Counting your queue',
    run: async (c) => {
      const id = account(c).id
      const statuses = ['pending', 'published', 'failed'] as const
      const counts = await Promise.all(statuses.map((s) => db.from('scheduled_pins').select('id', { count: 'exact', head: true }).eq('connection_id', id).eq('status', s)))
      const { data: next } = await db.from('scheduled_pins').select('scheduled_at').eq('connection_id', id).eq('status', 'pending').order('scheduled_at').limit(1).maybeSingle()
      const { data: last } = await db.from('scheduled_pins').select('scheduled_at').eq('connection_id', id).eq('status', 'pending').order('scheduled_at', { ascending: false }).limit(1).maybeSingle()
      return { scheduled: counts[0].count ?? 0, published: counts[1].count ?? 0, failed: counts[2].count ?? 0, next_pin_at: next?.scheduled_at ?? null, queue_runs_until: last?.scheduled_at ?? null }
    },
  },

  get_analytics: {
    kind: 'read', label: 'Reading your analytics',
    run: async (c, a) => {
      const plan = PLANS[c.planId]
      const days = Math.min(Math.max(1, Number(a.days) || 30), plan.analytics_days)
      const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
      const { data } = await db.from('account_analytics').select('day,impressions,saves,pin_clicks,outbound_clicks').eq('connection_id', account(c).id).gte('day', since).order('day')
      if (!data?.length) return { note: 'No analytics yet. Data appears 1 to 2 days after pins publish.' }
      const sum = (k: 'impressions' | 'saves' | 'pin_clicks' | 'outbound_clicks') => data.reduce((t, d) => t + (d[k] ?? 0), 0)
      const best = [...data].sort((x, y) => y.impressions - x.impressions)[0]
      const { data: snaps } = await db.from('analytics_snapshots').select('pin_id,impressions,saves,outbound_clicks').eq('connection_id', account(c).id).order('snapshot_date', { ascending: false }).limit(200)
      const seen = new Map<string, { impressions: number; saves: number; clicks: number }>()
      for (const s of snaps ?? []) if (s.pin_id && !seen.has(s.pin_id)) seen.set(s.pin_id, { impressions: s.impressions ?? 0, saves: s.saves ?? 0, clicks: s.outbound_clicks ?? 0 })
      const top = [...seen.entries()].sort((x, y) => y[1].impressions - x[1].impressions).slice(0, 5)
      const { data: titles } = top.length ? await db.from('scheduled_pins').select('id,title').in('id', top.map(([id]) => id)) : { data: [] }
      const tmap = new Map((titles ?? []).map((t) => [t.id, t.title]))
      return {
        days, totals: { impressions: sum('impressions'), saves: sum('saves'), pin_clicks: sum('pin_clicks'), outbound_clicks: sum('outbound_clicks') },
        best_day: { day: best.day, impressions: best.impressions },
        top_pins: top.map(([id, m]) => ({ title: clip(tmap.get(id), 60), ...m })),
      }
    },
  },

  trending_keywords: {
    kind: 'read', label: 'Checking Pinterest trends',
    run: async (c, a) => (await getKeywords(account(c).id, String(a.region ?? 'US'), String(a.query ?? ''))).slice(0, 20)
      .map((k) => ({ keyword: k.keyword, month_growth_pct: k.pct_growth_mom })),
  },

  import_page: {
    kind: 'read', label: 'Reading that web page',
    run: async (c, a) => {
      const url = z.string().url().parse(a.url)
      const r = await importPageMetered(c.userId, url, c.connection?.id ?? null)
      return { url: r.url, page_title: r.page_title, already_pinned: r.is_duplicate, image_urls: r.images.slice(0, 10), suggested_titles: r.ai.titles, suggested_description: r.ai.description, suggested_alt_text: r.ai.alt_text }
    },
  },

  generate_pin_copy: {
    kind: 'read', label: 'Writing pin copy',
    run: async (_c, a) => captionOptions(z.string().min(2).max(300).parse(a.topic)),
  },

  find_similar_pins: {
    kind: 'read', label: 'Searching for similar pins',
    run: async (c, a) => {
      if (!aiEnabled()) return []
      const [vec] = await embed([z.string().min(8).max(1500).parse(a.text)])
      const { data } = await db.rpc('match_pins', { p_user: c.userId, p_embedding: JSON.stringify(vec), p_threshold: 0.86, p_limit: 5, p_connection: c.connection?.id ?? null })
      return ((data ?? []) as { title: string; status: string; scheduled_at: string; similarity: number }[]).map((m) => ({ title: clip(m.title, 60), status: m.status, at: m.scheduled_at, similarity: Math.round(m.similarity * 100) / 100 }))
    },
  },

  suggest_board: {
    kind: 'read', label: 'Matching a board',
    run: async (c, a) => {
      const boards = (await loadBoards(account(c).id)).slice(0, 100)
      if (!boards.length) return []
      const vecs = await embed([z.string().min(3).max(1500).parse(a.text), ...boards.map((b) => `${b.name}. ${b.description}`)])
      return boards.map((b, i) => ({ name: b.name, score: Math.round(cosine(vecs[0], vecs[i + 1]) * 100) / 100 })).sort((x, y) => y.score - x.score).slice(0, 3)
    },
  },

  preview_best_times: {
    kind: 'read', label: 'Finding best posting times',
    run: async (c, a) => {
      const r = await previewSlots(c.userId, account(c).id, Math.min(Math.max(1, Number(a.count) || 5), 20), Math.min(Math.max(1, Number(a.per_day) || 2), 10))
      return { timezone: r.timezone, slots: r.slots.map((s) => fmt(s, r.timezone)), based_on: r.source === 'personal' ? `this account's last ${r.sample} published pins` : 'general Pinterest patterns (not enough results yet to personalize)' }
    },
  },
}

// ───────────────────────── UI tool ─────────────────────────
const PAGES: Record<string, string> = {
  overview: '/dashboard', new_pin: '/dashboard/schedule', bulk: '/dashboard/bulk', website_import: '/dashboard/import', pins: '/dashboard/pins',
  calendar: '/dashboard/calendar', boards: '/dashboard/boards', analytics: '/dashboard/analytics', keywords: '/dashboard/keywords',
  plans: '/dashboard/upgrade', billing: '/dashboard/billing', settings: '/dashboard/settings',
}
const uiTools: Record<string, UiTool> = {
  open_page: {
    kind: 'ui', label: 'Opening a page',
    run: (a) => {
      const page = String(a.page)
      if (!PAGES[page]) throw new ServiceError(`Unknown page. Choose one of: ${Object.keys(PAGES).join(', ')}`)
      return { type: 'navigate', path: PAGES[page], label: page.replace(/_/g, ' ') }
    },
  },
}

// ───────────────────────── write tools (need user confirmation) ─────────────────────────
const schedulePinsArgs = z.object({
  pins: z.array(z.object({
    image_url: z.string().url(), title: z.string().max(PIN_LIMITS.title).default(''), description: z.string().max(PIN_LIMITS.description).default(''),
    alt_text: z.string().max(PIN_LIMITS.altText).optional(), board: z.string().min(1), destination_url: z.string().url().optional(), scheduled_at: isoDate.optional(),
  })).min(1).max(200),
  per_day: z.number().int().min(1).max(10).optional(),
  every_hours: z.number().min(0.25).max(168).optional(),
  start_at: isoDate.optional(),
})

interface SchedulePayload { rows: PreparedRow[]; planId: Plan; profile: Prepared['profile']; warnings?: string[]; timing?: Prepared['timing'] }

const writeTools: Record<string, WriteTool> = {
  schedule_pins: {
    kind: 'write', label: 'Preparing your schedule',
    prepare: async (c, a) => {
      const args = schedulePinsArgs.parse(a)
      const boardCache = new Map<string, { id: string; name: string }>()
      const pins = []
      let i = 0
      for (const p of args.pins) {
        const key = p.board.toLowerCase()
        if (!boardCache.has(key)) boardCache.set(key, await resolveBoard(account(c).id, p.board))
        const b = boardCache.get(key)!
        let at = p.scheduled_at
        if (!at && args.every_hours && !args.per_day) {
          const start = args.start_at ? new Date(args.start_at).getTime() : Date.now() + 15 * 60_000
          at = new Date(start + i * args.every_hours * 3_600_000).toISOString()
        }
        pins.push({ image_url: p.image_url, title: p.title, description: p.description, alt_text: p.alt_text ?? '', board_id: b.id, board_name: b.name, destination_url: p.destination_url ?? '', scheduled_at: at })
        i++
      }
      const prepared = await prepareSchedule(c.userId, account(c).id, {
        pins: pins as never,
        auto: pins.some((p) => !p.scheduled_at) ? { per_day: args.per_day ?? 2, start_after: args.start_at, use_data: true } : undefined,
      })
      const sorted = [...prepared.rows].sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))
      const boards = [...new Set(prepared.rows.map((r) => r.board_name))].join(', ')
      return {
        summary: `Schedule ${prepared.rows.length} pin${prepared.rows.length > 1 ? 's' : ''} to ${boards} on @${account(c).pinterest_username ?? 'your account'}, from ${fmt(sorted[0].scheduled_at, c.tz)} to ${fmt(sorted[sorted.length - 1].scheduled_at, c.tz)}`,
        details: sorted.slice(0, 6).map((r) => `${fmt(r.scheduled_at, c.tz)}: ${clip(r.title || 'Untitled pin', 55)}`).concat(sorted.length > 6 ? [`and ${sorted.length - 6} more`] : []).concat(prepared.warnings.map((w) => `Heads up: ${w}`)),
        payload: { rows: prepared.rows, planId: prepared.profile.plan, profile: prepared.profile, warnings: prepared.warnings, timing: prepared.timing } satisfies SchedulePayload,
      }
    },
    commit: async (c, payload: SchedulePayload) => {
      const r = await commitSchedule(c.userId, { rows: payload.rows, plan: PLANS[payload.planId], profile: payload.profile, warnings: payload.warnings ?? [], timing: payload.timing ?? null })
      return `Scheduled ${r.created} pin${r.created > 1 ? 's' : ''}, from ${fmt(r.first_at, c.tz)} to ${fmt(r.last_at, c.tz)}.`
    },
  },

  update_pins: {
    kind: 'write', label: 'Preparing changes',
    prepare: async (c, a) => {
      const args = z.object({
        updates: z.array(z.object({
          id: z.string().uuid(), title: patchBody.shape.title, description: patchBody.shape.description, alt_text: patchBody.shape.alt_text,
          destination_url: patchBody.shape.destination_url, scheduled_at: patchBody.shape.scheduled_at, board: z.string().optional(),
        })).min(1).max(100),
      }).parse(a)
      const ids = args.updates.map((u) => u.id)
      const { data } = await db.from('scheduled_pins').select('id,title,status').eq('user_id', c.userId).in('id', ids)
      const found = new Map((data ?? []).map((p) => [p.id, p]))
      const missing = ids.filter((id) => !found.has(id))
      if (missing.length) throw new ServiceError(`These pin ids were not found: ${missing.slice(0, 5).join(', ')}. Use list_pins to get valid ids.`)
      const locked = ids.filter((id) => !['pending', 'failed'].includes(found.get(id)!.status))
      if (locked.length) throw new ServiceError('Only scheduled or failed pins can be edited; published pins cannot.')
      const resolved = []
      for (const u of args.updates) {
        const { board, ...rest } = u
        const b = board ? await resolveBoard(account(c).id, board) : null
        resolved.push({ ...rest, ...(b ? { board_id: b.id, board_name: b.name } : {}) })
      }
      return {
        summary: `Edit ${resolved.length} pin${resolved.length > 1 ? 's' : ''}`,
        details: resolved.slice(0, 6).map((u) => {
          const changes = Object.keys(u).filter((k) => k !== 'id' && k !== 'board_name').map((k) => (k === 'scheduled_at' ? `time ${fmt(u.scheduled_at!, c.tz)}` : k.replace(/_/g, ' '))).join(', ')
          return `${clip(found.get(u.id)!.title, 45)}: ${changes}`
        }).concat(resolved.length > 6 ? [`and ${resolved.length - 6} more`] : []),
        payload: resolved,
      }
    },
    commit: async (c, payload: ({ id: string } & z.infer<typeof patchBody>)[]) => {
      let ok = 0
      const errors: string[] = []
      for (const { id, ...patch } of payload) {
        try { await updatePin(c.userId, id, patch); ok++ } catch (e) { errors.push(e instanceof Error ? e.message : 'failed') }
      }
      return `Updated ${ok} pin${ok === 1 ? '' : 's'}.${errors.length ? ` ${errors.length} could not be changed (${errors[0]}).` : ''}`
    },
  },

  delete_pins: {
    kind: 'write', label: 'Preparing deletion',
    prepare: async (c, a) => {
      const args = z.object({ ids: z.array(z.string().uuid()).max(200).optional(), all_failed: z.boolean().optional() }).parse(a)
      let q = db.from('scheduled_pins').select('id,title,status').eq('user_id', c.userId).neq('status', 'processing').limit(200)
      if (args.all_failed) q = q.eq('status', 'failed')
      else if (args.ids?.length) q = q.in('id', args.ids)
      else throw new ServiceError('Provide ids, or all_failed: true.')
      const { data } = await q
      if (!data?.length) throw new ServiceError('No matching pins to delete.')
      return {
        summary: `Delete ${data.length} pin${data.length > 1 ? 's' : ''} permanently`,
        details: data.slice(0, 6).map((p) => `${clip(p.title, 55)} (${p.status})`).concat(data.length > 6 ? [`and ${data.length - 6} more`] : []),
        payload: data.map((p) => p.id),
      }
    },
    commit: async (c, ids: string[]) => `Deleted ${await deletePins(c.userId, ids)} pins.`,
  },

  retry_failed_pins: {
    kind: 'write', label: 'Preparing retry',
    prepare: async (c, a) => {
      const args = z.object({ ids: z.array(z.string().uuid()).max(200).optional() }).parse(a)
      let q = db.from('scheduled_pins').select('id,title').eq('user_id', c.userId).eq('status', 'failed').limit(200)
      if (args.ids?.length) q = q.in('id', args.ids)
      const { data } = await q
      if (!data?.length) throw new ServiceError('There are no failed pins to retry.')
      return {
        summary: `Retry ${data.length} failed pin${data.length > 1 ? 's' : ''} in about 2 minutes`,
        details: data.slice(0, 5).map((p) => clip(p.title, 60)),
        payload: data.map((p) => p.id),
      }
    },
    commit: async (c, ids: string[]) => `Re-queued ${await retryPins(c.userId, ids)} pins. They publish in a couple of minutes.`,
  },

  create_board: {
    kind: 'write', label: 'Preparing a board',
    prepare: async (c, a) => {
      const args = z.object({ name: z.string().trim().min(1).max(50), description: z.string().max(500).optional(), privacy: z.enum(['PUBLIC', 'SECRET']).default('PUBLIC') }).parse(a)
      const conn = account(c)
      return { summary: `Create a ${args.privacy.toLowerCase()} board named "${args.name}" on @${conn.pinterest_username ?? 'your account'}`, details: args.description ? [clip(args.description, 80)] : [], payload: { ...args, connection_id: conn.id } }
    },
    commit: async (_c, { connection_id, ...args }: { connection_id: string; name: string; description?: string; privacy: 'PUBLIC' | 'SECRET' }) => {
      // Bound to the account chosen when the card was shown, even if the user switched accounts since.
      const b = await withPinterest(connection_id, (t) => createBoard(t, args))
      await redis.del(`boards:${connection_id}`).catch(() => {})
      return `Created the board "${b.name}".`
    },
  },

  update_settings: {
    kind: 'write', label: 'Preparing a settings change',
    prepare: async (_c, a) => {
      const tz = z.string().refine(isValidTimeZone, 'Unknown timezone. Use an IANA name like America/New_York.').parse(a.timezone)
      return { summary: `Change your timezone to ${tz}`, details: ['Best-time scheduling will use this timezone.'], payload: { timezone: tz } }
    },
    commit: async (c, p: { timezone: string }) => {
      await db.from('user_profiles').update({ timezone: p.timezone }).eq('id', c.userId)
      await invalidateProfile(c.userId)
      return `Timezone set to ${p.timezone}.`
    },
  },
}

// ───────────────────────── schemas shown to the model ─────────────────────────
const S = (props: Json, required: string[] = []) => ({ type: 'object', properties: props, required, additionalProperties: false })
const fn = (name: string, description: string, parameters: Json) => ({ type: 'function' as const, function: { name, description, parameters } })
const ISO = { type: 'string', description: 'ISO 8601 with offset, e.g. 2026-10-05T19:30:00+05:30' }

export const TOOL_DEFS = [
  fn('get_account_summary', 'Plan, monthly usage and limits, timezone, Pinterest connection status.', S({})),
  fn('list_boards', 'The user\'s Pinterest boards with ids.', S({})),
  fn('list_pins', 'List pins with ids. Filter by status, time range or title text.', S({
    statuses: { type: 'array', items: { enum: ['pending', 'processing', 'published', 'failed'] } }, from: ISO, to: ISO,
    search: { type: 'string' }, newest_first: { type: 'boolean' }, limit: { type: 'integer', description: 'max 30' },
  })),
  fn('get_queue_stats', 'Counts of scheduled, published and failed pins and when the queue runs out.', S({})),
  fn('get_analytics', 'Impressions, saves, clicks, best day and top pins.', S({ days: { type: 'integer' } })),
  fn('trending_keywords', 'Trending Pinterest keywords, optionally filtered by a word.', S({ query: { type: 'string' }, region: { type: 'string', description: 'US, GB, CA, AU, DE, FR, BR, MX' } })),
  fn('import_page', 'Read a web page: returns image URLs and suggested titles, description and alt text. Costs one website import.', S({ url: { type: 'string' } }, ['url'])),
  fn('generate_pin_copy', 'Write 3 title and description options for a topic.', S({ topic: { type: 'string' } }, ['topic'])),
  fn('find_similar_pins', 'Find the user\'s existing pins that are near-duplicates of some text.', S({ text: { type: 'string' } }, ['text'])),
  fn('suggest_board', 'Rank the user\'s boards by fit for a pin text.', S({ text: { type: 'string' } }, ['text'])),
  fn('preview_best_times', 'Upcoming best posting slots in the user\'s timezone (paid plans).', S({ count: { type: 'integer' }, per_day: { type: 'integer' } })),
  fn('open_page', 'Offer the user a button that opens a page of the app.', S({ page: { enum: Object.keys(PAGES) } }, ['page'])),
  fn('schedule_pins', 'Propose scheduling pins. Needs the user\'s confirmation. Give either scheduled_at per pin, or every_hours (+start_at) for a fixed interval, or per_day for best-time slots (paid). board is a board name or id.', S({
    pins: { type: 'array', items: S({
      image_url: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, alt_text: { type: 'string' },
      board: { type: 'string' }, destination_url: { type: 'string' }, scheduled_at: ISO,
    }, ['image_url', 'board']) },
    per_day: { type: 'integer' }, every_hours: { type: 'number' }, start_at: ISO,
  }, ['pins'])),
  fn('update_pins', 'Propose edits to scheduled or failed pins (title, description, board, link, time). Needs confirmation. Use ids from list_pins.', S({
    updates: { type: 'array', items: S({ id: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, alt_text: { type: 'string' }, board: { type: 'string' }, destination_url: { type: 'string' }, scheduled_at: ISO }, ['id']) },
  }, ['updates'])),
  fn('delete_pins', 'Propose deleting pins by ids, or all failed pins. Needs confirmation.', S({ ids: { type: 'array', items: { type: 'string' } }, all_failed: { type: 'boolean' } })),
  fn('retry_failed_pins', 'Propose re-queuing failed pins (all, or by ids). Needs confirmation.', S({ ids: { type: 'array', items: { type: 'string' } } })),
  fn('create_board', 'Propose creating a Pinterest board. Needs confirmation.', S({ name: { type: 'string' }, description: { type: 'string' }, privacy: { enum: ['PUBLIC', 'SECRET'] } }, ['name'])),
  fn('update_settings', 'Propose changing the user\'s timezone. Needs confirmation.', S({ timezone: { type: 'string', description: 'IANA name, e.g. Asia/Kolkata' } }, ['timezone'])),
]

// ───────────────────────── dispatcher ─────────────────────────
export type ToolOutcome =
  | { kind: 'result'; text: string }
  | { kind: 'proposal'; proposal: Proposal; text: string }
  | { kind: 'ui'; action: UiAction; text: string }

const MAX_RESULT = 6000

export async function runTool(ctx: Ctx, name: string, rawArgs: string, savePayload: (p: { tool: string; payload: unknown; summary: string; details: string[] }) => Promise<string>): Promise<ToolOutcome> {
  let args: Json
  try { args = rawArgs ? JSON.parse(rawArgs) : {} } catch { return { kind: 'result', text: JSON.stringify({ error: 'Arguments were not valid JSON.' }) } }
  try {
    if (readTools[name]) {
      const out = await readTools[name].run(ctx, args)
      // Data fetched from the web or users is wrapped so the model treats it as content, not instructions.
      return { kind: 'result', text: JSON.stringify(out).slice(0, MAX_RESULT) }
    }
    if (uiTools[name]) {
      const action = uiTools[name].run(args)
      return { kind: 'ui', action, text: 'A button to open the page was shown to the user.' }
    }
    if (writeTools[name]) {
      const prepared = await writeTools[name].prepare(ctx, args)
      const id = await savePayload({ tool: name, payload: prepared.payload, summary: prepared.summary, details: prepared.details })
      return {
        kind: 'proposal',
        proposal: { id, tool: name, summary: prepared.summary, details: prepared.details },
        text: 'Shown to the user as a confirmation card. Nothing has been changed yet. Tell the user to review and press Confirm.',
      }
    }
    return { kind: 'result', text: JSON.stringify({ error: `Unknown tool ${name}` }) }
  } catch (e) {
    const msg = e instanceof z.ZodError ? `Invalid arguments: ${e.issues[0]?.path.join('.')} ${e.issues[0]?.message}` : e instanceof Error ? e.message : 'Tool failed'
    return { kind: 'result', text: JSON.stringify({ error: msg, ...(e instanceof ServiceError ? e.extra : {}) }) }
  }
}

export const toolLabel = (name: string) => readTools[name]?.label ?? writeTools[name]?.label ?? uiTools[name]?.label ?? 'Working'

export async function commitProposal(ctx: Ctx, tool: string, payload: unknown): Promise<string> {
  const t = writeTools[tool]
  if (!t) throw new ServiceError('Unknown action')
  return t.commit(ctx, payload as never)
}

export async function toolContext(userId: string, connection: Connection | null): Promise<Ctx> {
  const profile = await getProfile(userId)
  return { userId, connection, tz: isValidTimeZone(profile.timezone) ? profile.timezone : 'UTC', planId: profile.plan }
}

export const registeredToolNames = () => [...Object.keys(readTools), ...Object.keys(uiTools), ...Object.keys(writeTools)]
