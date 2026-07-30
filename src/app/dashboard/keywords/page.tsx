'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { Search, Plus, TrendingUp } from 'lucide-react'

interface Keyword { keyword: string; trend_type: string; weekly_trend?: number }

export default function KeywordsPage() {
  const [query, setQuery] = useState('')
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string[]>([])

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/keywords?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setKeywords(data.keywords ?? [])
      if (!data.keywords?.length) toast.info('No trending keywords found. Try a broader topic.')
    } catch {
      toast.error('Keyword search failed. Is your Pinterest connected?')
    }
    setLoading(false)
  }

  function addKeyword(kw: string) {
    if (copied.includes(kw)) return
    setCopied([...copied, kw])
    navigator.clipboard.writeText(kw).catch(() => {})
    toast.success(`"${kw}" copied!`)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pinterest Keyword Tool</h1>
        <p className="text-gray-500 text-sm mt-0.5">Find what people search for on Pinterest in your niche</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex gap-3">
        <div className="flex-1">
          <Input
            placeholder="Enter your niche (e.g. home decor ideas)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
        </div>
        <Button onClick={search} loading={loading} className="shrink-0">
          <Search size={15} />
          Search
        </Button>
      </div>

      {keywords.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <TrendingUp size={15} className="text-[#E60023]" />
            {keywords.length} trending keywords
          </p>
          <div className="grid gap-2">
            {keywords.map((kw) => (
              <div
                key={kw.keyword}
                className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#E60023]" />
                  <span className="text-sm font-medium text-gray-800">{kw.keyword}</span>
                  {kw.weekly_trend && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${kw.weekly_trend > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      {kw.weekly_trend > 0 ? '+' : ''}{kw.weekly_trend}%
                    </span>
                  )}
                </div>
                <button
                  onClick={() => addKeyword(kw.keyword)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    copied.includes(kw.keyword)
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-[#E60023] hover:bg-red-100'
                  }`}
                >
                  <Plus size={13} />
                  {copied.includes(kw.keyword) ? 'Copied' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
        <p className="text-sm font-semibold text-amber-800 mb-2">How to use keywords</p>
        <ul className="space-y-1.5 text-xs text-amber-700">
          <li>• Copy keywords and paste them into your pin description</li>
          <li>• Use 5-10 relevant keywords per pin</li>
          <li>• Put the most important keyword in your pin title too</li>
          <li>• Trending = currently searched — use these for best reach</li>
        </ul>
      </div>
    </div>
  )
}
