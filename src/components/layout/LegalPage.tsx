import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: { title: string; body: string[] }[] }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 md:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
        <div className="mt-8 space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="mb-2 text-lg font-semibold text-ink">{s.title}</h2>
              <div className="space-y-3 text-[15px] leading-7 text-stone-600">{s.body.map((p) => <p key={p}>{p}</p>)}</div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  )
}
