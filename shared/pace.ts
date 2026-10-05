// Pacing checks that run after pins are scheduled. Pure functions, no I/O, shared by the API and tests.
//
// Pinterest publishes no official daily pin limit. The numbers here follow the widely repeated advice
// of roughly 5 to 15 pins a day and not repeating the same pin, so they produce warnings, never errors.

export const DAILY_PIN_SOFT_MAX = 15
export const REPEAT_IMAGE_DAYS = 7

export interface PaceRow { id?: string; scheduled_at: string; image_url: string }

function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

/**
 * `added` are the pins being scheduled now; `existing` are pins already in the queue or recently published.
 * Returns human-readable warnings (empty when everything looks fine).
 */
export function paceWarnings(added: PaceRow[], existing: PaceRow[], timeZone: string): string[] {
  const warnings: string[] = []
  if (added.length === 0) return warnings

  const perDay = new Map<string, number>()
  for (const r of [...existing, ...added]) perDay.set(dayKey(r.scheduled_at, timeZone), (perDay.get(dayKey(r.scheduled_at, timeZone)) ?? 0) + 1)
  const touched = new Set(added.map((r) => dayKey(r.scheduled_at, timeZone)))
  const crowded = [...touched].filter((d) => (perDay.get(d) ?? 0) > DAILY_PIN_SOFT_MAX).sort()
  if (crowded.length > 0) {
    const shown = crowded.slice(0, 3).map((d) => `${d} (${perDay.get(d)})`).join(', ')
    const more = crowded.length > 3 ? ` and ${crowded.length - 3} more` : ''
    warnings.push(`More than ${DAILY_PIN_SOFT_MAX} pins fall on ${crowded.length === 1 ? 'one day' : `${crowded.length} days`}: ${shown}${more}. Pinterest sets no official limit, but about 5 to 15 a day is commonly recommended, so spreading them out is safer.`)
  }

  const windowMs = REPEAT_IMAGE_DAYS * 86_400_000
  const byImage = new Map<string, number[]>()
  for (const r of existing) byImage.set(r.image_url, [...(byImage.get(r.image_url) ?? []), new Date(r.scheduled_at).getTime()])
  let repeats = 0
  for (const r of added) {
    const t = new Date(r.scheduled_at).getTime()
    const others = byImage.get(r.image_url) ?? []
    if (others.some((o) => Math.abs(o - t) < windowMs)) repeats++
    byImage.set(r.image_url, [...others, t])
  }
  if (repeats > 0) {
    warnings.push(`${repeats} ${repeats === 1 ? 'pin reuses an image' : 'pins reuse images'} that ${repeats === 1 ? 'is' : 'are'} already scheduled within ${REPEAT_IMAGE_DAYS} days. Pinterest discourages repeating the same pin, so use a fresh image or space them further apart.`)
  }
  return warnings
}
