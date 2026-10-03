'use client'

import Link from 'next/link'
import { Select } from '@/components/ui/Input'
import { useBoards } from '@/lib/hooks'

export function BoardSelect({ value, onChange, label = 'Board', className }: {
  value: string; onChange: (id: string, name: string) => void; label?: string; className?: string
}) {
  const { boards, loaded, loading, error } = useBoards()
  return (
    <div className={className}>
      <Select
        label={label}
        value={value}
        disabled={!loaded && !error}
        onChange={(e) => onChange(e.target.value, boards.find((b) => b.id === e.target.value)?.name ?? '')}
        error={error?.message}
        hint={!error && loaded && boards.length === 0 ? 'No boards yet.' : undefined}
      >
        <option value="">{loading && !loaded ? 'Loading boards...' : 'Select a board'}</option>
        {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </Select>
      {loaded && boards.length === 0 && (
        <Link href="/dashboard/boards" className="mt-1.5 inline-block text-xs font-medium text-brand hover:underline">Create a board</Link>
      )}
      {error?.reconnect && (
        <a href="/api/auth/pinterest?next=/dashboard" className="mt-1.5 inline-block text-xs font-medium text-brand hover:underline">Reconnect Pinterest</a>
      )}
    </div>
  )
}
