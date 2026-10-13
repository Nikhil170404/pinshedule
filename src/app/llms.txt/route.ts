import { PLANS, YEARLY_BILLING } from '@shared/plans'
import { allPages, pageUrl, siteUrl } from '@/content/seo'

export const dynamic = 'force-static'

/** A plain-text summary for AI answer engines. Facts come from the same data as the product. */
export function GET() {
  const plans = Object.values(PLANS)
    .map((p) => `- ${p.name}: ${p.price_monthly_usd === 0 ? 'free' : YEARLY_BILLING ? `$${p.price_monthly_usd}/month or $${p.price_yearly_usd}/year` : `$${p.price_monthly_usd}/month`}, ${p.pins_per_month.toLocaleString('en-US')} pins per month`)
    .join('\n')
  const pages = allPages.map((p) => `- [${p.label}](${pageUrl(p.path)}): ${p.description}`).join('\n')
  const body = `# GoPinKaro

> GoPinKaro is a Pinterest scheduler. It schedules pins in bulk (images or CSV), turns web pages and sitemaps into drafted pins, publishes at best-time slots in the user's timezone through the official Pinterest API, and includes an AI assistant that asks for confirmation before changing anything. One login manages up to 10 Pinterest accounts (Free 1, Starter 1, Pro 3, Business 10) from one dashboard. It schedules image, video and carousel pins, has a template-based pin designer (with optional AI backgrounds) and learns best posting hours from an account's own results once there is enough data. Pinterest only; not a full design studio.

Website: ${siteUrl()}

## Plans
${plans}

## Free tools
- [Pinterest pin size checker](${siteUrl()}/tools/pin-size-checker): checks ratio, resolution and file size of pin images in the browser
- [Pinterest title and description checker](${siteUrl()}/tools/pin-text-checker): character counts and keyword placement
- [Pinterest posting frequency calculator](${siteUrl()}/tools/pin-schedule-calculator): turns a batch of pins and a number of days into a daily pace

## Pages
${pages}
`
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
