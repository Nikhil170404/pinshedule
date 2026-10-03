import { redis } from './clients'

/** Sorted set: member = pin id, score = scheduled epoch ms. The DB stays the source of truth. */
export const DUE_KEY = 'pins:due'

export async function enqueue(items: { id: string; at: Date | string }[]) {
  if (items.length === 0) return
  const [first, ...rest] = items.map((i) => ({ score: new Date(i.at).getTime(), member: i.id }))
  await redis.zadd(DUE_KEY, first, ...rest)
}

export async function dequeue(ids: string[]) {
  if (ids.length) await redis.zrem(DUE_KEY, ...ids)
}

/** Pop due ids. ZREM returns 1 only for the caller that removed it, so replicas never share a pin. */
export async function claimDue(limit: number): Promise<string[]> {
  const ids = await redis.zrange<string[]>(DUE_KEY, 0, Date.now(), { byScore: true, offset: 0, count: limit })
  const mine: string[] = []
  await Promise.all(
    ids.map(async (id) => {
      if ((await redis.zrem(DUE_KEY, id)) === 1) mine.push(String(id))
    })
  )
  return mine
}
