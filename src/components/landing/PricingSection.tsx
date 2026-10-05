'use client'

import Link from 'next/link'
import { useState } from 'react'
import { buttonStyles } from '@/components/ui/button-styles'
import { CycleToggle, PlanCards } from '@/components/pricing/PlanCards'
import type { BillingCycle } from '@/types'

export function PricingSection() {
  const [cycle, setCycle] = useState<BillingCycle>('yearly')
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-ink">Simple pricing for one account or a hundred</h2>
          <p className="mt-3 max-w-xl text-stone-600">No per-credit charges and no surprises. Start free and upgrade when you need more pins.</p>
        </div>
        <CycleToggle cycle={cycle} onChange={setCycle} />
      </div>
      <PlanCards cycle={cycle} renderCta={(p) => (
        <Link href="/login" className={`${buttonStyles(p.id === 'pro' ? 'primary' : 'outline', 'md')} w-full`}>{p.id === 'free_trial' ? 'Start free' : `Get ${p.name}`}</Link>
      )} />
      <p className="mt-6 text-sm text-muted">Yearly plans bill once a year and include two months free. Cancel any time and keep access until the period ends.</p>
    </section>
  )
}
