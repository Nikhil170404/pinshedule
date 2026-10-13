// Pin variation engine: the creative angles, the visual plan, and near-duplicate detection.
// Pure functions shared by the worker (angles) and the browser (visual plan), and covered by tests.

export interface Angle { key: string; label: string; instruction: string }

/** Genuinely different ways to pitch one page. Each concept in a batch gets a different angle. */
export const ANGLES: Angle[] = [
  { key: 'benefit', label: 'Main benefit', instruction: 'Lead with the single biggest benefit the reader gets from the page.' },
  { key: 'howto', label: 'How-to', instruction: 'Frame it as a clear how-to or step-by-step guide.' },
  { key: 'list', label: 'List', instruction: 'Frame it as a numbered list or collection of ideas, tips or items (use a real number from the page if there is one).' },
  { key: 'problem', label: 'Problem and fix', instruction: 'Name a common problem the reader has, and promise the page solves it.' },
  { key: 'question', label: 'Question', instruction: 'Open with a question the reader is likely searching for.' },
  { key: 'mistakes', label: 'Mistakes to avoid', instruction: 'Frame it around mistakes to avoid or what not to do.' },
  { key: 'beginner', label: 'For beginners', instruction: 'Aim it at a complete beginner who is starting out.' },
  { key: 'quick', label: 'Quick and easy', instruction: 'Emphasise how fast, simple or low-effort it is.' },
  { key: 'budget', label: 'Save money or time', instruction: 'Emphasise saving money, time or effort.' },
  { key: 'seasonal', label: 'Season or occasion', instruction: 'Tie it to a season, holiday or occasion only if the page genuinely fits one; otherwise tie it to a moment in the reader\'s day.' },
  { key: 'checklist', label: 'Checklist', instruction: 'Frame it as a checklist or cheat sheet to save.' },
  { key: 'myth', label: 'Myth versus fact', instruction: 'Challenge a common belief related to the page.' },
  { key: 'story', label: 'Result or story', instruction: 'Frame it around a concrete result or before-and-after the page supports. Do not invent numbers or testimonials.' },
  { key: 'expert', label: 'Expert tips', instruction: 'Frame it as tips or secrets worth knowing, without claiming credentials the page does not show.' },
  { key: 'compare', label: 'Compare options', instruction: 'Frame it as choosing between options, or the best option for a situation.' },
  { key: 'ideas', label: 'Inspiration', instruction: 'Frame it as inspiration: ideas to try, styled around the look and feel.' },
  { key: 'mustknow', label: 'Need to know', instruction: 'Frame it as the things you need to know before you start.' },
  { key: 'upgrade', label: 'Level up', instruction: 'Aim it at someone who already knows the basics and wants better results.' },
  { key: 'save', label: 'Save for later', instruction: 'Frame it as a reference worth saving for later.' },
  { key: 'goal', label: 'Goal-led', instruction: 'Start from a goal the reader has and show the path to it.' },
]

export const MIN_VARIATIONS = 5
export const MAX_VARIATIONS = 20

export const clampCount = (n: unknown) => Math.min(MAX_VARIATIONS, Math.max(MIN_VARIATIONS, Math.round(Number(n)) || MIN_VARIATIONS))
export const anglesFor = (count: number): Angle[] => ANGLES.slice(0, clampCount(count))

// ── Visual plan ────────────────────────────────────────────────────────────

export interface DesignSlot {
  template: 'headline' | 'card' | 'split' | 'number'
  paletteId: string
  /** Which source image to use. Only meaningful when usesPhoto is true. */
  imageIndex: number
  /** False for a plain designed pin with no photo (the photo layouts then draw shapes instead). */
  usesPhoto: boolean
}

const slotKey = (s: DesignSlot) => (s.usesPhoto ? `${s.template}|${s.paletteId}|img${s.imageIndex}` : `${s.template}|${s.paletteId}|plain`)

/**
 * Pick a layout, color set and source image for each variation so that no two look the same and neighbours differ.
 * Two of every three pins use a photo when there are photos. When the photos cannot supply enough distinct looks
 * (a page with one image has only layouts x colors of them) the rest become plain designs instead of repeating.
 */
export function planDesigns(count: number, imageCount: number, paletteIds: string[], hasNumber: boolean[] = []): DesignSlot[] {
  const out: DesignSlot[] = []
  const used = new Set<string>()
  const photoCapacity = imageCount * 2 * paletteIds.length
  let photoUsed = 0
  for (let i = 0; i < count; i++) {
    const usesPhoto = imageCount > 0 && i % 3 !== 2 && photoUsed < photoCapacity
    let pool: DesignSlot['template'][] = usesPhoto ? ['card', 'split'] : ['headline', 'number', 'card', 'split']
    // The big-number layout needs a number: only pins whose concept has one may use it.
    if (!hasNumber[i]) pool = pool.filter((t) => t !== 'number')
    let template = pool[Math.floor(i / 2) % pool.length]
    let paletteIdx = (i * 5 + Math.floor(i / paletteIds.length)) % paletteIds.length
    const imageIndex = usesPhoto ? i % imageCount : 0
    let slot: DesignSlot = { template, paletteId: paletteIds[paletteIdx], imageIndex, usesPhoto }
    // Resolve a repeat of an earlier combination by moving to the next color, then the next layout.
    for (let tries = 0; tries < paletteIds.length * pool.length && used.has(slotKey(slot)); tries++) {
      paletteIdx = (paletteIdx + 1) % paletteIds.length
      if (tries % paletteIds.length === paletteIds.length - 1) template = pool[(pool.indexOf(template) + 1) % pool.length]
      slot = { template, paletteId: paletteIds[paletteIdx], imageIndex, usesPhoto }
    }
    used.add(slotKey(slot))
    if (usesPhoto) photoUsed++
    out.push(slot)
  }
  // Neighbours must not look alike: if two adjacent slots share layout and color, move the later one to a free color.
  for (let i = 1; i < out.length; i++) {
    if (out[i].template !== out[i - 1].template || out[i].paletteId !== out[i - 1].paletteId) continue
    const free = paletteIds.find((p) => p !== out[i - 1].paletteId && !out.some((o, j) => j !== i && slotKey(o) === slotKey({ ...out[i], paletteId: p })))
    if (free) out[i] = { ...out[i], paletteId: free }
  }
  return out
}

/** Pairs of slots with an identical look. Empty when the plan is fully distinct. */
export function repeatedDesigns(slots: DesignSlot[]): [number, number][] {
  const seen = new Map<string, number>()
  const dupes: [number, number][] = []
  slots.forEach((s, i) => {
    const key = slotKey(s)
    if (seen.has(key)) dupes.push([seen.get(key)!, i])
    else seen.set(key, i)
  })
  return dupes
}

// ── Near-duplicate text ────────────────────────────────────────────────────

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'for', 'on', 'with', 'your', 'you', 'is', 'are', 'how', 'this', 'that', 'it', 'at', 'by', 'from', 'be', 'can', 'will'])
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)))

/** Word overlap between two texts, 0 (nothing shared) to 1 (same words). */
export function similarity(a: string, b: string): number {
  const x = words(a), y = words(b)
  if (x.size === 0 || y.size === 0) return 0
  let shared = 0
  for (const w of x) if (y.has(w)) shared++
  return shared / (x.size + y.size - shared)
}

export interface Textual { title: string; description: string }

/** Index pairs that read too much alike (title overlap, or very similar title plus description). */
export function nearDuplicates(items: Textual[], threshold = 0.7): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const t = similarity(items[i].title, items[j].title)
    const d = similarity(items[i].description, items[j].description)
    if (t >= threshold || (t >= threshold - 0.2 && d >= threshold - 0.1)) out.push([i, j])
  }
  return out
}
