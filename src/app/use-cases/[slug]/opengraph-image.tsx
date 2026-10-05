import { seoParams } from '@/lib/seo-route'
import { OG_ALT, OG_SIZE, OG_TYPE, renderOgImage } from '@/lib/og-image'

const PREFIX = 'use-cases'

export const alt = OG_ALT
export const size = OG_SIZE
export const contentType = OG_TYPE
export const dynamicParams = false
export const generateStaticParams = () => seoParams(PREFIX)

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return renderOgImage(PREFIX ? `${PREFIX}/${(await params).slug}` : (await params).slug)
}
