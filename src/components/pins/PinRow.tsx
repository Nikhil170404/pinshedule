'use client'

import { ExternalLink, Pencil, RotateCw, Trash2 } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { cn, formatDateTime } from '@/lib/utils'
import { SafeImage } from '@/components/ui/SafeImage'
import type { ScheduledPin } from '@/types'

export function PinRow({ pin, selected, onSelect, onEdit, onDelete, onRetry, tz }: {
  pin: ScheduledPin
  selected?: boolean
  onSelect?: (checked: boolean) => void
  onEdit?: () => void
  onDelete?: () => void
  onRetry?: () => void
  tz?: string
}) {
  const editable = pin.status === 'pending' || pin.status === 'failed'
  const when = pin.status === 'published' && pin.published_at ? pin.published_at : pin.scheduled_at
  return (
    <div className={cn('flex gap-3 px-3 py-3 sm:px-4', selected && 'bg-stone-50')}>
      {onSelect && (
        <input type="checkbox" aria-label="Select pin" checked={!!selected} onChange={(e) => onSelect(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#e60023]" disabled={pin.status === 'processing'} />
      )}
      <SafeImage src={pin.image_url} className="h-16 w-11 shrink-0 rounded-md border border-line" iconSize={16} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 max-w-full truncate text-sm font-medium text-ink">{pin.title || 'Untitled pin'}</p>
          <StatusBadge status={pin.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {pin.status === 'published' ? 'Published ' : ''}{formatDateTime(when, tz)}{pin.board_name ? ` · ${pin.board_name}` : ''}
        </p>
        {pin.error_message && (
          <p className={cn('mt-1 line-clamp-2 text-xs', pin.status === 'failed' ? 'text-red-600' : 'text-amber-700')}>{pin.error_message}</p>
        )}
      </div>
      <div className="flex shrink-0 items-start gap-0.5">
        {pin.status === 'published' && pin.pinterest_pin_id && (
          <a href={`https://www.pinterest.com/pin/${pin.pinterest_pin_id}/`} target="_blank" rel="noopener noreferrer" aria-label="View on Pinterest"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-ink"><ExternalLink size={16} /></a>
        )}
        {pin.status === 'failed' && onRetry && (
          <button onClick={onRetry} aria-label="Retry" className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-ink"><RotateCw size={16} /></button>
        )}
        {editable && onEdit && (
          <button onClick={onEdit} aria-label="Edit pin" className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-ink"><Pencil size={16} /></button>
        )}
        {pin.status !== 'processing' && onDelete && (
          <button onClick={onDelete} aria-label="Delete pin" className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
        )}
      </div>
    </div>
  )
}
