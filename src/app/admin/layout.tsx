import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminNav } from '@/components/admin/AdminNav'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(/\/$/, '')

/**
 * Gate for the whole admin area. Signed-out visitors go to login; signed-in people who are not admins get a plain 404, so
 * the area is not discoverable. The worker re-checks admin_users on every data request, so this is a convenience, not the lock.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims?.sub) redirect('/login?redirect=/admin')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login?redirect=/admin')
  let ok = false
  try {
    const res = await fetch(`${API}/v1/admin/me`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
    ok = res.ok
  } catch { ok = false }
  if (!ok) notFound()
  return (
    <div className="min-h-dvh bg-canvas">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
    </div>
  )
}
