import { PLANS } from '@shared/plans'
import { allPages, pageUrl, siteUrl } from '@/content/seo'

export const dynamic = 'force-static'

/** A plain-text summary for AI answer engines. Facts come from the same data as the product. */
export function GET() {
  const plans = Object.values(PLANS)
    .map((p) => `- ${p.name}: ${p.price_monthly_usd === 0 ? 'free' : `$${p.price_monthly_usd}/month or $${p.price_yearly_usd}/year`}, ${p.pins_per_month.toLocaleString('en-US')} pins per month`)
    .join('\n')
  const pages = allPages.map((p) => `- [${p.label}](${pageUrl(p.path)}): ${p.description}`).join('\n')
  const body = `# GoPinKaro

> GoPinKaro is a Pinterest scheduler. It schedules pins in bulk (images or CSV), turns web pages and sitemaps into drafted pins, publishes at best-time slots in the user's timezone through the official Pinterest API, and includes an AI assistant that asks for confirmation before changing anything. One login manages up to 100 Pinterest accounts (Free 1, Starter 3, Pro 10, Business 100) from one dashboard. It schedules image, video and carousel pins, has a template-based pin designer (with optional AI backgrounds) and learns best posting hours from an account's own results once there is enough data. Pinterest only; not a full design studio.

Website: ${siteUrl()}

## Plans
${plans}

## Pages
${pages}
`
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
