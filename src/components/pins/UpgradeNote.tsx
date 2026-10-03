import Link from 'next/link'
import { Lock } from 'lucide-react'

export function UpgradeNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-stone-50 px-3 py-2.5 text-xs text-muted">
      <Lock size={14} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children} <Link href="/dashboard/upgrade" className="font-medium text-brand hover:underline">See plans</Link></span>
    </p>
  )
}
