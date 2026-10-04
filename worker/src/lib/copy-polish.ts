/** Deterministic clean-up of AI-written pin copy, so quality does not depend on the model following every instruction. */

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu

export const stripEmoji = (s: string) => s.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').trim()

/** Cut to at most `max` characters at a word boundary (never mid-word), adding no ellipsis. */
export function clipAtWord(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-]+$/, '')
}

/** Keep at most `max` hashtags (the first ones), drop repeats, and keep them together at the end. */
export function limitHashtags(description: string, max = 5): string {
  const tags: string[] = []
  const body = description.replace(/(^|\s)(#[\p{L}\p{N}_]+)/gu, (_m, _s, tag: string) => {
    if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag)
    return ' '
  }).replace(/\s{2,}/g, ' ').trim()
  return [body, tags.slice(0, max).join(' ')].filter(Boolean).join(' ')
}

export const polishTitle = (s: string, max = 100) => clipAtWord(stripEmoji(s).replace(/^["'“”]+|["'“”]+$/g, ''), max)

/** Description: no emoji, at most 5 hashtags, and trimmed to the limit without cutting a hashtag in half. */
export function polishDescription(s: string, max = 500): string {
  const clean = limitHashtags(stripEmoji(s))
  if (clean.length <= max) return clean
  // Drop trailing hashtags first, then fall back to a word-boundary cut.
  const parts = clean.split(' ')
  while (parts.length > 1 && parts.join(' ').length > max && parts[parts.length - 1].startsWith('#')) parts.pop()
  return clipAtWord(parts.join(' '), max)
}

export const polishAlt = (s: string, max = 200) => clipAtWord(stripEmoji(s), max)
