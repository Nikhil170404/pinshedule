import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pins from your website' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
