import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { CreditCard, Zap } from 'lucide-react'
import { PLANS } from '@/types'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan, razorpay_subscription_id')
    .eq('id', user!.id)
    .single()

  const plan = (profile?.plan ?? 'free_trial') as keyof typeof PLANS
  const planDetails = PLANS[plan]
  const isFree = plan === 'free_trial'

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
              <Badge variant={isFree ? 'default' : 'success'}>
                {isFree ? 'Free' : 'Active'}
              </Badge>
            </div>
            {!isFree && (
              <p className="text-sm text-gray-500 mt-1">
                ${planDetails.price_monthly_usd}/mo
              </p>
            )}
          </div>
          {!isFree && (
            <Link href="/dashboard/upgrade">
              <Button variant="outline" size="sm">Change plan</Button>
            </Link>
          )}
        </div>

        {isFree && (
          <Link href="/dashboard/upgrade">
            <Button className="w-full">
              <Zap size={15} />
              Upgrade — from $15/mo
            </Button>
          </Link>
        )}
      </div>

      {/* Plan limits */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Your plan includes</h2>
        <div className="space-y-3">
          {[
            { label: 'Pins/month', value: planDetails.pins_per_month.toLocaleString() },
            { label: 'Pinterest accounts', value: planDetails.accounts },
            { label: 'Website imports/month', value: planDetails.website_imports.toLocaleString() },
            { label: 'AI generations/month', value: planDetails.ai_generations.toLocaleString() },
            { label: 'AI image credits/month', value: planDetails.ai_image_credits || 'Not included' },
            { label: 'Bulk CSV upload', value: planDetails.bulk_upload ? 'Included' : 'Not included' },
            { label: 'Sitemap import', value: planDetails.sitemap_import ? 'Included' : 'Not included' },
            { label: 'Brand kit', value: planDetails.brand_kit ? 'Included' : 'Not included' },
            { label: 'Team seats', value: planDetails.team_users === 'unlimited' ? 'Unlimited' : planDetails.team_users },
            { label: 'White label', value: planDetails.white_label ? 'Included' : 'Not included' },
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
        <p>Payments are processed securely via Razorpay.</p>
        <p>We never store your card details.</p>
        <p>
          Questions?{' '}
          <a href="mailto:support@pinshedule.com" className="text-[#E60023] hover:underline">
            support@pinshedule.com
          </a>
        </p>
      </div>
    </div>
  )
}
