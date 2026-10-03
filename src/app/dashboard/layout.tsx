import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar, MobileHeader, MobileTabBar } from '@/components/layout/Sidebar'
import { TimezoneSync } from '@/components/layout/TimezoneSync'
import { ConnectionBanner } from '@/components/layout/ConnectionBanner'
import { AssistantLauncher } from '@/components/assistant/AssistantLauncher'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login')

  return (
    <div className="min-h-dvh bg-canvas">
      <Sidebar />
      <div className="lg:pl-60">
        <MobileHeader />
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-6 sm:pt-8 lg:pb-12">
          <ConnectionBanner />
          {children}
        </main>
      </div>
      <MobileTabBar />
      <TimezoneSync />
      <AssistantLauncher />
    </div>
  )
}
