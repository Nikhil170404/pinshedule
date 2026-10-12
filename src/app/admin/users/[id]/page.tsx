'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, PageHeader, Skeleton } from '@/components/ui/Card'
import { PlanBadge, Section, Stat, n, when } from '@/components/admin/ui'
import { api, errorText } from '@/lib/api'

interface Detail {
  user: { id: string; email: string | null; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null; provider: string | null; banned_until: string | null }
  profile: { plan: string; plan_status: string; billing_cycle: string | null; timezone: string | null; plan_started_at: string | null; plan_expires_at: string | null; trial_ends_at: string | null; razorpay_subscription_id: string | null; razorpay_customer_id: string | null; razorpay_payment_id: string | null } | null
  plan_limits: { name: string; pins_per_month: number; accounts: number; website_imports: number; ai_generations: number } | null
  connections: { id: string; pinterest_username: string | null; label: string | null; status: string; last_error: string | null; is_primary: boolean; expires_at: string; created_at: string; analytics_synced_at: string | null }[]
  usage: { kind: string; period: string; count: number }[]
  pin_counts: { pending: number; processing: number; published: number; failed: number }
  recent_pins: { id: string; title: string | null; status: string; scheduled_at: string; published_at: string | null; attempts: number; error_message: string | null }[]
  recent_failures: { id: string; title: string | null; scheduled_at: string; attempts: number; error_message: string | null }[]
}

const KV = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-4 border-b border-line py-2 text-sm last:border-0"><dt className="text-muted">{k}</dt><dd className="min-w-0 break-all text-right text-ink">{v}</dd></div>

export default function AdminUser() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api<Detail>(`/admin/users/${id}`).then(setD).catch((e) => setErr(errorText(e))) }, [id])

  if (err) return <div><Link href="/admin/users" className="text-sm text-brand">Back to users</Link><p role="alert" className="mt-4 text-sm text-red-600">{err}</p></div>
  if (!d) return <Skeleton className="h-96" />
  const p = d.profile, month = new Date().toISOString().slice(0, 7)
  return (
    <div>
      <Link href="/admin/users" className="text-sm text-brand hover:underline">Back to users</Link>
      <PageHeader title={d.user.email ?? d.user.id} description={`User ${d.user.id}`} actions={p && <PlanBadge plan={p.plan} status={p.plan_status} />} />
      <p className="-mt-3 mb-4 text-xs text-muted">This view was recorded in the audit log.</p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Published pins" value={n(d.pin_counts.published)} />
        <Stat label="Pending / processing" value={`${n(d.pin_counts.pending)} / ${n(d.pin_counts.processing)}`} />
        <Stat label="Failed pins" value={n(d.pin_counts.failed)} tone={d.pin_counts.failed ? 'warn' : undefined} />
        <Stat label="Pinterest accounts" value={`${d.connections.length}${d.plan_limits ? ` / ${d.plan_limits.accounts}` : ''}`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-4"><h2 className="mb-2 text-sm font-semibold">Account</h2><dl>
          <KV k="Signed up" v={when(d.user.created_at)} /><KV k="Last sign-in" v={when(d.user.last_sign_in_at)} />
          <KV k="Email confirmed" v={d.user.email_confirmed_at ? when(d.user.email_confirmed_at) : 'No'} /><KV k="Login method" v={d.user.provider ?? '-'} />
          <KV k="Timezone" v={p?.timezone ?? '-'} />{d.user.banned_until && <KV k="Banned until" v={when(d.user.banned_until)} />}
        </dl></Card>
        <Card className="p-4"><h2 className="mb-2 text-sm font-semibold">Billing</h2><dl>
          <KV k="Plan" v={p ? `${d.plan_limits?.name ?? p.plan} (${p.billing_cycle ?? 'monthly'})` : '-'} /><KV k="Status" v={p?.plan_status ?? '-'} />
          <KV k="Plan started" v={when(p?.plan_started_at)} /><KV k="Renews / ends" v={when(p?.plan_expires_at)} />
          <KV k="Razorpay subscription" v={p?.razorpay_subscription_id ?? '-'} /><KV k="Razorpay customer" v={p?.razorpay_customer_id ?? '-'} /><KV k="Last payment" v={p?.razorpay_payment_id ?? '-'} />
        </dl></Card>
      </div>

      <Section title="Pinterest accounts">
        <Card className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-line bg-stone-50 text-xs text-muted"><tr>{['Account', 'Status', 'Token expires', 'Analytics synced', 'Last error'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{d.connections.map((c) => <tr key={c.id}><td className="px-4 py-2.5">{c.label ?? c.pinterest_username ?? c.id}{c.is_primary && ' (primary)'}</td><td className={`px-4 py-2.5 ${c.status !== 'active' ? 'text-red-600' : ''}`}>{c.status}</td><td className="px-4 py-2.5">{when(c.expires_at)}</td><td className="px-4 py-2.5">{when(c.analytics_synced_at)}</td><td className="px-4 py-2.5 text-stone-600">{c.last_error ?? '-'}</td></tr>)}
            {d.connections.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No Pinterest accounts connected.</td></tr>}</tbody></table></Card>
      </Section>

      <Section title="Usage" note={d.plan_limits ? `Limits on this plan: ${n(d.plan_limits.pins_per_month)} pins, ${n(d.plan_limits.website_imports)} imports, ${n(d.plan_limits.ai_generations)} AI generations a month.` : undefined}>
        <Card className="p-4"><dl>{d.usage.filter((x) => x.period === month).map((x) => <KV key={x.kind + x.period} k={`${x.kind} (${x.period})`} v={n(x.count)} />)}
          {d.usage.filter((x) => x.period === month).length === 0 && <p className="text-sm text-muted">No metered usage this month.</p>}</dl></Card>
      </Section>

      {d.recent_failures.length > 0 && (
        <Section title="Recent failures">
          <Card className="divide-y divide-line">{d.recent_failures.map((f) => <div key={f.id} className="p-3 text-sm"><p className="font-medium text-ink">{f.title ?? 'Untitled pin'} <span className="font-normal text-muted">· {when(f.scheduled_at)} · {f.attempts} attempts</span></p><p className="mt-0.5 text-red-700">{f.error_message ?? 'No error message'}</p></div>)}</Card>
        </Section>
      )}

      <Section title="Latest 25 pins">
        <Card className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-line bg-stone-50 text-xs text-muted"><tr>{['Title', 'Status', 'Scheduled', 'Published'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{d.recent_pins.map((x) => <tr key={x.id}><td className="max-w-xs truncate px-4 py-2.5">{x.title ?? 'Untitled'}</td><td className={`px-4 py-2.5 ${x.status === 'failed' ? 'text-red-600' : ''}`}>{x.status}</td><td className="px-4 py-2.5">{when(x.scheduled_at)}</td><td className="px-4 py-2.5">{when(x.published_at)}</td></tr>)}
            {d.recent_pins.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">No pins yet.</td></tr>}</tbody></table></Card>
      </Section>
    </div>
  )
}
