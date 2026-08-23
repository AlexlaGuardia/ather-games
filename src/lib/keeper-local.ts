'use client'
// ── BROWSER-LOCAL STATE THAT BELONGS TO A KEEPER, NOT TO A DEVICE ───────────────────────────────
//
// `save-slot.ts` made the save per-account (#682) and `voxel3d/save.ts` made the built world
// per-account (#692). Both left behind a spread of smaller localStorage keys that describe the same
// keeper and were still shared by every account on the browser: the birth rune, the move book, the
// cast loadout, the map you have uncovered, the mist you have already drawn from, and the clocks
// ticking on pots, saplings and fallen leaves in a world that is now per-account.
//
// None of them upload, so the blast radius is one browser rather than somebody's cloud garden —
// which is why they came second. It is the same bug: **a key that names what somebody knows, with
// nobody's name in it.** The rune is the sharp one. A second account on this browser skipped the
// ritual entirely and spawned holding the first keeper's affinity and cast book.
//
// ── ★★ THE OWNER GOES IN FRONT HERE, AND BEHIND IN `save-slot.ts`. THAT IS DELIBERATE ───────────
// The save slot is one fixed, fully-spelled key, so a suffix is unambiguous. These are not: several
// carry a DYNAMIC tail (`…:seen:<zoneId>`, `voxel3d:pots:<seed>`), and adoption has to find them by
// prefix because nothing holds a list of every zone a keeper has walked. Suffix-scope those and a
// scan for `ather:shimmer:seen:` matches the anonymous key AND every account's copy of it — one
// keeper's adoption sweeping up another's, which is the exact defect this file exists to close.
// A front marker cannot collide: no base key begins with `u:`.
import { saveOwner } from './save-slot'

/** The marker a signed-in keeper's keys carry. Shared with the world store, same shape, same reason. */
const OWNER_MARK = 'u:'

/**
 * ── ★ THE REGISTRY IS THE FEATURE, AND EVERY ABSENCE FROM IT IS A DECISION ──────────────────────
 * Adoption walks localStorage by prefix, so this list is what "belongs to a keeper" MEANS. A key
 * that is not here stays shared across accounts on the browser.
 *
 * ⚠ Deliberately NOT here, because they describe a DEVICE and not a person:
 *   · `shimmer.voxel.settings.v1` and `ather:gfx:shimmer` — graphics quality and voxel settings.
 *     Tuned to the machine you are sitting at; re-tuning them per account is a bug, not isolation.
 *   · `ather:shimmer:genWarned` — "this browser has been told the generator changed". One warning
 *     per browser is the whole point of it.
 *   · `ather:shimmer:justBorn` / `birthPending` — read and cleared inside a single boot, and the
 *     second is vestigial. Nothing survives long enough to leak.
 *   · `ather:save:shimmer` — `save-slot.ts` owns that one and scopes it its own way. Two mechanisms
 *     reaching for one key is worse than either.
 */
export const KEEPER_KEYS: readonly string[] = [
  'ather:shimmer:birthRune',   // ★ the ritual, and the affinity a keeper is born with
  'ather:shimmer:runes',       // what they have collected since
  'ather:shimmer:book',        // the moves they have learned
  'ather:shimmer:loadout',     // the cast slots they have set
  'ather:mp:id',               // ★ the peer other players see — two accounts were ONE peer
  'ather:mp:name',             // and this MIRRORS the signed-in username, so B announced A's name
  'ather:shimmer:seen:',       // one key per zone — the map they have uncovered (dynamic tail)
  'voxel3d:tutorial:',         // which prompts they have been shown (dynamic tail: seed)
  'voxel3d:mist:',             // which patches they have already drawn a resident from
  'voxel3d:pots:',             // clocks on things standing in a world that is now per-account
  'voxel3d:saplings:',
  'voxel3d:leafdecay:',
]

/** Where a given keeper's copy of `base` lives. Anonymous keeps the bare key, as everywhere else. */
export function keeperKeyFor(base: string, owner: string | null): string {
  return owner ? `${OWNER_MARK}${owner}:${base}` : base
}

/** Where the CURRENT keeper's copy lives. Reads the one definition of who is playing. */
export function keeperKey(base: string): string {
  return keeperKeyFor(base, saveOwner())
}

/** Who consumed this browser's anonymous keeper state. Its own key, in the anonymous namespace. */
export const KEEPER_CLAIM = 'ather:shimmer:anon-keeper'

/**
 * ★ THE DECISION, PURE — the same split `voxel3d/save.ts` draws around `planAdoption`, and for the
 * same reason: everything here that can be WRONG is reachable by a test holding a list of strings,
 * and what is left is a `getItem` and a `setItem`.
 *
 * The rules are the world store's rules, because a keeper who adopts one and not the other is worse
 * off than one who adopts neither — they would stand in their own garden holding a stranger's rune:
 *   · claimed by somebody else            → take nothing, claim nothing
 *   · nothing anonymous on disk           → claim nothing (reserving an empty browser costs whoever
 *                                           plays signed out later and returns as another account)
 *   · anonymous state, account has none   → MOVE it
 *   · anonymous state, account has its own→ LOCK it: the account's own state is the newer claim on
 *                                           this keeper, and overwriting it loses what they did
 *                                           while signed in.
 */
export interface KeeperAdoption {
  moves: Array<[string, string]>
  claim: boolean
  reason: 'adopted' | 'locked' | 'nothing-anonymous' | 'someone-elses' | 'anonymous'
}

export function planKeeperAdoption(keys: string[], claimedBy: string | null, userId: string | null): KeeperAdoption {
  if (!userId) return { moves: [], claim: false, reason: 'anonymous' }
  if (claimedBy && claimedBy !== userId) return { moves: [], claim: false, reason: 'someone-elses' }

  // ⚠ `startsWith` on every entry, so a registry entry ending in ':' matches its whole family and a
  // fully-spelled one matches only itself. A signed-in copy can never match: it starts with `u:`.
  const isKeeperState = (k: string) => KEEPER_KEYS.some(base => k.startsWith(base))
  const anon = keys.filter(k => isKeeperState(k) && k !== KEEPER_CLAIM)
  if (!anon.length) return { moves: [], claim: false, reason: 'nothing-anonymous' }

  const minePrefix = `${OWNER_MARK}${userId}:`
  if (keys.some(k => k.startsWith(minePrefix) && isKeeperState(k.slice(minePrefix.length)))) {
    return { moves: [], claim: true, reason: 'locked' }
  }
  return { moves: anon.map(k => [k, minePrefix + k] as [string, string]), claim: true, reason: 'adopted' }
}

/**
 * Move this browser's anonymous keeper state into the account signing in — once, ever.
 *
 * ⚠ CALL IT FROM A BOOT GATE, AFTER `setSaveOwner` AND BEFORE ANYTHING READS A RUNE. Both routes
 * call it: the rune is read by both, and whichever the keeper opens first is the one that has to
 * get it right. It is idempotent, so the second route finds the state already claimed and does
 * nothing.
 *
 * ★ NOT ATOMIC, AND IT CANNOT BE — localStorage has no transaction. So it writes every destination
 * BEFORE deleting any source: interrupted halfway, the keeper holds both copies (harmless, and the
 * next boot finishes the job) rather than neither. Never delete before the copy lands.
 */
export function adoptAnonKeeperState(userId: string | null = saveOwner()): KeeperAdoption {
  const nothing: KeeperAdoption = { moves: [], claim: false, reason: 'anonymous' }
  if (!userId) return nothing
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k) keys.push(k)
    }
    const plan = planKeeperAdoption(keys, localStorage.getItem(KEEPER_CLAIM), userId)
    for (const [from, to] of plan.moves) {
      const v = localStorage.getItem(from)
      if (v !== null) localStorage.setItem(to, v)
    }
    for (const [from]  of plan.moves) localStorage.removeItem(from)
    if (plan.claim) localStorage.setItem(KEEPER_CLAIM, userId)
    return plan
  } catch { return nothing }   // private mode or quota — nothing moved, nothing lost
}
