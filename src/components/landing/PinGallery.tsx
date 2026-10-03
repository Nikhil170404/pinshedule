import Image from 'next/image'
import { CheckCircle2, Clock } from 'lucide-react'
import { examplePins } from './example-pins'

export function PinGallery() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 md:pb-24">
      <div className="mb-8 max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight text-ink">One queue for every kind of pin</h2>
        <p className="mt-3 text-stone-600">Recipes, home, travel or products: add them once and GoPinKaro spaces them out across the week. These are example pins.</p>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {examplePins.map((p) => (
          <li key={p.src}>
            <Image src={p.src} alt={`Example pin: ${p.title}`} width={600} height={900} sizes="(min-width: 1024px) 180px, (min-width: 640px) 33vw, 50vw" className="h-auto w-full rounded-xl border border-line" />
            <p className={`mt-2 flex items-center gap-1 text-xs font-medium ${p.done ? 'text-emerald-700' : 'text-sky-700'}`}>
              {p.done ? <CheckCircle2 size={12} aria-hidden /> : <Clock size={12} aria-hidden />}{p.time}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
