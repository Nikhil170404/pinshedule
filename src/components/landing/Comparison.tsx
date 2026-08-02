import { Check, X, Minus } from 'lucide-react'

const rows = [
  { feature: 'Pinterest-first tool', us: true, tailwind: true, buffer: false },
  { feature: 'AI captions included', us: true, tailwind: 'credits', buffer: false },
  { feature: 'Bulk upload', us: true, tailwind: true, buffer: false },
  { feature: 'Keyword tool', us: true, tailwind: false, buffer: false },
  { feature: 'Starting price', us: '$15/mo', tailwind: '$24.99/mo', buffer: '$18/channel' },
  { feature: 'Credit system', us: false, tailwind: true, buffer: false },
  { feature: 'Free trial (no card)', us: true, tailwind: false, buffer: false },
]

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <Check size={18} className="text-green-600 mx-auto" />
  if (value === false) return <X size={18} className="text-gray-300 mx-auto" />
  if (value === 'credits') return <Minus size={18} className="text-orange-400 mx-auto" />
  return <span className="text-sm font-semibold text-gray-700">{value}</span>
}

export function Comparison() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-[#E60023] uppercase tracking-wider mb-3">How we compare</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Simpler and cheaper — always
          </h2>
          <p className="text-gray-500">
            We built Pinshedule because Tailwind is expensive and confusing, and Buffer isn't really for Pinterest.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-4 text-left text-sm font-medium text-gray-500 w-1/2">Feature</th>
                <th className="px-4 py-4 text-center w-[18%]">
                  <div className="inline-flex flex-col items-center gap-1">
                    <div className="bg-[#E60023] text-white text-xs font-bold px-2.5 py-0.5 rounded-full">Us</div>
                    <span className="text-xs text-gray-500">Pinshedule</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-center text-sm font-medium text-gray-500 w-[18%]">Tailwind</th>
                <th className="px-4 py-4 text-center text-sm font-medium text-gray-500 w-[18%]">Buffer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ feature, us, tailwind, buffer }, i) => (
                <tr key={feature} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-5 py-3.5 text-sm text-gray-700">{feature}</td>
                  <td className="px-4 py-3.5 text-center bg-red-50/30">
                    <Cell value={us} />
                  </td>
                  <td className="px-4 py-3.5 text-center"><Cell value={tailwind} /></td>
                  <td className="px-4 py-3.5 text-center"><Cell value={buffer} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Prices as of July 2026. We update this table regularly.
        </p>
      </div>
    </section>
  )
}
