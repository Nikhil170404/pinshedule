import type { Metadata } from 'next'
import { pageMeta } from '@/lib/site'
import { LegalPage } from '@/components/layout/LegalPage'

export const metadata: Metadata = pageMeta({
  title: 'Terms of Service',
  description: 'The terms for using GoPinKaro to prepare and schedule Pinterest pins: acceptable use, Pinterest access, billing and liability.',
  path: '/terms',
})

const sections = [
  { title: '1. Acceptance', body: ['By signing in to or using GoPinKaro you agree to these Terms. If you do not agree, do not use the service.'] },
  { title: '2. The service', body: ['GoPinKaro lets you prepare Pinterest pins and publish them on a schedule through the official Pinterest API. You sign in with your Pinterest account; there is no separate password. Your plan sets how many Pinterest accounts one GoPinKaro login can manage. You must only connect Pinterest accounts that you own or are authorised to manage, and you are responsible for the content you schedule to each of them.'] },
  { title: '3. Eligibility and your account', body: ['You must be at least 18 years old and have the right to the Pinterest account you connect. You are responsible for all activity under your account and for content you schedule.'] },
  { title: '4. Acceptable use', body: ['You agree to follow the Pinterest Terms of Service, Community Guidelines and Developer Guidelines when using GoPinKaro. You must not schedule content you do not have the right to use, content that is illegal, deceptive, hateful or harmful, or spam, including repetitive or automated posting meant to manipulate Pinterest. We may suspend accounts that put the service or Pinterest\'s platform at risk.'] },
  { title: '5. Pinterest access', body: ['You authorise GoPinKaro to read your boards and create pins on your behalf using the permissions you approve on Pinterest. You can revoke access at any time in your Pinterest settings or by disconnecting in GoPinKaro. Pinterest controls its API and may change, limit or interrupt it; we are not responsible for Pinterest outages, rate limits or actions Pinterest takes on your account.'] },
  { title: '6. Your content', body: ['You keep ownership of everything you upload or create. You give us a limited licence to store, process and transmit it to Pinterest so we can provide the service. AI-written suggestions are drafts; review them before publishing.'] },
  { title: '7. Plans, billing and cancellation', body: ['Paid plans are subscriptions billed monthly or yearly in US dollars through Razorpay and renew automatically until cancelled. You can cancel at any time from Plan and billing; you keep access until the end of the period you paid for. Plan limits (pins, AI generations, website imports) reset on the first day of each month (UTC). We may change prices with at least 30 days notice before your next renewal.'] },
  { title: '8. Refunds', body: ['Monthly plans are not refundable for a period already started. Yearly plans can be refunded within 7 days of purchase if you have scheduled fewer than 30 pins. If a fault on our side prevents publishing for more than 72 hours, contact us for a prorated credit.'] },
  { title: '9. Availability', body: ['We work to keep GoPinKaro available and publish pins on time, but we do not guarantee uninterrupted service or that every pin will publish at the exact minute, especially when Pinterest is unavailable.'] },
  { title: '10. Termination and deletion', body: ['You can delete your account at any time in Settings, which removes your data as described in the Privacy Policy. We may suspend or end accounts that violate these Terms.'] },
  { title: '11. Liability', body: ['To the extent permitted by law, GoPinKaro is provided "as is". We are not liable for lost revenue, Pinterest account restrictions, content you publish, or indirect or consequential damages. Our total liability is limited to the amount you paid us in the three months before the claim.'] },
  { title: '12. Governing law', body: ['These Terms are governed by the laws of India. Disputes are subject to the courts of Mumbai.'] },
  { title: '13. Changes and contact', body: ['We may update these Terms and will post the new date here; material changes take effect 14 days after posting. Questions: support@pinshedule.com.'] },
]

export default function TermsPage() {
  return <LegalPage title="Terms of Service" updated="October 3, 2026" sections={sections} />
}
