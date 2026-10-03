'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Copy, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/button-styles'
import { Card, Meter, PageHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { api, ApiError, errorText } from '@/lib/api'
import { refreshSummary, useSummary } from '@/lib/hooks'

interface Option { title: string; description: string }

export default function AiWriterPage() {
  const { summary } = useSummary()
  const [topic, setTopic] = useState('')
  const [options, setOptions] = useState<Option[]>([])
  const [busy, setBusy] = useState(false)

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    if (topic.trim().length < 2) return toast.error('Describe the pin in a few words.')
    setBusy(true)
    try {
      const r = await api<{ options: Option[] }>('/ai/caption', { body: { topic: topic.trim() } })
      setOptions(r.options)
      void refreshSummary()
    } catch (err) {
      toast.error(errorText(err), err instanceof ApiError && err.upgradeRequired ? { action: { label: 'Upgrade', onClick: () => (window.location.href = '/dashboard/upgrade') } } : undefined)
    }
    setBusy(false)
  }

  const copy = (o: Option) => navigator.clipboard.writeText(`${o.title}\n\n${o.description}`).then(() => toast.success('Copied.'))

  return (
    <div className="max-w-2xl">
      <PageHeader title="AI writer" description="Describe your pin and get three search-friendly titles and descriptions." />
      <Card className="mb-5 p-4 sm:p-5">
        <form onSubmit={generate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input className="flex-1" label="What is the pin about?" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={300} placeholder="Healthy meal prep for busy weeknights" />
          <Button type="submit" size="lg" loading={busy}>{!busy && <Wand2 size={16} aria-hidden />} Write</Button>
        </form>
        {summary && <div className="mt-4"><Meter label="AI generations this month" value={summary.used.ai} max={summary.limits.ai} /></div>}
      </Card>

      <div className="space-y-3">
        {options.map((o, i) => (
          <Card key={i} className="p-4">
            <p className="text-sm font-semibold text-ink">{o.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{o.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/dashboard/schedule?title=${encodeURIComponent(o.title)}&description=${encodeURIComponent(o.description)}`} className={buttonStyles('outline', 'sm')}>Use in a new pin</Link>
              <Button variant="ghost" size="sm" onClick={() => copy(o)}><Copy size={14} aria-hidden /> Copy</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
