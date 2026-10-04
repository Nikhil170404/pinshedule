'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { checkPinImage, RECOMMENDED, type ImageFacts } from '@/lib/pin-checks'
import { CheckList } from './CheckList'

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a }

export function ImageChecker() {
  const [facts, setFacts] = useState<(ImageFacts & { name: string }) | null>(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function read(file: File | undefined) {
    if (!file) return
    setError('')
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setPreview(url)
      setFacts({ width: img.naturalWidth, height: img.naturalHeight, bytes: file.size, type: file.type, name: file.name })
    }
    img.onerror = () => { URL.revokeObjectURL(url); setFacts(null); setError('That file could not be read as an image.') }
    img.src = url
  }

  const checks = useMemo(() => (facts ? checkPinImage(facts) : []), [facts])
  const g = facts ? gcd(facts.width, facts.height) : 1

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-white p-5">
        <button type="button" onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); read(e.dataTransfer.files[0]) }}
          className="flex min-h-56 w-full flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 p-6 text-center hover:bg-stone-50">
          {preview && facts ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob preview; next/image cannot optimise it
            <img src={preview} alt={`Preview of ${facts.name}`} className="max-h-72 w-auto rounded-lg" />
          ) : (
            <><ImagePlus size={26} className="mb-3 text-stone-400" aria-hidden /><span className="text-sm font-medium text-ink">Choose or drop an image</span><span className="mt-1 text-xs text-muted">JPG, PNG, WEBP or GIF</span></>
          )}
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" aria-label="Choose an image to check" onChange={(e) => read(e.target.files?.[0])} />
        <p className="mt-3 text-xs text-muted">The image stays on your device. It is read by your browser and never uploaded.</p>
      </div>
      <div className="rounded-xl border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Result</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!facts && !error && <p className="text-sm text-muted">Add an image to see its size, shape and what to improve.</p>}
        {facts && (
          <>
            <dl className="mb-4 grid grid-cols-3 gap-3 text-sm">
              <div><dt className="text-xs text-muted">Size</dt><dd className="font-medium tabular-nums text-ink">{facts.width} x {facts.height}</dd></div>
              <div><dt className="text-xs text-muted">Shape</dt><dd className="font-medium tabular-nums text-ink">{facts.width / g > 40 ? (facts.width / facts.height).toFixed(2) + ' : 1' : `${facts.width / g}:${facts.height / g}`}</dd></div>
              <div><dt className="text-xs text-muted">File</dt><dd className="font-medium tabular-nums text-ink">{(facts.bytes / 1048576).toFixed(2)} MB</dd></div>
            </dl>
            <CheckList checks={checks} />
            <p className="mt-4 text-xs text-muted">Recommended: {RECOMMENDED.width} x {RECOMMENDED.height} pixels (2:3).</p>
          </>
        )}
      </div>
    </div>
  )
}
