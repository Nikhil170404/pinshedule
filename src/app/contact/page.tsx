import type { Metadata } from 'next'
import { COMPANY } from '@shared/company'
import { pageMeta } from '@/lib/site'
import { LegalPage } from '@/components/layout/LegalPage'

export const metadata: Metadata = pageMeta({
  title: 'Contact us',
  description: 'Contact GoPinKaro for support, billing questions, refunds and invoices by email or Instagram.',
  path: '/contact',
})

const sections = [
  { title: 'Email', body: [`${COMPANY.supportEmail}: support, billing, refunds, invoices and privacy requests. Include the email or Pinterest username you sign in with and, for billing questions, the date of the payment.`] },
  { title: 'Instagram', body: [`@${COMPANY.instagramHandle} on Instagram (${COMPANY.instagramUrl}). Send us a direct message for quick questions.`] },
  { title: 'Billing and invoices', body: ['Every payment has an invoice and a receipt you can download as a PDF from Plan and billing inside the dashboard. You can also update your invoice details there (name, company, address and tax ID). Refunds are described in our Terms of Service.'] },
  { title: 'Website', body: [`${COMPANY.website}`] },
]

export default function ContactPage() {
  return <LegalPage title="Contact us" updated="October 15, 2026" sections={sections} />
}
