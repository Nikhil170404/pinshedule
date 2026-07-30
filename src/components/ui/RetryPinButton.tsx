'use client'

import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function RetryPinButton({ pinId }: { pinId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function retry() {
    setLoading(true)
    const supabase = createClient()
    await supabase
      .from('scheduled_pins')
      .update({ status: 'pending', error_message: null })
      .eq('id', pinId)
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={retry}
      disabled={loading}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-[#E60023] transition-colors disabled:opacity-50 mt-1"
      title="Reset to pending — the next cron run will retry publishing"
    >
      <RotateCcw size={11} className={loading ? 'animate-spin' : ''} />
      Retry
    </button>
  )
}
