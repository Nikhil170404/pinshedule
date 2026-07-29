const testimonials = [
  {
    name: 'Priya Sharma',
    role: 'Etsy seller, Mumbai',
    avatar: 'PS',
    color: '#E60023',
    text: 'I went from 200 to 2,400 monthly visitors in 3 months just by scheduling consistently. PinScheduleKaro made that actually possible.',
  },
  {
    name: 'Ananya Kapoor',
    role: 'Food blogger, Bangalore',
    avatar: 'AK',
    color: '#7C3AED',
    text: 'The AI captions are genuinely good. I used to spend 30 minutes writing pin descriptions. Now it takes 30 seconds. I\'m not going back.',
  },
  {
    name: 'Rahul Mehta',
    role: 'Shopify store owner, Delhi',
    avatar: 'RM',
    color: '#059669',
    text: 'Tailwind was ₹1,400/mo and confusing. PinScheduleKaro is ₹399/mo and I set it up in an afternoon. Simple choice.',
  },
]

export function Testimonials() {
  return (
    <section className="py-20 md:py-28 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-[#E60023] uppercase tracking-wider mb-3">What creators say</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
            Real results, real people
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map(({ name, role, avatar, color, text }, i) => (
            <div
              key={name}
              className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, j) => (
                  <svg key={j} width="14" height="14" viewBox="0 0 24 24" fill="#E60023">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                ))}
              </div>

              <p className="text-gray-700 leading-relaxed mb-5 text-sm">"{text}"</p>

              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: color }}
                >
                  {avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{name}</p>
                  <p className="text-xs text-gray-500">{role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof bar */}
        <div className="mt-12 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col sm:flex-row items-center justify-center gap-8">
          {[
            { val: '1,000+', label: 'Active creators' },
            { val: '2.4M+', label: 'Pins scheduled' },
            { val: '4.8/5', label: 'Average rating' },
          ].map(({ val, label }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold text-gray-900">{val}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
