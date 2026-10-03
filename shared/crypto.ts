// AES-256-GCM helpers for encrypting Pinterest tokens at rest.
// Used by both the Next.js OAuth callback and the Railway worker.
// The key is derived with SHA-256 so any secret length yields a full 256-bit key.

async function key(secret: string, usage: ('encrypt' | 'decrypt')[]) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, usage)
}

export async function encrypt(text: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret, ['encrypt']), new TextEncoder().encode(text))
  const out = new Uint8Array(iv.byteLength + enc.byteLength)
  out.set(iv)
  out.set(new Uint8Array(enc), iv.byteLength)
  return Buffer.from(out).toString('base64')
}

export async function decrypt(payload: string, secret: string): Promise<string> {
  const buf = Buffer.from(payload, 'base64')
  const dec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buf.subarray(0, 12) },
    await key(secret, ['decrypt']),
    buf.subarray(12)
  )
  return new TextDecoder().decode(dec)
}
