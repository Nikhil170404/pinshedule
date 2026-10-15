import { AtSign, Mail } from 'lucide-react'
import { COMPANY } from '@shared/company'

/** One-line help text for the sign-in page. */
export function SupportLine({ className }: { className?: string }) {
  return (
    <p className={className ?? 'mt-5 text-center text-xs leading-relaxed text-muted'}>
      Need help? Email{' '}
      <a href={`mailto:${COMPANY.supportEmail}`} className="font-medium text-ink underline-offset-2 hover:underline">{COMPANY.supportEmail}</a>
      {' '}or message{' '}
      <a href={COMPANY.instagramUrl} target="_blank" rel="noopener noreferrer me" className="font-medium text-ink underline-offset-2 hover:underline">@{COMPANY.instagramHandle}</a>
      {' '}on Instagram.
    </p>
  )
}

/** Both support channels as cards, for the dashboard Support page. */
export function SupportCards() {
  const card = 'flex items-start gap-3 rounded-xl border border-line bg-white p-4 transition-colors hover:bg-stone-50'
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <a href={`mailto:${COMPANY.supportEmail}`} className={card}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Mail size={18} aria-hidden /></span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">Email support</span>
          <span className="block break-all text-sm text-stone-600">{COMPANY.supportEmail}</span>
          <span className="mt-1 block text-xs text-muted">Billing, invoices, refunds, account and bug reports.</span>
        </span>
      </a>
      <a href={COMPANY.instagramUrl} target="_blank" rel="noopener noreferrer me" className={card}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><AtSign size={18} aria-hidden /></span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">Instagram</span>
          <span className="block text-sm text-stone-600">@{COMPANY.instagramHandle}</span>
          <span className="mt-1 block text-xs text-muted">Send a direct message for quick questions.</span>
        </span>
      </a>
    </div>
  )
}
