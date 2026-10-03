import { PLANS } from '@shared/plans'
import { JsonLd } from './JsonLd'
import { site } from '@/lib/site'

/** Product data for the pricing page. Offers come straight from the plan data, so they cannot drift. */
export function SiteJsonLd() {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'SoftwareApplication',
            name: site.name,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description: site.description,
            url: site.url,
            offers: Object.values(PLANS).map((p) => ({ '@type': 'Offer', name: p.name, price: p.price_monthly_usd, priceCurrency: 'USD', url: `${site.url}/pricing` })),
          },
        ],
      }}
    />
  )
}
