import { PLANS } from '@shared/plans'
import { DAILY_PIN_SOFT_MAX } from '@shared/pace'
import { MIN_PINS } from '@shared/best-times'
import { PALETTES, PIN_H, PIN_W, TEMPLATES } from '@/lib/pin-design'

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
  // Mirrors the pin designer and the pacing check, so the copy cannot drift from the code.
  designer: { width: PIN_W, height: PIN_H, templates: TEMPLATES.length, palettes: PALETTES.length },
  dailySoftMax: DAILY_PIN_SOFT_MAX,
  accounts: { free: F.accounts, starter: S.accounts, pro: P.accounts, business: B.accounts },
  aiImages: { free: F.ai_images, starter: S.ai_images, pro: P.ai_images, business: B.ai_images },
  /** Personal best-time ranking needs this many published pins with results (shared/best-times.ts). */
  personalTimingPins: MIN_PINS,
  videoMaxMb: 50,
}

export const CHECKED = '2026-10-06'

/** Third-party sources consulted for facts about Pinterest and other tools (October 2026). */
export const SRC = {
  nativeLimits: { label: 'Tailwind: Can you schedule Pinterest posts natively?', url: 'https://www.tailwindapp.com/blog/can-you-schedule-pinterest-posts-natively' },
  pinterestCommunity: { label: 'Pinterest Business Community: Pinterest scheduler', url: 'https://community.pinterest.biz/t/pinterest-scheduler/38307' },
  imageSizeTailwind: { label: 'Tailwind: Pinterest image size chart', url: 'https://www.tailwindapp.com/blog/pinterest-image-size' },
  imageSizePubler: { label: 'Publer: Pinterest post sizes', url: 'https://publer.com/blog/pinterest-post-sizes/' },
  charLimits: { label: 'Pinterest character limits guide', url: 'https://advancedcharactercounter.com/pinterest-character-limit-for-pins-titles-and-descriptions-complete-guide/' },
  tailwindPricing: { label: 'Tailwind pricing (official)', url: 'https://www.tailwindapp.com/pricing' },
  blogtopinPricing: { label: 'BlogToPin pricing (official)', url: 'https://blogtopin.com/pricing' },
  schedulerRoundup: { label: 'Pinterest schedulers compared: pinterestschedulers.com', url: 'https://pinterestschedulers.com/' },
  pinboostrRoundup: { label: 'Best Pinterest scheduling tools 2026: PinBoostr', url: 'https://pinboostr.com/best-pinterest-scheduling-tools/' },
  gainRoundup: { label: '8 best Pinterest scheduling tools in 2026: Gain', url: 'https://blog.gainapp.com/best-pinterest-scheduling-tools/' },
  automationGuide: { label: 'Pinterest automation best practices: SocialKit', url: 'https://socialk.it/en/blog/pinterest-automation-guide' },
}
