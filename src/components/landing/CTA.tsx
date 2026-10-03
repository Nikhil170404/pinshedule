import Link from 'next/link'
import { buttonStyles } from '@/components/ui/button-styles'

export function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 md:pb-24">
      <div className="rounded-2xl bg-ink px-6 py-12 text-center sm:px-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Fill your Pinterest queue this afternoon</h2>
        <p className="mx-auto mt-3 max-w-xl text-stone-300">Connect your account and schedule your first batch of pins in a few minutes.</p>
        <Link href="/login" className={`${buttonStyles('primary', 'lg')} mt-7`}>Start free with Pinterest</Link>
      </div>
    </section>
  )
}
