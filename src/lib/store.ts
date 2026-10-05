/** Tiny external store: components read it with useSyncExternalStore, so navigating never re-flashes a skeleton. */
export function createStore<T>() {
  let value: T | null = null
  const subs = new Set<() => void>()
  return {
    get: () => value,
    set(v: T | null) { value = v; subs.forEach((s) => s()) },
    subscribe(cb: () => void) { subs.add(cb); return () => { subs.delete(cb) } },
  }
}
