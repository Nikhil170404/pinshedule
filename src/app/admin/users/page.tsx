'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Card, PageHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PlanBadge, n, when } from '@/components/admin/ui'
import { api, errorText } from '@/lib/api'

interface Row { id: string; email: string | null; created_at: string; last_sign_in_at: string | null; provider: string | null; plan: string; plan_status: string; plan_expires_at: string | null }
interface Cursor { before_at: string; before_id: string }

export default function AdminUsers() {
  const [q, setQ] = useState('')
  const [plan, setPlan] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [next, setNext] = useState<Cursor | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async (cursor: Cursor | null, query: string, planFilter: string) => {
    setLoading(true); setErr('')
    const p = new URLSearchParams()
    if (query.trim()) p.set('q', query.trim())
    if (planFilter) p.set('plan', planFilter)
    if (cursor) { p.set('before_at', cursor.before_at); p.set('before_id', cursor.before_id) }
    try {
      const r = await api<{ users: Row[]; next: Cursor | null }>(`/admin/users?${p}`)
      setRows((prev) => (cursor ? [...prev, ...r.users] : r.users))
      setNext(r.next)
    } catch (e) { setErr(errorText(e)) } finally { setLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
  useEffect(() => { load(null, '', '') }, [load])

  return (
    <div>
      <PageHeader title="Users" description="Newest first. Search by exact user id or the start of an email. Opening a profile is recorded in the audit log." />
      <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load(null, q, plan) }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email starts with, or user id" aria-label="Search users" className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm focus:border-brand focus:outline-none sm:max-w-sm" />
        <select value={plan} onChange={(e) => { setPlan(e.target.value); load(null, q, e.target.value) }} aria-label="Plan" className="h-10 rounded-lg border border-line bg-white px-3 text-sm">
          <option value="">All plans</option><option value="free_trial">Free</option><option value="starter">Starter</option><option value="pro">Pro</option><option value="growth">Growth</option>
        </select>
        <Button type="submit">Search</Button>
      </form>
      {err && <p role="alert" className="mb-3 text-sm text-red-600">{err}</p>}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-stone-50 text-xs text-muted"><tr>{['Email', 'Plan', 'Signed up', 'Last sign-in', 'Login'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-stone-50">
                <td className="px-4 py-2.5"><Link href={`/admin/users/${u.id}`} className="font-medium text-brand hover:underline">{u.email ?? u.id}</Link></td>
                <td className="px-4 py-2.5"><PlanBadge plan={u.plan} status={u.plan_status} /></td>
                <td className="px-4 py-2.5 text-stone-600">{when(u.created_at)}</td>
                <td className="px-4 py-2.5 text-stone-600">{when(u.last_sign_in_at)}</td>
                <td className="px-4 py-2.5 text-stone-600">{u.provider ?? '-'}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">No users match.</td></tr>}
          </tbody>
        </table>
      </Card>
      <div className="mt-4 flex items-center gap-3">
        {next && <Button variant="outline" disabled={loading} onClick={() => load(next, q, plan)}>{loading ? 'Loading...' : 'Load more'}</Button>}
        <span className="text-xs text-muted">{n(rows.length)} shown</span>
      </div>
    </div>
  )
}
