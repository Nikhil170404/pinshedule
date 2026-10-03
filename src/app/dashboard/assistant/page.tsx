'use client'

import { PageHeader } from '@/components/ui/Card'
import { AssistantChat } from '@/components/assistant/AssistantChat'

export default function AssistantPage() {
  return (
    <div>
      <PageHeader title="Assistant" description="Tell it what you want done. It plans, you confirm." />
      <AssistantChat className="h-[calc(100dvh-14rem)] min-h-[420px] overflow-hidden rounded-xl border border-line lg:h-[calc(100dvh-12rem)]" />
    </div>
  )
}
