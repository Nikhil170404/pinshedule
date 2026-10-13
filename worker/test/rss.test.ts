import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFeed } from '../src/lib/rss'

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
<item><title><![CDATA[10 Easy Dinners &amp; Sides]]></title><link>https://blog.test/dinners</link><description><![CDATA[<p>Quick <b>weeknight</b> meals.</p>]]></description><media:content url="https://blog.test/a.jpg" medium="image"/></item>
<item><title>Fall Decor</title><link>/fall-decor</link><content:encoded><![CDATA[<p>Cozy.</p><img src="/img/fall.png" alt="x">]]></content:encoded></item>
<item><title>Podcast</title><link>https://blog.test/pod</link><enclosure url="https://blog.test/p.mp3" type="audio/mpeg"/></item>
<item><title>No link here</title></item>
<item><title>Dup</title><link>https://blog.test/dinners</link></item>
<item><title>Unsafe</title><link>javascript:alert(1)</link></item>
</channel></rss>`

test('RSS: titles, descriptions, images and relative links', () => {
  const items = parseFeed(RSS, 'https://blog.test/feed.xml')
  assert.deepEqual(items.map((i) => i.url), ['https://blog.test/dinners', 'https://blog.test/fall-decor', 'https://blog.test/pod'])
  assert.equal(items[0].title, '10 Easy Dinners & Sides')
  assert.equal(items[0].description, 'Quick weeknight meals.')
  assert.equal(items[0].image, 'https://blog.test/a.jpg')
  assert.equal(items[1].image, 'https://blog.test/img/fall.png')
  assert.equal(items[2].image, null) // an audio enclosure is not an image
})

test('Atom: alternate link, summary and caps', () => {
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Post</title><link rel="self" href="https://b.test/self"/><link rel="alternate" href="https://b.test/post"/><summary>Hello   world</summary></entry></feed>`
  const [i] = parseFeed(atom, 'https://b.test/atom')
  assert.equal(i.url, 'https://b.test/post')
  assert.equal(i.description, 'Hello world')
  const many = `<rss><channel>${Array.from({ length: 80 }, (_, n) => `<item><title>t${n}</title><link>https://b.test/${n}</link></item>`).join('')}</channel></rss>`
  assert.equal(parseFeed(many, 'https://b.test/f', 50).length, 50)
  assert.deepEqual(parseFeed('<html>not a feed</html>', 'https://b.test'), [])
})
