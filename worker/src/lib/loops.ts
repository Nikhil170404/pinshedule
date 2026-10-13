import { byFairness, isDue, pickSlot, PAUSE_AFTER_FAILURES, type LoopSettings } from '@shared/loop'
import { isValidTimeZone } from '@shared/schedule'
import { db } from './clients'
import { aiEnabled, captionOptions } from './ai'
import { consumeUsage, getProfile, invalidateProfile } from './plan'
import { schedulePins, ServiceError } from './pin-service'
import { notify } from './notify'
import { errMsg, log } from './log'

export interface Loop extends LoopSettings {
  id: string; user_id: string; connection_id: string; name: string; active: boolean; paused_reason: string | null
  require_approval: boolean; refresh_text: boolean
}
export interface Item {
  id: string; loop_id: string; image_url: string; title: string | null; description: string | null; alt_text: string | null
  destination_url: string | null; board_id: string; board_name: string | null; active: boolean; last_recycled_at: string | null; times_recycled: number
}

const MAX_REVIEW_BACKLOG = 10
const MAX_PER_TICK = 3

export async function pauseLoop(loop: Loop, reason: string) {
  await db.from('loops').update({ active: false, paused_reason: reason }).eq('id', loop.id)
  log.warn('loop paused', { loop: loop.id, reason })
  await notify(loop.user_id, {
    kind: 'feed_paused', connectionId: loop.connection_id, link: '/dashboard/smartloop', dedupeKey: `loop_paused:${loop.id}:${new Date().toISOString().slice(0, 10)}`,
    title: 'SmartLoop paused itself', body: `"${loop.name}" was paused: ${reason}`,
  })
}

/** Times of the account's queued and recent pins, so recycled pins keep a gap from everything else. */
async function queuedTimes(connectionId: string): Promise<number[]> {
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { data } = await db.from('scheduled_pins').select('scheduled_at').eq('connection_id', connectionId).in('status', ['pending', 'processing', 'published']).gte('scheduled_at', since).limit(3000)
  return (data ?? []).map((r) => new Date(r.scheduled_at as string).getTime())
}

/** Reword the saved text for a recycled pin when AI is available and the monthly allowance has room. Falls back to the original. */
async function freshText(userId: string, item: Item, allow: boolean): Promise<{ title: string; description: string; reworded: boolean }> {
  const original = { title: item.title ?? '', description: item.description ?? '', reworded: false }
  if (!allow || !aiEnabled()) return original
  try {
    const plan = (await getProfile(userId)).limits
    if (!(await consumeUsage(userId, 'ai', plan.ai_generations))) return original
    await invalidateProfile(userId)
    const options = await captionOptions(`${original.title}. ${original.description}`.slice(0, 280))
    const pick = options.find((o) => o.title.trim().toLowerCase() !== original.title.trim().toLowerCase()) ?? options[0]
    return pick ? { title: pick.title, description: pick.description, reworded: true } : original
  } catch { return original }
}

/** Put one recycled pin on the calendar at a random time inside the window. Returns the run row fields. */
export async function scheduleRecycled(loop: Loop, item: Item, text: { title: string; description: string }, tz: string, loopTimes: number[]) {
  const avoid = await queuedTimes(loop.connection_id)
  const at = pickSlot({ now: Date.now(), tz, start: loop.window_start, end: loop.window_end, maxPerDay: loop.max_per_day, taken: loopTimes, avoid })
  if (at === null) throw new ServiceError('No free slot in the next two weeks inside your posting window.', 409)
  const r = await schedulePins(loop.user_id, loop.connection_id, {
    pins: [{ image_url: item.image_url, media_type: 'image', title: text.title, description: text.description, alt_text: item.alt_text ?? '', board_id: item.board_id, board_name: item.board_name ?? '', destination_url: item.destination_url ?? '', scheduled_at: new Date(at).toISOString() }],
  })
  await db.from('scheduled_pins').update({ loop_id: loop.id }).eq('id', r.ids[0])
  await db.from('loop_items').update({ last_recycled_at: new Date().toISOString(), times_recycled: item.times_recycled + 1 }).eq('id', item.id)
  return { pin_id: r.ids[0], scheduled_at: new Date(at).toISOString(), warnings: r.warnings }
}

export async function loopTimes(loopId: string): Promise<number[]> {
  const { data } = await db.from('scheduled_pins').select('scheduled_at').eq('loop_id', loopId).in('status', ['pending', 'processing', 'published']).gte('scheduled_at', new Date(Date.now() - 86_400_000).toISOString())
  return (data ?? []).map((r) => new Date(r.scheduled_at as string).getTime())
}

/** One pass over one loop. Never throws: a problem pauses or skips the loop, it does not stop the others. */
export async function runLoop(loop: Loop): Promise<{ proposed: number; scheduled: number }> {
  const result = { proposed: 0, scheduled: 0 }
  try {
    const { data: conn } = await db.from('pinterest_connections').select('status').eq('id', loop.connection_id).maybeSingle()
    if (!conn || conn.status !== 'active') { await pauseLoop(loop, 'The Pinterest account needs to be reconnected.'); return result }

    // Back off when Pinterest keeps rejecting this loop's pins (a restriction, a removed board, a policy block).
    const { data: recent } = await db.from('scheduled_pins').select('status').eq('loop_id', loop.id).in('status', ['published', 'failed']).order('scheduled_at', { ascending: false }).limit(PAUSE_AFTER_FAILURES)
    if ((recent?.length ?? 0) >= PAUSE_AFTER_FAILURES && recent!.every((r) => r.status === 'failed')) {
      await pauseLoop(loop, `The last ${PAUSE_AFTER_FAILURES} recycled pins failed to publish. Check the Pins page for the reason, then resume.`)
      return result
    }

    const { count: backlog } = await db.from('loop_runs').select('id', { count: 'exact', head: true }).eq('loop_id', loop.id).eq('status', 'review')
    if ((backlog ?? 0) >= MAX_REVIEW_BACKLOG) return result // never pile up work the owner has not looked at

    const sinceDay = new Date(Date.now() - 86_400_000).toISOString()
    const { count: today } = await db.from('loop_runs').select('id', { count: 'exact', head: true }).eq('loop_id', loop.id).in('status', ['review', 'scheduled']).gte('created_at', sinceDay)
    const room = Math.min(MAX_PER_TICK, loop.max_per_day - (today ?? 0))
    if (room <= 0) return result

    const { data: items } = await db.from('loop_items').select('*').eq('loop_id', loop.id).eq('active', true)
    const due = byFairness(((items ?? []) as Item[]).filter((i) => isDue(i, loop.interval_days, Date.now()))).slice(0, room)
    if (!due.length) return result

    const profile = await getProfile(loop.user_id)
    const tz = isValidTimeZone(profile.timezone) ? profile.timezone : 'UTC'
    const times = await loopTimes(loop.id)

    for (const item of due) {
      const text = await freshText(loop.user_id, item, loop.refresh_text)
      const note = text.reworded ? 'Title and description reworded by AI.' : 'Original text reused.'
      if (loop.require_approval) {
        await db.from('loop_runs').insert({ loop_id: loop.id, item_id: item.id, user_id: loop.user_id, connection_id: loop.connection_id, status: 'review', title: text.title, description: text.description, note })
        await db.from('loop_items').update({ last_recycled_at: new Date().toISOString() }).eq('id', item.id) // waits a full interval before being proposed again
        result.proposed++
        continue
      }
      try {
        const s = await scheduleRecycled(loop, item, text, tz, times)
        times.push(new Date(s.scheduled_at).getTime())
        await db.from('loop_runs').insert({ loop_id: loop.id, item_id: item.id, user_id: loop.user_id, connection_id: loop.connection_id, status: 'scheduled', title: text.title, description: text.description, pin_id: s.pin_id, scheduled_at: s.scheduled_at, note })
        result.scheduled++
      } catch (e) {
        const msg = e instanceof ServiceError ? e.message : errMsg(e)
        await db.from('loop_runs').insert({ loop_id: loop.id, item_id: item.id, user_id: loop.user_id, connection_id: loop.connection_id, status: 'skipped', title: text.title, description: text.description, note: msg.slice(0, 300) })
        break // a full month or a full calendar will not improve within this pass
      }
    }
  } catch (e) {
    log.warn('loop run failed', { loop: loop.id, error: errMsg(e) })
  }
  return result
}

export async function runDueLoops() {
  const { data } = await db.from('loops').select('*').eq('active', true).limit(500)
  let proposed = 0, scheduled = 0
  for (const l of (data ?? []) as Loop[]) {
    const r = await runLoop(l)
    proposed += r.proposed; scheduled += r.scheduled
  }
  if (proposed || scheduled) log.info('loops ran', { proposed, scheduled })
}
