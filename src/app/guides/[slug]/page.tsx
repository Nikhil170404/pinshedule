import type { Metadata } from 'next'
import { SeoPageView, seoMetadata, seoParams } from '@/lib/seo-route'

const PREFIX = 'guides'

export const dynamicParams = false
export const generateStaticParams = () => seoParams(PREFIX)

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return seoMetadata(PREFIX, (await params).slug)
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <SeoPageView prefix={PREFIX} slug={(await params).slug} />
}
