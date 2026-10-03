import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

const cols = [
  { title: 'Product', links: [{ href: '/features', label: 'Features' }, { href: '/pricing', label: 'Pricing' }, { href: '/login', label: 'Log in' }] },
  { title: 'Legal', links: [{ href: '/privacy', label: 'Privacy policy' }, { href: '/terms', label: 'Terms of service' }] },
  { title: 'Support', links: [{ href: 'mailto:support@pinshedule.com', label: 'support@pinshedule.com' }] },
]

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-3 max-w-[220px] text-sm leading-relaxed text-muted">Schedule Pinterest pins in bulk and publish at the right time.</p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-400">{c.title}</h3>
              <ul className="space-y-2.5">
                {c.links.map((l) => <li key={l.label}><Link href={l.href} className="text-sm text-stone-600 hover:text-ink">{l.label}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:justify-between">
          <p>&copy; {new Date().getFullYear()} GoPinKaro</p>
          <p>GoPinKaro is an independent product and is not affiliated with or endorsed by Pinterest. Pinterest is a trademark of Pinterest, Inc.</p>
        </div>
      </div>
    </footer>
  )
}
