import type { Metadata } from 'next'
import { pageMeta } from '@/lib/site'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { PricingSection } from '@/components/landing/PricingSection'
import { FAQ } from '@/components/landing/FAQ'
import { CTA } from '@/components/landing/CTA'

export const metadata: Metadata = pageMeta({
  title: 'Pricing: free plan and paid plans from $9 a month',
  description: 'Free plan with 30 pins a month. Paid plans from $9 a month with bulk scheduling, best-time publishing and analytics.',
  path: '/pricing',
})

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main>
        <PricingSection />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  )
}
