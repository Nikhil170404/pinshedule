import { PIN_LIMITS } from '@shared/plans'

export type CheckLevel = 'error' | 'warn' | 'ok'
export interface Check { level: CheckLevel; text: string }

const hashtags = (s: string) => (s.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length
const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []

/**
 * Checks a pin title and description. "error" means Pinterest would reject or truncate it (limits come from
 * the same constants the scheduler enforces); "warn" is advice that usually helps. Nothing here is a ranking score.
 */
export function checkPinText(title: string, description: string): Check[] {
  const t = title.trim()
  const d = description.trim()
  const out: Check[] = []

  if (!t) out.push({ level: 'error', text: 'Add a title. It is the first thing people read and a main source of search keywords.' })
  else if (t.length > PIN_LIMITS.title) out.push({ level: 'error', text: `The title is ${t.length} characters. Pinterest allows ${PIN_LIMITS.title}.` })
  else {
    out.push({ level: 'ok', text: `Title length is fine (${t.length} of ${PIN_LIMITS.title}).` })
    if (t.length < 20) out.push({ level: 'warn', text: 'The title is very short. Add the words someone would search for, such as the topic and the type of pin.' })
    const letters = t.replace(/[^\p{L}]/gu, '')
    if (letters.length > 8 && letters.replace(/[^\p{Lu}]/gu, '').length / letters.length > 0.6) out.push({ level: 'warn', text: 'Most of the title is in capital letters. Sentence case is easier to read and looks less like spam.' })
    if (hashtags(t) > 0) out.push({ level: 'warn', text: 'Keep hashtags out of the title. Use them at the end of the description.' })
  }

  if (!d) out.push({ level: 'warn', text: 'Add a description. Pinterest uses it to understand and categorise the pin.' })
  else if (d.length > PIN_LIMITS.description) out.push({ level: 'error', text: `The description is ${d.length} characters. Pinterest allows ${PIN_LIMITS.description}.` })
  else {
    out.push({ level: 'ok', text: `Description length is fine (${d.length} of ${PIN_LIMITS.description}).` })
    if (d.length < 100) out.push({ level: 'warn', text: 'The description is short. Two or three natural sentences with your keywords give Pinterest more to work with.' })
    const tags = hashtags(d)
    if (tags > 5) out.push({ level: 'warn', text: `${tags} hashtags is a lot. Three to five relevant ones is typical, and more can look like spam.` })
    if (t && d.toLowerCase() === t.toLowerCase()) out.push({ level: 'warn', text: 'The description repeats the title. Use it to add detail and keywords the title does not have.' })
    const counts = new Map<string, number>()
    for (const w of words(d)) if (w.length > 3) counts.set(w, (counts.get(w) ?? 0) + 1)
    const stuffed = [...counts].find(([, n]) => n >= 5)
    if (stuffed) out.push({ level: 'warn', text: `"${stuffed[0]}" appears ${stuffed[1]} times. Repeating a keyword that often reads as keyword stuffing.` })
  }
  return out
}

export interface ImageFacts { width: number; height: number; bytes: number; type: string }
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const IMAGE_MAX_BYTES = 20 * 1024 * 1024
/** Pinterest's recommended pin shape is 2:3 (for example 1000 by 1500 pixels). */
export const RECOMMENDED = { width: 1000, height: 1500, ratio: 2 / 3 }
const TALLEST_RATIO = 1 / 2.1 // taller than this may be cropped in the feed

export function checkPinImage({ width, height, bytes, type }: ImageFacts): Check[] {
  const out: Check[] = []
  const ratio = width / height
  if (!IMAGE_TYPES.includes(type)) out.push({ level: 'error', text: 'Use a JPG, PNG, WEBP or GIF file.' })
  if (bytes > IMAGE_MAX_BYTES) out.push({ level: 'error', text: `The file is ${(bytes / 1048576).toFixed(1)} MB. The limit is 20 MB.` })

  if (Math.abs(ratio - RECOMMENDED.ratio) <= 0.03) out.push({ level: 'ok', text: 'The shape is the recommended 2:3 vertical.' })
  else if (ratio >= 1) out.push({ level: 'warn', text: 'Square and wide images take up less room in the feed. A 2:3 vertical pin usually gets more attention.' })
  else if (ratio < TALLEST_RATIO) out.push({ level: 'warn', text: 'This is taller than 1:2.1, so Pinterest may crop it. Keep important text inside a 2:3 area.' })
  else if (ratio < RECOMMENDED.ratio - 0.03) out.push({ level: 'ok', text: 'A tall vertical shape. It works, though 2:3 is the safest.' })
  else out.push({ level: 'warn', text: 'Slightly wider than 2:3. It works, but 2:3 fills the feed best.' })

  if (width < 600) out.push({ level: 'warn', text: `${width} pixels wide is small and can look blurry. Aim for ${RECOMMENDED.width} or more.` })
  else out.push({ level: 'ok', text: `${width} pixels wide is a good size.` })
  return out
}
