import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatDate, formatNumber } from '@/lib/utils'
import { Calendar, Image, BarChart3, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all dashboard data in parallel
  const [pinterestRes, pinsRes, analyticsRes] = await Promise.all([
    supabase.from('pinterest_connections').select('*').eq('user_id', user.id).single(),
    supabase.from('scheduled_pins')
      .select('*')
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: true })
      .limit(5),
    supabase.from('analytics_snapshots')
      .select('impressions, saves, clicks')
      .eq('user_id', user.id),
  ])

  const connected = !!pinterestRes.data
  const upcomingPins = pinsRes.data?.filter((p) => p.status === 'pending') ?? []
  const totalImpressions = analyticsRes.data?.reduce((s, r) => s + (r.impressions ?? 0), 0) ?? 0
  const totalSaves = analyticsRes.data?.reduce((s, r) => s + (r.saves ?? 0), 0) ?? 0
  const totalClicks = analyticsRes.data?.reduce((s, r) => s + (r.clicks ?? 0), 0) ?? 0

  const stats = [
    { label: 'Impressions', value: formatNumber(totalImpressions), icon: BarChart3, color: '#E60023' },
    { label: 'Saves', value: formatNumber(totalSaves), icon: CheckCircle2, color: '#00A400' },
    { label: 'Clicks', value: formatNumber(totalClicks), icon: Calendar, color: '#FF6B00' },
    { label: 'Scheduled', value: upcomingPins.length.toString(), icon: Clock, color: '#2563EB' },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Welcome back — here&apos;s your Pinterest overview</p>
        </div>
        <Link href="/dashboard/schedule">
          <Button size="md">
            <Image size={15} />
            Schedule pin
          </Button>
        </Link>
      </div>

      {/* Pinterest connect banner */}
      {!connected && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Connect your Pinterest account</p>
              <p className="text-amber-700 text-xs mt-0.5">
                Connect Pinterest to start scheduling pins and tracking analytics.
              </p>
            </div>
          </div>
          <Link href="/api/auth/pinterest">
            <Button size="sm" className="shrink-0">Connect Pinterest</Button>
          </Link>
        </div>
      )}

      {connected && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-green-600 shrink-0" />
          <p className="text-green-800 text-sm font-medium">Pinterest connected</p>
          <Badge variant="success">Active</Badge>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-sm transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{label}</p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                <Icon size={16} style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Upcoming pins */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900">Upcoming pins</h2>
          <Link href="/dashboard/pins" className="text-sm text-[#E60023] hover:underline">View all</Link>
        </div>
        {upcomingPins.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Calendar size={22} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm mb-4">No pins scheduled yet</p>
            <Link href="/dashboard/schedule">
              <Button size="sm">Schedule your first pin</Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {upcomingPins.map((pin) => (
              <div key={pin.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0 overflow-hidden">
                  {pin.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pin.image_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{pin.title || 'Untitled pin'}</p>
                  <p className="text-xs text-gray-500">{formatDate(pin.scheduled_at, { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <Badge variant={pin.status === 'published' ? 'success' : pin.status === 'failed' ? 'danger' : 'default'}>
                  {pin.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { href: '/dashboard/ai-caption', label: 'Generate AI captions', icon: '✨', desc: 'Write 3 options in seconds' },
          { href: '/dashboard/keywords', label: 'Find keywords', icon: '🔍', desc: 'Pinterest trending keywords' },
          { href: '/dashboard/calendar', label: 'View calendar', icon: '📅', desc: 'See all scheduled pins' },
        ].map(({ href, label, icon, desc }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all duration-200 group"
          >
            <p className="text-2xl mb-2">{icon}</p>
            <p className="text-sm font-semibold text-gray-900 mb-1 group-hover:text-[#E60023] transition-colors">{label}</p>
            <p className="text-xs text-gray-500">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
