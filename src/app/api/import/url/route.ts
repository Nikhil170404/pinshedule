import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { monthlyUsageIncr } from '@/lib/redis'
import { PLANS } from '@/types'
import type { Plan } from '@/types'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function extractMeta(html: string, attr: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([^"']{1,500})["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']{1,500})["'][^>]+${attr}=["']${name}["']`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) return decodeHtmlEntities(m[1].trim())
  }
  return null
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

// Block SSRF — prevent fetching internal/private network addresses
function isPrivateHost(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl)
    const h = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true
    // IPv6 private/link-local
    if (h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true
    // IPv4 private ranges
    const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (ipv4) {
      const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
      if (a === 10) return true                          // 10.x.x.x
      if (a === 172 && b >= 16 && b <= 31) return true  // 172.16–31.x.x
      if (a === 192 && b === 168) return true            // 192.168.x.x
      if (a === 169 && b === 254) return true            // 169.254.x.x link-local
      if (a === 0) return true                           // 0.x.x.x
      if (a === 127) return true                         // 127.x.x.x loopback
    }
    return false
  } catch {
    return true // unparseable URL → block
  }
}

function extractImages(html: string, baseUrl: string): string[] {
  const seen = new Set<string>()
  const imgs: string[] = []

  const patterns = [
    /<img[^>]+src=["']([^"']+)["']/gi,
    /content=["']([^"']+\.(jpg|jpeg|png|webp))["']/gi,
  ]

  for (const pattern of patterns) {
    for (const m of html.matchAll(pattern)) {
      const src = m[1].trim()
      if (!src || src.startsWith('data:')) continue

      let full = src
      if (src.startsWith('//')) full = 'https:' + src
      else if (src.startsWith('/')) {
        try { full = new URL(src, baseUrl).href } catch { continue }
      } else if (!src.startsWith('http')) {
        try { full = new URL(src, baseUrl).href } catch { continue }
      }

      if (!seen.has(full)) {
        seen.add(full)
        imgs.push(full)
      }
      if (imgs.length >= 12) break
    }
    if (imgs.length >= 12) break
  }

  return imgs
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await rateLimit('ai', user.id)
  if (!success) return rateLimitResponse()

  const body = await request.json()
  const url: string = body?.url?.trim()
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'A valid URL is required' }, { status: 400 })
  }
  if (isPrivateHost(url)) {
    return NextResponse.json({ error: 'That URL is not accessible' }, { status: 400 })
  }

  // Check monthly website-import limit
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan')
    .eq('id', user.id)
    .single()
  const plan = (profile?.plan ?? 'free_trial') as Plan
  const importLimit = PLANS[plan].website_imports

  const used = await monthlyUsageIncr('imports', user.id)
  if (used !== null && used > importLimit) {
    return NextResponse.json({
      error: `Monthly website import limit reached. ${PLANS[plan].name} plan: ${importLimit} imports/month.`,
      limit: importLimit,
      upgrade_required: plan !== 'growth',
    }, { status: 403 })
  }

  // Fetch the page
  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Pinshedule/1.0; +https://pinshedule.com/bot)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = await res.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Could not fetch URL: ${msg}` }, { status: 422 })
  }

  // Extract metadata
  const ogTitle = extractMeta(html, 'property', 'og:title')
  const ogDesc = extractMeta(html, 'property', 'og:description')
  const ogImage = extractMeta(html, 'property', 'og:image')
  const metaDesc = extractMeta(html, 'name', 'description')
  const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)
  const pageTitle = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null

  const bestTitle = ogTitle || pageTitle || url
  const bestDesc = ogDesc || metaDesc || ''

  const images = extractImages(html, url)
  if (ogImage && !images.includes(ogImage)) images.unshift(ogImage)

  // Check for existing pins from this URL
  const { data: existing } = await supabase
    .from('scheduled_pins')
    .select('id')
    .eq('user_id', user.id)
    .eq('destination_url', url)
    .limit(1)

  const isDuplicate = (existing?.length ?? 0) > 0

  // AI: generate Pinterest-optimised copy
  let ai: { titles: string[]; description: string; keywords: string[]; alt_text: string }
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `You are a Pinterest SEO expert. Given this webpage, write Pinterest content.

Title: ${bestTitle}
Description: ${bestDesc}
URL: ${url}

Return ONLY valid JSON, no other text:
{
  "titles": ["<100 chars, keyword-rich, no clickbait>", "<second option>", "<third option>"],
  "description": "<150-200 chars, includes CTA, ends with 4-5 hashtags>",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "alt_text": "<one sentence describing the image for accessibility>"
}`,
        },
      ],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}'
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/, '')
    ai = JSON.parse(jsonStr)
    if (!Array.isArray(ai.titles) || ai.titles.length === 0) throw new Error('bad shape')
  } catch {
    ai = {
      titles: [bestTitle],
      description: bestDesc.slice(0, 200),
      keywords: [],
      alt_text: '',
    }
  }

  return NextResponse.json({
    page_title: bestTitle,
    og_image: ogImage,
    images,
    ai,
    is_duplicate: isDuplicate,
  })
}
