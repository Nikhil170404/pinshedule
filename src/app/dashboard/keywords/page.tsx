'use client'

import { useEffect, useState } from 'react'
import { Copy, Hash, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Card'
import { Select } from '@/components/ui/Input'
import { api, errorText } from '@/lib/api'

interface Kw { keyword: string; pct_growth_wow?: number; pct_growth_mom?: number; pct_growth_yoy?: number }
const REGIONS = [['US', 'United States'], ['CA', 'Canada'], ['GB', 'United Kingdom'], ['AU', 'Australia'], ['DE', 'Germany'], ['FR', 'France'], ['BR', 'Brazil'], ['MX', 'Mexico']]

const pct = (n?: number) => (n === undefined ? '-' : `${n > 0 ? '+' : ''}${Math.round(n)}%`)

export default function KeywordsPage() {
  const [q, setQ] = useState('')
  const [region, setRegion] = useState('US')
  const [list, setList] = useState<Kw[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function search(query = q) {
    setBusy(true); setError(null)
    try {
      const r = await api<{ keywords: Kw[] }>(`/keywords?region=${region}${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''}`)
      setList(r.keywords)
    } catch (e) { setError(errorText(e)); setList([]) }
    setBusy(false)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- fetch when the region changes
  useEffect(() => { void search('') }, [region])

  return (
    <div className="max-w-3xl">
      <PageHeader title="Keywords" description="What people are searching for on Pinterest right now. Use these words in titles and descriptions." />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void search() }}>
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden />
          <input aria-label="Keyword" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by a word, for example kitchen"
            className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200" />
        </div>
        <div className="sm:w-48"><Select aria-label="Region" value={region} onChange={(e) => setRegion(e.target.value)}>{REGIONS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select></div>
        <Button type="submit" loading={busy}>Search</Button>
      </form>

      <Card className="overflow-hidden">
        {list === null || busy ? <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          : error ? <EmptyState icon={Hash} title="Could not load keywords" description={error} />
          : list.length === 0 ? <EmptyState icon={Hash} title="No trending keywords found" description="Try a broader word or another region." />
          : (
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-stone-50 text-xs text-muted">
                <tr><th className="px-4 py-2.5 text-left font-medium">Keyword</th><th className="px-2 py-2.5 text-right font-medium">Week</th><th className="px-2 py-2.5 text-right font-medium">Month</th><th className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">Year</th><th className="w-12" /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((k) => (
                  <tr key={k.keyword}>
                    <td className="px-4 py-2.5 font-medium text-ink">{k.keyword}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-muted">{pct(k.pct_growth_wow)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-muted">{pct(k.pct_growth_mom)}</td>
                    <td className="hidden px-2 py-2.5 text-right tabular-nums text-muted sm:table-cell">{pct(k.pct_growth_yoy)}</td>
                    <td className="px-2"><button aria-label={`Copy ${k.keyword}`} onClick={() => { navigator.clipboard.writeText(k.keyword).then(() => toast.success('Copied.')) }} className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-ink"><Copy size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Card>
      <p className="mt-3 text-xs text-muted">Growth figures compare search volume with the previous week, month and year. Source: Pinterest Trends.</p>
    </div>
  )
}
