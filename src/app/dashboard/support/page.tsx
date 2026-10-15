import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, Card } from '@/components/ui/Card'
import { SupportCards } from '@/components/layout/SupportLinks'

export const metadata: Metadata = { title: 'Support', robots: { index: false, follow: false } }

export default function SupportPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Support" description="Questions, billing problems or something not working? Reach us either way." />
      <SupportCards />
      <Card className="mt-5 p-5">
        <h2 className="text-sm font-semibold text-ink">To get help faster, include</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-600">
          <li>Your Pinterest username (it is how you sign in).</li>
          <li>For billing, the invoice number or payment date from <Link href="/dashboard/billing" className="font-medium text-ink underline-offset-2 hover:underline">Plan &amp; billing</Link>.</li>
          <li>For a pin problem, the pin&apos;s title and scheduled time, and a screenshot of any error.</li>
        </ul>
      </Card>
    </div>
  )
}
