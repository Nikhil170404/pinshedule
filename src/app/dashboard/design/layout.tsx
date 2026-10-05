import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pin designer' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
