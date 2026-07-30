import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PinScheduleKaro — Schedule Pinterest Pins in Seconds',
  description:
    'AI captions. Bulk upload. Real analytics. Schedule Pinterest pins automatically. Simpler than Tailwind, cheaper than Buffer.',
  keywords:
    'pinterest scheduler, schedule pinterest pins, pinterest automation, ai caption generator, bulk pin scheduler',
  openGraph: {
    title: 'PinScheduleKaro — Schedule Pinterest Pins in Seconds',
    description: 'AI captions. Bulk upload. Real analytics. All for ₹399/mo.',
    type: 'website',
    url: 'https://pinschedulekaro.com',
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
