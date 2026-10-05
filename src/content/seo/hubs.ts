import type { SeoPage } from './types'

/** Index pages that collect every page of one kind: crawl paths for search engines and a map for readers. */
export interface Hub { path: string; kind: SeoPage['kind']; label: string; title: string; description: string; h1: string; intro: string }

export const hubs: Hub[] = [
  {
    path: 'alternatives', kind: 'comparison', label: 'Alternatives',
    title: 'Pinterest scheduler alternatives and comparisons',
    description: 'Compare GoPinKaro with Tailwind, BlogToPin, PinBoostr, Buffer, Later, Publer, Planoly, Hootsuite and Metricool, with official prices, limits and honest trade-offs.',
    h1: 'Pinterest scheduler alternatives and comparisons',
    intro: 'Every comparison here uses prices and limits from the tools\' own pages (or, where a vendor blocks automated reading, named third-party roundups), dated, with a note on where each tool is the better choice. Pick the tool you are weighing up against.',
  },
  {
    path: 'guides', kind: 'guide', label: 'Guides',
    title: 'Pinterest marketing guides',
    description: 'Practical Pinterest guides: how to schedule pins, find keywords, the best time to post, video pin specs, AI content rules, safe automation and more.',
    h1: 'Pinterest marketing guides',
    intro: 'Plain, sourced answers to the questions people ask when they start scheduling and automating Pinterest: what to publish, how often, which sizes and formats, and how to stay on the right side of Pinterest\'s rules.',
  },
  {
    path: 'use-cases', kind: 'use-case', label: 'Use cases',
    title: 'Pinterest scheduling for bloggers, sellers and agencies',
    description: 'How bloggers, Etsy and Shopify sellers, food bloggers, print-on-demand shops and agencies use GoPinKaro to keep a steady flow of pins.',
    h1: 'Pinterest scheduling by use case',
    intro: 'The same scheduler works differently for a food blog, a print-on-demand shop and an agency running many accounts. Start with the page closest to what you do.',
  },
]

export const hubForKind = (kind: SeoPage['kind']) => hubs.find((h) => h.kind === kind)
