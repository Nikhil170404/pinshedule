import Link from 'next/link'
import { Card, PageHeader } from '@/components/ui/Card'
import { FIRST_PIN, TOPICS, TROUBLESHOOTING } from '@/content/help'

export default function HelpPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title="Help" description="Short guides for each part of GoPinKaro." />

      <Card className="p-5">
        <h2 className="text-base font-semibold text-ink">Schedule your first pin in five minutes</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-stone-700">{FIRST_PIN.map((s) => <li key={s}>{s}</li>)}</ol>
      </Card>

      <section aria-labelledby="guides">
        <h2 id="guides" className="mb-3 text-base font-semibold text-ink">Guides</h2>
        <div className="space-y-2">
          {TOPICS.map((t) => (
            <details key={t.id} className="group rounded-xl border border-line bg-white p-4 open:shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-medium text-ink">
                {t.title}<span className="mt-0.5 block text-xs font-normal text-muted">{t.summary}</span>
              </summary>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-stone-700">{t.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              {t.href && <Link href={t.href.to} className="mt-3 inline-block text-sm font-medium text-brand hover:underline">{t.href.label}</Link>}
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="fix">
        <h2 id="fix" className="mb-3 text-base font-semibold text-ink">When something goes wrong</h2>
        <div className="space-y-2">
          {TROUBLESHOOTING.map((f) => (
            <details key={f.q} className="rounded-xl border border-line bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-ink">{f.q}</summary>
              <p className="mt-2 text-sm text-stone-700">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="text-sm text-muted">Still stuck? Email <a className="font-medium text-brand hover:underline" href="mailto:support@pinshedule.com">support@pinshedule.com</a> and say which page you were on.</p>
    </div>
  )
}
