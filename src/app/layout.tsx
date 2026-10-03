import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' })

const description = 'Schedule Pinterest pins in bulk, turn your website into pins, and publish at the best times. Free plan included.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://pinshedule.com'),
  title: { default: 'Pinshedule: Pinterest scheduler for bulk pins', template: '%s | Pinshedule' },
  description,
  openGraph: { title: 'Pinshedule: Pinterest scheduler for bulk pins', description, type: 'website', siteName: 'Pinshedule' },
  robots: { index: true, follow: true },
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
