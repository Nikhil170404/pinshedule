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

type Verified = Record<string, unknown> & { error?: string }

function open<T>(options: Record<string, unknown>, verifyPath: string, map: (r: Verified) => T): Promise<T | null> {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) return reject(new Error('Payment form is still loading. Try again in a moment.'))
    const rzp = new window.Razorpay({
      ...options,
      name: 'GoPinKaro',
      theme: { color: '#e60023' },
      modal: { ondismiss: () => resolve(null) },
      handler: async (r: Record<string, string>) => {
        try {
          const res = await api<Verified>(verifyPath, { body: r })
          // The worker answers 202 with a message while Razorpay is still confirming: say so instead of claiming success.
          if (typeof res.error === 'string') throw new Error(res.error)
          resolve(map(res))
        } catch (e) { reject(e) }
      },
    })
    rzp.open()
  })
}

/**
 * Open Razorpay Checkout for a subscription the worker created, then confirm the signed result with the worker.
 * Resolves to null when the customer closes the window without paying. Rejects if the payment could not be confirmed.
 */
export function openRazorpay(o: { subscriptionId: string; keyId: string; description: string }): Promise<VerifyResult | null> {
  return open({ key: o.keyId, subscription_id: o.subscriptionId, description: o.description }, '/billing/verify', (r) => r as unknown as VerifyResult)
}

/** One-time payment for the prorated difference of an upgrade. Resolves to true once the new plan is active. */
export function openUpgradePayment(o: { orderId: string; amount: number; currency: string; keyId: string; description: string }): Promise<boolean | null> {
  return open({ key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency, description: o.description }, '/billing/upgrade/verify', (r) => r.ok === true)
}

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
