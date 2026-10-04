import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { groups } from '@/content/seo'
import { site } from '@/lib/site'

const product = ['pinterest-scheduler', 'pinterest-bulk-scheduler', 'pinterest-automation-tool', 'website-to-pinterest-pins', 'pinterest-keyword-tool', 'free-pinterest-scheduler']

export function Footer() {
  const byPath = (path: string) => [...groups.product, ...groups.compare, ...groups.useCases, ...groups.guides].find((p) => p.path === path)
  const cols = [
    { title: 'Product', links: [{ href: '/features', label: 'Features' }, { href: '/pricing', label: 'Pricing' }, { href: '/tools', label: 'Free tools' }, ...product.map((p) => ({ href: `/${p}`, label: byPath(p)?.label ?? p }))] },
    { title: 'Compare', links: groups.compare.map((p) => ({ href: `/${p.path}`, label: p.label })) },
    { title: 'Use cases', links: groups.useCases.map((p) => ({ href: `/${p.path}`, label: p.label.replace('Pinterest scheduler for ', '') })) },
    { title: 'Guides', links: groups.guides.map((p) => ({ href: `/${p.path}`, label: p.label })) },
  ]
  return (
    <footer className="mt-auto border-t border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Logo />
            <p className="mt-3 max-w-[240px] text-sm leading-relaxed text-muted">Schedule Pinterest pins in bulk and publish at the right time.</p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-400">{c.title}</h3>
              <ul className="space-y-2.5">
                {c.links.map((l) => <li key={l.href}><Link href={l.href} className="text-sm text-stone-600 hover:text-ink">{l.label}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-xs text-muted">
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-ink">Privacy policy</Link>
            <Link href="/terms" className="hover:text-ink">Terms of service</Link>
            <a href="mailto:support@pinshedule.com" className="hover:text-ink">support@pinshedule.com</a>
          </nav>
          <p>&copy; {new Date().getFullYear()} {site.name}. {site.name} is an independent product and is not affiliated with or endorsed by Pinterest. Pinterest is a trademark of Pinterest, Inc.</p>
        </div>
      </div>
    </footer>
  )
}
