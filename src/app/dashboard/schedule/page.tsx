'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { toast } from 'sonner'
import { useDropzone } from 'react-dropzone'
import { Upload, X, Sparkles, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// iOS Safari minimum date string helper — avoids the UTC vs local offset bug
// where new Date().toISOString() gives the wrong local time on iOS.
function localDatetimeMin() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export default function SchedulePage() {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [link, setLink] = useState('')
  const [board, setBoard] = useState('')
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([])
  const [scheduledAt, setScheduledAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiOptions, setAiOptions] = useState<string[]>([])
  const [boardsLoaded, setBoardsLoaded] = useState(false)

  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
    // noClick: false ensures tap-to-select works on iOS Safari
  })

  async function loadBoards() {
    if (boardsLoaded) return
    try {
      const res = await fetch('/api/boards')
      const data = await res.json()
      setBoards(data.boards ?? [])
      setBoardsLoaded(true)
    } catch {
      toast.error('Could not load boards. Is your Pinterest connected?')
    }
  }

  async function generateCaptions() {
    if (!title && !description) {
      toast.error('Add a title or describe your pin first')
      return
    }
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: title || description }),
      })
      const data = await res.json()
      setAiOptions(data.captions ?? [])
    } catch {
      toast.error('AI generation failed. Try again.')
    }
    setAiLoading(false)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!imageFile && !imagePreview) {
      toast.error('Upload an image first')
      return
    }
    if (!board) {
      toast.error('Select a board')
      return
    }
    if (!scheduledAt) {
      toast.error('Set a schedule time')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let imageUrl = imagePreview
      if (imageFile) {
        const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif']
        const ext = imageFile.name.split('.').pop()?.toLowerCase() ?? ''
        if (!allowedExts.includes(ext)) {
          toast.error('Only JPG, PNG, WEBP, or GIF images are allowed')
          setLoading(false)
          return
        }
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('pin-images')
          .upload(path, imageFile, { contentType: imageFile.type })
        if (uploadErr) throw uploadErr
        const { data: { publicUrl } } = supabase.storage.from('pin-images').getPublicUrl(path)
        imageUrl = publicUrl
      }

      const selectedBoard = boards.find((b) => b.id === board)
      const res = await fetch('/api/pins/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          title,
          description,
          board_id: board,
          board_name: selectedBoard?.name,
          destination_url: link || null,
          scheduled_at: new Date(scheduledAt).toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scheduling failed')

      toast.success('Pin scheduled!')
      setImageFile(null)
      setImagePreview('')
      setTitle('')
      setDescription('')
      setLink('')
      setBoard('')
      setScheduledAt('')
      setAiOptions([])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule pin')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Schedule a pin</h1>
        <p className="text-gray-500 text-sm mt-0.5">Upload, write, pick a board — done in 3 clicks</p>
      </div>

      {/* noValidate: we handle all validation in onSubmit with toast messages,
          so the browser never shows its own red :invalid borders */}
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {/* Image upload */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Image</p>
          {imagePreview ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Preview"
                className="rounded-2xl max-h-64 w-full object-cover border border-gray-100"
              />
              <button
                type="button"
                onClick={() => { setImagePreview(''); setImageFile(null) }}
                className="absolute top-2 right-2 w-8 h-8 bg-gray-900/70 text-white rounded-full flex items-center justify-center hover:bg-gray-900 transition-colors"
                aria-label="Remove image"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200',
                // Larger tap target on mobile
                'min-h-[120px] flex flex-col items-center justify-center',
                isDragActive
                  ? 'border-[#E60023] bg-red-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100'
              )}
            >
              <input {...getInputProps()} />
              <Upload size={24} className="text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 font-medium">
                {isDragActive ? 'Drop it here' : 'Tap to upload or drag & drop'}
              </p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP · max 20 MB</p>
            </div>
          )}
        </div>

        {/* Title */}
        <Input
          label="Title"
          placeholder="e.g. 10 Easy Home Decor Ideas on a Budget"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          hint="Keep it under 100 characters"
          autoCapitalize="words"
          autoCorrect="on"
        />

        {/* Description + AI */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <button
              type="button"
              onClick={generateCaptions}
              disabled={aiLoading}
              className="flex items-center gap-1.5 text-xs text-[#E60023] font-medium hover:underline disabled:opacity-50 min-h-[44px] px-1"
            >
              <Sparkles size={13} />
              {aiLoading ? 'Generating…' : 'AI generate'}
            </button>
          </div>
          <Textarea
            placeholder="Describe your pin (150–200 chars, add hashtags)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            autoCapitalize="sentences"
            autoCorrect="on"
          />

          {/* AI options */}
          {aiOptions.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-500 font-medium">Pick one or edit:</p>
              {aiOptions.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDescription(opt)}
                  className="w-full text-left text-xs bg-gray-50 hover:bg-red-50 hover:border-red-200 active:bg-red-100 border border-gray-100 rounded-xl p-3 transition-colors leading-relaxed"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Destination URL */}
        <Input
          label="Destination URL (optional)"
          type="url"
          placeholder="https://your-blog.com/post"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="url"
        />

        {/* Board selector */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">Board</label>
          <div className="relative">
            <select
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              onFocus={loadBoards}
              className={cn(
                'w-full rounded-xl border bg-white px-4 py-2.5',
                'text-sm focus:outline-none focus:ring-2 focus:ring-[#E60023] focus:border-transparent',
                'pr-9 min-h-[44px] shadow-none transition-colors',
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

        {/* Schedule date & time */}
        <Input
          label="Schedule date & time"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          min={localDatetimeMin()}
          required
        />

        <Button type="submit" loading={loading} size="lg" className="w-full">
          Schedule pin
        </Button>
      </form>
    </div>
  )
}
