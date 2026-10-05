import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import { encrypt } from '../../../shared/crypto'
import { PORTS, pinterest, serviceKey, sql, startServers, storage } from './harness'

const ENC = 'integration-encryption-secret-32-chars!'
process.env.APP_URL = 'http://app.test'
process.env.SUPABASE_URL = `http://127.0.0.1:${PORTS.supabase}`
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey()
process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${PORTS.redis}`
process.env.UPSTASH_REDIS_REST_TOKEN = 'x'
process.env.ENCRYPTION_SECRET = ENC
process.env.PINTEREST_CLIENT_ID = 'x'
process.env.PINTEREST_CLIENT_SECRET = 'x'
process.env.PINTEREST_API_BASE = `http://127.0.0.1:${PORTS.pinterest}/v5`
process.env.MEDIA_POLL_MS = '20'

const U1 = '11111111-1111-1111-1111-111111111111' // a pro login with two Pinterest accounts
const U2 = '22222222-2222-2222-2222-222222222222' // a different login with one
const A = 'aaaaaaaa-0000-0000-0000-00000000000a'
const B = 'bbbbbbbb-0000-0000-0000-00000000000b'
const C = 'cccccccc-0000-0000-0000-00000000000c'
const past = () => new Date(Date.now() - 30_000).toISOString() // due now; DB and host clocks may differ a little

let stop: () => Promise<unknown[]>
let svc: typeof import('../../src/lib/pin-service')
let pub: typeof import('../../src/jobs/publisher')
let analytics: typeof import('../../src/jobs/analytics')
let timing: typeof import('../../src/lib/timing')
let tools: typeof import('../../src/lib/assistant-tools')
let accountsMod: typeof import('../../src/lib/accounts')
let authMod: typeof import('../../src/lib/auth')
let accountsRoute: typeof import('../../src/routes/accounts')
let pinsRoute: typeof import('../../src/routes/pins')
let planMod: typeof import('../../src/lib/plan')
let clients: typeof import('../../src/lib/clients')
let queue: typeof import('../../src/lib/queue')

const pinBody = (over: Record<string, unknown> = {}) => ({ image_url: `https://img.example/${Math.random().toString(36).slice(2)}.jpg`, board_id: 'b', scheduled_at: past(), ...over })
const parse = (pins: object[], auto?: object) => svc.scheduleBody.parse({ pins, ...(auto ? { auto } : {}) })
const pinRow = (id: string) => JSON.parse(sql(`select row_to_json(p) from scheduled_pins p where id='${id}'`))
const pinterestPins = () => pinterest.calls.filter((c) => c.method === 'POST' && c.path === '/v5/pins')

before(async () => {
  stop = await startServers(Number(process.env.IT_REST_PORT))
  sql(`insert into auth.users (id, email) values ('${U1}','one@test'),('${U2}','two@test')`)
  sql(`update user_profiles set plan='pro', timezone='UTC' where id='${U1}'`)
  const conn = async (id: string, user: string, name: string, primary: boolean) =>
    sql(`insert into pinterest_connections (id, user_id, pinterest_user_id, pinterest_username, access_token, refresh_token, expires_at, is_primary)
         values ('${id}','${user}','pid-${name}','${name}','${await encrypt(`tok${name}`, ENC)}','${await encrypt(`ref${name}`, ENC)}', now() + interval '10 days', ${primary})`)
  await conn(A, U1, 'A', true); await conn(B, U1, 'B', false); await conn(C, U2, 'C', true)

  svc = await import('../../src/lib/pin-service')
  pub = await import('../../src/jobs/publisher')
  analytics = await import('../../src/jobs/analytics')
  timing = await import('../../src/lib/timing')
  tools = await import('../../src/lib/assistant-tools')
  accountsMod = await import('../../src/lib/accounts')
  authMod = await import('../../src/lib/auth')
  accountsRoute = await import('../../src/routes/accounts')
  pinsRoute = await import('../../src/routes/pins')
  planMod = await import('../../src/lib/plan')
  clients = await import('../../src/lib/clients')
  queue = await import('../../src/lib/queue')
})

after(async () => { await stop?.() })

test('pins publish through the Pinterest account they were scheduled for', async () => {
  pinterest.reset()
  const a = await svc.schedulePins(U1, A, parse([pinBody({ board_id: 'bA' })]))
  const b = await svc.schedulePins(U1, B, parse([pinBody({ board_id: 'bB' })]))
  const r = await pub.dispatchDue()
  assert.equal(r.published, 2, JSON.stringify(r))
  const calls = pinterestPins()
  assert.equal(calls.length, 2)
  const byBoard = Object.fromEntries(calls.map((c) => [(c.body as { board_id: string }).board_id, c.token]))
  assert.deepEqual(byBoard, { bA: 'tokA', bB: 'tokB' }, 'each pin used its own account token')
  assert.equal(pinRow(a.ids[0]).status, 'published')
  assert.equal(pinRow(b.ids[0]).connection_id, B)
})

test('a pin from before accounts existed uses the only account, but never guesses between several', async () => {
  pinterest.reset()
  const legacy = (user: string) => sql(`insert into scheduled_pins (user_id, image_url, board_id, scheduled_at, status) values ('${user}','https://img.example/legacy.jpg','bx', now() - interval '1 minute','pending') returning id`)
  const one = legacy(U2); const two = legacy(U1)
  await queue.enqueue([{ id: one, at: new Date(Date.now() - 60_000) }, { id: two, at: new Date(Date.now() - 60_000) }])
  await pub.dispatchDue()
  assert.equal(pinRow(one).status, 'published', 'one account: unambiguous')
  assert.equal(pinterestPins().find((c) => (c.body as { board_id: string }).board_id === 'bx')?.token, 'tokC')
  const failed = pinRow(two)
  assert.equal(failed.status, 'failed', 'two accounts: refuse to guess')
  assert.match(failed.error_message, /account for this pin was removed/)
})

test('video pin: uploads the file, waits for processing, then creates the pin', async () => {
  pinterest.reset()
  storage.set(`pin-videos/${U1}/clip.mp4`, { bytes: Buffer.alloc(5000, 7), type: 'video/mp4' })
  const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/pin-videos/${U1}/clip.mp4`
  const r = await svc.schedulePins(U1, A, parse([pinBody({ media_type: 'video', video_url: url, image_url: 'https://img.example/cover.jpg', board_id: 'vid' })]))
  await pub.dispatchDue()
  const row = pinRow(r.ids[0])
  assert.equal(row.status, 'published', row.error_message)
  assert.equal(pinterest.uploads.length, 1)
  assert.deepEqual(Object.keys(pinterest.uploads[0].fields), ['key', 'policy', 'x-amz-signature'], 'form fields are sent before the file')
  assert.equal(pinterest.uploads[0].fileBytes, 5000)
  const polls = pinterest.calls.filter((c) => c.path.startsWith('/v5/media/')).length
  assert.ok(polls >= 2, `polled until processed (${polls})`)
  const created = pinterestPins().find((c) => (c.body as { board_id: string }).board_id === 'vid')!
  const source = (created.body as { media_source: Record<string, string> }).media_source
  assert.equal(source.source_type, 'video_id')
  assert.equal(source.cover_image_url, 'https://img.example/cover.jpg')
  assert.match(source.media_id, /^media-/)
  assert.equal(row.media_id, source.media_id, 'the media id was saved')
})

test('a video still processing goes back in the queue and is not uploaded twice', async () => {
  pinterest.reset(); pinterest.processingPolls = 999
  storage.set(`pin-videos/${U1}/slow.mp4`, { bytes: Buffer.alloc(3000, 1), type: 'video/mp4' })
  const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/pin-videos/${U1}/slow.mp4`
  const r = await svc.schedulePins(U1, A, parse([pinBody({ media_type: 'video', video_url: url, board_id: 'slow' })]))
  const id = r.ids[0]
  assert.equal((await pub.dispatchDue()).retried, 1)
  let row = pinRow(id)
  assert.equal(row.status, 'pending')
  assert.match(row.error_message, /still processing/)
  assert.ok(row.media_id, 'media id kept for the retry')
  const wait = new Date(row.scheduled_at).getTime() - Date.now()
  assert.ok(wait > 60_000 && wait < 120_000, `retry in about 90s, got ${wait}ms`)

  // Pinterest finishes processing; the pin is due again.
  pinterest.processingPolls = 0
  sql(`update scheduled_pins set scheduled_at = now() - interval '5 seconds' where id='${id}'`)
  await queue.enqueue([{ id, at: new Date(Date.now() - 5000) }])
  await pub.dispatchDue()
  row = pinRow(id)
  assert.equal(row.status, 'published', row.error_message)
  assert.equal(pinterest.uploads.length, 1, 'the file was uploaded once, on the first attempt')
  assert.equal(pinterest.calls.filter((c) => c.path === '/v5/media' && c.method === 'POST').length, 1, 'no second registration')
})

test('a video Pinterest rejects fails permanently with a clear message and clears the media id', async () => {
  pinterest.reset(); pinterest.mediaFails = true
  storage.set(`pin-videos/${U1}/bad.mp4`, { bytes: Buffer.alloc(2000, 2), type: 'video/mp4' })
  const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/pin-videos/${U1}/bad.mp4`
  const r = await svc.schedulePins(U1, A, parse([pinBody({ media_type: 'video', video_url: url })]))
  await pub.dispatchDue()
  const row = pinRow(r.ids[0])
  assert.equal(row.status, 'failed')
  assert.match(row.error_message, /could not process this video/)
  assert.equal(row.media_id, null, 'so a retry uploads the (possibly replaced) file again')
})

test('carousel pins send every image, with the first as the thumbnail', async () => {
  pinterest.reset()
  const items = ['https://img.example/1.jpg', 'https://img.example/2.jpg', 'https://img.example/3.jpg'].map((url) => ({ url }))
  const r = await svc.schedulePins(U1, B, parse([pinBody({ media_type: 'carousel', carousel_items: items, image_url: 'https://img.example/ignored.jpg', board_id: 'car' })]))
  await pub.dispatchDue()
  const row = pinRow(r.ids[0])
  assert.equal(row.status, 'published', row.error_message)
  assert.equal(row.image_url, items[0].url)
  const created = pinterestPins().find((c) => (c.body as { board_id: string }).board_id === 'car')!
  assert.deepEqual((created.body as { media_source: unknown }).media_source, { source_type: 'multiple_image_urls', items, index: 0 })
  assert.equal(created.token, 'tokB')
})

test('one Pinterest account can be a secondary account in another login, but only once per login', () => {
  // An agency (U1) manages a client's Pinterest account that also has its own login (U2): both may hold it,
  // and holding it never gives either login access to the other.
  sql(`insert into pinterest_connections (user_id, pinterest_user_id, access_token, refresh_token, expires_at) values ('${U2}','pid-A','x','y', now())`)
  assert.equal(sql(`select count(*) from pinterest_connections where pinterest_user_id='pid-A'`), '2')
  assert.throws(() => sql(`insert into pinterest_connections (user_id, pinterest_user_id, access_token, refresh_token, expires_at) values ('${U1}','pid-A','x','y', now())`), /duplicate key|unique/i)
  sql(`delete from pinterest_connections where user_id='${U2}' and pinterest_user_id='pid-A'`)
})

test('the active account is resolved per request and cannot be another login\'s', async () => {
  assert.equal((await accountsMod.resolveConnection(U1, A)).connection?.id, A)
  assert.equal((await accountsMod.resolveConnection(U1, null)).connection?.id, A, 'default is the primary account')
  const foreign = await accountsMod.resolveConnection(U1, C)
  assert.equal(foreign.connection, null); assert.equal(foreign.stale, true)
  assert.equal((await accountsMod.resolveConnection(U1, 'not-a-uuid')).stale, true)
  assert.equal(await accountsMod.soleConnectionId(U2), C)
  assert.equal(await accountsMod.soleConnectionId(U1), null)
})

function app(userId: string) {
  const a = new Hono<import('../../src/lib/auth').AppEnv>()
  a.onError((e, c) => (e instanceof accountsMod.AccountError ? c.json({ error: e.message, ...e.extra }, e.status) : c.json({ error: String(e) }, 500)))
  a.use('*', async (c, next) => { c.set('userId', userId); await next() })
  a.use('*', authMod.withAccount)
  a.route('/accounts', accountsRoute.accounts)
  a.route('/pins', pinsRoute.pins)
  return a
}

test('API: naming another login\'s account is refused instead of silently using the primary', async () => {
  const res = await app(U1).request('/pins/timing', { headers: { 'x-account-id': C } })
  assert.equal(res.status, 404)
  assert.equal(((await res.json()) as { account_missing: boolean }).account_missing, true)
  const ok = await app(U1).request('/pins/timing', { headers: { 'x-account-id': B } })
  assert.equal(ok.status, 200)
})

test('API: accounts list shows each account with its own queue numbers and the plan limit', async () => {
  await svc.schedulePins(U1, B, parse([pinBody({ scheduled_at: new Date(Date.now() + 3600_000).toISOString() }), pinBody({ scheduled_at: new Date(Date.now() + 7200_000).toISOString() })]))
  const res = await app(U1).request('/accounts')
  const body = (await res.json()) as { accounts: { id: string; username: string; is_primary: boolean; stats: { pending: number; published_30d: number } }[]; limit: number; can_add: boolean }
  assert.equal(res.status, 200)
  assert.deepEqual(body.accounts.map((a) => a.id), [A, B], 'primary first')
  assert.equal(body.limit, 10); assert.equal(body.can_add, true)
  const stats = Object.fromEntries(body.accounts.map((a) => [a.username, a.stats]))
  assert.equal(stats.B.pending, 2)
  assert.ok(stats.A.published_30d >= 1)
  const other = (await (await app(U2).request('/accounts')).json()) as { accounts: { id: string }[]; limit: number }
  assert.deepEqual(other.accounts.map((a) => a.id), [C], 'another login sees only its own')
  assert.equal(other.limit, 1)
})

test('API: rename, and one login cannot remove another login\'s account', async () => {
  const r = await app(U1).request(`/accounts/${B}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'Client B' }) })
  assert.equal(r.status, 200)
  assert.equal(sql(`select label from pinterest_connections where id='${B}'`), 'Client B')
  assert.equal((await app(U2).request(`/accounts/${B}`, { method: 'DELETE' })).status, 404)
  assert.equal(sql(`select count(*) from pinterest_connections where id='${B}'`), '1')
})

test('API: checking a connection refreshes the profile details from Pinterest', async () => {
  pinterest.reset()
  const r = await app(U1).request(`/accounts/${A}/check`, { method: 'POST' })
  assert.equal(r.status, 200, await r.clone().text())
  assert.equal(sql(`select avatar_url from pinterest_connections where id='${A}'`), 'https://img.example/tokA.jpg')
})

test('assistant tools see only the selected account', async () => {
  const ctxA = await tools.toolContext(U1, (await accountsMod.resolveConnection(U1, A)).connection)
  const ctxB = await tools.toolContext(U1, (await accountsMod.resolveConnection(U1, B)).connection)
  const save = async () => 'id'
  const pins = async (ctx: typeof ctxA) => JSON.parse((await tools.runTool(ctx, 'list_pins', '{}', save)).text) as { total_matching: number; pins: { board: string | null }[] }
  const a = await pins(ctxA); const b = await pins(ctxB)
  const dbCount = (c: string) => Number(sql(`select count(*) from scheduled_pins where connection_id='${c}'`))
  assert.equal(a.total_matching, dbCount(A)); assert.equal(b.total_matching, dbCount(B))
  assert.notEqual(a.total_matching, a.total_matching + b.total_matching)
  const stats = JSON.parse((await tools.runTool(ctxB, 'get_queue_stats', '{}', save)).text) as { scheduled: number }
  assert.equal(stats.scheduled, Number(sql(`select count(*) from scheduled_pins where connection_id='${B}' and status='pending'`)))
  const none = await tools.runTool(await tools.toolContext(U1, null), 'list_boards', '{}', save)
  assert.match(none.text, /Connect a Pinterest account/)
})

test('pacing: a crowded day and a repeated image are reported, per account', async () => {
  const day = new Date(Date.now() + 5 * 86_400_000); day.setUTCHours(10, 0, 0, 0)
  const same = 'https://img.example/same.jpg'
  const pins = Array.from({ length: 16 }, (_, i) => pinBody({ ...(i < 2 ? { image_url: same } : {}), scheduled_at: new Date(day.getTime() + i * 60_000).toISOString() }))
  const r = await svc.schedulePins(U1, A, parse(pins))
  assert.equal(r.warnings.length, 2, r.warnings.join(' | '))
  assert.match(r.warnings[0], /More than 15 pins/)
  assert.match(r.warnings[1], /reuse/)
  // The same busy day on a different account is a different feed: no warning.
  const other = await svc.schedulePins(U1, B, parse([pinBody({ scheduled_at: new Date(day.getTime() + 30 * 60_000).toISOString() })]))
  assert.deepEqual(other.warnings, [])
})

test('the monthly pin quota is shared by all accounts of a login', async () => {
  sql(`update user_profiles set plan='free_trial' where id='${U1}'`) // 30 pins a month, 10 per batch
  await planMod.invalidateProfile(U1)
  const start = new Date(); start.setUTCMonth(start.getUTCMonth() + 2, 15); start.setUTCHours(9, 0, 0, 0)
  const batch = (offset: number, n: number) => parse(Array.from({ length: n }, (_, i) => pinBody({ scheduled_at: new Date(start.getTime() + (offset + i) * 3600_000).toISOString() })))
  await svc.schedulePins(U1, A, batch(0, 10))
  await svc.schedulePins(U1, B, batch(20, 10))
  await svc.schedulePins(U1, A, batch(40, 10)) // 30 used across two accounts
  await assert.rejects(
    svc.schedulePins(U1, B, batch(60, 2)),
    (e: Error & { extra?: { remaining: number; limit: number } }) => e.message.includes('Monthly pin limit') && e.extra?.remaining === 0 && e.extra?.limit === 30,
  )
  sql(`update user_profiles set plan='pro' where id='${U1}'`)
  await planMod.invalidateProfile(U1)
})

test('analytics sync is per account and re-running does not duplicate rows', async () => {
  pinterest.reset()
  await analytics.syncConnectionAnalytics(A)
  await analytics.syncConnectionAnalytics(A)
  assert.equal(sql(`select count(*) from account_analytics where connection_id='${A}'`), '1')
  assert.equal(sql(`select count(*) from account_analytics where connection_id='${B}'`), '0')
  assert.ok(Number(sql(`select count(*) from analytics_snapshots where connection_id='${A}'`)) >= 1)
  assert.ok(sql(`select analytics_synced_at from pinterest_connections where id='${A}'`).length > 0)
})

test('the scheduled analytics job picks up accounts that were never synced', async () => {
  pinterest.reset()
  sql(`update pinterest_connections set analytics_synced_at = null where id='${B}'`)
  await analytics.syncAllAnalytics()
  assert.ok(sql(`select analytics_synced_at from pinterest_connections where id='${B}'`).length > 0)
  assert.equal(sql(`select count(*) from account_analytics where connection_id='${B}'`), '1')
})

test('personalised timing: general until enough results, then led by the account\'s best hour', async () => {
  const redisClear = async () => { await clients.redis.del(`timing:${C}:UTC`) }
  await redisClear()
  assert.equal((await timing.loadTiming(C, 'UTC')).source, 'general', 'no data yet')

  // 40 published pins for account C: hour 20 earns 8% engagement, hour 14 earns 2%.
  sql(`
    with p as (
      insert into scheduled_pins (user_id, connection_id, image_url, board_id, scheduled_at, status, published_at, pinterest_pin_id)
      select '${U2}', '${C}', 'https://i/'||g, 'b', now() - interval '3 days', 'published',
             date_trunc('day', now() - ((g % 25)+1 || ' days')::interval) + case when g % 2 = 0 then interval '20 hours 10 minutes' else interval '14 hours 10 minutes' end, 'pp'||g
        from generate_series(1,40) g returning id, published_at)
    insert into analytics_snapshots (user_id, connection_id, pin_id, snapshot_date, impressions, saves, clicks, outbound_clicks)
    select '${U2}', '${C}', id, current_date, 1000, case when extract(hour from published_at) = 20 then 50 else 12 end, case when extract(hour from published_at) = 20 then 20 else 6 end, case when extract(hour from published_at) = 20 then 10 else 2 end from p`)
  await redisClear()
  const t = await timing.loadTiming(C, 'UTC')
  assert.equal(t.source, 'personal'); assert.equal(t.sample, 40)
  assert.equal(t.hours[0], 20, `ranking: ${t.hours.join(',')}`)

  sql(`update user_profiles set plan='starter' where id='${U2}'`)
  await planMod.invalidateProfile(U2)
  const preview = await svc.previewSlots(U2, C, 3, 1)
  assert.equal(preview.source, 'personal')
  assert.ok(preview.slots.every((s) => new Date(s).getUTCHours() === 20), 'one pin a day lands on the best hour')
})

test('similar-pin search is limited to one account when asked', async () => {
  const vec = (x: number) => `[${[x, ...Array(1535).fill(0)].join(',')}]`
  const mk = (conn: string, user: string, title: string) => sql(`
    with p as (insert into scheduled_pins (user_id, connection_id, image_url, title, board_id, scheduled_at, status) values ('${user}','${conn}','https://i/${title}','${title}','b', now(), 'pending') returning id)
    insert into pin_embeddings (pin_id, user_id, embedding) select id, '${user}', '${vec(1)}' from p`)
  mk(A, U1, 'on-account-A'); mk(B, U1, 'on-account-B')
  const { data: all } = await clients.db.rpc('match_pins', { p_user: U1, p_embedding: JSON.stringify([1, ...Array(1535).fill(0)]), p_threshold: 0.9, p_limit: 10 })
  const { data: onlyB } = await clients.db.rpc('match_pins', { p_user: U1, p_embedding: JSON.stringify([1, ...Array(1535).fill(0)]), p_threshold: 0.9, p_limit: 10, p_connection: B })
  assert.deepEqual(((all ?? []) as { title: string }[]).map((m) => m.title).sort(), ['on-account-A', 'on-account-B'])
  assert.deepEqual(((onlyB ?? []) as { title: string }[]).map((m) => m.title), ['on-account-B'])
})

test('removing the primary account promotes another and deletes only that account\'s pins', async () => {
  const before = Number(sql(`select count(*) from scheduled_pins where connection_id='${B}'`))
  assert.ok(before > 0)
  const res = await app(U1).request(`/accounts/${A}`, { method: 'DELETE' })
  assert.equal(res.status, 200)
  assert.equal(sql(`select count(*) from pinterest_connections where id='${A}'`), '0')
  assert.equal(sql(`select is_primary from pinterest_connections where id='${B}'`), 't', 'the remaining account became the default')
  assert.equal(sql(`select count(*) from scheduled_pins where connection_id='${A}'`), '0')
  assert.equal(Number(sql(`select count(*) from scheduled_pins where connection_id='${B}'`)), before, 'the other account is untouched')
  assert.equal((await accountsMod.resolveConnection(U1, null)).connection?.id, B)
})
