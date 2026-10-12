'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card, PageHeader, Skeleton } from '@/components/ui/Card'
import { Section, n, when } from '@/components/admin/ui'
import { api, errorText } from '@/lib/api'

interface Logs {
  failed_pins: { id: string; user_id: string; title: string | null; scheduled_at: string; attempts: number; error_message: string | null }[]
  top_errors: { message: string; count: number }[]
  broken_connections: { id: string; user_id: string; pinterest_username: string | null; last_error: string | null; updated_at: string | null }[]
  audit: { id: number; admin_id: string; action: string; target_user: string | null; detail: Record<string, unknown> | null; ip: string | null; created_at: string }[]
}

export default function AdminLogs() {
  const [d, setD] = useState<Logs | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api<Logs>('/admin/logs').then(setD).catch((e) => setErr(errorText(e))) }, [])
  if (err) return <p role="alert" className="text-sm text-red-600">{err}</p>
  if (!d) return <Skeleton className="h-96" />
  const user = (id: string) => <Link href={`/admin/users/${id}`} className="text-brand hover:underline">{id.slice(0, 8)}</Link>
  return (
    <div>
      <PageHeader title="Logs" description="Publishing failures, Pinterest connections that need attention, and the admin audit trail. Server request logs live in Railway." />

      <Section title="Most common failure reasons" note="From the 100 latest failed pins.">
        <Card className="divide-y divide-line">{d.top_errors.map((e) => <div key={e.message} className="flex justify-between gap-4 p-3 text-sm"><span className="min-w-0 break-words text-stone-700">{e.message}</span><span className="shrink-0 tabular-nums font-medium">{n(e.count)}</span></div>)}
          {d.top_errors.length === 0 && <p className="p-4 text-sm text-muted">No failed pins.</p>}</Card>
      </Section>

      <Section title="Latest failed pins">
        <Card className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-b border-line bg-stone-50 text-xs text-muted"><tr>{['User', 'Pin', 'Scheduled', 'Tries', 'Error'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{d.failed_pins.map((f) => <tr key={f.id}><td className="px-4 py-2.5">{user(f.user_id)}</td><td className="max-w-[180px] truncate px-4 py-2.5">{f.title ?? 'Untitled'}</td><td className="px-4 py-2.5">{when(f.scheduled_at)}</td><td className="px-4 py-2.5">{f.attempts}</td><td className="px-4 py-2.5 text-red-700">{f.error_message ?? '-'}</td></tr>)}</tbody></table></Card>
      </Section>

      <Section title="Pinterest accounts needing reconnect">
        <Card className="divide-y divide-line">{d.broken_connections.map((c) => <div key={c.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm"><span>{user(c.user_id)} · {c.pinterest_username ?? 'unknown'}</span><span className="text-stone-600">{c.last_error ?? 'No error saved'} · {when(c.updated_at)}</span></div>)}
          {d.broken_connections.length === 0 && <p className="p-4 text-sm text-muted">All connections healthy.</p>}</Card>
      </Section>

      <Section title="Admin audit trail" note="Every user profile opened and every search by an admin.">
        <Card className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-b border-line bg-stone-50 text-xs text-muted"><tr>{['When', 'Admin', 'Action', 'Target', 'IP'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{d.audit.map((a) => <tr key={a.id}><td className="px-4 py-2.5">{when(a.created_at)}</td><td className="px-4 py-2.5 font-mono text-xs">{a.admin_id.slice(0, 8)}</td><td className="px-4 py-2.5">{a.action}{a.detail && 'q' in a.detail ? ` "${String(a.detail.q)}"` : ''}</td><td className="px-4 py-2.5">{a.target_user ? user(a.target_user) : '-'}</td><td className="px-4 py-2.5 text-stone-600">{a.ip ?? '-'}</td></tr>)}</tbody></table></Card>
      </Section>
    </div>
  )
}
