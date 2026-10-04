import { ErrorReporter } from '@/components/layout/ErrorReporter'
import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { site, pageMeta } from '@/lib/site'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: `%s | ${site.name}` },
  applicationName: site.name,
  keywords: ['Pinterest scheduler', 'schedule Pinterest pins', 'bulk pin scheduler', 'Pinterest automation', 'Pinterest marketing tool', 'website to pins', 'Pinterest analytics'],
  category: 'technology',
  robots: { index: true, follow: true },
  ...pageMeta({ path: '/' }),
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fafaf9',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only z-[100] rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to main content</a>
        {children}
        <ErrorReporter />
      </body>
    </html>
  )
}
