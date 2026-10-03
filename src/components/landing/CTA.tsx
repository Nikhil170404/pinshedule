import Link from 'next/link'
import Image from 'next/image'
import { buttonStyles } from '@/components/ui/button-styles'
import { examplePins } from './example-pins'

const tilt = ['-rotate-6', '-rotate-3', 'rotate-0', 'rotate-3', 'rotate-6']

export function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 md:pb-24">
      <div className="rounded-2xl bg-ink px-6 py-12 text-center sm:px-12">
        <div className="mb-8 flex justify-center -space-x-3" aria-hidden>
          {examplePins.slice(0, 5).map((p, i) => (
            <Image key={p.src} src={p.src} alt="" width={120} height={180} className={`h-24 w-16 rounded-lg border-2 border-white object-cover sm:h-28 sm:w-[4.5rem] ${tilt[i]}`} />
          ))}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Fill your Pinterest queue this afternoon</h2>
        <p className="mx-auto mt-3 max-w-xl text-stone-300">Connect your account and schedule your first batch of pins in a few minutes.</p>
        <Link href="/login" className={`${buttonStyles('primary', 'lg')} mt-7`}>Start free with Pinterest</Link>
      </div>
    </section>
  )
}
