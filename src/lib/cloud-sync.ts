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

import { ATHER_EPOCH } from './ather-epoch'

const PUSH_DEBOUNCE_MS = 8_000

/** Field the epoch rides in, inside the save blob itself. */
const EPOCH_FIELD = '_epoch'

/**
 * Stamp the current epoch into a serialized save.
 *
 * ★ THE EPOCH HAS TO TRAVEL WITH THE CHARACTER, NOT SIT BESIDE IT. A world reset clears
 * localStorage, but the cloud copy is a second home for the same character — and deleting those
 * rows server-side does NOT settle it, because any browser still holding the old save re-uploads it
 * the moment it next plays. That is a race the server cannot win: the row comes back, a wiped
 * device pulls it, and `loadWithCloudFallback` closes the birth modal on the way past. Observed on
 * 2026-08-07 with a row that had been verified deleted minutes earlier.
 *
 * Stamping ends the race instead of running it. A save written before the reset carries no stamp,
 * so it is refused on pull no matter how many times a stale client pushes it back.
 */
function stamp(data: string): string {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>
    if (parsed && typeof parsed === 'object') {
      parsed[EPOCH_FIELD] = ATHER_EPOCH
      return JSON.stringify(parsed)
    }
  } catch { /* not an object we can stamp — push it unchanged rather than lose the save */ }
  return data
}

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
  // Stamped at QUEUE time so both exit paths carry it — the debounced fetch and the pagehide
  // sendBeacon, which reads straight out of `pending` and would otherwise ship an unstamped blob.
  pending.set(game, stamp(data))
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
    const data = body.save?.data ?? null
    if (data === null) return null
    // ⚠ FAIL CLOSED on the epoch. Only a save from THIS world is restorable: an unstamped blob
    // (written before the reset, or re-pushed since by a browser still running the old bundle)
    // reads as epoch 0 and is refused. Refusing costs a returning keeper a fresh start, which is
    // what a world reset MEANS; accepting would silently resurrect the character the reset existed
    // to clear, and would close the birth ritual on its way in.
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>
      if (Number(parsed?.[EPOCH_FIELD] ?? 0) !== ATHER_EPOCH) return null
    } catch {
      return null   // unparseable is not a save we can vouch for
    }
    return data
  } catch {
    return null
  }
}
