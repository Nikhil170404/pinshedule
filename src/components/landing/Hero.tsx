import Link from 'next/link'
import { CheckCircle2, Clock } from 'lucide-react'
import { buttonStyles } from '@/components/ui/button-styles'

const sample = [
  { title: 'Small kitchen storage ideas', time: 'Today, 8:15 PM', status: 'Scheduled', done: false },
  { title: 'Easy weeknight pasta recipes', time: 'Tomorrow, 2:19 PM', status: 'Scheduled', done: false },
  { title: 'Cozy reading nook on a budget', time: 'Yesterday, 8:02 PM', status: 'Published', done: true },
]

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-16 pt-14 sm:px-6 md:pb-24 md:pt-20 lg:grid-cols-2">
      <div>
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
          Pinterest scheduling that keeps your queue full.
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-stone-600">
          Paste a page from your site, review the pins, and let GoPinKaro publish them over the coming weeks at the times your audience is online. Bulk upload, CSV import and a live calendar included.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/login" className={buttonStyles('primary', 'lg')}>Start free with Pinterest</Link>
          <Link href="/pricing" className={buttonStyles('outline', 'lg')}>See pricing</Link>
        </div>
        <p className="mt-4 text-sm text-muted">Free plan with 30 pins a month. No credit card.</p>
      </div>

      <div className="rounded-2xl border border-line bg-white p-4 sm:p-5" aria-hidden>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Queue</p>
          <p className="text-xs text-muted">Example</p>
        </div>
        <div className="divide-y divide-line rounded-xl border border-line">
          {sample.map((s) => (
            <div key={s.title} className="flex items-center gap-3 p-3">
              <div className="h-14 w-10 shrink-0 rounded-md bg-gradient-to-b from-stone-200 to-stone-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{s.title}</p>
                <p className="mt-0.5 text-xs text-muted">{s.time}</p>
              </div>
              <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${s.done ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>
                {s.done ? <CheckCircle2 size={12} /> : <Clock size={12} />}{s.status}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-muted">
          {['3 pins a day', 'Best times', 'Live status'].map((t) => <div key={t} className="rounded-lg bg-stone-50 py-2">{t}</div>)}
        </div>
      </div>
    </section>
  )
}
