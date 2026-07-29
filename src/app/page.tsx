import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Testimonials } from '@/components/landing/Testimonials'
import { Comparison } from '@/components/landing/Comparison'
import { PricingSection } from '@/components/landing/PricingSection'
import { FAQ } from '@/components/landing/FAQ'
import { CTA } from '@/components/landing/CTA'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Comparison />
        <PricingSection />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  )
}
