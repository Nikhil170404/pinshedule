import { cn } from '@/lib/utils'

export const buttonStyles = (
  variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' = 'primary',
  size: 'sm' | 'md' | 'lg' = 'md'
) =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap select-none transition-colors',
    'disabled:opacity-50 disabled:pointer-events-none',
    {
      primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-stone-200 disabled:text-stone-400 disabled:opacity-100',
      secondary: 'bg-stone-100 text-ink hover:bg-stone-200',
      ghost: 'text-stone-600 hover:bg-stone-100 hover:text-ink',
      danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-stone-200 disabled:text-stone-400 disabled:opacity-100',
      outline: 'border border-line bg-white text-ink hover:bg-stone-50',
    }[variant],
    { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-[15px]' }[size]
  )
