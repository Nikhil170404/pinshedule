import type { Metadata } from 'next'
import { pageMeta } from '@/lib/site'
import { LegalPage } from '@/components/layout/LegalPage'

export const metadata: Metadata = pageMeta({
  title: 'Privacy Policy',
  description: 'What GoPinKaro collects, how your Pinterest connection and content are stored, and how to access or delete your data.',
  path: '/privacy',
})

const sections = [
  { title: 'What we collect', body: [
    'Account: your Pinterest user ID, username and profile image URL, received when you sign in with Pinterest. We do not ask for or store your email address or a password.',
    'Pinterest connections: for every Pinterest account you connect, its username, profile image URL and OAuth access and refresh tokens, stored encrypted (AES-256-GCM). Tokens are never exposed to your browser. A login can connect several accounts, and you should only connect accounts you own or are authorized to manage.',
    'Your content: images and videos you upload, titles, descriptions, links, boards and schedules that you create in GoPinKaro, for each connected account.',
    'Performance data: impressions, saves and clicks for your account and for pins published through GoPinKaro, retrieved from Pinterest with your permission.',
    'Billing: handled by Razorpay. We store your plan, subscription ID and renewal date, never card numbers.',
    'Technical logs: request logs and error information used to keep the service secure and reliable.',
  ] },
  { title: 'How we use it', body: ['To publish the pins you schedule (including uploading videos to Pinterest on your behalf), show your boards and analytics, enforce plan limits, process payments, prevent abuse and fix problems. We do not sell your data, use your Pinterest content for advertising, or share it with third parties except the processors listed below.'] },
  { title: 'AI features', body: ['The in-app assistant keeps your conversation in your own browser only (local storage); the recent messages of a conversation are sent to OpenAI each time you send one, together with a short account summary (plan, usage, timezone) and the results of the actions it looks up for you, such as pin titles and board names. Changes the assistant proposes are only carried out after you confirm them. When you use the AI writer or import a web page, the topic you type, or the title and description of the page you import, is sent to OpenAI to generate suggestions. To warn you about near-duplicate pins and suggest boards, the title and description of your pins and the names and descriptions of your boards are also converted to numeric embeddings by OpenAI and stored in our database. We do not send your Pinterest tokens, images or analytics to the AI provider, and OpenAI does not use API data to train its models. When you ask for an AI background image in the pin designer, the description you type is sent to OpenAI to create the picture, which is returned to your browser and is not stored by GoPinKaro unless you schedule a pin that uses it. To design pins from a web page, our server fetches that page\'s public images for you. GoPinKaro also learns the best posting hours for each account from that account\'s own published pins and their results; this stays within your workspace.'] },
  { title: 'Processors', body: ['Supabase (database, authentication, file storage), Railway (publishing and API service), Vercel (website hosting), Upstash (queue and cache), OpenAI (AI suggestions and embeddings) and Razorpay (payments).'] },
  { title: 'Retention and deletion', body: ['You can disconnect Pinterest at any time, which deletes the stored tokens. You can delete your account in Settings: this immediately removes your profile, pins, uploaded images, analytics and Pinterest connection, and cancels your subscription at the end of the paid period. Cached copies in backups expire within 30 days. Pinterest data is only kept for as long as you have an account.'] },
  { title: 'Your rights', body: ['You can access, correct or delete your data from inside the app, or by emailing privacy@pinshedule.com. If you would like a copy of your data, email us and we will provide it.'] },
  { title: 'Cookies', body: ['We use only essential cookies to keep you signed in. There are no advertising or cross-site tracking cookies.'] },
  { title: 'Changes and contact', body: ['We will post changes on this page with a new date. Questions: privacy@pinshedule.com.'] },
]

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" updated="October 3, 2026" sections={sections} />
}
