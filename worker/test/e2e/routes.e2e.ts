// End-to-end check of the worker's HTTP routes against in-memory fakes of Supabase (PostgREST), Upstash, Pinterest,
// OpenAI, Resend and Sentry. Run with: npm run test:e2e
import http from 'node:http'
import { spawn } from 'node:child_process'
import { encrypt } from '../../../shared/crypto'

const enc = await encrypt('tok', 'secret-secret-secret')
const PRIMARY = '11111111-1111-4111-8111-111111111111'
const SECOND = '22222222-2222-4222-8222-222222222222'
const FOREIGN = '33333333-3333-4333-8333-333333333333'
const old = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
const db: Record<string, any[]> = {
  user_profiles: [{ id: 'u1', plan: 'growth', billing_cycle: 'monthly', timezone: 'Asia/Kolkata', plan_status: 'active', plan_expires_at: null, razorpay_subscription_id: null, notification_email: null, notification_email_verified: false, notifications_enabled: true }],
  pinterest_connections: [
    { id: PRIMARY, user_id: 'u1', pinterest_user_id: 'p1', pinterest_username: 'main', status: 'active', is_primary: true, created_at: '2026-01-01', access_token: enc, refresh_token: enc, expires_at: new Date(Date.now() + 864e5).toISOString() },
    { id: SECOND, user_id: 'u1', pinterest_user_id: 'p2', pinterest_username: 'second', status: 'active', is_primary: false, created_at: '2026-02-01', access_token: enc, refresh_token: enc, expires_at: new Date(Date.now() + 864e5).toISOString() },
    { id: FOREIGN, user_id: 'someone-else', pinterest_user_id: 'p9', pinterest_username: 'other', status: 'active', is_primary: true, created_at: '2026-02-01', access_token: enc, refresh_token: enc, expires_at: new Date(Date.now() + 864e5).toISOString() },
  ],
  scheduled_pins: [
    { id: 'old1', user_id: 'u1', connection_id: SECOND, status: 'published', image_url: 'https://i.example.com/1.jpg', title: 'Old one', description: 'd', alt_text: null, board_id: 'b1', board_name: 'Home ideas', destination_url: 'https://x.com/1', published_at: old(90), created_at: old(90), scheduled_at: old(90), recycled_from: null },
    { id: 'old2', user_id: 'u1', connection_id: SECOND, status: 'published', image_url: 'https://i.example.com/2.jpg', title: 'Old two', description: 'd', alt_text: null, board_id: 'b1', board_name: 'Home ideas', destination_url: 'https://x.com/2', published_at: old(80), created_at: old(80), scheduled_at: old(80), recycled_from: null },
    { id: 'fresh', user_id: 'u1', connection_id: SECOND, status: 'published', image_url: 'https://i.example.com/3.jpg', title: 'Fresh', description: 'd', alt_text: null, board_id: 'b1', board_name: 'Home ideas', destination_url: null, published_at: old(5), created_at: old(5), scheduled_at: old(5), recycled_from: null },
    { id: 'pend2', user_id: 'u1', connection_id: SECOND, status: 'pending', image_url: 'https://i.example.com/4.jpg', title: 'Pending on second', scheduled_at: new Date(Date.now() + 864e5).toISOString(), created_at: old(1), recycled_from: null },
  ],
  analytics_snapshots: [{ pin_id: 'old2', saves: 99, impressions: 10, snapshot_date: '2026-10-01' }, { pin_id: 'old1', saves: 3, impressions: 900, snapshot_date: '2026-10-01' }],
  automations: [], automation_urls: [], usage_counters: [], account_analytics: [],
}
const mem = new Map<string, any>()
const calls: any[] = []
const emails: any[] = []
const envelopes: { auth: string; raw: string }[] = []
const body = async (req: http.IncomingMessage) => { const c: Buffer[] = []; for await (const x of req) c.push(x as Buffer); const t = Buffer.concat(c).toString(); try { return JSON.parse(t) } catch { return t } }
const json = (res: http.ServerResponse, b: unknown, code = 200, h: Record<string, string> = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...h }); res.end(JSON.stringify(b)) }

function applyFilters(rows: any[], q: URLSearchParams) {
  let out = rows
  for (const [k, v] of q.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
    const [op, ...rest] = v.split('.'); const val = rest.join('.')
    const num = (x: any) => (typeof x === 'string' && /^\d{4}-/.test(x) ? new Date(x).getTime() : x)
    out = out.filter((r) => {
      const x = r[k]
      switch (op) {
        case 'eq': return String(x) === val
        case 'neq': return String(x) !== val
        case 'in': return val.slice(1, -1).split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(x))
        case 'is': return val === 'null' ? x == null : x != null
        case 'not': { const [o2, v2] = [rest[0], rest.slice(1).join('.')]; return o2 === 'is' && v2 === 'null' ? x != null : true }
        case 'lte': return num(x) <= num(val)
        case 'lt': return num(x) < num(val)
        case 'gte': return num(x) >= num(val)
        case 'gt': return num(x) > num(val)
        default: return true
      }
    })
  }
  const order = q.getAll('order').flatMap((o) => o.split(','))
  for (const o of order.reverse()) { const [col, dir] = o.split('.'); out = [...out].sort((a, b) => (String(a[col] ?? '') < String(b[col] ?? '') ? -1 : String(a[col] ?? '') > String(b[col] ?? '') ? 1 : 0) * (dir === 'desc' ? -1 : 1)) }
  const off = Number(q.get('offset') ?? 0); const lim = q.get('limit') ? Number(q.get('limit')) : undefined
  return { all: out, page: out.slice(off, lim === undefined ? undefined : off + lim) }
}
const project = (rows: any[], sel: string | null) => {
  if (!sel || sel === '*') return rows
  const cols = sel.split(',').map((c) => c.trim().split(':').pop()!.split('(')[0])
  return rows.map((r) => Object.fromEntries(cols.filter((c) => c in r).map((c) => [c, r[c]])))
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url!, 'http://x')
  const b = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method!) ? await body(req) : null
  if (u.pathname.startsWith('/upstash')) {
    const run = (cmd: any[]) => {
      const [op, k, ...r] = cmd; const O = String(op).toUpperCase()
      if (O === 'GET') { const v = mem.get(k); return typeof v === 'string' ? Buffer.from(v).toString('base64') : v ?? null }
      if (O === 'SET') { if (r.map((x: any) => String(x).toUpperCase()).includes('NX') && mem.has(k)) return null; mem.set(k, r[0]); return 'OK' }
      if (O === 'GETDEL') { const v = mem.get(k) ?? null; mem.delete(k); return typeof v === 'string' ? Buffer.from(v).toString('base64') : v }
      if (O === 'DEL') { let n = 0; for (const key of [k, ...r]) if (mem.delete(key)) n++; return n }
      if (O === 'INCR') { const n = (Number(mem.get(k)) || 0) + 1; mem.set(k, n); return n }
      if (O === 'EXPIRE') return 1
      if (O === 'ZADD') return 1
      if (O === 'ZRANGE') return []
      if (O === 'ZREM') return 0
      if (O === 'MGET') return [k, ...r].map((x) => mem.get(x) ?? null)
      if (O === 'PING') return 'PONG'
      if (O.startsWith('EVAL')) throw new Error('no lua')
      return null
    }
    if (u.pathname.endsWith('/pipeline') || u.pathname.endsWith('/multi-exec')) return json(res, (b as any[]).map((c) => { try { return { result: run(c) } } catch (e: any) { return { error: e.message } } }))
    try { return json(res, { result: run(b) }) } catch (e: any) { return json(res, { error: e.message }, 400) }
  }
  if (u.pathname === '/auth/v1/user') return json(res, { id: 'u1', aud: 'authenticated', role: 'authenticated' })
  if (u.pathname.startsWith('/rest/v1/rpc/')) {
    const fn = u.pathname.split('/').pop()!
    calls.push({ rpc: fn, body: b })
    if (fn === 'consume_usage' || fn === 'refund_usage') return json(res, true)
    if (fn === 'schedule_pins') { for (const r of (b as any).p_rows) db.scheduled_pins.push({ ...r, user_id: 'u1', status: 'pending', created_at: new Date().toISOString() }); return json(res, (b as any).p_rows.map((r: any) => ({ id: r.id, scheduled_at: r.scheduled_at }))) }
    if (fn === 'prune_analytics') return json(res, 0)
    return json(res, null)
  }
  if (u.pathname.startsWith('/rest/v1/')) {
    const t = u.pathname.split('/').pop()!
    const table = (db[t] ??= [])
    const accept = String(req.headers.accept ?? ''); const obj = /pgrst\.object/.test(accept)
    const prefer = String(req.headers.prefer ?? ''); const wantsRows = /return=representation/.test(prefer)
    const sel = u.searchParams.get('select')
    if (req.method === 'GET' || req.method === 'HEAD') {
      const { all, page } = applyFilters(table, u.searchParams)
      if (req.method === 'HEAD') { res.writeHead(200, { 'content-range': `*/${all.length}` }); return res.end() }
      if (obj) return page.length ? json(res, project(page, sel)[0]) : json(res, { code: 'PGRST116', message: 'The result contains 0 rows' }, 406)
      return json(res, project(page, sel), 200, { 'content-range': `0-${Math.max(0, page.length - 1)}/${all.length}` })
    }
    if (req.method === 'POST') {
      const rows = Array.isArray(b) ? b : [b]
      const out: any[] = []
      const conflict = u.searchParams.get('on_conflict')?.split(',')
      for (const r of rows) {
        const hit = conflict ? table.find((x) => conflict.every((c) => x[c] === r[c])) : null
        if (hit) { Object.assign(hit, r); out.push(hit) } else { const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), enabled: true, total_created: 0, next_run_at: new Date().toISOString(), ...r }; table.push(row); out.push(row) }
      }
      if (obj) return json(res, project(out, sel)[0], 201)
      return wantsRows ? json(res, project(out, sel), 201) : (res.writeHead(201), res.end())
    }
    if (req.method === 'PATCH' || req.method === 'DELETE') {
      const { all } = applyFilters(table, u.searchParams)
      if (req.method === 'PATCH') all.forEach((r) => Object.assign(r, b))
      else for (const r of all) table.splice(table.indexOf(r), 1)
      calls.push({ table: t, method: req.method, n: all.length })
      return wantsRows ? json(res, project(all, sel)) : (res.writeHead(204), res.end())
    }
  }
  if (u.pathname === '/pin/boards') { calls.push({ boards: req.headers.authorization }); return json(res, { items: [{ id: 'b1', name: 'Home ideas', description: 'Decor' }], bookmark: null }) }
  if (u.pathname === '/api/42/envelope/') { envelopes.push({ auth: String(req.headers['x-sentry-auth']), raw: typeof b === 'string' ? b : JSON.stringify(b) }); return json(res, { id: 'x' }) }
  if (u.pathname === '/resend') { emails.push(b); return json(res, { id: 'e1' }) }
  if (u.pathname.endsWith('/chat/completions')) {
    const name = (b as any).response_format?.json_schema?.name
    const content = name === 'titles' ? { titles: ['Kitchen storage ideas', 'Second', 'Third'] } : name === 'description' ? { description: 'Smart storage tips. #kitchen' } : { alt_text: 'A tidy kitchen shelf' }
    calls.push({ openai: name })
    return json(res, { id: 'c', object: 'chat.completion', created: 0, model: 'gpt-4o-mini', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(content) } }], usage: { total_tokens: 10 } })
  }
  json(res, { error: 'unhandled ' + u.pathname }, 404)
})
await new Promise<void>((r) => server.listen(9011, r))

const worker = spawn('npx', ['tsx', 'src/index.ts'], { cwd: new URL('../../', import.meta.url).pathname, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: '8151', APP_URL: 'http://localhost:3100', SUPABASE_URL: 'http://localhost:9011', SUPABASE_SERVICE_ROLE_KEY: 'k', UPSTASH_REDIS_REST_URL: 'http://localhost:9011/upstash', UPSTASH_REDIS_REST_TOKEN: 't', ENCRYPTION_SECRET: 'secret-secret-secret', PINTEREST_CLIENT_ID: 'i', PINTEREST_CLIENT_SECRET: 's', PINTEREST_API_BASE: 'http://localhost:9011/pin', OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: 'http://localhost:9011/openai/v1', SENTRY_DSN: 'http://abc123@localhost:9011/42', RESEND_API_KEY: 're_test', RESEND_API_URL: 'http://localhost:9011/resend', PUBLIC_API_URL: 'http://localhost:8151', RUN_JOBS: 'false' } })
let logs = ''; worker.stdout?.on('data', (d) => (logs += d)); worker.stderr?.on('data', (d) => (logs += d))
for (let i = 0; i < 40; i++) { try { if ((await fetch('http://localhost:8151/health')).status) break } catch {} await new Promise((r) => setTimeout(r, 500)) }
process.on('uncaughtException', (e) => { console.log('HARNESS ERROR', e.message, '\nWORKER LOG:\n' + logs.slice(-1500)); try { process.kill(-worker.pid!, 'SIGKILL') } catch {}; process.exit(1) })

const H = { Authorization: 'Bearer t', 'Content-Type': 'application/json' }
const call = async (method: string, path: string, payload?: unknown) => { const r = await fetch(`http://localhost:8151${path}`, { method, headers: H, body: payload === undefined ? undefined : JSON.stringify(payload), redirect: 'manual' }); const t = await r.text(); let j: any; try { j = JSON.parse(t) } catch { j = t } return { status: r.status, j, headers: r.headers } }
let failures = 0
const ok = (name: string, cond: boolean, extra = '') => { if (!cond) failures++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`) }

let r = await call('GET', '/v1/account/summary')
ok('summary lists both of the user\'s accounts, primary first', r.j.accounts?.length === 2 && r.j.accounts[0].is_primary && r.j.accounts[0].username === 'main', JSON.stringify(r.j.accounts?.map((a: any) => a.username)))
ok('summary exposes plan limits for accounts and automations', r.j.limits.accounts === 3 && r.j.limits.automations === 10 && r.j.used.accounts === 2)

r = await call('GET', `/v1/boards?connection=${SECOND}`)
ok('boards for a connected account', r.status === 200 && r.j.boards?.length === 1)
r = await call('GET', `/v1/boards?connection=${FOREIGN}`)
ok("another customer's account id is rejected", r.status === 400, r.j.error)
r = await call('GET', '/v1/boards?connection=not-a-uuid')
ok('garbage account id is rejected', r.status === 400)

r = await call('POST', '/v1/pins/schedule', { connection_id: SECOND, pins: [{ image_url: 'https://i.example.com/a.jpg', board_id: 'b1', scheduled_at: new Date(Date.now() + 3 * 864e5).toISOString() }] })
let rows = calls.filter((c) => c.rpc === 'schedule_pins').at(-1)?.body.p_rows
ok('scheduling to the second account records its id', r.status === 200 && rows?.[0].connection_id === SECOND)
r = await call('POST', '/v1/pins/schedule', { pins: [{ image_url: 'https://i.example.com/b.jpg', board_id: 'b1', scheduled_at: new Date(Date.now() + 3 * 864e5).toISOString() }] })
rows = calls.filter((c) => c.rpc === 'schedule_pins').at(-1)?.body.p_rows
ok('no account chosen means the primary account', rows?.[0].connection_id === PRIMARY)
r = await call('POST', '/v1/pins/schedule', { connection_id: FOREIGN, pins: [{ image_url: 'https://i.example.com/c.jpg', board_id: 'b1', scheduled_at: new Date(Date.now() + 3 * 864e5).toISOString() }] })
ok("scheduling onto someone else's account is refused", r.status === 400)

// bulk AI copy
const before = calls.filter((c) => c.rpc === 'consume_usage').length
r = await call('POST', '/v1/ai/bulk-copy', { items: [{ id: 'r1', title: 'kitchen storage' }, { id: 'r2', title: '' }] })
const used = calls.filter((c) => c.rpc === 'consume_usage').slice(before).at(-1)?.body
ok('bulk copy writes copy and charges only the pins it can work on', r.status === 200 && r.j.results.length === 1 && r.j.results[0].ok && r.j.skipped === 1 && used?.p_amount === 1, `${JSON.stringify(r.j.results?.[0]).slice(0, 110)} amount=${used?.p_amount}`)
r = await call('POST', '/v1/ai/bulk-copy', { items: [{ id: 'r2', title: '' }] })
ok('bulk copy with nothing to work from is a clear 400', r.status === 400)

// automations
r = await call('POST', '/v1/automations', { kind: 'evergreen', connection_id: SECOND, config: { min_age_days: 60, per_day: 2, best_first: true } })
const id = r.j.automation?.id
ok('evergreen automation created for the second account', r.status === 200 && !!id)
r = await call('POST', '/v1/automations', { kind: 'evergreen', config: { min_age_days: 10 } })
ok('invalid automation settings are rejected', r.status === 400)
r = await call('POST', `/v1/automations/${id}/run`, {})
ok('run now accepted', r.status === 200)
await new Promise((r) => setTimeout(r, 1500))
const kids = db.scheduled_pins.filter((p) => p.recycled_from)
ok('evergreen re-pinned only pins older than the cutoff, best saves first', kids.length === 2 && kids[0].recycled_from === 'old2' && kids[1].recycled_from === 'old1' && !kids.some((k) => k.recycled_from === 'fresh'), kids.map((k) => k.recycled_from).join(','))
ok('re-pins go to the same account, tagged with the automation', kids.every((k) => k.connection_id === SECOND && k.automation_id === id))
const auto = db.automations[0]
ok('the run is recorded on the automation', auto.total_created === 2 && /Re-pinned 2/.test(auto.last_result), auto.last_result)
r = await call('POST', `/v1/automations/${id}/run`, {})
ok('running again straight away is rate limited', r.status === 429)
r = await call('PATCH', `/v1/automations/${id}`, { enabled: false })
ok('automation can be paused', r.status === 200 && db.automations[0].enabled === false)
r = await call('DELETE', `/v1/automations/${id}`)
ok('automation can be deleted', r.status === 200 && db.automations.length === 0)

// email verification
r = await call('POST', '/v1/account/email', { email: 'not-an-email' })
ok('bad email rejected', r.status === 400)
r = await call('POST', '/v1/account/email', { email: 'Owner@Example.com' })
const mail = emails.at(-1)
const link = /https?:\/\/[^\s"']*verify-email\?token=[\w-]+/.exec(JSON.stringify(mail))?.[0]
ok('verification email sent to the lowercased address', r.status === 200 && mail?.to === 'owner@example.com' && !!link, `status=${r.status} ${JSON.stringify(r.j)} to=${mail?.to} subject=${mail?.subject}`)
ok('address stored but unverified', db.user_profiles[0].notification_email === 'owner@example.com' && db.user_profiles[0].notification_email_verified === false)
r = await call('POST', '/v1/account/email', { email: 'other@example.com' })
ok('second request within a minute is rate limited', r.status === 429)
let v = await fetch(link!.replace('localhost:8151', 'localhost:8151'), { redirect: 'manual' })
ok('confirmation link verifies and redirects to settings', v.status === 302 && /settings\?email=verified/.test(v.headers.get('location') ?? '') && db.user_profiles[0].notification_email_verified === true, v.headers.get('location') ?? '')
v = await fetch(link!, { redirect: 'manual' })
ok('the link works only once', /email=invalid/.test(v.headers.get('location') ?? ''))
v = await fetch('http://localhost:8151/public/verify-email?token=abcdefghijklmnopqrstuvwxyz', { redirect: 'manual' })
ok('a made-up token is rejected', /email=invalid/.test(v.headers.get('location') ?? ''))

// client error reports
let last = 0
for (let i = 0; i < 7; i++) last = (await fetch('http://localhost:8151/public/client-errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'boom ' + i }) })).status
ok('client error reports are accepted, then rate limited', last === 429)
ok('client errors reach the logs', logs.includes('client error'))
await new Promise((r) => setTimeout(r, 500))
const env0 = envelopes[0]
const evt = env0 ? JSON.parse(env0.raw.split('\n')[2]) : null
ok('sentry receives an envelope with the key and message', !!env0 && /sentry_key=abc123/.test(env0.auth) && /client: boom/.test(evt?.message?.formatted ?? ''), `${envelopes.length} envelope(s)`)
ok('sentry reports are throttled per message', envelopes.length <= 5)

// disconnect secondary
const pendBefore = db.scheduled_pins.filter((p) => p.connection_id === SECOND && p.status === 'pending').length
r = await call('POST', '/v1/account/disconnect', { connection_id: SECOND })
ok('disconnecting one account removes its connection and waiting pins only', r.status === 200 && db.pinterest_connections.filter((c) => c.user_id === 'u1').length === 1 && db.scheduled_pins.filter((p) => p.connection_id === SECOND && p.status === 'pending').length === 0 && db.scheduled_pins.some((p) => p.id === 'old1'), `pending before=${pendBefore}`)
r = await call('POST', '/v1/account/disconnect', { connection_id: FOREIGN })
ok("cannot disconnect someone else's account", db.pinterest_connections.some((c) => c.id === FOREIGN))

r = await call('GET', '/v1/account/export')
ok('export includes accounts and automations but no tokens', r.status === 200 && Array.isArray(r.j.pinterest_connections) && 'automations' in r.j && !/access_token|refresh_token/.test(JSON.stringify(r.j)))

console.log('\nerrors in worker log:', (logs.match(/"level":"error"/g) ?? []).length)
if (/"level":"error"/.test(logs)) console.log(logs.split('\n').filter((l) => /"level":"error"/.test(l)).slice(0, 5).join('\n'))
try { process.kill(-worker.pid!, 'SIGKILL') } catch {}; server.close(); console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed'); process.exit(failures ? 1 : 0)
