import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date) {
  const now = new Date()
  const then = new Date(date)
  const diff = then.getTime() - now.getTime()
  const absDiff = Math.abs(diff)

  if (absDiff < 60_000) return 'just now'
  if (absDiff < 3_600_000) return `${Math.round(absDiff / 60_000)}m ago`
  if (absDiff < 86_400_000) return `${Math.round(absDiff / 3_600_000)}h ago`
  if (absDiff < 604_800_000) return `${Math.round(absDiff / 86_400_000)}d ago`
  return formatDate(date)
}

export function truncate(str: string, length: number) {
  return str.length > length ? str.slice(0, length) + '…' : str
}

export function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function generateState() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export async function encrypt(text: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    encoder.encode(text)
  )
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.byteLength)
  return Buffer.from(combined).toString('base64')
}

export async function decrypt(encryptedText: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const combined = Buffer.from(encryptedText, 'base64')
  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    encrypted
  )
  return decoder.decode(decrypted)
}
