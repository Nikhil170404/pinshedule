'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { buttonStyles } from '@/components/ui/button-styles'

const links = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-ink">{l.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className={buttonStyles('ghost', 'md')}>Log in</Link>
          <Link href="/login" className={buttonStyles('primary', 'md')}>Start free</Link>
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100 md:hidden" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <div className="anim-fade space-y-1 border-t border-line bg-white px-4 py-3 md:hidden">
          {links.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-sm font-medium text-ink hover:bg-stone-50">{l.label}</Link>)}
          <div className="flex flex-col gap-2 pt-2">
            <Link href="/login" className={buttonStyles('outline', 'lg')}>Log in</Link>
            <Link href="/login" className={buttonStyles('primary', 'lg')}>Start free</Link>
          </div>
        </div>
      )}
    </header>
  )
}
