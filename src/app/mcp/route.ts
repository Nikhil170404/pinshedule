import { PLANS, YEARLY_BILLING } from '@shared/plans'
import { allPages, pageUrl, siteUrl } from '@/content/seo'
import { FACTS } from '@/content/seo/facts'
import { site } from '@/lib/site'

/**
 * A public, read-only MCP server (Streamable HTTP, stateless JSON responses). It exposes facts about GoPinKaro and
 * two small checkers, so AI assistants can answer from the same data the site uses. It has no accounts, no secrets
 * and no write tools: nothing here can read or change anyone's Pinterest data.
 */
const PROTOCOL = '2025-06-18'
const JSON_HEADERS = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' }

const tools = [
  {
    name: 'get_plans',
    description: 'GoPinKaro plans and limits: price, pins per month, Pinterest accounts, AI allowances.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'search_pages',
    description: 'Search GoPinKaro guides, comparisons and use-case pages by keyword. Returns titles, URLs and summaries.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', maxLength: 100 } }, required: ['query'], additionalProperties: false },
  },
  {
    name: 'check_pin_text',
    description: `Check a Pinterest pin title (${FACTS.titleMax} characters max) and description (${FACTS.descriptionMax} max) against the limits and how much shows in the feed.`,
    inputSchema: { type: 'object', properties: { title: { type: 'string', maxLength: 500 }, description: { type: 'string', maxLength: 2000 } }, required: ['title'], additionalProperties: false },
  },
  {
    name: 'plan_pin_pace',
    description: 'Turn a number of pins and days into a pins-per-day pace, with a warning above the safe daily maximum.',
    inputSchema: { type: 'object', properties: { pins: { type: 'integer', minimum: 1, maximum: 100000 }, days: { type: 'integer', minimum: 1, maximum: 365 } }, required: ['pins', 'days'], additionalProperties: false },
  },
]

type Args = Record<string, unknown>
const text = (t: string) => ({ content: [{ type: 'text', text: t }] })

function callTool(name: string, a: Args) {
  switch (name) {
    case 'get_plans':
      return text(JSON.stringify({
        url: `${siteUrl()}/pricing`,
        billing: YEARLY_BILLING ? 'monthly or yearly' : 'monthly',
        plans: Object.values(PLANS).map((p) => ({ name: p.name, usd_per_month: p.price_monthly_usd, pins_per_month: p.pins_per_month, pinterest_accounts: p.accounts, website_imports: p.website_imports, ai_writing: p.ai_generations, ai_images: p.ai_images, bulk_upload: p.bulk_upload, best_time_scheduling: p.smart_scheduler, sitemap_import: p.sitemap_import })),
      }, null, 2))
    case 'search_pages': {
      const words = String(a.query ?? '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)
      if (!words.length) return text('Give a keyword to search for.')
      const hits = allPages
        .map((p) => ({ p, score: words.reduce((s, w) => s + (p.title.toLowerCase().includes(w) ? 3 : 0) + (p.description.toLowerCase().includes(w) ? 1 : 0) + (p.path.includes(w) ? 2 : 0), 0) }))
        .filter((x) => x.score > 0).sort((x, y) => y.score - x.score).slice(0, 8)
      return text(hits.length ? hits.map(({ p }) => `${p.title}\n${pageUrl(p.path)}\n${p.description}`).join('\n\n') : 'No matching pages.')
    }
    case 'check_pin_text': {
      const title = String(a.title ?? '').trim(), desc = String(a.description ?? '').trim()
      return text(JSON.stringify({
        title: { length: title.length, max: FACTS.titleMax, ok: title.length > 0 && title.length <= FACTS.titleMax, shown_in_feed: title.slice(0, 40) },
        description: { length: desc.length, max: FACTS.descriptionMax, ok: desc.length <= FACTS.descriptionMax, shown_in_feed: desc.slice(0, 55) },
        tip: 'Put the main keyword at the start of the title and description; only the first ~40 and ~55 characters show in the feed.',
      }, null, 2))
    }
    case 'plan_pin_pace': {
      const pins = Number(a.pins), days = Number(a.days)
      if (!Number.isFinite(pins) || !Number.isFinite(days) || pins < 1 || days < 1) return { ...text('pins and days must be positive numbers.'), isError: true }
      const perDay = pins / days
      return text(JSON.stringify({ pins_per_day: Math.round(perDay * 10) / 10, soft_max_per_day: FACTS.dailySoftMax, warning: perDay > FACTS.dailySoftMax ? `Above ${FACTS.dailySoftMax} pins a day; spread them over more days.` : null }, null, 2))
    }
    default:
      return null
  }
}

const reply = (id: unknown, result: unknown) => Response.json({ jsonrpc: '2.0', id, result }, { headers: JSON_HEADERS })
const fail = (id: unknown, code: number, message: string, status = 200) => Response.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, { status, headers: JSON_HEADERS })

function handle(m: { id?: unknown; method?: string; params?: { name?: string; arguments?: Args } }) {
  if (m.id === undefined) return new Response(null, { status: 202, headers: JSON_HEADERS }) // notification
  switch (m.method) {
    case 'initialize':
      return reply(m.id, { protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: 'gopinkaro', title: site.name, version: '1.0.0' }, instructions: 'Read-only facts and checkers for GoPinKaro, a Pinterest scheduler. It cannot access anyone\'s account.' })
    case 'ping': return reply(m.id, {})
    case 'tools/list': return reply(m.id, { tools })
    case 'tools/call': {
      const out = callTool(String(m.params?.name), m.params?.arguments ?? {})
      return out ? reply(m.id, out) : fail(m.id, -32602, 'Unknown tool')
    }
    default: return fail(m.id, -32601, 'Method not found')
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(null, -32700, 'Send one JSON-RPC message.', 400)
  return handle(body)
}

export function GET() {
  return new Response('GoPinKaro MCP server: POST JSON-RPC to this URL (Streamable HTTP).', { status: 405, headers: { allow: 'POST, OPTIONS', 'content-type': 'text/plain' } })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...JSON_HEADERS, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, mcp-protocol-version, accept' } })
}
