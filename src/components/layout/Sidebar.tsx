'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, CalendarDays, ListChecks, BarChart3, Wand2, Hash, Columns3, Settings, CreditCard,
  LogOut, Globe, PlusSquare, Layers, MoreHorizontal, AlertTriangle, Sparkles, Palette, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui/Logo'
import { Modal } from '@/components/ui/Modal'
import { AccountSwitcher } from '@/components/accounts/AccountSwitcher'
import { useSummary } from '@/lib/hooks'
import { Badge } from '@/components/ui/Badge'

const groups = [
  { items: [{ href: '/dashboard', label: 'Overview', icon: LayoutDashboard }] },
  {
    label: 'Create',
    items: [
      { href: '/dashboard/assistant', label: 'Assistant', icon: Sparkles },
      { href: '/dashboard/schedule', label: 'New pin', icon: PlusSquare },
      { href: '/dashboard/design', label: 'Pin designer', icon: Palette },
      { href: '/dashboard/bulk', label: 'Bulk schedule', icon: Layers },
      { href: '/dashboard/import', label: 'From website', icon: Globe },
      { href: '/dashboard/ai-writer', label: 'AI writer', icon: Wand2 },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/dashboard/pins', label: 'Pins', icon: ListChecks },
      { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarDays },
      { href: '/dashboard/boards', label: 'Boards', icon: Columns3 },
      { href: '/dashboard/accounts', label: 'Accounts', icon: Users },
    ],
  },
  {
    label: 'Grow',
    items: [
      { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/dashboard/keywords', label: 'Keywords', icon: Hash },
    ],
  },
]

const account = [
  { href: '/dashboard/billing', label: 'Plan & billing', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

const isActive = (pathname: string, href: string) => (href === '/dashboard' ? pathname === href : pathname.startsWith(href))

function NavLink({ href, label, icon: Icon, onNavigate }: { href: string; label: string; icon: React.ElementType; onNavigate?: () => void }) {
  const active = isActive(usePathname(), href)
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
        active ? 'bg-stone-100 text-ink' : 'text-stone-600 hover:bg-stone-50 hover:text-ink'
      )}
    >
      <Icon size={17} className={cn('shrink-0', active && 'text-brand')} aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  )
}

function useLogout() {
  const router = useRouter()
  return async () => {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }
}

export function Sidebar() {
  const logout = useLogout()
  const { summary } = useSummary()
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-white lg:flex">
      <div className="flex h-16 shrink-0 items-center border-b border-line px-5"><Logo href="/dashboard" /></div>
      <div className="border-b border-line px-3 py-3"><AccountSwitcher /></div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
        {groups.map((g, i) => (
          <div key={i}>
            {'label' in g && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{g.label}</p>}
            <div className="space-y-0.5">{g.items.map((it) => <NavLink key={it.href} {...it} />)}</div>
          </div>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-line px-3 py-3">
        {summary && (
          <Link href="/dashboard/billing" className="mb-2 flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-xs text-muted hover:bg-stone-100">
            <span>Plan</span><Badge tone={summary.plan === 'free_trial' ? 'neutral' : 'brand'}>{summary.plan_name}</Badge>
          </Link>
        )}
        {account.map((it) => <NavLink key={it.href} {...it} />)}
        <button onClick={logout} className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-ink">
          <LogOut size={17} aria-hidden /> Log out
        </button>
      </div>
    </aside>
  )
}

export function MobileHeader() {
  const { summary } = useSummary()
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
      <Logo href="/dashboard" showText={false} />
      <div className="flex min-w-0 items-center gap-2">
        <AccountSwitcher compact />
        {summary?.pinterest?.status === 'needs_reconnect' ? (
          <Link href="/dashboard/accounts" aria-label="Reconnect Pinterest" className="flex shrink-0 items-center rounded-lg bg-amber-50 p-2 text-amber-800"><AlertTriangle size={16} aria-hidden /></Link>
        ) : summary ? (
          <Link href="/dashboard/billing" className="shrink-0"><Badge tone={summary.plan === 'free_trial' ? 'neutral' : 'brand'}>{summary.plan_name}</Badge></Link>
        ) : null}
      </div>
    </header>
  )
}

const tabs = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/schedule', label: 'New pin', icon: PlusSquare },
  { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/dashboard/pins', label: 'Pins', icon: ListChecks },
]

export function MobileTabBar() {
  const pathname = usePathname()
  const [more, setMore] = useState(false)
  const logout = useLogout()
  const moreActive = !tabs.some((t) => isActive(pathname, t.href))

  return (
    <>
      <nav className="safe-pb fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white lg:hidden" aria-label="Primary">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined}
              className={cn('flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', active ? 'text-brand' : 'text-stone-500')}>
              <Icon size={20} aria-hidden />{label}
            </Link>
          )
        })}
        <button onClick={() => setMore(true)} className={cn('flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', moreActive ? 'text-brand' : 'text-stone-500')}>
          <MoreHorizontal size={20} aria-hidden />More
        </button>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="Menu">
        <div className="space-y-4">
          {[...groups.slice(1), { label: 'Account', items: account }].map((g, i) => (
            <div key={i}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{'label' in g ? g.label : ''}</p>
              <div className="grid grid-cols-1 gap-0.5">
                {g.items.map((it) => <NavLink key={it.href} {...it} onNavigate={() => setMore(false)} />)}
              </div>
            </div>
          ))}
          <button onClick={logout} className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-stone-600 hover:bg-stone-50">
            <LogOut size={17} aria-hidden /> Log out
          </button>
        </div>
      </Modal>
    </>
  )
}
