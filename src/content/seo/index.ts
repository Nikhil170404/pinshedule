import { productPages } from './product-pages'
import { productPages2 } from './product-pages-2'
import { comparePages } from './compare-pages'
import { alternativePages } from './alternative-pages'
import { useCasePages } from './usecase-pages'
import { useCasePages2 } from './usecase-pages-2'
import { guidePages } from './guide-pages'
import { guidePages2 } from './guide-pages-2'
import { usPages } from './us-pages'
import { site } from '@/lib/site'
import { expansions } from './expansions'
import type { SeoPage } from './types'

/** Links from the original pages to the newer ones, so the whole set is one connected web rather than two islands. */
const extraRelated: Record<string, string[]> = {
  'pinterest-scheduler': ['pinterest-video-pin-scheduler', 'manage-multiple-pinterest-accounts', 'cheapest-pinterest-scheduler', 'safest-pinterest-scheduler'],
  'pinterest-bulk-scheduler': ['pinterest-pin-generator', 'use-cases/print-on-demand', 'use-cases/agencies'],
  'pinterest-automation-tool': ['safest-pinterest-scheduler', 'guides/is-pinterest-scheduling-safe'],
  'free-pinterest-scheduler': ['cheapest-pinterest-scheduler'],
  'pinterest-keyword-tool': ['guides/how-to-find-pinterest-keywords'],
  'website-to-pinterest-pins': ['pinterest-pin-generator'],
  'pinterest-pin-maker': ['pinterest-pin-generator', 'pinterest-carousel-pin-scheduler', 'guides/pinterest-ai-generated-content-rules'],
  'best-pinterest-tools': ['best-pinterest-schedulers', 'cheapest-pinterest-scheduler', 'pinboostr-alternative', 'metricool-alternative-for-pinterest', 'later-alternative-for-pinterest'],
  'tailwind-alternative': ['pinboostr-alternative', 'pin-generator-alternative', 'cheapest-pinterest-scheduler'],
  'guides/how-to-schedule-pinterest-pins': ['guides/best-time-to-post-on-pinterest', 'pinterest-video-pin-scheduler'],
  'guides/how-often-to-pin-on-pinterest': ['guides/best-time-to-post-on-pinterest', 'guides/is-pinterest-scheduling-safe'],
  'guides/pinterest-seo-basics': ['guides/how-to-find-pinterest-keywords', 'guides/pinterest-title-and-description-examples'],
  'guides/pinterest-image-size-and-specs': ['guides/pinterest-video-pin-specs'],
  'guides/best-time-to-post-on-pinterest': ['guides/pinterest-seasonal-content-calendar-us', 'guides/pinterest-statistics'],
  'cheapest-pinterest-scheduler': ['best-pinterest-schedulers'],
  'use-cases/print-on-demand': ['guides/pinterest-seasonal-content-calendar-us'],
  'guides/pinterest-native-scheduler-limits': ['cheapest-pinterest-scheduler'],
  'use-cases/bloggers': ['use-cases/food-bloggers'],
  'use-cases/etsy-sellers': ['use-cases/print-on-demand'],
  'use-cases/shopify-stores': ['use-cases/print-on-demand'],
}

export const allPages: SeoPage[] = [...productPages, ...productPages2, ...comparePages, ...alternativePages, ...useCasePages, ...useCasePages2, ...guidePages, ...guidePages2, ...usPages].map((p) => ({
  ...p,
  blocks: [...p.blocks, ...(expansions[p.path] ?? [])],
  related: [...new Set([...p.related, ...(extraRelated[p.path] ?? [])])].slice(0, 8),
}))

export const pageByPath = (path: string) => allPages.find((p) => p.path === path)

export { hubs, hubForKind } from './hubs'

export const siteUrl = () => site.url
export const pageUrl = (path: string) => `${siteUrl()}/${path}`.replace(/\/$/, '')

export const groups = {
  product: allPages.filter((p) => p.kind === 'product'),
  compare: allPages.filter((p) => p.kind === 'comparison'),
  useCases: allPages.filter((p) => p.kind === 'use-case'),
  guides: allPages.filter((p) => p.kind === 'guide'),
}
