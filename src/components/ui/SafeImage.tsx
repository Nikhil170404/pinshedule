'use client'

import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/** An <img> that never shows the browser's broken-image icon: it falls back to a neutral placeholder. */
export function SafeImage({ src, alt = '', className, iconSize = 18 }: { src?: string | null; alt?: string; className?: string; iconSize?: number }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-stone-100 text-stone-400', className)} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
        <ImageOff size={iconSize} aria-hidden />
      </div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn('bg-stone-100 object-cover', className)} />
}
