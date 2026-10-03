'use client'

import Link from 'next/link'
import { Select } from '@/components/ui/Input'
import { useBoards } from '@/lib/hooks'
import { useBoardSuggestions } from '@/lib/useAiHints'

export function BoardSelect({ value, onChange, label = 'Board', className, suggestText = '' }: {
  value: string; onChange: (id: string, name: string) => void; label?: string; className?: string
  /** Pin title and description; when given, the best-matching boards are suggested (vector search). */
  suggestText?: string
}) {
  const { boards, loaded, loading, error } = useBoards()
  const suggestions = useBoardSuggestions(suggestText).filter((s) => s.id !== value)
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
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>Suggested:</span>
          {suggestions.map((s) => (
            <button key={s.id} type="button" onClick={() => onChange(s.id, s.name)}
              className="rounded-md border border-line bg-white px-2 py-1 font-medium text-ink hover:border-stone-400">{s.name}</button>
          ))}
        </div>
      )}
      {loaded && boards.length === 0 && (
        <Link href="/dashboard/boards" className="mt-1.5 inline-block text-xs font-medium text-brand hover:underline">Create a board</Link>
      )}
      {error?.reconnect && (
        <a href="/api/auth/pinterest?next=/dashboard" className="mt-1.5 inline-block text-xs font-medium text-brand hover:underline">Reconnect Pinterest</a>
      )}
    </div>
  )
}
