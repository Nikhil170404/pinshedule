'use client'

import { useState } from 'react'
import { Columns3, Lock, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { api, errorText } from '@/lib/api'
import { useBoards } from '@/lib/hooks'
import { connectionParam, useActiveAccount } from '@/lib/accounts'
import { SafeImage } from '@/components/ui/SafeImage'
import type { PinterestBoard } from '@/types'

/** Cover image, else a 2x2 collage of pin thumbnails, else a neutral placeholder. */
function BoardCover({ board }: { board: PinterestBoard }) {
  const thumbs = (board.thumbnails ?? []).filter(Boolean)
  if (board.image_url && thumbs.length < 2) return <SafeImage src={board.image_url} alt="" className="h-full w-full" iconSize={28} />
  if (thumbs.length >= 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-white">
        {[0, 1, 2, 3].map((i) => <SafeImage key={i} src={thumbs[i]} className="h-full w-full" iconSize={16} />)}
      </div>
    )
  }
  return <SafeImage src={board.image_url} className="h-full w-full" iconSize={28} />
}

export default function BoardsPage() {
  const { boards, loaded, loading, error, reload } = useBoards()
  const { account } = useActiveAccount()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState('PUBLIC')
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!name.trim()) return toast.error('Give the board a name.')
    setBusy(true)
    try {
      await api(`/boards${connectionParam(account) ? `?connection=${connectionParam(account)}` : ''}`, { body: { name: name.trim(), description, privacy } })
      toast.success('Board created.')
      setOpen(false); setName(''); setDescription('')
      await reload()
    } catch (e) { toast.error(errorText(e)) }
    setBusy(false)
  }

  return (
    <div>
      <PageHeader title="Boards" description="Your Pinterest boards. Pins are published to the board you choose."
        actions={<><Button variant="outline" onClick={reload} loading={loading}>{!loading && <RefreshCw size={15} aria-hidden />} Refresh</Button><Button onClick={() => setOpen(true)}><Plus size={16} aria-hidden /> New board</Button></>} />

      {!loaded && !error ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : error ? (
        <Card><EmptyState icon={Columns3} title="Could not load boards" description={error.message}
          action={error.reconnect ? <a href="/api/auth/pinterest?next=/dashboard/boards" className="text-sm font-medium text-brand hover:underline">Reconnect Pinterest</a> : <Button variant="outline" onClick={reload}>Try again</Button>} /></Card>
      ) : boards.length === 0 ? (
        <Card><EmptyState icon={Columns3} title="No boards yet" description="Create your first board to start pinning." action={<Button onClick={() => setOpen(true)}>New board</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {boards.map((b) => (
            <Card key={b.id} className="overflow-hidden">
              <div className="aspect-[4/3] overflow-hidden bg-stone-100"><BoardCover board={b} /></div>
              <div className="p-3">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">{b.privacy === 'SECRET' && <Lock size={13} className="shrink-0 text-stone-400" aria-label="Secret board" />}<span className="truncate">{b.name}</span></p>
                <p className="mt-0.5 text-xs text-muted">{b.pin_count.toLocaleString()} pins</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New board" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} loading={busy}>Create board</Button></>}>
        <div className="space-y-4">
          <Input label="Name" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
          <Textarea label="Description (optional)" rows={3} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
          <Select label="Visibility" value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
            <option value="PUBLIC">Public</option>
            <option value="SECRET">Secret</option>
          </Select>
        </div>
      </Modal>
    </div>
  )
}
