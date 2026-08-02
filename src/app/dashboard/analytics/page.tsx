import { createClient } from '@/lib/supabase/server'
import { formatNumber } from '@/lib/utils'
import { BarChart3, TrendingUp, Eye, Heart, MousePointer } from 'lucide-react'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: snapshots } = await supabase
    .from('analytics_snapshots')
    .select('*')
    .eq('user_id', user!.id)
    .order('snapshot_date', { ascending: false })
    .limit(30)

  const totals = (snapshots ?? []).reduce(
    (acc, s) => ({
      impressions: acc.impressions + (s.impressions ?? 0),
      saves: acc.saves + (s.saves ?? 0),
      clicks: acc.clicks + (s.clicks ?? 0),
    }),
    { impressions: 0, saves: 0, clicks: 0 }
  )

  const stats = [
    { label: 'Total Impressions', value: formatNumber(totals.impressions), icon: Eye, color: '#E60023', bg: '#fff0f2' },
    { label: 'Total Saves', value: formatNumber(totals.saves), icon: Heart, color: '#00A400', bg: '#f0fdf4' },
    { label: 'Link Clicks', value: formatNumber(totals.clicks), icon: MousePointer, color: '#FF6B00', bg: '#fff7ed' },
    {
      label: 'Click Rate',
      value: totals.impressions > 0 ? `${((totals.clicks / totals.impressions) * 100).toFixed(1)}%` : '—',
      icon: TrendingUp,
      color: '#2563EB',
      bg: '#eff6ff',
    },
  ]

  // Group by date for mini bar chart
  const byDate = (snapshots ?? []).slice(0, 7).reverse()

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-0.5">Track how your pins perform on Pinterest</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: bg }}>
              <Icon size={18} style={{ color }} />
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-0.5">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Bar chart (last 7 days) */}
      {byDate.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={18} className="text-[#E60023]" />
            <h2 className="font-semibold text-gray-900">Last 7 days — Impressions</h2>
          </div>
          <div className="flex items-end gap-3 h-32">
            {byDate.map((s, i) => {
              const maxImp = Math.max(...byDate.map((d) => d.impressions ?? 0), 1)
              const pct = ((s.impressions ?? 0) / maxImp) * 100
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-t-lg bg-[#E60023] transition-all duration-500"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                  <span className="text-[9px] text-gray-400">
                    {new Date(s.snapshot_date).toLocaleDateString('en', { weekday: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!snapshots?.length && (
        <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center">
          <BarChart3 size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No analytics yet</p>
          <p className="text-gray-400 text-sm mt-1">Analytics will appear after your first pin is published.</p>
        </div>
      )}

      {/* Recent snapshots table */}
      {snapshots && snapshots.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">Recent snapshots</h2>
          </div>
          {/* Header row */}
          <div className="grid grid-cols-4 gap-2 px-5 py-2 bg-gray-50/60 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            <span>Date</span>
            <span>Impressions</span>
            <span>Saves</span>
            <span>Clicks</span>
          </div>
          <div className="divide-y divide-gray-50">
            {snapshots.slice(0, 10).map((s) => (
              <div key={s.id} className="grid grid-cols-4 gap-2 px-5 py-3 text-sm">
                <span className="text-gray-500 text-xs sm:text-sm">
                  {new Date(s.snapshot_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-gray-900 font-medium text-xs sm:text-sm">{formatNumber(s.impressions ?? 0)}</span>
                <span className="text-green-600 text-xs sm:text-sm">{formatNumber(s.saves ?? 0)}</span>
                <span className="text-orange-600 text-xs sm:text-sm">{formatNumber(s.clicks ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
