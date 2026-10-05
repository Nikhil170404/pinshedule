import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const field =
  'w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-stone-500 ' +
  'focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-200 disabled:bg-stone-50 disabled:text-stone-400'

export function Field({ label, hint, error, htmlFor, children, className }: {
  label?: string; hint?: string; error?: string; htmlFor?: string; children: ReactNode; className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}</label>}
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; hint?: string; error?: string; wrapperClassName?: string }

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, hint, error, className, wrapperClassName, id, ...props }, ref) => {
  const auto = useId()
  const fid = id ?? auto
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fid} className={wrapperClassName}>
      <input ref={ref} id={fid} className={cn(field, 'h-10', error && 'border-red-400', className)} {...props} />
    </Field>
  )
})
Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string; hint?: string; error?: string; wrapperClassName?: string }

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, hint, error, className, wrapperClassName, id, ...props }, ref) => {
  const auto = useId()
  const fid = id ?? auto
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fid} className={wrapperClassName}>
      <textarea ref={ref} id={fid} className={cn(field, 'py-2.5 resize-y min-h-[88px]', error && 'border-red-400', className)} {...props} />
    </Field>
  )
})
Textarea.displayName = 'Textarea'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: string; hint?: string; error?: string; wrapperClassName?: string }

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, hint, error, className, wrapperClassName, id, children, ...props }, ref) => {
  const auto = useId()
  const fid = id ?? auto
  return (
    <Field label={label} hint={hint} error={error} htmlFor={fid} className={wrapperClassName}>
      <div className="relative">
        <select ref={ref} id={fid} className={cn(field, 'h-10 appearance-none pr-9', error && 'border-red-400', className)} {...props}>
          {children}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden />
      </div>
    </Field>
  )
})
Select.displayName = 'Select'
