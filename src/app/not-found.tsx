import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { buttonStyles } from '@/components/ui/button-styles'

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-20 text-center outline-none">
        <p className="text-sm font-semibold text-brand">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">We could not find that page</h1>
        <p className="mt-3 text-stone-600">The link may be old or mistyped. Here are some places to go instead.</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className={buttonStyles('primary', 'lg')}>Go to the home page</Link>
          <Link href="/pinterest-scheduler" className={buttonStyles('outline', 'lg')}>Pinterest scheduler</Link>
          <Link href="/dashboard" className={buttonStyles('outline', 'lg')}>Open the app</Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
