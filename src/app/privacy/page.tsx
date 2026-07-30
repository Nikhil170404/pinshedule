import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export const metadata = {
  title: 'Privacy Policy — PinScheduleKaro',
}

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
            <p className="text-gray-500 text-sm">Last Updated: July 29, 2026</p>
          </div>

          <div className="prose prose-gray max-w-none space-y-8 text-sm leading-7 text-gray-600">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">What we collect</h2>
              <ul className="space-y-2 list-disc pl-5">
                <li><strong>Account data:</strong> Email address, encrypted password</li>
                <li><strong>Pinterest connection:</strong> Pinterest user ID, access tokens (encrypted at rest)</li>
                <li><strong>Content you create:</strong> Pin images, titles, descriptions, schedules you create</li>
                <li><strong>Analytics snapshots:</strong> Performance data of your own pins (pulled from Pinterest API with your permission)</li>
                <li><strong>Payment data:</strong> Handled by Razorpay — we never store card numbers</li>
                <li><strong>Usage data:</strong> Log files, browser type, pages visited</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">What we do NOT collect</h2>
              <ul className="space-y-2 list-disc pl-5">
                <li>We do not store raw Pinterest API data beyond what you create</li>
                <li>We do not store other users&apos; pins or boards</li>
                <li>We do not sell your data to third parties</li>
                <li>We do not use your Pinterest content for advertising</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">How we use your data</h2>
              <ul className="space-y-2 list-disc pl-5">
                <li>To operate the scheduling and analytics features you signed up for</li>
                <li>To send you transactional emails (pin published, failed, billing)</li>
                <li>To improve the product</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Data storage</h2>
              <ul className="space-y-2 list-disc pl-5">
                <li>Stored on Supabase (AWS us-east-1 region)</li>
                <li>Pinterest tokens encrypted using AES-256</li>
                <li>Pin images stored in Supabase Storage</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Pinterest data</h2>
              <p>
                We access your Pinterest account data only with your permission through Pinterest&apos;s official OAuth.
                We follow Pinterest&apos;s Developer Terms regarding data storage — we do not cache Pinterest data beyond
                analytics snapshots of your own account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Your rights</h2>
              <ul className="space-y-2 list-disc pl-5">
                <li>Access your data: Email privacy@pinschedulekaro.com</li>
                <li>Delete your account: Settings → Delete Account (removes all your data within 30 days)</li>
                <li>Export your data: Settings → Export Data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Cookies</h2>
              <p>We use essential cookies for authentication only. We do not use advertising cookies.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Contact</h2>
              <p>
                Questions? Email us at{' '}
                <a href="mailto:privacy@pinschedulekaro.com" className="text-[#E60023] hover:underline">
                  privacy@pinschedulekaro.com
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
