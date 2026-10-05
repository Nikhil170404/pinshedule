import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutFor, tidyHeadline, PALETTES, TEMPLATES } from '../../src/lib/pin-design'

test('tidyHeadline drops a trailing site name', () => {
  assert.equal(tidyHeadline('Best Pasta Recipes for Busy Weeknights | My Food Blog'), 'Best Pasta Recipes for Busy Weeknights')
  assert.equal(tidyHeadline('Best Pasta Recipes for Busy Weeknights - My Food Blog'), 'Best Pasta Recipes for Busy Weeknights')
  assert.equal(tidyHeadline('Small kitchen storage ideas – Home Daily'), 'Small kitchen storage ideas')
})

test('tidyHeadline keeps a short first part (it is probably the brand, not the headline)', () => {
  assert.equal(tidyHeadline('Home | Ten Ways To Organise A Tiny Kitchen'), 'Home | Ten Ways To Organise A Tiny Kitchen')
})

test('tidyHeadline leaves hyphenated words alone', () => {
  assert.equal(tidyHeadline('Make-ahead breakfast ideas'), 'Make-ahead breakfast ideas')
})

test('tidyHeadline shortens long titles at a word boundary with an ellipsis', () => {
  const long = 'The complete step by step beginner guide to organizing every single cupboard drawer and shelf in a very small apartment kitchen'
  const out = tidyHeadline(long, 60)
  assert.ok(out.length <= 60)
  assert.ok(out.endsWith('…'))
  assert.ok(long.startsWith(out.slice(0, -1).trimEnd()))
  assert.ok(!/\s…$/.test(out))
})

test('layoutFor alternates in mixed mode and is fixed otherwise', () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => layoutFor(i, 'mixed')), ['card', 'split', 'card', 'split'])
  assert.deepEqual([0, 1, 2].map((i) => layoutFor(i, 'split')), ['split', 'split', 'split'])
})

test('every template and palette is usable (ids are unique)', () => {
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length)
  assert.equal(new Set(PALETTES.map((p) => p.id)).size, PALETTES.length)
})
