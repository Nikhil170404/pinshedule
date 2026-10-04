'use client'

import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckCircle2, Clock, Globe, Layers, PlusSquare, XCircle } from 'lucide-react'
import { buttonStyles } from '@/components/ui/button-styles'
import { Card, EmptyState, Meter, Skeleton } from '@/components/ui/Card'
import { PinRow } from '@/components/pins/PinRow'
import { GetStarted } from '@/components/layout/GetStarted'
import { usePinCounts, usePins, useSummary } from '@/lib/hooks'
import { PLANS } from '@/types'

function Stat({ icon: Icon, label, value, tone, href }: { icon: React.ElementType; label: string; value: number | null; tone: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-line bg-white p-4 transition-colors hover:border-stone-300">
      <div className="flex items-center gap-2 text-sm text-muted"><Icon size={16} className={tone} aria-hidden />{label}</div>
      {value === null ? <Skeleton className="mt-2 h-8 w-14" /> : <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">{value.toLocaleString()}</p>}
    </Link>
  )
}

export default function OverviewPage() {
  const { summary } = useSummary()
  const counts = usePinCounts()
  const upcoming = usePins({ statuses: ['pending', 'processing'], ascending: true, pageSize: 5 })
  const recent = usePins({ statuses: ['published', 'failed'], ascending: false, pageSize: 5 })
  const plan = summary ? PLANS[summary.plan] : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{summary?.pinterest?.username ? `Welcome, ${summary.pinterest.username}` : 'Overview'}</h1>
          <p className="mt-1 text-sm text-muted">Your publishing queue, live.</p>
        </div>
        <Link href="/dashboard/schedule" className={buttonStyles('primary')}><PlusSquare size={16} aria-hidden /> New pin</Link>
      </div>

      <GetStarted />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Clock} label="Scheduled" value={counts ? counts.pending + counts.processing : null} tone="text-sky-600" href="/dashboard/pins" />
        <Stat icon={CheckCircle2} label="Published" value={counts?.published ?? null} tone="text-emerald-600" href="/dashboard/pins" />
        <Stat icon={XCircle} label="Failed" value={counts?.failed ?? null} tone={counts && counts.failed > 0 ? 'text-red-600' : 'text-stone-400'} href="/dashboard/pins" />
        <Card className="p-4">
          {summary && plan ? (
            <Meter label="Pins this month" value={summary.used.pins} max={plan.pins_per_month} />
          ) : <Skeleton className="h-10" />}
          {summary && plan && summary.used.pins >= plan.pins_per_month * 0.8 && plan.id !== 'growth' && (
            <Link href="/dashboard/upgrade" className="mt-2 inline-block text-xs font-medium text-brand hover:underline">Upgrade for more pins</Link>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Up next</h2>
            <Link href="/dashboard/pins" className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">All pins <ArrowRight size={12} aria-hidden /></Link>
          </div>
          <Card className="overflow-hidden">
            {upcoming.loading ? <div className="space-y-3 p-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
              : upcoming.pins.length === 0 ? (
                <EmptyState icon={CalendarDays} title="Your queue is empty" description="Add a few pins and they publish on their own."
                  action={<div className="flex flex-wrap justify-center gap-2"><Link href="/dashboard/schedule" className={buttonStyles('primary', 'sm')}>New pin</Link><Link href="/dashboard/import" className={buttonStyles('outline', 'sm')}>Import from website</Link></div>} />
              ) : <div className="divide-y divide-line">{upcoming.pins.map((p) => <PinRow key={p.id} pin={p} />)}</div>}
          </Card>
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-ink">Recent activity</h2>
          <Card className="overflow-hidden">
            {recent.loading ? <div className="space-y-3 p-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
              : recent.pins.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">Published and failed pins appear here.</p>
              : <div className="divide-y divide-line">{recent.pins.map((p) => <PinRow key={p.id} pin={p} />)}</div>}
          </Card>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { href: '/dashboard/import', icon: Globe, title: 'Import from a website', text: 'Turn a blog post or product page into pins.' },
          { href: '/dashboard/bulk', icon: Layers, title: 'Bulk schedule', text: 'Upload images or a CSV and spread them over days.' },
          { href: '/dashboard/calendar', icon: CalendarDays, title: 'See the calendar', text: 'Your month at a glance.' },
        ].map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="rounded-xl border border-line bg-white p-4 transition-colors hover:border-stone-300">
            <Icon size={18} className="mb-2 text-stone-500" aria-hidden />
            <p className="text-sm font-medium text-ink">{title}</p>
            <p className="mt-0.5 text-xs text-muted">{text}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
