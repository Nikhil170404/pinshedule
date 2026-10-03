import { db } from '../lib/clients'
import { enqueue } from '../lib/queue'
import { log } from '../lib/log'

/**
 * Self-healing. Redis is a fast trigger, Postgres is the truth, so after a Redis flush, a crash
 * between "popped from queue" and "claimed in DB", or an edit made elsewhere, this puts things right.
 */
export async function reconcile() {
  // 1. Re-queue pending pins that are due within the next 15 minutes (ZADD is idempotent).
  const horizon = new Date(Date.now() + 15 * 60_000).toISOString()
  const { data: pending } = await db
    .from('scheduled_pins')
    .select('id, scheduled_at')
    .eq('status', 'pending')
    .lte('scheduled_at', horizon)
    .limit(2000)
  await enqueue((pending ?? []).map((p) => ({ id: p.id as string, at: p.scheduled_at as string })))

  // 2. Pins stuck in "processing" (worker died mid-publish) go back to pending, or fail after too many tries.
  const stale = new Date(Date.now() - 10 * 60_000).toISOString()
  const { data: stuck } = await db
    .from('scheduled_pins')
    .select('id, attempts')
    .eq('status', 'processing')
    .lt('processing_started_at', stale)
    .limit(500)
  const retry = (stuck ?? []).filter((p) => (p.attempts as number) < 4).map((p) => p.id as string)
  const dead = (stuck ?? []).filter((p) => (p.attempts as number) >= 4).map((p) => p.id as string)
  if (retry.length) {
    await db.from('scheduled_pins').update({ status: 'pending', processing_started_at: null }).in('id', retry)
    await enqueue(retry.map((id) => ({ id, at: new Date() })))
  }
  if (dead.length) {
    await db
      .from('scheduled_pins')
      .update({ status: 'failed', error_message: 'Publishing was interrupted. Check Pinterest before retrying to avoid a duplicate.' })
      .in('id', dead)
  }
  if (stuck?.length) log.warn('recovered stuck pins', { retried: retry.length, failed: dead.length })
}
