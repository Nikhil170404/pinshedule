// Which Pinterest account the dashboard is working on. Plain module state so the API client can read it
// without React. The choice lives in sessionStorage (per tab), so two open tabs can work on two different
// accounts without one silently posting to the other's; localStorage only remembers the last one for new tabs.
const KEY = 'gpk.account'

function read(): string | null {
  if (typeof window === 'undefined') return null
  try { return sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY) } catch { return null }
}

let active: string | null = read()
const subs = new Set<() => void>()

export const activeAccount = {
  get: () => active,
  set(id: string | null) {
    if (id === active) return
    active = id
    try {
      if (id) { sessionStorage.setItem(KEY, id); localStorage.setItem(KEY, id) }
      else sessionStorage.removeItem(KEY)
    } catch { /* storage blocked: the choice just lasts until reload */ }
    subs.forEach((s) => s())
  },
  subscribe(cb: () => void) { subs.add(cb); return () => { subs.delete(cb) } },
}
