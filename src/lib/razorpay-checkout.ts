import { api } from '@/lib/api'

declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } }
}

export interface VerifyResult {
  ok: boolean
  /** applied: active now. pending: authorised, starts later. */
  state: 'applied' | 'pending' | 'ending' | 'duplicate' | 'ignored'
  plan: string
}

/**
 * Open Razorpay Checkout for a subscription the worker created, then confirm the signed result with the worker.
 * Resolves to null when the customer closes the window without paying. Rejects if the payment itself could not be confirmed.
 */
export function openRazorpay(o: { subscriptionId: string; keyId: string; description: string }): Promise<VerifyResult | null> {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) return reject(new Error('Payment form is still loading. Try again in a moment.'))
    const rzp = new window.Razorpay({
      key: o.keyId,
      subscription_id: o.subscriptionId,
      name: 'GoPinKaro',
      description: o.description,
      theme: { color: '#e60023' },
      modal: { ondismiss: () => resolve(null) },
      handler: async (r: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
        try { resolve(await api<VerifyResult & Record<string, unknown>>('/billing/verify', { body: r })) } catch (e) { reject(e) }
      },
    })
    rzp.open()
  })
}

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
