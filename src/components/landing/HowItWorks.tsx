import Image from 'next/image'
import { CheckCircle2, Clock } from 'lucide-react'
import { examplePins } from './example-pins'

const frame = 'mb-5 flex h-40 items-center justify-center rounded-xl border border-line bg-stone-50'

const steps = [
  {
    title: 'Connect Pinterest',
    text: 'Sign in with your Pinterest account. That is your GoPinKaro login, so there is no password to manage.',
    visual: (
      <div className={frame}>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
          <Image src="/logo-mark.png" alt="" width={36} height={36} />
          <div>
            <p className="text-sm font-semibold text-ink">Pinterest account</p>
            <p className="flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 size={12} aria-hidden />Connected</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Add your pins',
    text: 'Upload images, import a CSV, or paste a page from your site. Review and edit the titles and descriptions.',
    visual: (
      <div className={`${frame} gap-3`}>
        {examplePins.slice(3, 6).map((p) => (
          <Image key={p.src} src={p.src} alt="" width={160} height={240} className="h-28 w-auto rounded-lg border border-line" />
        ))}
      </div>
    ),
  },
  {
    title: 'Choose the pace',
    text: 'Pick a board, then a fixed interval or best-time slots. GoPinKaro publishes while you do other work.',
    visual: (
      <div className={`${frame} flex-col gap-2`}>
        {examplePins.slice(0, 3).map((p) => (
          <div key={p.src} className="flex w-52 items-center gap-2 rounded-lg border border-line bg-white px-2 py-1.5">
            <Image src={p.src} alt="" width={40} height={60} className="h-7 w-5 rounded-sm object-cover" />
            <span className="flex items-center gap-1 text-xs font-medium text-sky-700"><Clock size={12} aria-hidden />{p.time}</span>
          </div>
        ))}
      </div>
    ),
  },
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <h2 className="mb-10 text-3xl font-semibold tracking-tight text-ink">From idea to scheduled in minutes</h2>
      <ol className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <div aria-hidden>{s.visual}</div>
            <div className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{i + 1}</span>
              <div>
                <h3 className="text-base font-semibold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{s.text}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
