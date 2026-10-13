'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { api, errorText } from '@/lib/api'

interface Note { id: string; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }

export default function NotificationsPage() {
  const [list, setList] = useState<Note[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setList((await api<{ notifications: Note[] }>('/notifications')).notifications); setError(null) } catch (e) { setError(errorText(e)) }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load when the page opens
  useEffect(() => { void load() }, [load])

  async function markAllRead() {
    await api('/notifications/read', { method: 'POST', body: {} }).catch(() => {})
    window.dispatchEvent(new Event('gpk:notifications-read'))
    await load()
  }
  const unread = list?.filter((n) => !n.read_at).length ?? 0

  return (
    <div className="max-w-2xl">
      <PageHeader title="Notifications" description="Problems that need your attention, such as failed pins and connections about to expire."
        actions={unread > 0 ? <Button variant="secondary" onClick={markAllRead}>Mark all read</Button> : undefined} />
      {error ? <EmptyState icon={Bell} title="Could not load notifications" description={error} />
        : !list ? <Skeleton className="h-32" />
        : list.length === 0 ? <EmptyState icon={Bell} title="Nothing to report" description="You will see failed pins, expiring connections and paused feeds here. We can also email them: turn that on or off in Settings." />
        : (
          <Card className="divide-y divide-line">
            {list.map((n) => (
              <div key={n.id} className={cn('p-4 text-sm', !n.read_at && 'bg-amber-50/50')}>
                <p className="font-medium text-ink">{n.title}</p>
                {n.body && <p className="mt-1 text-muted">{n.body}</p>}
                <p className="mt-1.5 flex items-center gap-3 text-xs text-muted">
                  {new Date(n.created_at).toLocaleString()}
                  {n.link && <Link href={n.link} className="font-medium text-brand hover:underline">Open</Link>}
                </p>
              </div>
            ))}
          </Card>
        )}
    </div>
  )
}
