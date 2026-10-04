import type { Metadata } from 'next'
import { pageMeta } from '@/lib/site'

// A sign-in page is a utility page: keep it out of search results so it does not compete with the real landing pages.
export const metadata: Metadata = {
  ...pageMeta({
    title: 'Sign in with Pinterest',
    description: 'Sign in to GoPinKaro with your Pinterest account and start scheduling pins. No separate password, free plan included.',
    path: '/login',
  }),
  robots: { index: false, follow: true },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
