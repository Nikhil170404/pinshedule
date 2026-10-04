import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar, MobileHeader, MobileTabBar } from '@/components/layout/Sidebar'
import { TimezoneSync } from '@/components/layout/TimezoneSync'
import { ConnectionBanner } from '@/components/layout/ConnectionBanner'
import { AssistantLauncher } from '@/components/assistant/AssistantLauncher'
import { FailedPinsBanner } from '@/components/layout/FailedPinsBanner'
import { Toaster } from 'sonner'
import { UsageNudge } from '@/components/layout/UsageNudge'

export const metadata: Metadata = { title: 'Overview', robots: { index: false, follow: false } }

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login')

  return (
    <div className="min-h-dvh bg-canvas">
      <Sidebar />
      <div className="lg:pl-60">
        <MobileHeader />
        <main id="main" tabIndex={-1} className="outline-none mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-6 sm:pt-8 lg:pb-12">
          <ConnectionBanner />
          <FailedPinsBanner />
          <UsageNudge />
          {children}
        </main>
      </div>
      <MobileTabBar />
      <TimezoneSync />
      <AssistantLauncher />
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: '10px', fontSize: '14px' } }} />
    </div>
  )
}
