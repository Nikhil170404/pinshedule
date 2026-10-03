import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export function LogoMark({ size = 32 }: { size?: number }) {
  return <Image src="/logo-mark.png" alt="" width={size} height={size} className="shrink-0" priority />
}

export function Logo({ href = '/', className, showText = true }: { href?: string; className?: string; showText?: boolean }) {
  return (
    <Link href={href} className={cn('flex items-center gap-2.5', className)} aria-label="GoPinKaro home">
      <LogoMark />
      {showText && (
        <span className="text-[15px] font-bold tracking-tight text-ink">
          Go<span className="text-brand">Pin</span>Karo
        </span>
      )}
    </Link>
  )
}
