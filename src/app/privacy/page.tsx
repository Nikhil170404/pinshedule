import type { Metadata } from 'next'
import { LegalPage } from '@/components/layout/LegalPage'

export const metadata: Metadata = { title: 'Privacy Policy' }

const sections = [
  { title: 'What we collect', body: [
    'Account: your Pinterest user ID, username and profile image URL, received when you sign in with Pinterest. We do not ask for or store your email address or a password.',
    'Pinterest connection: OAuth access and refresh tokens, stored encrypted (AES-256-GCM). Tokens are never exposed to your browser.',
    'Your content: images you upload, titles, descriptions, links, boards and schedules that you create in Pinshedule.',
    'Performance data: impressions, saves and clicks for your account and for pins published through Pinshedule, retrieved from Pinterest with your permission.',
    'Billing: handled by Razorpay. We store your plan, subscription ID and renewal date, never card numbers.',
    'Technical logs: request logs and error information used to keep the service secure and reliable.',
  ] },
  { title: 'How we use it', body: ['To publish the pins you schedule, show your boards and analytics, enforce plan limits, process payments, prevent abuse and fix problems. We do not sell your data, use your Pinterest content for advertising, or share it with third parties except the processors listed below.'] },
  { title: 'AI features', body: ['When you use the AI writer or import a web page, the topic you type, or the title and description of the page you import, is sent to Anthropic to generate suggestions. We do not send your Pinterest tokens or analytics to the AI provider.'] },
  { title: 'Processors', body: ['Supabase (database, authentication, file storage), Railway (publishing and API service), Vercel (website hosting), Upstash (queue and cache), Anthropic (AI suggestions) and Razorpay (payments).'] },
  { title: 'Retention and deletion', body: ['You can disconnect Pinterest at any time, which deletes the stored tokens. You can delete your account in Settings: this immediately removes your profile, pins, uploaded images, analytics and Pinterest connection, and cancels your subscription at the end of the paid period. Cached copies in backups expire within 30 days. Pinterest data is only kept for as long as you have an account.'] },
  { title: 'Your rights', body: ['You can access, correct or delete your data from inside the app, or by emailing privacy@pinshedule.com. If you would like a copy of your data, email us and we will provide it.'] },
  { title: 'Cookies', body: ['We use only essential cookies to keep you signed in. There are no advertising or cross-site tracking cookies.'] },
  { title: 'Changes and contact', body: ['We will post changes on this page with a new date. Questions: privacy@pinshedule.com.'] },
]

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" updated="October 3, 2026" sections={sections} />
}
