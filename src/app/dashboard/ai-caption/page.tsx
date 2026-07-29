'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { Sparkles, Copy, Check, RefreshCw } from 'lucide-react'

export default function AICaptionPage() {
  const [topic, setTopic] = useState('')
  const [captions, setCaptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)

  async function generate() {
    if (!topic.trim()) {
      toast.error('Enter a topic first')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Generation failed')
      }
      const data = await res.json()
      setCaptions(data.captions ?? [])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    }
    setLoading(false)
  }

  async function copy(text: string, i: number) {
    await navigator.clipboard.writeText(text)
    setCopied(i)
    toast.success('Copied!')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Caption Generator</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Describe your pin → get 3 SEO-optimised captions with hashtags
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <Input
          label="What is your pin about?"
          placeholder="e.g. Budget home decor ideas for small apartments"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          hint="The more specific you are, the better the captions"
        />
        <Button onClick={generate} loading={loading} className="w-full" size="lg">
          <Sparkles size={16} />
          Generate 3 captions
        </Button>
      </div>

      {captions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">3 caption options</p>
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Regenerate
            </button>
          </div>

          {captions.map((caption, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-[#E60023] bg-red-50 px-2 py-0.5 rounded-full">
                      Option {i + 1}
                    </span>
                    <span className="text-xs text-gray-400">{caption.length} chars</span>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed">{caption}</p>
                </div>
                <button
                  onClick={() => copy(caption, i)}
                  className="shrink-0 p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
                >
                  {copied === i ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          ))}

          <p className="text-xs text-gray-400 text-center pt-1">
            Click a caption to copy it, then paste into the Schedule form
          </p>
        </div>
      )}

      {/* Tips */}
      <div className="bg-gray-50 rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Tips for better captions</p>
        <ul className="space-y-2">
          {[
            'Include your niche (home decor, Etsy shop, food blog)',
            'Mention the target audience (moms, students, renters)',
            'Add the outcome ("save money", "in 10 minutes")',
            'Captions with 150-200 chars perform best on Pinterest',
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-xs text-gray-600">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E60023] mt-1.5 shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
