import { cn } from '@/lib/utils'
import { accountName, type AccountInfo } from '@/lib/accounts'

/** The Pinterest profile picture, or the first letter of the account's name when there is none. */
export function AccountAvatar({ account, size = 32, className }: { account: Pick<AccountInfo, 'avatar_url' | 'label' | 'username'> | null; size?: number; className?: string }) {
  const letter = (accountName(account).replace(/^@/, '')[0] ?? '?').toUpperCase()
  return account?.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={account.avatar_url} alt="" width={size} height={size} className={cn('shrink-0 rounded-full bg-stone-100 object-cover', className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-dark', className)}
      style={{ width: size, height: size, fontSize: size * 0.42 }}>{letter}</span>
  )
}
