import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Pinshedule — Turn Your Website into Pinterest Traffic',
  description:
    'The fastest and most affordable Pinterest automation. Paste a URL, get AI-optimized pins, schedule automatically. From $15/mo.',
  keywords:
    'pinterest scheduler, pinterest automation, website to pins, bulk pin scheduler, ai pinterest captions',
  openGraph: {
    title: 'Pinshedule — Turn Your Website into Pinterest Traffic',
    description: 'Paste a URL, get pins. The fastest and most affordable Pinterest automation. Starting at $15/mo.',
    type: 'website',
    url: 'https://pinshedule.com',
  },
}

// Required for env(safe-area-inset-*) to work on iOS Safari
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen min-h-[100dvh] flex flex-col">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{ style: { borderRadius: '12px', fontSize: '14px' } }}
        />
      </body>
    </html>
  )
}
