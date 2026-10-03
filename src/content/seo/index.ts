import { productPages } from './product-pages'
import { comparePages } from './compare-pages'
import { useCasePages } from './usecase-pages'
import { guidePages } from './guide-pages'
import { site } from '@/lib/site'
import { expansions } from './expansions'
import type { SeoPage } from './types'

export const allPages: SeoPage[] = [...productPages, ...comparePages, ...useCasePages, ...guidePages].map((p) => ({
  ...p,
  blocks: [...p.blocks, ...(expansions[p.path] ?? [])],
}))

export const pageByPath = (path: string) => allPages.find((p) => p.path === path)

export const siteUrl = () => site.url
export const pageUrl = (path: string) => `${siteUrl()}/${path}`.replace(/\/$/, '')

export const groups = {
  product: allPages.filter((p) => p.kind === 'product'),
  compare: allPages.filter((p) => p.kind === 'comparison'),
  useCases: allPages.filter((p) => p.kind === 'use-case'),
  guides: allPages.filter((p) => p.kind === 'guide'),
}
