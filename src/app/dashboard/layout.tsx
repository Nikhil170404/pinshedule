import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar, MobileTabBar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      {/*
        ml-14 on tablet (icon sidebar), ml-56 on desktop (full sidebar).
        pb accounts for the mobile tab bar (≈64px) + iOS home indicator via safe area.
      */}
      <main className="md:ml-14 lg:ml-56 min-h-screen">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 pb-28 md:pb-8">
          {children}
        </div>
      </main>
      <MobileTabBar />
    </div>
  )
}
