'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Lightbulb, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Card'
import { api, errorText } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import { useSummary } from '@/lib/hooks'
import { useActiveAccount } from '@/lib/accounts'
import { buildInsights } from '@/lib/insights'
import { SafeImage } from '@/components/ui/SafeImage'
import { PLANS } from '@/types'
import { cn, formatNumber } from '@/lib/utils'

const TrendChart = dynamic(() => import('@/components/charts/TrendChart'), { ssr: false, loading: () => <Skeleton className="h-60" /> })

interface Day { day: string; impressions: number; saves: number; pin_clicks: number; outbound_clicks: number; engagements: number }
interface TopPin { pin_id: string; impressions: number; saves: number; clicks: number; outbound_clicks: number; title: string | null; image_url: string | null }

const METRICS = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'saves', label: 'Saves' },
  { key: 'pin_clicks', label: 'Pin clicks' },
  { key: 'outbound_clicks', label: 'Outbound clicks' },
] as const

export default function AnalyticsPage() {
  const { summary } = useSummary()
  const maxDays = summary ? PLANS[summary.plan].analytics_days : 7
  const { account, multiple } = useActiveAccount()
  const accountId = account?.id
  const [range, setRange] = useState(30)
  const [metric, setMetric] = useState<(typeof METRICS)[number]['key']>('impressions')
  const [days, setDays] = useState<Day[] | null>(null)
  const [top, setTop] = useState<TopPin[]>([])
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const since = new Date(Date.now() - Math.min(range, maxDays) * 86_400_000).toISOString().slice(0, 10)
    if (!accountId) { if (summary) setDays([]); return } // wait until we know which Pinterest account to show
    const [a, s] = await Promise.all([
      supabase.from('account_analytics').select('day,impressions,saves,pin_clicks,outbound_clicks,engagements').eq('connection_id', accountId).gte('day', since).order('day'),
      supabase.from('analytics_snapshots').select('pin_id,impressions,saves,clicks,outbound_clicks,snapshot_date').order('snapshot_date', { ascending: false }).limit(300),
    ])
    setDays((a.data ?? []) as Day[])

    const latest = new Map<string, TopPin>()
    for (const r of s.data ?? []) if (r.pin_id && !latest.has(r.pin_id)) latest.set(r.pin_id, { pin_id: r.pin_id, impressions: r.impressions ?? 0, saves: r.saves ?? 0, clicks: r.clicks ?? 0, outbound_clicks: r.outbound_clicks ?? 0, title: null, image_url: null })
    const ranked = [...latest.values()].sort((x, y) => y.impressions - x.impressions).slice(0, 10)
    if (ranked.length) {
      const { data: pins } = await supabase.from('scheduled_pins').select('id,title,image_url,connection_id').in('id', ranked.map((r) => r.pin_id))
      const meta = new Map((pins ?? []).map((p) => [p.id, p]))
      ranked.forEach((r) => { r.title = meta.get(r.pin_id)?.title ?? null; r.image_url = meta.get(r.pin_id)?.image_url ?? null })
      // Per-pin numbers belong to the account that published the pin.
      setTop(ranked.filter((r) => !meta.get(r.pin_id)?.connection_id || meta.get(r.pin_id)?.connection_id === accountId))
      return
    }
    setTop(ranked)
  }, [range, maxDays, accountId, summary])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and when the range changes
  useEffect(() => { void load() }, [load])

  const totals = useMemo(() => {
    const t = { impressions: 0, saves: 0, pin_clicks: 0, outbound_clicks: 0 }
    for (const d of days ?? []) { t.impressions += d.impressions; t.saves += d.saves; t.pin_clicks += d.pin_clicks; t.outbound_clicks += d.outbound_clicks }
    return t
  }, [days])

  async function sync() {
    setSyncing(true)
    try {
      await api(`/account/analytics/sync${accountId ? `?connection=${accountId}` : ''}`, { method: 'POST', body: {} })
      await load()
      toast.success('Analytics updated from Pinterest.')
    } catch (e) { toast.error(errorText(e)) }
    setSyncing(false)
  }

  const insights = useMemo(() => buildInsights(days ?? [], top), [days, top])
  const ranges = [7, 30, 90].filter((r) => r <= Math.max(maxDays, 7))
  const empty = days !== null && days.length === 0

  return (
    <div>
      <PageHeader title="Analytics" description={`Performance of ${multiple && account?.username ? '@' + account.username : 'your Pinterest account'}. Pinterest reports data with a delay of one to two days.`}
        actions={<Button variant="outline" onClick={sync} loading={syncing}>{!syncing && <RefreshCw size={15} aria-hidden />} Refresh</Button>} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-stone-100 p-1">
          {ranges.map((r) => (
            <button key={r} onClick={() => setRange(r)} className={cn('h-8 rounded-md px-3 text-[13px] font-medium', range === r ? 'bg-white text-ink shadow-sm' : 'text-stone-600')}>{r} days</button>
          ))}
        </div>
        {maxDays < 90 && <Link href="/dashboard/upgrade" className="text-xs font-medium text-brand hover:underline">Longer history on paid plans</Link>}
      </div>

      {days === null ? <Skeleton className="h-80" /> : empty ? (
        <Card><EmptyState icon={BarChart3} title="No analytics yet" description="Numbers appear after your first published pins have been on Pinterest for a day or two."
          action={<Button onClick={sync} loading={syncing}>Fetch from Pinterest</Button>} /></Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {METRICS.map((m) => (
              <button key={m.key} onClick={() => setMetric(m.key)} aria-pressed={metric === m.key}
                className={cn('rounded-xl border bg-white p-4 text-left transition-colors', metric === m.key ? 'border-ink' : 'border-line hover:border-stone-300')}>
                <p className="text-sm text-muted">{m.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{formatNumber(totals[m.key])}</p>
              </button>
            ))}
          </div>
          {insights.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {insights.map((i) => (
                <Card key={i.id} className="flex gap-3 p-4">
                  <Lightbulb size={18} className={cn('mt-0.5 shrink-0', i.tone === 'good' ? 'text-emerald-600' : i.tone === 'warn' ? 'text-amber-600' : 'text-stone-400')} aria-hidden />
                  <div className="min-w-0"><p className="text-sm font-semibold text-ink">{i.title}</p><p className="mt-0.5 text-xs text-muted">{i.body}</p></div>
                </Card>
              ))}
            </div>
          )}
          <Card className="p-4">
            <TrendChart data={days.map((d) => ({ day: d.day, value: d[metric] }))} label={METRICS.find((m) => m.key === metric)!.label} />
          </Card>

          <h2 className="mb-2 mt-6 text-sm font-semibold text-ink">Top pins published with GoPinKaro</h2>
          <Card className="overflow-hidden">
            {top.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">Per-pin numbers appear once pins have collected impressions.</p> : (
              <div className="divide-y divide-line">
                {top.map((p) => (
                  <div key={p.pin_id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                    <SafeImage src={p.image_url} className="h-14 w-10 shrink-0 rounded-md border border-line" iconSize={14} />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.title || 'Untitled pin'}</p>
                    <dl className="flex shrink-0 gap-4 text-right text-xs">
                      <div><dt className="text-muted">Views</dt><dd className="font-medium tabular-nums text-ink">{formatNumber(p.impressions)}</dd></div>
                      <div><dt className="text-muted">Saves</dt><dd className="font-medium tabular-nums text-ink">{formatNumber(p.saves)}</dd></div>
                      <div className="hidden sm:block"><dt className="text-muted">Clicks</dt><dd className="font-medium tabular-nums text-ink">{formatNumber(p.outbound_clicks)}</dd></div>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
