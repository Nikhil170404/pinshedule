import type { Metadata } from 'next'
import { pageMeta } from '@/lib/site'

export const metadata: Metadata = pageMeta({
  title: 'Sign in with Pinterest',
  description: 'Sign in to GoPinKaro with your Pinterest account and start scheduling pins. No separate password, free plan included.',
  path: '/login',
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
