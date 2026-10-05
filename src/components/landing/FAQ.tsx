import { ChevronDown } from 'lucide-react'

const faqs = [
  { q: 'Why do I sign in with Pinterest?', a: 'GoPinKaro publishes through the official Pinterest API, so connecting your account is the only step. Your Pinterest account is your login and there is no separate password.' },
  { q: 'Will scheduling get my account in trouble?', a: 'GoPinKaro only uses Pinterest\'s official API. Pinterest rewards steady, original pinning, so we space pins out, avoid on-the-hour posting and suggest a few pins a day rather than large bursts. You stay responsible for following Pinterest\'s community guidelines.' },
  { q: 'How are the best times chosen?', a: 'From general Pinterest patterns: evening and afternoon hours in your own timezone, with small minute offsets so pins do not land on the hour. It is not personalised to your audience, so use a fixed interval or pick exact times if you know your audience is active at other hours.' },
  { q: 'Can GoPinKaro design my pins?', a: 'Yes, with templates. The pin designer has four layouts and six color sets, lets you add your own photo, and saves a 1000 x 1500 image you can schedule straight away. For fully custom artwork, design in Canva and upload it.' },
  { q: 'What image size works best?', a: 'Vertical images with a 2:3 ratio, such as 1000 by 1500 pixels. JPG, PNG, WEBP and GIF files up to 20 MB are supported.' },
  { q: 'What happens when a pin fails?', a: 'Temporary Pinterest errors are retried automatically with increasing delays. If a pin still cannot be published you see the reason in your Pins list and can fix it and retry in one click.' },
  { q: 'Can I connect more than one Pinterest account?', a: 'Each GoPinKaro login is tied to one Pinterest account. Use a separate login for each account you manage.' },
  { q: 'Can I cancel any time?', a: 'Yes. Cancel from Plan and billing and you keep your plan until the end of the period you paid for. Your scheduled pins stay in your queue.' },
  { q: 'Is GoPinKaro affiliated with Pinterest?', a: 'No. GoPinKaro is an independent product that uses the public Pinterest API.' },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
}

export function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <h2 className="mb-8 text-3xl font-semibold tracking-tight text-ink">Questions</h2>
      <div className="divide-y divide-line rounded-xl border border-line bg-white">
        {faqs.map((f) => (
          <details key={f.q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
              {f.q}<ChevronDown size={16} className="shrink-0 text-stone-400 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
