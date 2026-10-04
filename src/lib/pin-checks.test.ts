import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkPinImage, checkPinText } from './pin-checks'

const levels = (c: { level: string }[]) => c.map((x) => x.level)

test('title and description limits are errors, advice is a warning', () => {
  assert.ok(levels(checkPinText('', '')).includes('error'))
  assert.ok(levels(checkPinText('x'.repeat(101), 'fine description '.repeat(10))).includes('error'))
  assert.ok(levels(checkPinText('Small kitchen storage ideas', 'y'.repeat(801))).includes('error'))
  const good = checkPinText('Small kitchen storage ideas that work', 'Smart ways to organise a small kitchen without a remodel. Save this for your next weekend project. #kitchen #organising')
  assert.equal(levels(good).includes('error'), false)
  assert.equal(levels(good).includes('warn'), false)
})

test('spammy patterns are flagged', () => {
  const caps = checkPinText('BEST KITCHEN STORAGE IDEAS EVER', 'A normal long description that explains the pin properly and adds some useful detail for readers.')
  assert.ok(caps.some((c) => /capital/.test(c.text)))
  const tags = checkPinText('Kitchen storage ideas', `${'Nice ideas. '.repeat(10)}#a #b #c #d #e #f`)
  assert.ok(tags.some((c) => /hashtags/.test(c.text)))
  const stuffed = checkPinText('Kitchen storage ideas', 'storage storage storage storage storage and then some other words to pad the length of this description out')
  assert.ok(stuffed.some((c) => /stuffing/.test(c.text)))
})

test('image checks: 2:3 is ok, wide and tall are advised, oversize is an error', () => {
  const ok = checkPinImage({ width: 1000, height: 1500, bytes: 500_000, type: 'image/jpeg' })
  assert.deepEqual(levels(ok), ['ok', 'ok'])
  assert.ok(checkPinImage({ width: 1500, height: 1000, bytes: 1, type: 'image/png' }).some((c) => c.level === 'warn' && /wide/.test(c.text)))
  assert.ok(checkPinImage({ width: 600, height: 2000, bytes: 1, type: 'image/png' }).some((c) => /crop/.test(c.text)))
  assert.ok(checkPinImage({ width: 1000, height: 1500, bytes: 25 * 1048576, type: 'image/png' }).some((c) => c.level === 'error'))
  assert.ok(checkPinImage({ width: 400, height: 600, bytes: 1, type: 'image/png' }).some((c) => /blurry/.test(c.text)))
  assert.ok(checkPinImage({ width: 1000, height: 1500, bytes: 1, type: 'image/tiff' }).some((c) => c.level === 'error'))
})
