import { PLANS, nextPlan } from '@/types'
import type { Summary } from '@/types'

export interface Nudge {
  meter: 'pins' | 'ai' | 'imports'
  level: 'warning' | 'limit'
  pct: number
  /** Name of the plan to suggest, or null when already on the top plan. */
  upgradeTo: string | null
  message: string
}

const NAMES = { pins: 'scheduled pins', ai: 'AI generations', imports: 'website imports' } as const

/**
 * The single most useful "you are close to a limit" message, or null. Warns from 80% and flags 100%.
 * The meter that is closest to its limit wins; a full meter always beats one that is merely close.
 */
export function nudgeFor(summary: Pick<Summary, 'plan' | 'limits' | 'used'> | null): Nudge | null {
  if (!summary) return null
  let best: Nudge | null = null
  for (const meter of ['pins', 'ai', 'imports'] as const) {
    const max = summary.limits[meter]
    if (!max) continue
    const pct = Math.round((summary.used[meter] / max) * 100)
    if (pct < 80) continue
    const up = nextPlan(summary.plan)
    const upgradeTo = up ? PLANS[up].name : null
    const level = pct >= 100 ? 'limit' : 'warning'
    const left = Math.max(0, max - summary.used[meter])
    const message = level === 'limit'
      ? `You have used all ${max.toLocaleString()} ${NAMES[meter]} this month.${upgradeTo ? ` ${upgradeTo} raises the limit.` : ' The limit resets on the 1st.'}`
      : `${left.toLocaleString()} ${NAMES[meter]} left this month (${pct}% used).${upgradeTo ? ` ${upgradeTo} gives you more.` : ''}`
    if (!best || pct > best.pct) best = { meter, level, pct, upgradeTo, message }
  }
  return best
}
