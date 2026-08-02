import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { PricingSection } from '@/components/landing/PricingSection'
import { FAQ } from '@/components/landing/FAQ'
import { CTA } from '@/components/landing/CTA'

export const metadata = {
  title: 'Pricing — Pinshedule',
  description: 'Free plan forever. Paid plans from $15/mo. The most affordable way to automate Pinterest traffic from your website.',
}

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16">
        <div className="py-16 text-center bg-gray-50 border-b border-gray-100">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-4">
            Pricing that makes sense
          </h1>
          <p className="text-xl text-gray-500 max-w-xl mx-auto">
            Free plan forever. Upgrade when you need more pins, more accounts, or more automation.
          </p>
        </div>
        <PricingSection />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  )
}
