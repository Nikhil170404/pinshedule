import { db, mapLimit } from './clients'
import { safeFetchText } from './safe-fetch'
import { extractImages, metaContent } from './html'
import { parseFeed, type FeedItem } from './rss'
import { errMsg, log } from './log'

export interface Feed {
  id: string; user_id: string; connection_id: string; url: string
  board_id: string | null; board_name: string | null; active: boolean
  last_checked_at: string | null; last_error: string | null; failures: number
}

const NEW_PER_POLL = 5
const FIRST_POLL_DRAFTS = 3 // a new feed drafts only its latest posts, never the whole archive
const MAX_FAILURES = 10
export const POLL_EVERY_MS = 30 * 60_000

export async function fetchFeed(url: string): Promise<FeedItem[]> {
  const { text, finalUrl } = await safeFetchText(url, { maxBytes: 3_000_000, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' })
  const items = parseFeed(text, finalUrl)
  if (items.length === 0) throw new Error('No posts found. Is this an RSS or Atom feed address?')
  return items
}

/** Pinterest needs an image: use the feed's, else read the post's own page. */
async function imageFor(item: FeedItem): Promise<string | null> {
  if (item.image) return item.image
  try {
    const { text, finalUrl } = await safeFetchText(item.url, { maxBytes: 1_000_000 })
    return extractImages(text, finalUrl, 1)[0] ?? metaContent(text, 'property', 'og:image')
  } catch { return null }
}

/** Check one feed and turn new posts into drafts that wait for approval. Never throws. */
export async function pollFeed(feed: Feed): Promise<{ drafted: number; error?: string }> {
  const now = new Date().toISOString()
  try {
    const items = await fetchFeed(feed.url)
    const { data: seenRows } = await db.from('feed_drafts').select('item_url').eq('feed_id', feed.id).in('item_url', items.map((i) => i.url))
    const seen = new Set((seenRows ?? []).map((r) => r.item_url as string))
    const fresh = items.filter((i) => !seen.has(i.url))
    const first = feed.last_checked_at === null
    const take = fresh.slice(0, first ? FIRST_POLL_DRAFTS : NEW_PER_POLL)
    // On the first check, older posts are recorded as seen so they never flood the review list later.
    const archive = first ? fresh.slice(take.length) : []

    // Duplicate URL detection against everything this account already scheduled or published.
    const { data: dupRows } = take.length
      ? await db.from('scheduled_pins').select('destination_url').eq('connection_id', feed.connection_id).in('destination_url', take.map((i) => i.url))
      : { data: [] }
    const already = new Set((dupRows ?? []).map((r) => r.destination_url as string))

    const rows = await mapLimit(take, 3, async (item) => {
      const image = await imageFor(item)
      const status = already.has(item.url) ? 'duplicate' : image ? 'review' : 'rejected'
      return { feed_id: feed.id, user_id: feed.user_id, connection_id: feed.connection_id, item_url: item.url, title: item.title, description: item.description, image_url: image, status }
    })
    const all = [...rows, ...archive.map((i) => ({ feed_id: feed.id, user_id: feed.user_id, connection_id: feed.connection_id, item_url: i.url, title: i.title, description: i.description, image_url: null, status: 'rejected' }))]
    if (all.length) await db.from('feed_drafts').upsert(all, { onConflict: 'feed_id,item_url', ignoreDuplicates: true })

    await db.from('rss_feeds').update({ last_checked_at: now, last_error: null, failures: 0 }).eq('id', feed.id)
    return { drafted: rows.filter((r) => r.status === 'review').length }
  } catch (e) {
    const msg = errMsg(e).slice(0, 300)
    const failures = feed.failures + 1
    await db.from('rss_feeds').update({ last_checked_at: now, last_error: msg, failures, active: failures < MAX_FAILURES }).eq('id', feed.id)
    log.warn('feed poll failed', { feed: feed.id, failures, error: msg })
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
