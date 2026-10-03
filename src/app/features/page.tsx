import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { CTA } from '@/components/landing/CTA'

export const metadata: Metadata = {
  title: 'Features',
  description: 'Bulk scheduling, website to pins, best-time publishing, an AI writer and live analytics for Pinterest.',
}

export default function FeaturesPage() {
  return (
    <>
      <Navbar />
      <main>
        <Features />
        <HowItWorks />
        <CTA />
      </main>
      <Footer />
    </>
  )
}
