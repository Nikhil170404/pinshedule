import type { Metadata } from 'next'
import { pageMeta } from '@/lib/site'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Features } from '@/components/landing/Features'
import { PinGallery } from '@/components/landing/PinGallery'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { CTA } from '@/components/landing/CTA'

export const metadata: Metadata = pageMeta({
  title: 'Features: bulk scheduling, website to pins and AI writer',
  description: 'Bulk scheduling, website to pins, best-time publishing, an AI writer and live analytics for Pinterest.',
  path: '/features',
})

export default function FeaturesPage() {
  return (
    <>
      <Navbar />
      <main id="main" tabIndex={-1} className="outline-none">
        <Features />
        <HowItWorks />
        <PinGallery />
        <CTA />
      </main>
      <Footer />
    </>
  )
}
