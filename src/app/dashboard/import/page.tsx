'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import {
  Globe, Sparkles, Check, ChevronDown, AlertTriangle, RefreshCw, X, Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIResult {
  titles: string[]
  description: string
  keywords: string[]
  alt_text: string
}

interface ImportResult {
  page_title: string
  og_image: string | null
  images: string[]
  ai: AIResult
  is_duplicate: boolean
}

function localDatetimeMin() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export default function ImportPage() {
  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  // Step 2 form state
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [chosenTitle, setChosenTitle] = useState('')
  const [description, setDescription] = useState('')
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([])
  const [boardsLoaded, setBoardsLoaded] = useState(false)
  const [board, setBoard] = useState('')
  const [startTime, setStartTime] = useState('')
  const [scheduling, setScheduling] = useState(false)

  async function handleImport() {
    if (!url.trim() || !/^https?:\/\//.test(url.trim())) {
      toast.error('Enter a valid URL starting with https://')
      return
    }
    setImporting(true)
    setResult(null)
    try {
      const res = await fetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResult(data)

      // Pre-select og:image or first image
      const firstImg = data.og_image ?? data.images[0]
      if (firstImg) setSelectedImages(new Set([firstImg]))

      setChosenTitle(data.ai.titles[0] ?? data.page_title ?? '')
      setDescription(data.ai.description ?? '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    }
    setImporting(false)
  }

  function toggleImage(src: string) {
    setSelectedImages((prev) => {
      const next = new Set(prev)
      if (next.has(src)) next.delete(src)
      else next.add(src)
      return next
    })
  }

  async function loadBoards() {
    if (boardsLoaded) return
    try {
      const res = await fetch('/api/boards')
      const data = await res.json()
      setBoards(data.boards ?? [])
      setBoardsLoaded(true)
    } catch {
      toast.error('Could not load boards. Is Pinterest connected?')
    }
  }

  async function handleSchedule() {
    const images = [...selectedImages]
    if (images.length === 0) { toast.error('Select at least one image'); return }
    if (!board) { toast.error('Select a board'); return }
    if (!startTime) { toast.error('Set a start time'); return }

    setScheduling(true)
    try {
      // Build pins with 2-hour gaps
      let slotTime = new Date(startTime)
      const boardName = boards.find((b) => b.id === board)?.name
      const pins = images.map((imageUrl, i) => {
        if (i > 0) slotTime = new Date(slotTime.getTime() + 2 * 60 * 60 * 1000)
        return {
          image_url: imageUrl,
          title: chosenTitle,
          description,
          board_id: board,
          board_name: boardName,
          destination_url: url.trim(),
          scheduled_at: slotTime.toISOString(),
        }
      })

      const res = await fetch('/api/pins/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pins),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scheduling failed')

      toast.success(`${pins.length} pin${pins.length > 1 ? 's' : ''} scheduled!`)

      // Reset
      setResult(null)
      setUrl('')
      setSelectedImages(new Set())
      setChosenTitle('')
      setDescription('')
      setBoard('')
      setStartTime('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scheduling failed')
    }
    setScheduling(false)
  }

  const allImages = result ? [
    ...(result.og_image && !result.images.includes(result.og_image) ? [result.og_image] : []),
    ...result.images,
  ] : []

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Website → Pins</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Paste any URL — we extract images and write your pin copy automatically
        </p>
      </div>

      {/* URL input */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="https://yourblog.com/post-title"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              label="Page URL"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleImport} loading={importing} disabled={!url.trim()}>
              <Globe size={15} />
              Import
            </Button>
          </div>
        </div>

        {importing && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <RefreshCw size={14} className="animate-spin" />
            Fetching page and generating Pinterest copy…
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {result.is_duplicate && (
            <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={15} className="shrink-0" />
              You&apos;ve already scheduled a pin from this URL. Duplicate pins can hurt your reach.
            </div>
          )}

          {/* Image selector */}
          {allImages.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Select images to pin
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  {selectedImages.size} selected · each becomes a separate pin
                </span>
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {allImages.map((src, i) => {
                  const selected = selectedImages.has(src)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleImage(src)}
                      className={cn(
                        'relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-150',
                        selected ? 'border-[#E60023] ring-2 ring-red-100' : 'border-gray-100 hover:border-gray-300'
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }}
                      />
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-[#E60023] rounded-full flex items-center justify-center">
                          <Check size={11} className="text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* AI title options */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-[#E60023]" />
              <p className="text-sm font-semibold text-gray-900">AI title options</p>
            </div>
            <div className="space-y-2">
              {result.ai.titles.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setChosenTitle(t)}
                  className={cn(
                    'w-full text-left text-sm px-4 py-3 rounded-xl border transition-all duration-150',
                    chosenTitle === t
                      ? 'border-[#E60023] bg-red-50 text-gray-900 font-medium'
                      : 'border-gray-100 hover:border-gray-200 text-gray-700'
                  )}
                >
                  {t}
                </button>
              ))}
              {/* Custom title input */}
              {!result.ai.titles.includes(chosenTitle) && chosenTitle && (
                <div className="relative">
                  <input
                    value={chosenTitle}
                    onChange={(e) => setChosenTitle(e.target.value)}
                    className="w-full text-sm px-4 py-3 rounded-xl border border-[#E60023] bg-red-50 text-gray-900 outline-none"
                    maxLength={100}
                  />
                  <button
                    type="button"
                    onClick={() => setChosenTitle(result.ai.titles[0] ?? '')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-400">Click to select, or type your own below</p>
              <input
                placeholder="Or write a custom title…"
                value={chosenTitle}
                onChange={(e) => setChosenTitle(e.target.value)}
                className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#E60023]"
                maxLength={100}
              />
            </div>

            <div className="pt-1">
              <p className="text-xs font-medium text-gray-500 mb-2">AI description</p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full text-sm px-4 py-3 rounded-xl border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#E60023] resize-none"
              />
            </div>

            {result.ai.keywords.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.ai.keywords.map((kw) => (
                    <span key={kw} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scheduling */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={15} className="text-[#E60023]" />
              <p className="text-sm font-semibold text-gray-900">Schedule</p>
              {selectedImages.size > 1 && (
                <span className="text-xs text-gray-400 ml-auto">
                  Pins auto-spaced 2 hrs apart
                </span>
              )}
            </div>

            {/* Board */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Board</label>
              <div className="relative">
                <select
                  value={board}
                  onChange={(e) => setBoard(e.target.value)}
                  onFocus={loadBoards}
                  className={cn(
                    'w-full rounded-xl border bg-white px-4 py-2.5 text-sm pr-9 min-h-[44px]',
                    'focus:outline-none focus:ring-2 focus:ring-[#E60023] focus:border-transparent transition-colors',
                    board ? 'border-gray-200 text-gray-900' : 'border-gray-200 text-gray-400'
                  )}
                >
                  <option value="">Select a board</option>
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Start time */}
            <Input
              label={selectedImages.size > 1 ? `Start time (first of ${selectedImages.size} pins)` : 'Schedule time'}
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              min={localDatetimeMin()}
            />

            <Button
              onClick={handleSchedule}
              loading={scheduling}
              size="lg"
              className="w-full"
              disabled={selectedImages.size === 0 || !board || !startTime}
            >
              Schedule {selectedImages.size > 1 ? `${selectedImages.size} pins` : 'pin'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
