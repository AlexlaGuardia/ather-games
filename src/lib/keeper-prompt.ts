// ── THE SIGN-IN PROMPT (M12 step 3): "Add this keeper to your roster?" ───────────────────────────────────────────
//
// The case: this browser holds an ANONYMOUS keeper, and the account that just signed in already has its own.
// `planKeeperAdoption` calls that 'locked': the anonymous keys are left alone (and the browser is claimed by the
// account). This module is what happens to them next, with the player's say-so. (An account with NO keeper adopts
// silently, in keeper-local; that path is unchanged.)
//
//   YES  → a new roster entry whose parked keys are COPIES of the anonymous keeper's; the claim is stamped; and only
//          after both landed are the anonymous copies removed (move-not-delete). The ACTIVE keeper does not change.
//   NO   → nothing moves, nothing is deleted; a device-local flag stops the nag. The keeper stays on this browser.
//   FULL → at ROSTER_CAP the answer is "full" and the anonymous keeper is left untouched.
// GARDEN keys never move in any branch (they are not in KEEPER_KEYS, and nothing here names them).
import { KEEPER_KEYS, KEEPER_CLAIM } from './keeper-local'
import { ROSTER_CAP, ensureRoster, addKeeperWith } from './keeper-roster'

/** DEVICE-local: which account answered "Not now" for this browser's anonymous keeper. Never part of a keeper. */
export const ROSTER_DECLINED = 'ather:roster:anon-declined'

export type RosterPrompt = 'none' | 'ask' | 'full'

const isKeeperState = (k: string) => KEEPER_KEYS.some(base => (base.endsWith(':') ? k.startsWith(base) && k.length > base.length : k === base))

/** The anonymous keeper's keys on this browser (bare, never `u:`-scoped, never the claim stamp). */
export function anonKeeperKeys(keys: string[]): string[] {
  return keys.filter(k => k !== KEEPER_CLAIM && isKeeperState(k))
}

/**
 * PURE. Should the prompt show? Only for the 'locked' shape: this account claimed the browser, anonymous keeper state is
 * still on disk, and the player has not already said "Not now". `rosterSize` is the account's keeper count (>= 1).
 */
export function planRosterPrompt(keys: string[], claimedBy: string | null, declinedBy: string | null, userId: string | null, rosterSize: number): RosterPrompt {
  if (!userId || claimedBy !== userId || declinedBy === userId) return 'none'
  if (!anonKeeperKeys(keys).length) return 'none'
  return rosterSize >= ROSTER_CAP ? 'full' : 'ask'
}

function allKeys(): string[] {
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) out.push(k) }
  return out
}

/** Read the world and decide. Never writes (ensureRoster is deferred to YES). */
export function rosterPromptNow(userId: string | null): RosterPrompt {
  if (!userId) return 'none'
  try {
    const keys = allKeys()
    // a roster that does not exist yet has one keeper (the live one), so it can never be full
    let size = 1
    try {
      const raw = localStorage.getItem(`u:${userId}:ather:roster.v1`)
      if (raw) { const r = JSON.parse(raw) as { keepers?: unknown[] }; if (Array.isArray(r.keepers)) size = r.keepers.length }
    } catch { /* corrupt: treated as one */ }
    return planRosterPrompt(keys, localStorage.getItem(KEEPER_CLAIM), localStorage.getItem(ROSTER_DECLINED), userId, size)
  } catch { return 'none' }
}

/** YES. 'added' | 'full' (nothing touched) | 'failed' (nothing lost: anonymous copies stay). */
export function addAnonKeeperToRoster(userId: string | null): 'added' | 'full' | 'failed' {
  if (!userId) return 'failed'
  try {
    const r = ensureRoster(userId)
    if (!r) return 'failed'
    if (r.keepers.length >= ROSTER_CAP) return 'full'
    const anon = anonKeeperKeys(allKeys())
    if (!anon.length) return 'failed'
    const data = new Map<string, string>()
    for (const k of anon) { const v = localStorage.getItem(k); if (v !== null) data.set(k, v) }
    if (!addKeeperWith(data, userId)) return 'failed'
    localStorage.setItem(KEEPER_CLAIM, userId)       // both writes landed: only now may the sources go
    for (const k of data.keys()) localStorage.removeItem(k)
    return 'added'
  } catch { return 'failed' }
}

/** NO. Remember on this device; touch nothing else. */
export function declineAnonKeeper(userId: string | null): void {
  if (!userId) return
  try { localStorage.setItem(ROSTER_DECLINED, userId) } catch { /* private mode: it will ask again, harmless */ }
}
