import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Image, Calendar, Clock } from 'lucide-react'

export default async function PinsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: pins } = await supabase
    .from('scheduled_pins')
    .select('*')
    .eq('user_id', user!.id)
    .order('scheduled_at', { ascending: false })

  const statusVariant = (status: string) => {
    if (status === 'published') return 'success'
    if (status === 'failed') return 'danger'
    return 'default'
  }

  const pendingCount = pins?.filter((p) => p.status === 'pending').length ?? 0
  const publishedCount = pins?.filter((p) => p.status === 'published').length ?? 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Pins</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {pendingCount} pending · {publishedCount} published
          </p>
        </div>
        <Link href="/dashboard/schedule">
          <Button size="sm">
            <Image size={14} />
            Schedule new
          </Button>
        </Link>
      </div>

      {!pins?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Calendar size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium mb-1">No pins yet</p>
          <p className="text-gray-400 text-sm mb-5">Schedule your first pin to see it here</p>
          <Link href="/dashboard/schedule">
            <Button>Schedule a pin</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-[56px,1fr,160px,90px] gap-4 px-5 py-3 border-b border-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <span>Image</span>
              <span>Pin</span>
              <span>Scheduled</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-gray-50">
              {pins.map((pin) => (
                <div
                  key={pin.id}
                  className="grid grid-cols-[56px,1fr,160px,90px] gap-4 px-5 py-4 items-center hover:bg-gray-50/50 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                    {pin.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pin.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image size={16} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{pin.title || 'Untitled'}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{pin.board_name || pin.board_id || '—'}</p>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <Clock size={11} className="shrink-0 text-gray-400" />
                    {formatDate(pin.scheduled_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <Badge variant={statusVariant(pin.status)}>{pin.status}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {pins.map((pin) => (
              <div key={pin.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                  {pin.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pin.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image size={18} className="text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{pin.title || 'Untitled'}</p>
                    <Badge variant={statusVariant(pin.status)}>{pin.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{pin.board_name || pin.board_id || '—'}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1.5">
                    <Clock size={11} className="shrink-0 text-gray-400" />
                    {formatDate(pin.scheduled_at, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {pin.error_message && (
                    <p className="text-xs text-red-500 mt-1 truncate">{pin.error_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
