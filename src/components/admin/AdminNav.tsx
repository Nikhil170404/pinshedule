'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const items = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/logs', label: 'Logs' },
]

export function AdminNav() {
  const path = usePathname()
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <span className="text-sm font-semibold text-ink">GoPinKaro admin</span>
        <nav aria-label="Admin" className="flex gap-1">
          {items.map((i) => {
            const active = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href)
            return <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', active ? 'bg-stone-100 text-ink' : 'text-stone-600 hover:bg-stone-50 hover:text-ink')}>{i.label}</Link>
          })}
        </nav>
        <Link href="/dashboard" className="ml-auto text-xs text-muted hover:text-ink">Back to app</Link>
      </div>
    </header>
  )
}
