export type Block =
  | { type: 'h2'; id: string; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'steps'; items: { title: string; text: string }[] }
  | { type: 'table'; head: string[]; rows: string[][]; note?: string }
  | { type: 'callout'; title?: string; text: string }
  | { type: 'plans' }

export interface Source { label: string; url: string }

export interface SeoPage {
  /** URL path without leading slash, e.g. "pinterest-scheduler" or "guides/how-to-schedule-pinterest-pins". */
  path: string
  kind: 'product' | 'comparison' | 'use-case' | 'guide'
  /** <title> without the site suffix (the root layout adds " | GoPinKaro"). */
  title: string
  description: string
  h1: string
  /** Short answer shown first (also what answer engines tend to quote). */
  intro: string
  /** ISO date of the last review of the facts on the page. */
  updated: string
  /** ISO date the page first went live (defaults to `updated`). */
  published?: string
  /** Where the page's sign-up buttons send people after Pinterest sign-in, with the button text. */
  cta?: { label: string; redirect: string }
  blocks: Block[]
  faqs: { q: string; a: string }[]
  related: string[]
  sources?: Source[]
  /** Short label used in navigation lists. */
  label: string
}

// Tiny authoring helpers so the content files stay readable.
export const h2 = (id: string, text: string): Block => ({ type: 'h2', id, text })
export const h3 = (text: string): Block => ({ type: 'h3', text })
export const p = (text: string): Block => ({ type: 'p', text })
export const ul = (...items: string[]): Block => ({ type: 'list', items })
export const ol = (...items: string[]): Block => ({ type: 'list', items, ordered: true })
export const steps = (...items: [string, string][]): Block => ({ type: 'steps', items: items.map(([title, text]) => ({ title, text })) })
export const table = (head: string[], rows: string[][], note?: string): Block => ({ type: 'table', head, rows, note })
export const callout = (text: string, title?: string): Block => ({ type: 'callout', text, title })
export const plansTable = (): Block => ({ type: 'plans' })
