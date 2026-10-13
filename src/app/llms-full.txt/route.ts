import { allPages, pageUrl } from '@/content/seo'
import { pageToText } from '@/content/seo/plain'

export const dynamic = 'force-static'

/** Every content page as plain text, so AI answer engines can read the full, current facts in one request. */
export function GET() {
  const body = `# GoPinKaro: full content\n\nGoPinKaro is a Pinterest scheduler. Facts below are reviewed on the dates shown on each page.\n\n${allPages.map((p) => pageToText(p, pageUrl(p.path))).join('\n\n---\n\n')}\n`
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
