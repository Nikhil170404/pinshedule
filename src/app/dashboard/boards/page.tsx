'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LayoutGrid, Lock, Globe } from 'lucide-react'
import type { PinterestBoard } from '@/types'

export default function BoardsPage() {
  const [boards, setBoards] = useState<PinterestBoard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/boards')
        const data = await res.json()
        setBoards(data.boards ?? [])
      } catch {
        toast.error('Could not load boards. Make sure Pinterest is connected.')
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Boards</h1>
        <p className="text-gray-500 text-sm mt-0.5">All Pinterest boards available for scheduling</p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="skeleton h-32 w-full rounded-xl" />
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center">
          <LayoutGrid size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No boards found</p>
          <p className="text-gray-400 text-sm mt-1">Connect your Pinterest account to see your boards.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => (
            <div
              key={board.id}
              className="bg-white rounded-2xl border border-gray-100 hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              <div className="h-32 bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
                {board.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={board.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <LayoutGrid size={28} className="text-red-200" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900 text-sm">{board.name}</h3>
                  {board.privacy === 'SECRET' ? (
                    <Lock size={14} className="text-gray-400" />
                  ) : (
                    <Globe size={14} className="text-gray-400" />
                  )}
                </div>
                {board.pin_count !== undefined && (
                  <p className="text-xs text-gray-500">{board.pin_count} pins</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
