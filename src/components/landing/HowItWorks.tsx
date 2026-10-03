const steps = [
  { title: 'Connect Pinterest', text: 'Sign in with your Pinterest account. That is your Pinshedule login, so there is no password to manage.' },
  { title: 'Add your pins', text: 'Upload images, import a CSV, or paste a page from your site. Review and edit the titles and descriptions.' },
  { title: 'Choose the pace', text: 'Pick a board, then a fixed interval or best-time slots. Pinshedule publishes while you do other work.' },
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <h2 className="mb-10 text-3xl font-semibold tracking-tight text-ink">From idea to scheduled in minutes</h2>
      <ol className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{i + 1}</span>
            <div>
              <h3 className="text-base font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
