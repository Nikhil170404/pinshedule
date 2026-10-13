import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ANGLES, anglesFor, clampCount, nearDuplicates, planDesigns, repeatedDesigns, similarity } from '../../shared/variations'

const PALETTES = ['brand', 'ink', 'sage', 'sand', 'sky', 'plum']

test('count is clamped to 5 through 20 and angles are all different', () => {
  assert.equal(clampCount(1), 5); assert.equal(clampCount(99), 20); assert.equal(clampCount('abc'), 5); assert.equal(clampCount(12), 12)
  assert.equal(anglesFor(20).length, 20)
  assert.equal(new Set(ANGLES.map((a) => a.key)).size, ANGLES.length)
  assert.equal(new Set(anglesFor(20).map((a) => a.instruction)).size, 20)
})

test('the visual plan never repeats a look, for every count and image count', () => {
  for (let n = 5; n <= 20; n++) for (const images of [0, 1, 3, 8]) {
    const plan = planDesigns(n, images, PALETTES, Array.from({ length: n }, (_, i) => i % 2 === 0))
    assert.equal(plan.length, n)
    assert.deepEqual(repeatedDesigns(plan), [], `n=${n} images=${images}`)
    for (const s of plan) assert.ok(s.imageIndex >= 0 && s.imageIndex < Math.max(images, 1))
  }
})

test('neighbouring pins differ in layout or color', () => {
  const plan = planDesigns(20, 4, PALETTES)
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i].template !== plan[i - 1].template || plan[i].paletteId !== plan[i - 1].paletteId, `slot ${i}`)
})

test('the big-number layout is used only where a number exists', () => {
  const plan = planDesigns(12, 3, PALETTES, Array.from({ length: 12 }, (_, i) => i === 2))
  plan.forEach((s, i) => { if (i !== 2) assert.notEqual(s.template, 'number') })
})

test('near-duplicate detection flags rewordings but not different angles', () => {
  assert.ok(similarity('Easy weeknight pasta dinners', 'Easy weeknight pasta dinners!') > 0.99)
  const items = [
    { title: '10 easy weeknight pasta dinners', description: 'Quick pasta recipes for busy nights.' },
    { title: '10 easy weeknight pasta dinner ideas', description: 'Quick pasta recipes for busy weeknights.' },
    { title: 'Pasta mistakes that ruin dinner', description: 'Avoid salty water errors and overcooked noodles.' },
  ]
  assert.deepEqual(nearDuplicates(items), [[0, 1]])
})
