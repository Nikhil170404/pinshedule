'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { Bell, Trash2, RefreshCw } from 'lucide-react'

export default function SettingsPage() {
  const [pinterestUsername, setPinterestUsername] = useState('')
  const [pinterestAvatar, setPinterestAvatar] = useState<string | null>(null)
  const [timezone, setTimezone] = useState('')
  const [notifications, setNotifications] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const meta = user.user_metadata
      setPinterestUsername(meta?.pinterest_username ?? meta?.pinterest_id ?? '')
      setPinterestAvatar(meta?.pinterest_avatar ?? null)

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('timezone, notifications_enabled')
        .eq('id', user.id)
        .single()
      if (profile) {
        setTimezone(profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
        setNotifications(profile.notifications_enabled ?? true)
      }
    }
    load()
  }, [])

  async function saveProfile() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ id: user!.id, timezone, notifications_enabled: notifications }, { onConflict: 'id' })
    if (error) toast.error('Save failed')
    else toast.success('Settings saved')
    setLoading(false)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Pinterest identity */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Pinterest Account</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {pinterestAvatar ? (
              <img src={pinterestAvatar} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#E60023] flex items-center justify-center text-white font-bold text-sm">
                {pinterestUsername.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">@{pinterestUsername}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <p className="text-xs text-gray-500">Connected</p>
              </div>
            </div>
          </div>
          <a
            href="/api/auth/pinterest?next=/dashboard/settings"
            className="flex items-center gap-1.5 text-xs text-[#E60023] hover:underline"
          >
            <RefreshCw size={11} />
            Reconnect
          </a>
        </div>
        <p className="text-xs text-gray-400">
          Your Pinterest account is your Pinshedule identity. Reconnect if your token expires.
        </p>
      </div>

      {/* Profile preferences */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Preferences</h2>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#E60023]"
          >
            {Intl.supportedValuesOf('timeZone').map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <Button onClick={saveProfile} loading={loading}>Save settings</Button>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Bell size={16} className="text-[#E60023]" />
          <h2 className="font-semibold text-gray-900">Notifications</h2>
        </div>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-900">Email notifications</p>
            <p className="text-xs text-gray-500">Pin published, pin failed, billing reminders</p>
          </div>
          <button
            type="button"
            onClick={() => setNotifications(!notifications)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${notifications ? 'bg-[#E60023]' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${notifications ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </label>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl border border-red-100 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 size={16} className="text-red-500" />
          <h2 className="font-semibold text-red-700">Danger zone</h2>
        </div>
        <p className="text-sm text-gray-600">
          Deleting your account removes all your data within 30 days. This cannot be undone.
        </p>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (confirm('Are you sure? This will permanently delete your account.')) {
              toast.error('Contact support@pinshedule.com to delete your account.')
            }
          }}
        >
          Delete account
        </Button>
      </div>
    </div>
  )
}
