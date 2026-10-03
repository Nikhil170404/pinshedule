'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { BoardSelect } from '@/components/pins/BoardSelect'
import { api, errorText } from '@/lib/api'
import { PIN_LIMITS, type ScheduledPin } from '@/types'
import { toLocalInput } from '@/lib/utils'

export function PinEditModal({ pin, onClose }: { pin: ScheduledPin | null; onClose: () => void }) {
  if (!pin) return null
  return <EditForm key={pin.id} pin={pin} onClose={onClose} />
}

function EditForm({ pin, onClose }: { pin: ScheduledPin; onClose: () => void }) {
  const [title, setTitle] = useState(pin.title ?? '')
  const [description, setDescription] = useState(pin.description ?? '')
  const [link, setLink] = useState(pin.destination_url ?? '')
  const [board, setBoard] = useState({ id: pin.board_id, name: pin.board_name ?? '' })
  const [when, setWhen] = useState(toLocalInput(new Date(pin.scheduled_at)))
  const [busy, setBusy] = useState(false)

  async function save() {
    if (link && !/^https?:\/\//i.test(link)) return toast.error('The link must start with https://')
    const at = new Date(when)
    const timeChanged = at.toISOString() !== new Date(pin.scheduled_at).toISOString()
    if (pin.status === 'failed' && !timeChanged && at.getTime() < Date.now()) return toast.error('Choose a future time to re-queue this pin.')
    setBusy(true)
    try {
      await api(`/pins/${pin.id}`, {
        method: 'PATCH',
        body: {
          title, description, board_id: board.id, board_name: board.name, destination_url: link,
          ...(timeChanged || pin.status === 'failed' ? { scheduled_at: at.toISOString() } : {}),
        },
      })
      toast.success('Pin updated.')
      onClose()
    } catch (e) {
      toast.error(errorText(e))
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit pin"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>{pin.status === 'failed' ? 'Save and re-queue' : 'Save changes'}</Button></>}>
      <div className="space-y-4">
        <Input label="Title" value={title} maxLength={PIN_LIMITS.title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Description" rows={4} value={description} maxLength={PIN_LIMITS.description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Destination link" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
        <BoardSelect value={board.id} onChange={(id, name) => setBoard({ id, name })} suggestText={`${title} ${description}`} />
        <Input label="Publish time" type="datetime-local" value={when} min={toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value)} />
      </div>
    </Modal>
  )
}
