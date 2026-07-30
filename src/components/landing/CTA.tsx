import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ArrowRight } from 'lucide-react'

export function CTA() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <div className="bg-gradient-to-br from-[#E60023] to-[#c0001d] rounded-3xl px-8 py-16 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
              Start scheduling today
            </h2>
            <p className="text-red-100 text-lg mb-8 max-w-md mx-auto">
              14-day free trial. No credit card. 5 minutes to set up. Your Pinterest growth starts now.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-white !text-[#E60023] hover:bg-red-50 shadow-xl w-full sm:w-auto group"
                >
                  Get started free
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  size="lg"
                  className="bg-transparent border border-white/40 text-white hover:bg-white/10 w-full sm:w-auto"
                >
                  See pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
