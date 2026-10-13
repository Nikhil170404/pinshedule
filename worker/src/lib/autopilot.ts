import { db, mapLimit } from './clients'
import { safeFetchText } from './safe-fetch'
import { extractImages, metaContent, pageTitle, parseSitemapUrls } from './html'
import { findFeedLink, parseFeed, sniffSource, type FeedItem, type SourceKind } from './rss'
import { errMsg, log } from './log'
import { notify } from './notify'

export interface Feed {
  id: string; user_id: string; connection_id: string; url: string
  board_id: string | null; board_name: string | null; active: boolean
  last_checked_at: string | null; last_error: string | null; failures: number
}

const NEW_PER_POLL = 5
const FIRST_POLL_DRAFTS = 3 // a new feed drafts only its latest posts, never the whole archive
const MAX_FAILURES = 10
export const POLL_EVERY_MS = 30 * 60_000

const FEED_ACCEPT = 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, text/html;q=0.8, */*;q=0.5'
const SITEMAP_PAGE_CAP = 1000
const COMMON_FEED_PATHS = ['/feed', '/feed/', '/rss', '/feed.xml', '/atom.xml', '/index.xml', '/sitemap.xml']

async function readSitemap(start: string): Promise<FeedItem[]> {
  const pages = new Set<string>()
  const queue = [start]
  const done = new Set<string>()
  while (queue.length && done.size < 4 && pages.size < SITEMAP_PAGE_CAP) {
    const next = queue.shift()!
    if (done.has(next)) continue
    done.add(next)
    const { text } = await safeFetchText(next, { maxBytes: 5_000_000, accept: 'application/xml,text/xml' })
    const x = parseSitemapUrls(text)
    for (const p of x.pages) if (pages.size < SITEMAP_PAGE_CAP && !/\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(p)) pages.add(p)
    // Post, product and article sitemaps first; tag and category ones last.
    queue.push(...x.sitemaps.sort((p, q) => Number(/post|product|article|blog/i.test(q)) - Number(/post|product|article|blog/i.test(p))))
  }
  return [...pages].map((url) => ({ url, title: '', description: '', image: null }))
}

/** Read a feed or sitemap address into items. A web page address is resolved to its feed first. */
export async function fetchSource(url: string): Promise<{ items: FeedItem[]; kind: Exclude<SourceKind, 'html'>; resolvedUrl: string }> {
  const { text, finalUrl } = await safeFetchText(url, { maxBytes: 5_000_000, accept: FEED_ACCEPT })
  const kind = sniffSource(text)
  if (kind === 'feed') {
    const items = parseFeed(text, finalUrl)
    if (!items.length) throw new Error('That feed has no posts yet.')
    return { items, kind, resolvedUrl: finalUrl }
  }
  if (kind === 'sitemap') {
    const items = await readSitemap(finalUrl)
    if (!items.length) throw new Error('No pages found in that sitemap.')
    return { items, kind, resolvedUrl: finalUrl }
  }
  // An ordinary page: follow the feed it advertises, then try the usual WordPress and static-site locations.
  const candidates = [findFeedLink(text, finalUrl), ...COMMON_FEED_PATHS.map((p) => new URL(p, finalUrl).href)].filter((c): c is string => !!c && c !== finalUrl)
  for (const c of [...new Set(candidates)].slice(0, 6)) {
    try {
      const r = await safeFetchText(c, { maxBytes: 5_000_000, accept: FEED_ACCEPT })
      const k = sniffSource(r.text)
      if (k === 'feed') { const items = parseFeed(r.text, r.finalUrl); if (items.length) return { items, kind: 'feed', resolvedUrl: r.finalUrl } }
      if (k === 'sitemap') { const items = await readSitemap(r.finalUrl); if (items.length) return { items, kind: 'sitemap', resolvedUrl: r.finalUrl } }
    } catch { /* try the next candidate */ }
  }
  throw new Error('Could not find an RSS feed or sitemap at that address. Try the full feed address, for example https://yourblog.com/feed.')
}

/** Fill in what a feed did not carry (sitemap entries have only a URL) from the post's own page. */
async function enrich(item: FeedItem): Promise<FeedItem> {
  if (item.title && item.image) return item
  try {
    const { text, finalUrl } = await safeFetchText(item.url, { maxBytes: 1_000_000 })
    return {
      ...item,
      title: item.title || (metaContent(text, 'property', 'og:title') || pageTitle(text) || '').slice(0, 100),
      description: item.description || (metaContent(text, 'property', 'og:description') || metaContent(text, 'name', 'description') || '').slice(0, 500),
      image: item.image ?? extractImages(text, finalUrl, 1)[0] ?? metaContent(text, 'property', 'og:image'),
    }
  } catch { return item }
}

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

/** Check one feed and turn new posts into drafts that wait for approval. Never throws. */
export async function pollFeed(feed: Feed): Promise<{ drafted: number; error?: string }> {
  const now = new Date().toISOString()
  try {
    const { items, kind } = await fetchSource(feed.url)
    const seen = new Set<string>()
    for (const part of chunk(items.map((i) => i.url), 60)) {
      const { data: seenRows } = await db.from('feed_drafts').select('item_url').eq('feed_id', feed.id).in('item_url', part)
      for (const r of seenRows ?? []) seen.add(r.item_url as string)
    }
    const fresh = items.filter((i) => !seen.has(i.url))
    const first = feed.last_checked_at === null
    // A sitemap has no reliable order, so its first check only records what already exists; later new URLs become drafts.
    const take = fresh.slice(0, first ? (kind === 'sitemap' ? 0 : FIRST_POLL_DRAFTS) : NEW_PER_POLL)
    // On the first check, older posts are recorded as seen so they never flood the review list later.
    const archive = first ? fresh.slice(take.length) : []

    // Duplicate URL detection against everything this account already scheduled or published.
    const { data: dupRows } = take.length
      ? await db.from('scheduled_pins').select('destination_url').eq('connection_id', feed.connection_id).in('destination_url', take.map((i) => i.url))
      : { data: [] }
    const already = new Set((dupRows ?? []).map((r) => r.destination_url as string))

    const rows = await mapLimit(take, 3, async (raw) => {
      const item = await enrich(raw)
      const image = item.image
      const status = already.has(item.url) ? 'duplicate' : image ? 'review' : 'rejected'
      return { feed_id: feed.id, user_id: feed.user_id, connection_id: feed.connection_id, item_url: item.url, title: item.title, description: item.description, image_url: image, status }
    })
    const all = [...rows, ...archive.map((i) => ({ feed_id: feed.id, user_id: feed.user_id, connection_id: feed.connection_id, item_url: i.url, title: i.title, description: i.description, image_url: null, status: 'rejected' }))]
    for (const part of chunk(all, 400)) await db.from('feed_drafts').upsert(part, { onConflict: 'feed_id,item_url', ignoreDuplicates: true })

    await db.from('rss_feeds').update({ last_checked_at: now, last_error: null, failures: 0 }).eq('id', feed.id)
    return { drafted: rows.filter((r) => r.status === 'review').length }
  } catch (e) {
    const msg = errMsg(e).slice(0, 300)
    const failures = feed.failures + 1
    await db.from('rss_feeds').update({ last_checked_at: now, last_error: msg, failures, active: failures < MAX_FAILURES }).eq('id', feed.id)
    log.warn('feed poll failed', { feed: feed.id, failures, error: msg })
    if (failures === MAX_FAILURES) {
      await notify(feed.user_id, { kind: 'feed_paused', connectionId: feed.connection_id, link: '/dashboard/autopilot', dedupeKey: `feed_paused:${feed.id}:${now.slice(0, 10)}`, title: 'Autopilot paused a feed', body: `${feed.url} failed ${MAX_FAILURES} times in a row (${msg}). Fix the address and resume it on the Autopilot page.` })
    }
    return { drafted: 0, error: msg }
  }
}

/** Background job: poll every feed that has not been checked for half an hour. */
export async function pollDueFeeds() {
  const before = new Date(Date.now() - POLL_EVERY_MS).toISOString()
  const { data } = await db.from('rss_feeds').select('*').eq('active', true)
    .or(`last_checked_at.is.null,last_checked_at.lt.${before}`).order('last_checked_at', { ascending: true, nullsFirst: true }).limit(40)
  const feeds = (data ?? []) as Feed[]
  if (!feeds.length) return
  const res = await mapLimit(feeds, 4, pollFeed)
  log.info('feeds polled', { feeds: feeds.length, drafted: res.reduce((t, r) => t + r.drafted, 0) })
}
