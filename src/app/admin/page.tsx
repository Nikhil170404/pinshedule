'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { Card, PageHeader, Skeleton } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Section, Stat, n, usd } from '@/components/admin/ui'
import { api, errorText } from '@/lib/api'

const TrendChart = dynamic(() => import('@/components/charts/TrendChart'), { ssr: false, loading: () => <Skeleton className="h-60" /> })

interface Overview {
  users: Record<'total' | 'new_24h' | 'new_7d' | 'new_30d' | 'active_24h' | 'active_7d' | 'active_30d', number>
  signups: { day: string; value: number }[]
  paid_by_start_month: { month: string; value: number }[]
  pins: Record<'published' | 'failed' | 'pending' | 'processing', number>
  connections: { total: number; needs_reconnect: number }
  revenue: {
    mrr: number; arr: number; paying_users: number; arpu: number; conversion_pct: number
    at_risk: { mrr: number; users: number }; churning: { mrr: number; users: number }
    by_plan: { plan: string; name: string; users: number; mrr: number }[]
  }
}

export default function AdminOverview() {
  const [d, setD] = useState<Overview | null>(null)
  const [err, setErr] = useState('')
  const load = () => { setErr(''); api<Overview>('/admin/overview').then(setD).catch((e) => setErr(errorText(e))) }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
  useEffect(load, [])

  if (err) return <div><PageHeader title="Overview" /><p role="alert" className="text-sm text-red-600">{err}</p><Button className="mt-3" onClick={load}>Try again</Button></div>
  if (!d) return <div><PageHeader title="Overview" /><div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div></div>

  const u = d.users, r = d.revenue
  const failRate = d.pins.published + d.pins.failed > 0 ? (d.pins.failed / (d.pins.published + d.pins.failed)) * 100 : 0
  return (
    <div>
      <PageHeader title="Overview" description="Refreshed every 5 minutes. Revenue is an estimate from plan prices, not a Razorpay payout report." actions={<Button variant="outline" onClick={load}>Refresh</Button>} />

      <Section title="Users">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Total users" value={n(u.total)} />
          <Stat label="New (24h / 7d)" value={`${n(u.new_24h)} / ${n(u.new_7d)}`} sub={`${n(u.new_30d)} in 30 days`} />
          <Stat label="Active today (DAU)" value={n(u.active_24h)} sub="signed in, last 24h" />
          <Stat label="Active 7d / 30d" value={`${n(u.active_7d)} / ${n(u.active_30d)}`} sub="WAU / MAU" />
        </div>
        <Card className="mt-3 p-4"><p className="mb-2 text-xs font-medium text-muted">Signups per day, last 30 days</p><TrendChart data={d.signups} label="Signups" /></Card>
      </Section>

      <Section title="Revenue (estimate)" note="Plan price x subscribers whose plan is active or cancelling. Yearly plans count as price / 12.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="MRR" value={usd(r.mrr)} />
          <Stat label="ARR" value={usd(r.arr)} sub="MRR x 12" />
          <Stat label="Paying users" value={n(r.paying_users)} sub={`${r.conversion_pct}% of all users`} />
          <Stat label="ARPU" value={usd(r.arpu)} sub="per paying user, monthly" />
          <Stat label="Payment failed" value={usd(r.at_risk.mrr)} sub={`${n(r.at_risk.users)} users at risk`} tone={r.at_risk.users ? 'bad' : undefined} />
          <Stat label="Cancelling" value={usd(r.churning.mrr)} sub={`${n(r.churning.users)} users leave at period end`} tone={r.churning.users ? 'warn' : undefined} />
        </div>
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-line bg-stone-50 text-xs text-muted"><tr><th className="px-4 py-2.5 font-medium">Plan</th><th className="px-4 py-2.5 font-medium">Users</th><th className="px-4 py-2.5 font-medium">MRR</th></tr></thead>
            <tbody className="divide-y divide-line">{r.by_plan.map((p) => <tr key={p.plan}><td className="px-4 py-2.5 font-medium text-ink">{p.name}</td><td className="px-4 py-2.5 tabular-nums">{n(p.users)}</td><td className="px-4 py-2.5 tabular-nums">{p.plan === 'free_trial' ? '-' : usd(p.mrr)}</td></tr>)}</tbody>
          </table>
        </Card>
        {d.paid_by_start_month.length > 0 && (
          <p className="mt-2 text-xs text-muted">Current paid users by month their plan started: {d.paid_by_start_month.map((m) => `${m.month}: ${n(m.value)}`).join(', ')}.</p>
        )}
      </Section>

      <Section title="Pins and accounts" note="Pins scheduled in the last 30 days or upcoming.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Published" value={n(d.pins.published)} />
          <Stat label="Failed" value={n(d.pins.failed)} sub={`${failRate.toFixed(1)}% of finished pins`} tone={failRate > 5 ? 'bad' : undefined} />
          <Stat label="Pending / processing" value={`${n(d.pins.pending)} / ${n(d.pins.processing)}`} />
          <Stat label="Pinterest accounts" value={n(d.connections.total)} sub={`${n(d.connections.needs_reconnect)} need reconnecting`} tone={d.connections.needs_reconnect ? 'warn' : undefined} />
        </div>
      </Section>
    </div>
  )
}
