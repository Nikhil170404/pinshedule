import type { Block, SeoPage } from './types'

/** Plain-text rendering of a content page, for llms-full.txt and other machine-readable outputs. */
export function blockToText(b: Block): string {
  switch (b.type) {
    case 'h2': return `\n## ${b.text}`
    case 'h3': return `\n### ${b.text}`
    case 'p': return b.text
    case 'list': return b.items.map((t, i) => (b.ordered ? `${i + 1}. ` : '- ') + t).join('\n')
    case 'steps': return b.items.map((s, i) => `${i + 1}. ${s.title}: ${s.text}`).join('\n')
    case 'table': return [b.head.join(' | '), ...b.rows.map((r) => r.join(' | ')), b.note ?? ''].filter(Boolean).join('\n')
    case 'callout': return `${b.title ? `${b.title}: ` : ''}${b.text}`
    default: return ''
  }
}

export function pageToText(page: SeoPage, url: string): string {
  const body = [page.intro, ...page.blocks.map(blockToText)].filter(Boolean).join('\n\n')
  const faqs = page.faqs.length ? `\n\n## Questions and answers\n\n${page.faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')}` : ''
  return `# ${page.h1}\nSource: ${url}\nLast reviewed: ${page.updated}\n\n${body}${faqs}`
}
