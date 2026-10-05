import { test, before } from 'node:test'
import assert from 'node:assert/strict'

process.env.APP_URL ??= 'http://x'
process.env.SUPABASE_URL = 'https://proj.supabase.co'
process.env.UPSTASH_REDIS_REST_URL ??= 'https://example.upstash.io'
for (const k of ['SUPABASE_SERVICE_ROLE_KEY', 'UPSTASH_REDIS_REST_TOKEN', 'ENCRYPTION_SECRET', 'PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET']) process.env[k] ??= 'x'

let mediaSource: typeof import('../src/lib/pinterest').mediaSource
let pinInput: typeof import('../src/lib/pin-service').pinInput

before(async () => {
  // Imported after the environment is set: the worker refuses to start without it.
  ;({ mediaSource } = await import('../src/lib/pinterest'))
  ;({ pinInput } = await import('../src/lib/pin-service'))
})

const base = { image_url: 'https://cdn.example.com/a.jpg', board_id: 'b1' }
const ownVideo = 'https://proj.supabase.co/storage/v1/object/public/pin-videos/u1/clip.mp4'

test('image pins use image_url', () => {
  assert.deepEqual(mediaSource({ ...base }), { source_type: 'image_url', url: base.image_url })
})

test('video pins reference the processed media and use the image as cover', () => {
  assert.deepEqual(mediaSource({ ...base, media_type: 'video', video_media_id: 'm123' }),
    { source_type: 'video_id', media_id: 'm123', cover_image_url: base.image_url })
  assert.throws(() => mediaSource({ ...base, media_type: 'video' }), /not been uploaded/)
})

test('carousel pins send 2 to 5 image urls, first as the cover', () => {
  const items = [{ url: 'https://i/1.jpg' }, { url: 'https://i/2.jpg' }]
  assert.deepEqual(mediaSource({ ...base, media_type: 'carousel', carousel_items: items }),
    { source_type: 'multiple_image_urls', items, index: 0 })
  assert.throws(() => mediaSource({ ...base, media_type: 'carousel', carousel_items: [items[0]] }), /2 to 5/)
  assert.throws(() => mediaSource({ ...base, media_type: 'carousel', carousel_items: Array(6).fill(items[0]) }), /2 to 5/)
})

test('pin input: video must come from our own storage', () => {
  assert.equal(pinInput.safeParse({ ...base, media_type: 'video', video_url: ownVideo }).success, true)
  const outside = pinInput.safeParse({ ...base, media_type: 'video', video_url: 'https://evil.example.com/clip.mp4' })
  assert.equal(outside.success, false, 'the worker downloads this URL, so arbitrary hosts must be refused')
  const internal = pinInput.safeParse({ ...base, media_type: 'video', video_url: 'https://proj.supabase.co.evil.com/storage/v1/object/public/pin-videos/x.mp4' })
  assert.equal(internal.success, false, 'a lookalike host must not pass the prefix check')
  assert.equal(pinInput.safeParse({ ...base, media_type: 'video' }).success, false, 'a video pin needs a video')
})

test('pin input: carousel needs 2 to 5 images and only carousels carry them', () => {
  const two = [{ url: 'https://i/1.jpg' }, { url: 'https://i/2.jpg' }]
  assert.equal(pinInput.safeParse({ ...base, media_type: 'carousel', carousel_items: two }).success, true)
  assert.equal(pinInput.safeParse({ ...base, media_type: 'carousel', carousel_items: [two[0]] }).success, false)
  assert.equal(pinInput.safeParse({ ...base, media_type: 'carousel', carousel_items: [...two, ...two, ...two] }).success, false)
  assert.equal(pinInput.safeParse({ ...base, media_type: 'carousel' }).success, false)
  assert.equal(pinInput.safeParse({ ...base, carousel_items: two }).success, false, 'an image pin must not smuggle in items')
  assert.equal(pinInput.safeParse({ ...base, video_url: ownVideo }).success, false)
})

test('pin input: existing image pins are unchanged', () => {
  const r = pinInput.parse({ ...base, title: ' Hi ' })
  assert.equal(r.media_type, 'image')
  assert.equal(r.title, 'Hi')
})
