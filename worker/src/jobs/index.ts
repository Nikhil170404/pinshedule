import { withLock } from '../lib/clients'
import { dispatchDue } from './publisher'
import { reconcile } from './reconciler'
import { refreshExpiring } from './refresher'
import { pruneAnalytics, syncAllAnalytics } from './analytics'
import { runDueAutomations } from '../lib/automations'
import { errMsg, log } from '../lib/log'

/** Self-rescheduling loop: next run starts only after the previous one finishes (no overlap). */
function loop(name: string, everyMs: number, fn: () => Promise<unknown>, opts: { lock?: number } = {}) {
  let stopped = false
  const run = async () => {
    if (stopped) return
    try {
      if (opts.lock) await withLock(`job:${name}`, opts.lock, fn)
      else await fn()
    } catch (e) {
      log.error(`job ${name} failed`, { error: errMsg(e) })
    }
    if (!stopped) setTimeout(run, everyMs).unref?.()
  }
  setTimeout(run, 1000 + Math.random() * 1000)
  return () => { stopped = true }
}

export function startJobs() {
  const stops = [
    // Publishing is safe to run on every replica: claiming is atomic.
    loop('dispatch', 3_000, dispatchDue),
    loop('reconcile', 30_000, reconcile, { lock: 25 }),
    loop('refresh-tokens', 10 * 60_000, refreshExpiring, { lock: 9 * 60 }),
    loop('analytics', 6 * 3600_000, syncAllAnalytics, { lock: 5 * 3600 }),
    loop('automations', 5 * 60_000, runDueAutomations, { lock: 4 * 60 }),
    loop('analytics-retention', 24 * 3600_000, pruneAnalytics, { lock: 23 * 3600 }),
  ]
  log.info('background jobs started')
  return () => stops.forEach((s) => s())
}
