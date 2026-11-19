// ── THE HELD GUN, SEEN BY THE PARTY (BETA M27 slice 4, client-only over the server's 'relay', shimmer-server afc1d34) ────
// Each keeper says what gun is in their hand ('gun.held' {g: gun id | null}); the others hang that gun on that keeper's
// right hand (held-gun-prop.ts). The server keeps nothing, so the SENDER keeps everyone current:
//   on a CHANGE (drew, swapped, stowed), when a NEW peer appears (a joiner sees it at once), and a KEEPALIVE every 10 s
//   (a missed message heals itself). Quiet otherwise: nothing per frame.
// ★ PURE (no React, no socket). Node test: held-gun.test.ts.
export const HELD_KIND = 'gun.held'
export const HELD_KEEPALIVE = 10
const ID = /^[a-z0-9-]{1,32}$/

export interface HeldSend { g: string | null | undefined; peers: Set<string>; at: number }
export const newHeldSend = (): HeldSend => ({ g: undefined, peers: new Set(), at: -1e9 })

/** Should I say what I hold now? Mutates `s` when it says yes. `peers` = who is live in my instance right now. */
export function heldDue(s: HeldSend, g: string | null, peers: readonly string[], now: number): boolean {
  const fresh = peers.some(p => !s.peers.has(p))
  s.peers = new Set(peers)
  if (!peers.length) return false                 // alone: nobody to tell (a newcomer triggers it)
  if (g === s.g && !fresh && now - s.at < HELD_KEEPALIVE) return false
  s.g = g; s.at = now
  return true
}

/** What a peer said they hold: a gun id, null (hands empty), or undefined (junk: ignore it). */
export function decodeHeld(d: unknown): string | null | undefined {
  const g = (d as { g?: unknown })?.g
  if (g === null) return null
  return typeof g === 'string' && ID.test(g) ? g : undefined
}
