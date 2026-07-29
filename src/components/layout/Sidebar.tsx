'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Calendar, Image, BarChart3, Sparkles,
  Search, LayoutGrid, Settings, CreditCard, TrendingUp, LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/schedule', label: 'Schedule Pin', icon: Image },
  { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/pins', label: 'My Pins', icon: LayoutGrid },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/ai-caption', label: 'AI Captions', icon: Sparkles },
  { href: '/dashboard/keywords', label: 'Keywords', icon: Search },
  { href: '/dashboard/boards', label: 'Boards', icon: LayoutGrid },
]

const bottomNav = [
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/upgrade', label: 'Upgrade', icon: TrendingUp },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
    const active = pathname === href
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
          active
            ? 'bg-[#E60023] text-white shadow-sm shadow-red-200'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )}
      >
        <Icon size={17} className="shrink-0" />
        <span className="hidden lg:block">{label}</span>
      </Link>
    )
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-14 lg:w-56 border-r border-gray-100 bg-white z-40 flex flex-col">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2.5 px-3 lg:px-4 h-16 border-b border-gray-100 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-[#E60023] flex items-center justify-center shrink-0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
          </svg>
        </div>
        <span className="hidden lg:block font-semibold text-gray-900 text-sm tracking-tight">PinScheduleKaro</span>
      </Link>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 lg:px-3 space-y-0.5">
        {nav.map((item) => <NavItem key={item.href} {...item} />)}
      </nav>

      {/* Bottom nav */}
      <div className="px-2 lg:px-3 pb-4 space-y-0.5 border-t border-gray-100 pt-3">
        {bottomNav.map((item) => <NavItem key={item.href} {...item} />)}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={17} />
          <span className="hidden lg:block">Log out</span>
        </button>
      </div>
    </aside>
  )
}

// Bottom tab bar for mobile
export function MobileTabBar() {
  const pathname = usePathname()
  const mobileNav = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/dashboard/schedule', label: 'Schedule', icon: Image },
    { href: '/dashboard/pins', label: 'Pins', icon: LayoutGrid },
    { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-40 flex">
      {mobileNav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
              active ? 'text-[#E60023]' : 'text-gray-500'
            )}
          >
            <Icon size={20} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
