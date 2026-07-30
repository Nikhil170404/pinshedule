import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ClientTime } from '@/components/ui/ClientTime'
import { RetryPinButton } from '@/components/ui/RetryPinButton'
import {
  CalendarDays, ImagePlus, LayoutGrid, Zap,
  AlertCircle, CheckCircle2, Clock, TrendingUp,
  XCircle, ArrowRight, Link2, Search,
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [pinterestRes, pendingRes, recentRes, countsRes] = await Promise.all([
    supabase
      .from('pinterest_connections')
      .select('pinterest_username, expires_at')
      .eq('user_id', user.id)
      .single(),
    // Next 3 pending pins (used for "Up Next")
    supabase
      .from('scheduled_pins')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('scheduled_at', { ascending: true })
      .limit(3),
    // Last 6 pins regardless of status (activity feed)
    supabase
      .from('scheduled_pins')
      .select('*')
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: false })
      .limit(6),
    // All pins to compute counts
    supabase
      .from('scheduled_pins')
      .select('status')
      .eq('user_id', user.id),
  ])

  const connected = !!pinterestRes.data
  const username = pinterestRes.data?.pinterest_username
  const nextPin = pendingRes.data?.[0] ?? null
  const upNextPins = pendingRes.data?.slice(1) ?? []
  const recentPins = recentRes.data ?? []

  const allStatuses = countsRes.data ?? []
  const totalPins = allStatuses.length
  const pendingCount = allStatuses.filter((p) => p.status === 'pending').length
  const publishedCount = allStatuses.filter((p) => p.status === 'published').length
  const failedCount = allStatuses.filter((p) => p.status === 'failed').length

  // Detect if failures are due to missing Pinterest scopes → show reconnect banner
  const needsReconnect = connected && recentPins.some(
    (p) => p.status === 'failed' && p.error_message &&
      (p.error_message.includes('permissions') || p.error_message.includes('boards:write') || p.error_message.includes('pins:write') || p.error_message.includes('Reconnect'))
  )

  const statusBadge = (status: string) => {
    if (status === 'published') return <Badge variant="success">Published</Badge>
    if (status === 'failed') return <Badge variant="danger">Failed</Badge>
    return <Badge variant="warning">Pending</Badge>
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-gray-500 text-sm mt-0.5">Your Pinterest scheduling at a glance</p>
        </div>
        <Link href="/dashboard/schedule">
          <Button size="md">
            <ImagePlus size={15} />
            Schedule pin
          </Button>
        </Link>
      </div>

      {/* ── Pinterest status ── */}
      {!connected ? (
        <div className="flex items-center justify-between gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertCircle size={17} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">Pinterest not connected</p>
              <p className="text-xs text-amber-700 mt-0.5">Connect your account to schedule and publish pins</p>
            </div>
          </div>
          <Link href="/api/auth/pinterest">
            <Button size="sm">Connect Pinterest</Button>
          </Link>
        </div>
      ) : needsReconnect ? (
        /* Token missing boards:write / pins:write scope */
        <div className="flex items-center justify-between gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertCircle size={17} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">Pinterest needs reconnecting</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Your token is missing <code className="font-mono bg-amber-100 px-1 rounded">boards:write</code> permission. Reconnect to fix all failed pins.
              </p>
            </div>
          </div>
          <Link href="/api/auth/pinterest">
            <Button size="sm">Reconnect Pinterest</Button>
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle2 size={17} className="text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-900">Pinterest connected</p>
            {username && (
              <p className="text-xs text-green-700 mt-0.5">@{username}</p>
            )}
          </div>
          <Badge variant="success">Active</Badge>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Pending', value: pendingCount, icon: Clock,       color: 'text-orange-500', bg: 'bg-orange-50',  href: '/dashboard/pins' },
          { label: 'Published', value: publishedCount, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50',   href: '/dashboard/pins' },
          { label: 'Failed',  value: failedCount,   icon: XCircle,    color: 'text-red-500',    bg: 'bg-red-50',    href: '/dashboard/pins' },
          { label: 'Total',   value: totalPins,     icon: TrendingUp, color: 'text-blue-500',   bg: 'bg-blue-50',   href: '/dashboard/pins' },
        ].map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all duration-200 group"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
              <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={15} className={color} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
          </Link>
        ))}
      </div>

      {/* ── Main two-column layout ── */}
      <div className="grid lg:grid-cols-[1fr,320px] gap-5 items-start">

        {/* Left — Up next + recent activity */}
        <div className="space-y-5">

          {/* Up Next card */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900 text-sm">Up next</h2>
              {pendingCount > 0 && (
                <span className="text-xs text-gray-400">{pendingCount} pin{pendingCount !== 1 ? 's' : ''} pending</span>
              )}
            </div>

            {!nextPin ? (
              <div className="py-14 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <CalendarDays size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-1">Nothing queued</p>
                <p className="text-xs text-gray-400 mb-5">Schedule your next pin and it will appear here</p>
                <Link href="/dashboard/schedule">
                  <Button size="sm">Schedule a pin</Button>
                </Link>
              </div>
            ) : (
              <div>
                {/* Primary next pin — larger display */}
                <div className="flex gap-4 p-5">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gray-100 shrink-0 overflow-hidden">
                    {nextPin.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={nextPin.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImagePlus size={20} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate leading-tight">{nextPin.title || 'Untitled pin'}</p>
                    {nextPin.board_name && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{nextPin.board_name}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <Clock size={12} className="text-orange-500 shrink-0" />
                      <ClientTime
                        iso={nextPin.scheduled_at}
                        options={{ weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }}
                        className="text-xs font-medium text-orange-600"
                      />
                    </div>
                    {nextPin.description && (
                      <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">{nextPin.description}</p>
                    )}
                  </div>
                </div>

                {/* Secondary queued pins */}
                {upNextPins.length > 0 && (
                  <div className="border-t border-gray-50 divide-y divide-gray-50">
                    {upNextPins.map((pin) => (
                      <div key={pin.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                          {pin.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pin.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImagePlus size={12} className="text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{pin.title || 'Untitled pin'}</p>
                          <ClientTime
                            iso={pin.scheduled_at}
                            options={{ month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }}
                            className="text-xs text-gray-400"
                          />
                        </div>
                        <Badge variant="warning">Pending</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900 text-sm">Recent activity</h2>
              <Link href="/dashboard/pins" className="text-xs text-[#E60023] hover:underline font-medium flex items-center gap-1">
                View all <ArrowRight size={11} />
              </Link>
            </div>

            {recentPins.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No pins yet</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentPins.map((pin) => (
                  <div key={pin.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                      {pin.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pin.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImagePlus size={12} className="text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{pin.title || 'Untitled pin'}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <ClientTime
                          iso={pin.scheduled_at}
                          options={{ month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }}
                          className="text-xs text-gray-400"
                        />
                        {pin.board_name && (
                          <span className="text-xs text-gray-400 truncate">· {pin.board_name}</span>
                        )}
                      </div>
                      {pin.status === 'failed' && pin.error_message && (
                        <p className="text-[11px] text-red-500 mt-0.5 line-clamp-1">{pin.error_message}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {statusBadge(pin.status)}
                      {pin.status === 'failed' && <RetryPinButton pinId={pin.id} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — Quick actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900 text-sm">Quick actions</h2>
            </div>
            <div className="p-3 space-y-1">
              {[
                { href: '/dashboard/schedule',   icon: ImagePlus,   label: 'Schedule a new pin',       desc: 'Upload image, set time' },
                { href: '/dashboard/calendar',   icon: CalendarDays,label: 'View calendar',             desc: 'See all scheduled pins' },
                { href: '/dashboard/pins',       icon: LayoutGrid,  label: 'My Pins',                  desc: 'Browse & manage pins' },
                { href: '/dashboard/ai-caption', icon: Zap,         label: 'Generate AI captions',     desc: 'Write descriptions in seconds' },
                { href: '/dashboard/keywords',   icon: Search,      label: 'Keyword research',         desc: 'Pinterest trending keywords' },
                { href: '/dashboard/boards',     icon: Link2,       label: 'My Boards',                desc: 'View Pinterest boards' },
              ].map(({ href, icon: Icon, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-[#E60023]/10 flex items-center justify-center shrink-0 transition-colors">
                    <Icon size={14} className="text-gray-500 group-hover:text-[#E60023] transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-gray-900 truncate">{label}</p>
                    <p className="text-xs text-gray-400 truncate">{desc}</p>
                  </div>
                  <ArrowRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          {/* Failed pins callout */}
          {failedCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-800">
                    {failedCount} pin{failedCount !== 1 ? 's' : ''} failed to publish
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Check error messages and retry from My Pins or Calendar.
                  </p>
                  <Link
                    href="/dashboard/pins"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline mt-2"
                  >
                    View failed pins <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
