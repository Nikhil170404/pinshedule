import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createHmac } from 'node:crypto'
import { execFileSync } from 'node:child_process'

export const PORTS = { supabase: 3300, redis: 3302, pinterest: 3303 }
export const SECRET = process.env.IT_JWT_SECRET ?? ''
export const PG = process.env.IT_PG_CONTAINER ?? ''

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
export function serviceKey(): string {
  const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'service_role', iss: 'it' })}`
  return `${head}.${createHmac('sha256', SECRET).update(head).digest('base64url')}`
}

/** Run SQL in the throwaway Postgres container and return the raw output. */
export function sql(text: string): string {
  return execFileSync('docker', ['exec', '-i', PG, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t'], { input: text, encoding: 'utf8' }).trim()
}

async function body(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return Buffer.concat(chunks)
}
const json = (res: ServerResponse, status: number, data: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)) }
const listen = (s: Server, port: number) => new Promise<void>((r) => s.listen(port, '127.0.0.1', r))

// ───────────────────────── Supabase: PostgREST proxy + public storage ─────────────────────────
export const storage = new Map<string, { bytes: Buffer; type: string }>()

export function supabaseServer(restPort: number): Server {
  return createServer(async (req, res) => {
    const url = req.url ?? '/'
    if (url.startsWith('/rest/v1/')) {
      const payload = await body(req)
      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string' && !['host', 'connection', 'content-length'].includes(k)) headers[k] = v
      const upstream = await fetch(`http://127.0.0.1:${restPort}${url.slice('/rest/v1'.length)}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : payload })
      const out = Buffer.from(await upstream.arrayBuffer())
      const rh: Record<string, string> = {}
      upstream.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'connection'].includes(k)) rh[k] = v })
      res.writeHead(upstream.status, rh); res.end(out)
      return
    }
    const m = url.match(/^\/storage\/v1\/object\/public\/(.+)$/)
    if (m && storage.has(m[1])) {
      const f = storage.get(m[1])!
      res.writeHead(200, { 'content-type': f.type, 'content-length': String(f.bytes.length) }); res.end(f.bytes)
      return
    }
    json(res, 404, { error: 'not found', url })
  })
}

// ───────────────────────── Upstash Redis REST (just the commands the worker uses) ─────────────────────────
export function redisServer(): Server {
  const kv = new Map<string, { v: string; exp: number | null }>()
  const z = new Map<string, Map<string, number>>()
  const live = (k: string) => { const e = kv.get(k); if (e && e.exp !== null && e.exp < Date.now()) { kv.delete(k); return undefined } return e }

  /** Run one command; returns the result or throws for an unknown one. */
  function run(cmd: (string | number)[]): unknown {
    const [name, ...a] = cmd
    const op = String(name).toUpperCase()
    const k = String(a[0])
    switch (op) {
      case 'GET': return live(k)?.v ?? null
      case 'SET': {
        const flags = a.slice(2).map((x) => String(x).toUpperCase())
        if (flags.includes('NX') && live(k)) return null
        const exI = flags.indexOf('EX')
        kv.set(k, { v: String(a[1]), exp: exI >= 0 ? Date.now() + Number(a.slice(2)[exI + 1]) * 1000 : null })
        return 'OK'
      }
      case 'DEL': { let n = 0; for (const key of a) { if (kv.delete(String(key))) n++; if (z.delete(String(key))) n++ } return n }
      case 'GETDEL': { const v = live(k)?.v ?? null; kv.delete(k); return v }
      case 'ZADD': {
        const set = z.get(k) ?? new Map<string, number>(); z.set(k, set)
        let added = 0
        for (let i = 1; i + 1 < a.length; i += 2) { if (!set.has(String(a[i + 1]))) added++; set.set(String(a[i + 1]), Number(a[i])) }
        return added
      }
      case 'ZREM': { const set = z.get(k); let n = 0; for (const m of a.slice(1)) if (set?.delete(String(m))) n++; return n }
      case 'ZRANGE': {
        const set = z.get(k) ?? new Map<string, number>()
        const lo = Number(a[1]); const hi = Number(a[2])
        const li = a.findIndex((x) => String(x).toUpperCase() === 'LIMIT')
        const off = li >= 0 ? Number(a[li + 1]) : 0; const cnt = li >= 0 ? Number(a[li + 2]) : Infinity
        const m = [...set.entries()].filter(([, s]) => s >= lo && s <= hi).sort((x, y) => x[1] - y[1]).map(([mem]) => mem)
        return m.slice(off, off + cnt)
      }
      case 'EXPIRE': return 1
      case 'INCR': { const n = Number(live(k)?.v ?? 0) + 1; kv.set(k, { v: String(n), exp: live(k)?.exp ?? null }); return n }
      default: throw new Error(`ERR unknown command ${op}`)
    }
  }

  return createServer(async (req, res) => {
    const base64 = req.headers['upstash-encoding'] === 'base64'
    const enc = (v: unknown): unknown => (base64 && typeof v === 'string' ? Buffer.from(v).toString('base64') : Array.isArray(v) ? v.map(enc) : v)
    let payload: unknown
    try { payload = JSON.parse((await body(req)).toString()) } catch { return json(res, 400, { error: 'bad body' }) }
    // The client batches commands into a pipeline (an array of commands); a single command is one array.
    const batch = Array.isArray(payload) && Array.isArray(payload[0])
    const items = (batch ? payload : [payload]) as (string | number)[][]
    const out = items.map((cmd) => { try { return { result: enc(run(cmd)) } } catch (e) { return { error: (e as Error).message } } })
    if (!batch) return out[0].error ? json(res, 400, out[0]) : json(res, 200, out[0])
    json(res, 200, out)
  })
}

// ───────────────────────── Pinterest API (v5) ─────────────────────────
export interface PinterestCall { method: string; path: string; token: string; body: unknown; contentType: string }
export const pinterest = {
  calls: [] as PinterestCall[],
  /** Media polls that report "processing" before "succeeded". Set high to simulate a stuck video. */
  processingPolls: 1,
  mediaFails: false,
  uploads: [] as { fields: Record<string, string>; fileBytes: number; fileType: string }[],
  polls: new Map<string, number>(),
  reset() { this.calls = []; this.uploads = []; this.polls.clear(); this.processingPolls = 1; this.mediaFails = false },
}

function parseMultipart(buf: Buffer, contentType: string) {
  const boundary = contentType.split('boundary=')[1]
  const fields: Record<string, string> = {}
  let fileBytes = 0, fileType = ''
  for (const part of buf.toString('latin1').split(`--${boundary}`).slice(1, -1)) {
    const [head, ...rest] = part.split('\r\n\r\n')
    const content = rest.join('\r\n\r\n').replace(/\r\n$/, '')
    const name = head.match(/name="([^"]+)"/)?.[1] ?? ''
    if (/filename=/.test(head)) { fileBytes = Buffer.byteLength(content, 'latin1'); fileType = head.match(/content-type:\s*([^\r\n]+)/i)?.[1] ?? '' }
    else fields[name] = content
  }
  return { fields, fileBytes, fileType }
}

export function pinterestServer(): Server {
  let pinCounter = 0
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const raw = await body(req)
    const ct = String(req.headers['content-type'] ?? '')
    const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '')
    let parsed: unknown = null
    if (ct.includes('json')) { try { parsed = JSON.parse(raw.toString()) } catch { /* ignore */ } }
    pinterest.calls.push({ method: req.method ?? 'GET', path: url.pathname, token, body: parsed, contentType: ct })

    if (url.pathname === '/s3-upload' && req.method === 'POST') {
      pinterest.uploads.push(parseMultipart(raw, ct)); res.writeHead(204); return res.end()
    }
    if (url.pathname === '/v5/oauth/token') return json(res, 200, { access_token: 'tok-refreshed', refresh_token: 'ref-refreshed', expires_in: 2592000 })
    if (url.pathname === '/v5/user_account' && req.method === 'GET') return json(res, 200, { id: `id-${token}`, username: `user-${token}`, profile_image: `https://img.example/${token}.jpg` })
    if (url.pathname === '/v5/boards') return json(res, 200, { items: [{ id: `board-${token}`, name: `Board of ${token}` }], bookmark: null })
    if (url.pathname === '/v5/pins' && req.method === 'POST') return json(res, 201, { id: `pin-${++pinCounter}` })
    if (url.pathname === '/v5/media' && req.method === 'POST') {
      return json(res, 201, { media_id: `media-${pinCounter}-${pinterest.calls.length}`, media_type: 'video', upload_url: `http://127.0.0.1:${PORTS.pinterest}/s3-upload`, upload_parameters: { key: 'k1', policy: 'p1', 'x-amz-signature': 's1' } })
    }
    const media = url.pathname.match(/^\/v5\/media\/(.+)$/)
    if (media) {
      const n = (pinterest.polls.get(media[1]) ?? 0) + 1
      pinterest.polls.set(media[1], n)
      const status = pinterest.mediaFails ? 'failed' : n > pinterest.processingPolls ? 'succeeded' : 'processing'
      return json(res, 200, { media_id: media[1], status })
    }
    if (url.pathname === '/v5/user_account/analytics') {
      return json(res, 200, { all: { daily_metrics: [{ date: '2030-01-01', metrics: { IMPRESSION: 100, SAVE: 5, PIN_CLICK: 3, OUTBOUND_CLICK: 2, ENGAGEMENT: 10 } }] } })
    }
    if (/^\/v5\/pins\/[^/]+\/analytics$/.test(url.pathname)) return json(res, 200, { all: { summary_metrics: { IMPRESSION: 200, SAVE: 8, PIN_CLICK: 4, OUTBOUND_CLICK: 6 } } })
    json(res, 404, { message: `no fake for ${req.method} ${url.pathname}` })
  })
}

export async function startServers(restPort: number) {
  const servers = [supabaseServer(restPort), redisServer(), pinterestServer()]
  await Promise.all([listen(servers[0], PORTS.supabase), listen(servers[1], PORTS.redis), listen(servers[2], PORTS.pinterest)])
  return () => Promise.all(servers.map((s) => new Promise<void>((r) => { s.closeAllConnections?.(); s.close(() => r()) })))
}
