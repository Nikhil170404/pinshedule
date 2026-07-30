'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LayoutGrid, Lock, Globe, RefreshCw } from 'lucide-react'
import type { PinterestBoard } from '@/types'
import { cn } from '@/lib/utils'

export default function BoardsPage() {
  const [boards, setBoards] = useState<PinterestBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/boards')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBoards(data.boards ?? [])
    } catch {
      toast.error('Could not load boards. Make sure Pinterest is connected.')
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Boards</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {!loading && `${boards.length} board${boards.length !== 1 ? 's' : ''} available for scheduling`}
            {loading && 'Loading boards…'}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading || refreshing}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors disabled:opacity-40',
          )}
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => (
            <div
              key={board.id}
              className="bg-white rounded-2xl border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden"
            >
              <div className="h-36 bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center overflow-hidden">
                {board.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={board.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <LayoutGrid size={28} className="text-red-200" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug">{board.name}</h3>
                  <span className="shrink-0 mt-0.5">
                    {board.privacy === 'SECRET' ? (
                      <Lock size={13} className="text-gray-400" />
                    ) : (
                      <Globe size={13} className="text-gray-400" />
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                  {board.pin_count !== undefined && (
                    <span>{board.pin_count.toLocaleString()} pins</span>
                  )}
                  {board.follower_count !== undefined && (
                    <span>{board.follower_count.toLocaleString()} followers</span>
                  )}
                  <span className={cn(
                    'capitalize px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                    board.privacy === 'SECRET' ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'
                  )}>
                    {board.privacy.toLowerCase()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
