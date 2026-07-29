import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { CreditCard, Zap, Calendar } from 'lucide-react'
import { PLANS } from '@/types'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan, trial_ends_at, razorpay_subscription_id')
    .eq('id', user!.id)
    .single()

  const plan = (profile?.plan ?? 'free_trial') as keyof typeof PLANS
  const planDetails = PLANS[plan]
  const isTrial = plan === 'free_trial'
  const trialEnd = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null

  return (
    <div className="space-y-6 animate-fade-in max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900">Billing</h1>

      {/* Current plan */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard size={16} className="text-[#E60023]" />
          <h2 className="font-semibold text-gray-900">Current plan</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-gray-900">{planDetails.name}</p>
              <Badge variant={isTrial ? 'warning' : 'success'}>
                {isTrial ? 'Trial' : 'Active'}
              </Badge>
            </div>
            {isTrial && trialEnd && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                <Calendar size={13} />
                Trial ends {trialEnd.toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
            {!isTrial && (
              <p className="text-sm text-gray-500 mt-1">
                ₹{planDetails.price_monthly.toLocaleString('en-IN')}/mo
              </p>
            )}
          </div>
          {!isTrial && (
            <Link href="/dashboard/upgrade">
              <Button variant="outline" size="sm">Change plan</Button>
            </Link>
          )}
        </div>

        {isTrial && (
          <Link href="/dashboard/upgrade">
            <Button className="w-full">
              <Zap size={15} />
              Upgrade now — from ₹399/mo
            </Button>
          </Link>
        )}
      </div>

      {/* Plan limits */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Your plan includes</h2>
        <div className="space-y-3">
          {[
            { label: 'Scheduled pins/month', value: planDetails.pins_per_month === 'unlimited' ? 'Unlimited' : planDetails.pins_per_month },
            { label: 'Pinterest accounts', value: planDetails.accounts },
            { label: 'AI captions/month', value: planDetails.ai_captions === 'unlimited' ? 'Unlimited' : planDetails.ai_captions },
            { label: 'Analytics', value: planDetails.analytics === 'full' ? 'Full dashboard' : 'Basic' },
            { label: 'Bulk CSV upload', value: planDetails.bulk_upload ? `Up to ${planDetails.bulk_limit} pins` : 'Not included' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment info */}
      <div className="bg-gray-50 rounded-2xl p-5 text-sm text-gray-600 space-y-1">
        <p>Payments are processed securely by <strong>Razorpay</strong>.</p>
        <p>We never store your card details.</p>
        <p>
          Questions?{' '}
          <a href="mailto:support@pinschedulekaro.com" className="text-[#E60023] hover:underline">
            support@pinschedulekaro.com
          </a>
        </p>
      </div>
    </div>
  )
}
