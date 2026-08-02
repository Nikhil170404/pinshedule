import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export const metadata = {
  title: 'Terms of Service — Pinshedule',
}

const sections = [
  { id: '1', title: 'Acceptance', body: 'By using Pinshedule, you agree to these Terms. If you disagree, do not use the service.' },
  { id: '2', title: 'Eligibility', body: 'You must be 18+ to use Pinshedule. By using our service, you confirm you are 18+.' },
  { id: '3', title: 'Your account', body: 'You are responsible for keeping your password secure. You are responsible for all activity under your account. You must not share your account with others. Notify us immediately of unauthorized access.' },
  { id: '4', title: 'Acceptable use', body: 'You agree NOT to: use our service to violate Pinterest\'s Terms of Service; upload content you do not own; upload illegal, harmful, or offensive content; attempt to reverse engineer our platform; use our service for spam; or share your account credentials.' },
  { id: '5', title: 'Pinterest account', body: 'You must have a valid Pinterest Business or Creator account. You authorize Pinshedule to access your Pinterest account via official Pinterest API. You can revoke access at any time from Pinterest settings. We are not responsible for Pinterest API changes or downtime.' },
  { id: '6', title: 'Content ownership', body: 'You retain full ownership of all content you upload. You grant us a limited license to store and publish your content on your behalf. We do not claim ownership of your pins, images, or captions.' },
  { id: '7', title: 'Payments and subscriptions', body: 'All plans are billed monthly or annually via Razorpay. Plans auto-renew unless cancelled before renewal date. You can cancel anytime from Settings → Billing.' },
  { id: '8', title: 'Refund policy', body: 'Free trial: 14 days, no credit card required. Monthly plans: no refunds for current billing period. Yearly plans: refund available within 7 days of purchase if you have not used more than 50 scheduled pins. Exceptions: if there is a technical failure on our side preventing you from using the service for more than 72 hours, contact us for a prorated credit.' },
  { id: '9', title: 'Service availability', body: 'We aim for 99.5% uptime but do not guarantee it. We are not liable for Pinterest API downtime or changes. Scheduled maintenance will be announced in advance.' },
  { id: '10', title: 'Termination', body: 'We may suspend accounts that violate these Terms. You may cancel your account at any time. Upon termination, your data is deleted within 30 days.' },
  { id: '11', title: 'Limitation of liability', body: 'Pinshedule is not liable for: lost revenue due to Pinterest API downtime; Pinterest account restrictions or bans; content you publish through our platform; or indirect or consequential damages. Maximum liability is limited to the amount you paid us in the last 3 months.' },
  { id: '12', title: 'Governing law', body: 'These Terms are governed by the laws of India. Disputes will be resolved in Mumbai courts.' },
  { id: '13', title: 'Changes', body: 'We will notify you by email of material changes 14 days before they take effect.' },
]

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
            <p className="text-gray-500 text-sm">Last Updated: July 29, 2026</p>
          </div>

          <div className="space-y-8 text-sm leading-7 text-gray-600">
            {sections.map(({ id, title, body }) => (
              <section key={id}>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{id}. {title}</h2>
                <p>{body}</p>
              </section>
            ))}

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Contact</h2>
              <p>
                Questions? Email{' '}
                <a href="mailto:support@pinshedule.com" className="text-[#E60023] hover:underline">
                  support@pinshedule.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
