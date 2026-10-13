import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { FIRST_PIN, TOPICS, TROUBLESHOOTING } from '../../src/content/help'

const root = join(__dirname, '../../src/app')

test('every help link points to a dashboard page that exists', () => {
  for (const t of TOPICS) if (t.href) assert.ok(existsSync(join(root, t.href.to.replace(/^\//, ''), 'page.tsx')), `${t.id} -> ${t.href.to}`)
})

test('help topics have unique ids and real content', () => {
  assert.equal(new Set(TOPICS.map((t) => t.id)).size, TOPICS.length)
  for (const t of TOPICS) assert.ok(t.steps.length >= 2 && t.summary.length > 10, t.id)
  assert.ok(FIRST_PIN.length >= 3 && TROUBLESHOOTING.length >= 3)
})
