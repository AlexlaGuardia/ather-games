'use client'
// Cloud-save sync — stage 2 of per-keeper Home Plots (see /api/saves).
//
// Push side: debounced fire-and-forget. The game saves often (its own debounce), the cloud
// copy only needs to be RECENT, not instant — and a failed push must never surface to play.
// A pagehide flush via sendBeacon catches the tab closing inside the debounce window
// (fetch would be cancelled with the page; beacons outlive it).
//
// Pull side: explicit, and only ever into a BLANK device (the caller enforces it). A stale
// cloud copy silently clobbering live local play is the one unrecoverable failure this
// design has to rule out, so the client never "syncs down" on its own.

const PUSH_DEBOUNCE_MS = 8_000

const pending = new Map<string, string>()
let timer: ReturnType<typeof setTimeout> | null = null

async function send(game: string, data: string): Promise<void> {
  try {
    await fetch('/api/saves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, data }),
    })
  } catch { /* offline / signed out — the local save is still the truth */ }
}

function flushPending() {
  if (timer) { clearTimeout(timer); timer = null }
  for (const [game, data] of pending) {
    const payload = new Blob([JSON.stringify({ game, data })], { type: 'application/json' })
    if (!navigator.sendBeacon?.('/api/saves', payload)) void send(game, data)
  }
  pending.clear()
}

if (typeof window !== 'undefined') {
  // pagehide, not beforeunload: fires on mobile tab-discard too, and doesn't block bfcache.
  window.addEventListener('pagehide', flushPending)
}

/** Queue a cloud push for this game's serialized save. Safe to call on every local save. */
export function pushCloudSave(game: string, data: string): void {
  pending.set(game, data)
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    const batch = [...pending]
    pending.clear()
    for (const [g, d] of batch) void send(g, d)
  }, PUSH_DEBOUNCE_MS)
}

/** Fetch this account's cloud copy, or null (signed out / none / offline — all just "no cloud"). */
export async function pullCloudSave(game: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/saves?game=${encodeURIComponent(game)}`, { cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as { save: { data: string } | null }
    return body.save?.data ?? null
  } catch {
    return null
  }
}
