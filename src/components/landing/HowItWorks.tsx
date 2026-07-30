const steps = [
  {
    number: '01',
    title: 'Connect Pinterest',
    desc: 'One-click OAuth. Secure, official Pinterest API. Takes 30 seconds.',
    detail: 'We use Pinterest\'s official API — your account is always safe.',
  },
  {
    number: '02',
    title: 'Create your pins',
    desc: 'Upload images, let AI write your captions, pick your board and time.',
    detail: 'AI generates 3 caption options. You pick and edit. Done in seconds.',
  },
  {
    number: '03',
    title: 'Grow on autopilot',
    desc: 'Pins publish automatically at the right time. Track results live.',
    detail: 'See impressions, saves, and clicks for every pin you schedule.',
  },
]

export function HowItWorks() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-[#E60023] uppercase tracking-wider mb-3">How it works</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-4">
            3 steps to more Pinterest traffic
          </h2>
          <p className="text-lg text-gray-500 max-w-lg mx-auto">
            From signup to first scheduled pin in under 5 minutes. No tutorials needed.
          </p>
        </div>

        <div className="relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

          <div className="grid md:grid-cols-3 gap-8 md:gap-6">
            {steps.map(({ number, title, desc, detail }, i) => (
              <div
                key={number}
                className="relative text-center group animate-fade-in-up"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                {/* Number badge */}
                <div className="relative inline-flex items-center justify-center mb-6">
                  <div className="absolute inset-0 rounded-full bg-[#E60023] opacity-10 scale-150" />
                  <div className="w-16 h-16 rounded-full bg-[#E60023] flex items-center justify-center shadow-lg shadow-red-200 group-hover:scale-105 transition-transform duration-300">
                    <span className="text-xl font-bold text-white">{number}</span>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-600 mb-3 leading-relaxed">{desc}</p>
                <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-2.5">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
