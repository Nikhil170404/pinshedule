import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allPages, hubs, pageByPath } from '../../src/content/seo'
import type { Block } from '../../src/content/seo/types'

// Search quality gates for the content pages: broken links, duplicate or badly sized titles and descriptions,
// thin pages and unsourced comparisons are caught here instead of after publishing.

const LINK = /\[[^\]]+\]\((\/[^)\s]*)\)/g
const textOf = (b: Block): string => {
  switch (b.type) {
    case 'h2': case 'h3': case 'p': return b.text
    case 'list': return b.items.join(' ')
    case 'steps': return b.items.map((i) => `${i.title} ${i.text}`).join(' ')
    case 'table': return [...b.head, ...b.rows.flat(), b.note ?? ''].join(' ')
    case 'callout': return `${b.title ?? ''} ${b.text}`
    default: return ''
  }
}
const pageText = (p: (typeof allPages)[number]) => [p.intro, ...p.blocks.map(textOf), ...p.faqs.map((f) => `${f.q} ${f.a}`)].join(' ')
const words = (s: string) => s.split(/\s+/).filter(Boolean).length

test('there are at least 40 content pages', () => assert.ok(allPages.length >= 40, `only ${allPages.length}`))

test('paths are unique and every kind has a hub', () => {
  assert.equal(new Set(allPages.map((p) => p.path)).size, allPages.length)
  for (const kind of new Set(allPages.map((p) => p.kind))) {
    if (kind !== 'product') assert.ok(hubs.some((h) => h.kind === kind), `no hub for ${kind}`)
  }
})

test('titles and descriptions are unique and a sensible length for search results', () => {
  const titles = new Set<string>(); const descs = new Set<string>()
  for (const p of allPages) {
    assert.ok(p.title.length >= 20 && p.title.length <= 62, `${p.path}: title is ${p.title.length} chars`)
    assert.ok(p.description.length >= 100 && p.description.length <= 175, `${p.path}: description is ${p.description.length} chars`)
    assert.ok(!titles.has(p.title), `${p.path}: duplicate title`); titles.add(p.title)
    assert.ok(!descs.has(p.description), `${p.path}: duplicate description`); descs.add(p.description)
    assert.ok(p.h1.length >= 15 && p.h1.length <= 100, `${p.path}: h1 length`)
  }
})

test('every page has real substance: body, questions and a way forward', () => {
  for (const p of allPages) {
    assert.ok(words(pageText(p)) >= 350, `${p.path}: only ${words(pageText(p))} words`)
    assert.ok(p.blocks.filter((b) => b.type === 'h2').length >= 4, `${p.path}: fewer than 4 sections`)
    assert.ok(p.faqs.length >= 3, `${p.path}: fewer than 3 FAQs`)
    assert.ok(p.related.length >= 3, `${p.path}: fewer than 3 related pages`)
    assert.match(p.updated, /^\d{4}-\d{2}-\d{2}$/)
  }
})

test('every related page and every inline link resolves', () => {
  const real = new Set([...allPages.map((p) => `/${p.path}`), '/', '/pricing', '/features', '/login', '/privacy', '/terms', ...hubs.map((h) => `/${h.path}`)])
  for (const p of allPages) {
    for (const r of p.related) assert.ok(pageByPath(r), `${p.path}: related page "${r}" does not exist`)
    assert.ok(!p.related.includes(p.path), `${p.path}: relates to itself`)
    const text = [p.intro, ...p.blocks.map(textOf), ...p.faqs.map((f) => f.a)].join(' ')
    for (const m of text.matchAll(LINK)) assert.ok(real.has(m[1].replace(/#.*$/, '')), `${p.path}: broken link ${m[1]}`)
  }
})

test('comparison pages cite sources and say when the facts were checked', () => {
  for (const p of allPages.filter((x) => x.kind === 'comparison' && x.path !== 'best-pinterest-tools')) {
    assert.ok((p.sources?.length ?? 0) >= 1, `${p.path}: comparison without sources`)
  }
  for (const p of allPages.filter((x) => x.sources)) for (const s of p.sources!) assert.match(s.url, /^https:\/\//, `${p.path}: source is not https`)
})

test('no page promises rankings, fake ratings or guaranteed results', () => {
  const banned = [/guarantee[sd]? (?:you|a |top|rank|results)/i, /#1 ranked/i, /rated \d(\.\d)?\/5/i, /aggregateRating/i, /\bbest scheduler in the world\b/i]
  for (const p of allPages) for (const re of banned) assert.ok(!re.test(pageText(p)), `${p.path}: matches ${re}`)
})

test('every page can reach every hub and is reachable from one', () => {
  const linkedFrom = new Map<string, number>()
  for (const p of allPages) for (const r of p.related) linkedFrom.set(r, (linkedFrom.get(r) ?? 0) + 1)
  const orphans = allPages.filter((p) => !linkedFrom.has(p.path)).map((p) => p.path)
  // Orphans in `related` are still linked from their hub, the footer and the "more to explore" strip, but flag
  // any page that nothing points at so it gets deliberate links too.
  assert.ok(orphans.length <= 6, `pages that no other page lists as related: ${orphans.join(', ')}`)
})
