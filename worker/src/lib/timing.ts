import { rankHours, type Timing, type TimingSample } from '@shared/best-times'
import { db, redis } from './clients'
import { errMsg, log } from './log'

const key = (connectionId: string, tz: string) => `timing:${connectionId}:${tz}`

/**
 * Hours ranked for one Pinterest account: learned from its own published pins once there are enough, otherwise
 * the general ranking. Cached for 6 hours (analytics only change when the sync job runs).
 */
export async function loadTiming(connectionId: string, timeZone: string): Promise<Timing> {
  const hit = await redis.get<Timing>(key(connectionId, timeZone)).catch(() => null)
  if (hit) return hit
  let timing: Timing
  try {
    const { data, error } = await db.rpc('timing_samples', { p_connection: connectionId })
    if (error) throw new Error(error.message)
    timing = rankHours((data ?? []) as TimingSample[], timeZone)
  } catch (e) {
    // Timing is an improvement, never a requirement: scheduling must work without it.
    log.warn('timing lookup failed', { connection: connectionId, error: errMsg(e) })
    timing = rankHours([], timeZone)
  }
  redis.set(key(connectionId, timeZone), timing as never, { ex: 6 * 3600 }).catch(() => {})
  return timing
}
