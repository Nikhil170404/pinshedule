import Link from 'next/link'
import { Pin } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg bg-brand text-white" style={{ width: size, height: size }}>
      <Pin size={size * 0.52} strokeWidth={2.25} aria-hidden />
    </span>
  )
}

export function Logo({ href = '/', className, showText = true }: { href?: string; className?: string; showText?: boolean }) {
  return (
    <Link href={href} className={cn('flex items-center gap-2.5', className)} aria-label="Pinshedule home">
      <LogoMark />
      {showText && <span className="text-[15px] font-semibold tracking-tight text-ink">Pinshedule</span>}
    </Link>
  )
}
