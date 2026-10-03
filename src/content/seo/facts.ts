import { PLANS } from '@shared/plans'

/**
 * Every number about GoPinKaro that appears in SEO copy comes from here (plans) or from the product
 * constants it mirrors, so the marketing pages cannot drift from what the app actually enforces.
 */
const F = PLANS.free_trial
const S = PLANS.starter
const P = PLANS.pro
const B = PLANS.growth
const n = (x: number) => x.toLocaleString('en-US')

export const FACTS = {
  free: { pins: n(F.pins_per_month), imports: F.website_imports, ai: F.ai_generations },
  starter: { price: S.price_monthly_usd, yearly: S.price_yearly_usd, pins: n(S.pins_per_month) },
  pro: { price: P.price_monthly_usd, yearly: P.price_yearly_usd, pins: n(P.pins_per_month) },
  business: { price: B.price_monthly_usd, yearly: B.price_yearly_usd, pins: n(B.pins_per_month) },
  // Mirrors worker/src/routes/pins.ts and BulkComposer.
  bulkMax: 200,
  freeBatchMax: 10,
  importBatchMax: 25,
  imageMaxMb: 20,
  titleMax: 100,
  descriptionMax: 800,
  scheduleAheadDays: 365,
}

export const CHECKED = '2026-10-03'

/** Third-party sources consulted for facts about Pinterest and other tools (October 2026). */
export const SRC = {
  nativeLimits: { label: 'Tailwind: Can you schedule Pinterest posts natively?', url: 'https://www.tailwindapp.com/blog/can-you-schedule-pinterest-posts-natively' },
  pinterestCommunity: { label: 'Pinterest Business Community: Pinterest scheduler', url: 'https://community.pinterest.biz/t/pinterest-scheduler/38307' },
  imageSizeTailwind: { label: 'Tailwind: Pinterest image size chart', url: 'https://www.tailwindapp.com/blog/pinterest-image-size' },
  imageSizePubler: { label: 'Publer: Pinterest post sizes', url: 'https://publer.com/blog/pinterest-post-sizes/' },
  charLimits: { label: 'Pinterest character limits guide', url: 'https://advancedcharactercounter.com/pinterest-character-limit-for-pins-titles-and-descriptions-complete-guide/' },
}
