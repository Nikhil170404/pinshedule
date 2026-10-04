/**
 * Fails the build when SEO content breaks the rules that protect rankings and trust:
 * title/description length, duplicates, broken internal links, missing FAQs, emoji, leftover old brand.
 * Run with: npm run check:seo
 */
import { allPages } from '../src/content/seo'

const paths = new Set(allPages.map((p) => p.path))
const titles = new Set<string>()
const descriptions = new Set<string>()
const problems: string[] = []
const flag = (path: string, msg: string) => problems.push(`${path}: ${msg}`)

for (const p of allPages) {
  const fullTitle = `${p.title} | GoPinKaro`
  if (fullTitle.length > 65) flag(p.path, `title is ${fullTitle.length} characters (max 65)`)
  if (p.description.length < 110 || p.description.length > 165) flag(p.path, `description is ${p.description.length} characters (110 to 165)`)
  if (titles.has(p.title)) flag(p.path, 'duplicate title')
  if (descriptions.has(p.description)) flag(p.path, 'duplicate description')
  titles.add(p.title)
  descriptions.add(p.description)
  for (const r of p.related) if (!paths.has(r)) flag(p.path, `related link ${r} does not exist`)
  if (p.faqs.length === 0) flag(p.path, 'has no FAQs')
  const ids = p.blocks.flatMap((b) => (b.type === 'h2' ? [b.id] : []))
  if (new Set(ids).size !== ids.length) flag(p.path, 'duplicate heading ids')
  const text = JSON.stringify(p)
  if (/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(text)) flag(p.path, 'contains emoji')
  if (/Pinshedule/.test(text)) flag(p.path, 'contains the old brand name')
  if (/aggregateRating|testimonial/i.test(text)) flag(p.path, 'contains rating or testimonial wording; only publish real ones')
}

if (problems.length) {
  console.error(`SEO check failed (${problems.length}):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`SEO check passed for ${allPages.length} pages`)
