import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pageByPath } from '@/content/seo'
import { site } from '@/lib/site'
import type { SeoPage } from '@/content/seo/types'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_TYPE = 'image/png'
export const OG_ALT = `${site.name}: the Pinterest scheduler for bulk pins`

const KICKER: Record<SeoPage['kind'], string> = { product: 'Pinterest scheduling', comparison: 'Alternatives and comparisons', 'use-case': 'Use case', guide: 'Guide' }

/** A share image for one content page: its headline on the brand colors, so every shared link looks distinct. */
export async function renderOgImage(path: string) {
  const page = pageByPath(path)
  const mark = await readFile(join(process.cwd(), 'public/logo-mark.png')).then((b) => `data:image/png;base64,${b.toString('base64')}`).catch(() => null)
  const title = (page?.h1 ?? site.title).slice(0, 110)
  const size = title.length > 80 ? 54 : title.length > 52 ? 62 : 72

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: 'linear-gradient(135deg, #fff1f3 0%, #ffffff 55%, #ffe3e8 100%)', borderBottom: '14px solid #e60023', color: '#1c1917' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {mark && (
            // next/image is not available inside ImageResponse, so a plain img is required here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mark} width={64} height={64} alt="" />
          )}
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>
            <span>Go</span><span style={{ color: '#e60023' }}>Pin</span><span>Karo</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', fontSize: 28, color: '#e60023', letterSpacing: 4, textTransform: 'uppercase' }}>{page ? KICKER[page.kind] : 'Pinterest scheduler'}</div>
          <div style={{ display: 'flex', fontSize: size, lineHeight: 1.12, fontWeight: 700 }}>{title}</div>
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#78716c' }}>{site.url.replace(/^https?:\/\//, '')}</div>
      </div>
    ),
    OG_SIZE,
  )
}
