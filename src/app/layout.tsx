import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { site, pageMeta } from '@/lib/site'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: `%s | ${site.name}` },
  applicationName: site.name,
  keywords: ['Pinterest scheduler', 'schedule Pinterest pins', 'bulk pin scheduler', 'Pinterest automation', 'Pinterest marketing tool', 'website to pins', 'Pinterest analytics'],
  category: 'technology',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-dvh flex-col">
        {children}
        <Toaster position="top-center" toastOptions={{ style: { borderRadius: '10px', fontSize: '14px' } }} />
      </body>
    </html>
  )
}
