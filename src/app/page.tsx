import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { PricingSection } from '@/components/landing/PricingSection'
import { FAQ } from '@/components/landing/FAQ'
import { Explore } from '@/components/landing/Explore'
import { site } from '@/lib/site'
import { CTA } from '@/components/landing/CTA'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${site.url}/#org`, name: site.name, url: site.url, logo: `${site.url}/logo-mark.png` },
    { '@type': 'WebSite', '@id': `${site.url}/#site`, name: site.name, url: site.url, publisher: { '@id': `${site.url}/#org` } },
    {
      '@type': 'SoftwareApplication',
      name: site.name,
      url: site.url,
      description: site.description,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      image: `${site.url}${site.ogImage.url}`,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
  ],
}

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <PricingSection />
        <Explore />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  )
}
