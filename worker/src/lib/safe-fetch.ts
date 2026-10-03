import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const l = ip.toLowerCase()
    if (l === '::1' || l === '::' || l.startsWith('fe80') || l.startsWith('fc') || l.startsWith('fd')) return true
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return mapped ? isPrivateIp(mapped[1]) : false
  }
  const [a, b] = ip.split('.').map(Number)
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || a >= 224
  )
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL
  try { u = new URL(raw) } catch { throw new Error('That is not a valid URL') }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) URLs are supported')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('That URL is not accessible')
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => { throw new Error('Could not resolve that domain') })
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error('That URL is not accessible')
  return u
}

/** Fetch text from the public internet: SSRF-checked on every redirect hop, size- and time-capped. */
export async function safeFetchText(url: string, opts: { maxBytes?: number; accept?: string } = {}): Promise<{ text: string; finalUrl: string }> {
  const maxBytes = opts.maxBytes ?? 2_000_000
  let current = (await assertPublicUrl(url)).href
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PinsheduleBot/1.0; +https://pinshedule.com)', Accept: opts.accept ?? 'text/html,application/xhtml+xml,application/xml' },
      signal: AbortSignal.timeout(12_000),
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = (await assertPublicUrl(new URL(res.headers.get('location')!, current).href)).href
      continue
    }
    if (!res.ok) throw new Error(`The site responded with HTTP ${res.status}`)
    const reader = res.body?.getReader()
    if (!reader) return { text: await res.text(), finalUrl: current }
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      chunks.push(value)
      if (total >= maxBytes) { await reader.cancel(); break }
    }
    return { text: Buffer.concat(chunks).toString('utf8'), finalUrl: current }
  }
  throw new Error('Too many redirects')
}
