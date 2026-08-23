'use client'
// ── WHO THIS BROWSER'S SAVE BELONGS TO ──────────────────────────────────────────────────────────
//
// One definition of the save slot key, and one definition of the owner stamp. Every reader DERIVES
// from here; nobody keeps a copy.
//
// ★ WHY THIS FILE EXISTS AT ALL (#682, 2026-08-23). The slot used to be the bare literal
// `ather:save:shimmer`, written out by hand in five places across four files — with NO ACCOUNT IN
// IT. So two accounts in one browser shared one slot, and the damage was not the confusion, it was
// the upload: `pushCloudSave` reads that shared slot and POSTs it under whatever session holds the
// cookie, and the server writes unconditionally. Reproduced end to end on 2026-08-23: account B
// signs in, plays nothing, and B's cloud garden is replaced by A's world. It had already happened
// in production once — one account's row held another's garden, 99.85% identical, only mana regen
// apart.
//
// ⚠ AND IT NEEDED NO INPUT. `ge.lastTick` advances on its own, so the save differs from the last
// written blob within a minute of LOADING the page. "Don't play as a second account" was never the
// mitigation; "don't load it" was. That is why the push is gated here rather than on activity.
//
// ── THE ANONYMOUS SLOT KEEPS THE BARE KEY, AND THAT IS DELIBERATE ───────────────────────────────
// Same reasoning `voxel3d/save.ts` gives for not namespacing the Wilds: a new namespace pays for
// its own prefix, the existing one pays nothing. Every anonymous keeper who has ever played is
// already in `ather:save:shimmer`; renaming it would orphan all of them, which reads to a player as
// "my garden is gone". Signed-in slots are the new thing, so signed-in slots carry the suffix.

/** The anonymous keeper's slot. Byte-identical to what it always was. */
export const ANON_SAVE_KEY = 'ather:save:shimmer'

/**
 * Every SHIMMER slot starts with this, so an epoch reset can find them all.
 *
 * ⚠⚠ SHIMMER'S PREFIX, NOT `ather:save:`, AND WIDENING IT WOULD WIPE THE MARKS. `ather-epoch.ts`
 * sweeps every key starting with this and deletes it. The wallet lives at `ather:save:wallet` and
 * the epoch's own header says out loud that Marks SURVIVE a world reset — "start the world over" is
 * not "delete everything the player has ever done on the site". Generalising this constant to cover
 * the slot family would be a one-word change that silently confiscates every player's currency.
 */
export const SAVE_KEY_PREFIX = ANON_SAVE_KEY

/**
 * ── ★ THE SLOT FAMILY (2026-08-23, marks split per account) ─────────────────────────────────────
 * Three games keep a save in this browser: `shimmer`, `wallet` (the shared Marks purse) and `magii`
 * (the card game). All three were one-per-browser; #682 scoped shimmer because it UPLOADS, and left
 * the other two on the reasoning that their failure is contained. Alex ruled the purse splits: two
 * people on one machine sharing a coin balance is wrong, and there is no record of who earned a coin.
 */
export type SaveGame = 'shimmer' | 'wallet' | 'magii'

/**
 * The slot a given account uses for a given game. The anonymous keeper keeps the bare key for all
 * three — same argument as everywhere else, and here it is a currency, so orphaning it reads to a
 * player as being robbed rather than merely reset.
 */
export function gameSlot(game: SaveGame, owner: string | null = ownerId): string {
  const base = `ather:save:${game}`
  return owner ? `${base}:${owner}` : base
}

/** The field the owner rides in, inside the save blob — beside `_epoch`, same trick. */
export const OWNER_FIELD = '_owner'

let ownerId: string | null = null
let resolved = false

/**
 * Declare who is playing. Called ONCE at boot, from `page.tsx`, before the game mounts.
 *
 * ⚠ ORDERING IS THE WHOLE CONTRACT. `Shimmer3D` and `VoxelWorld` read the slot synchronously while
 * they render, so the owner has to be known before they mount. `page.tsx` holds them behind the
 * `loading` phase until the session fetch settles, which is what makes that true — do not move the
 * session fetch after the world phase, and do not read a save during `loading`.
 */
export function setSaveOwner(userId: string | null): void {
  const changed = ownerId !== userId || !resolved
  ownerId = userId
  resolved = true
  // ★ TELL THE LIVE SURFACES. The Marks readout in `SiteNav` and `useWallet` are mounted on pages
  // all over the site and read their slot synchronously; before the owner is known they are reading
  // the anonymous purse. They cannot poll a module variable, so resolution is an EVENT.
  if (changed && typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent(SAVE_OWNER_EVENT, { detail: userId })) } catch { /* no CustomEvent */ }
  }
}

/** Fired on `window` whenever the answer to "who is playing" changes, including the first time. */
export const SAVE_OWNER_EVENT = 'ather:save-owner'

/**
 * Has anybody answered "who is playing" yet?
 *
 * ⚠ THE HONEST ANSWER IS "NOT YET", AND CALLERS MUST BE ABLE TO SAY SO. `saveKey()` answers with the
 * anonymous slot when unresolved, which is right for a read that must not crash and WRONG for a
 * WRITE — money written into the anonymous purse in the first frames of a page load is money the
 * account that earned it never sees. Surfaces that can act on a balance gate on this instead.
 */
export function saveOwnerResolved(): boolean {
  return resolved
}

/** Who the current slot belongs to — null means the anonymous keeper. */
export function saveOwner(): string | null {
  return ownerId
}

/**
 * The localStorage slot for whoever is playing right now.
 *
 * ⚠ Called before `setSaveOwner`, this answers with the ANONYMOUS slot — which is a real answer for
 * an anonymous player and a WRONG one for a signed-in player whose session has not landed yet. It
 * cannot throw (a throw in the save path loses the write it was trying to protect), so it says so
 * loudly instead. A warning here means the boot order above was broken, not that the player is new.
 */
export function saveKey(): string {
  if (!resolved && typeof console !== 'undefined') {
    console.warn('[save-slot] saveKey() before setSaveOwner — answering with the anonymous slot. '
      + 'If this browser is signed in, that is the wrong slot and the boot order in page.tsx broke.')
  }
  return gameSlot('shimmer')
}

/** The slot a given account would use. Used by adoption, which reasons about a slot it is not in. */
export function slotFor(userId: string | null): string {
  return gameSlot('shimmer', userId)
}

/**
 * Stamp the owner into a serialized save, the way `cloud-sync` stamps the epoch.
 *
 * The stamp is what lets the SERVER refuse a foreign blob. Keying the slot already stops the client
 * reading the wrong garden; this is the half that survives a client bug, a stale bundle, or a tab
 * that was already open when the account changed. Defence in depth, deliberately redundant.
 */
export function stampOwner(data: string, userId: string | null): string {
  if (!userId) return data          // anonymous saves carry no owner and are refused by nobody
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>
    if (parsed && typeof parsed === 'object') {
      parsed[OWNER_FIELD] = userId
      return JSON.stringify(parsed)
    }
  } catch { /* unparseable — push it unchanged rather than lose the save */ }
  return data
}

/** Who a serialized save says it belongs to, or null for an unstamped/anonymous one. */
export function ownerOf(data: string): string | null {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>
    const o = parsed?.[OWNER_FIELD]
    return typeof o === 'string' && o ? o : null
  } catch {
    return null
  }
}

/**
 * Is this blob safe for `userId` to hold?
 *
 * ★ UNSTAMPED IS ALLOWED ON PURPOSE, and this is the one judgement call in the file. Every save
 * written before today is unstamped, and refusing those would delete every existing garden on
 * upgrade — the cure being worse than #682. An unstamped blob is adoptable; a blob stamped for
 * SOMEONE ELSE never is. So the check is "does it name a different owner", not "does it name me".
 */
export function ownedBy(data: string, userId: string | null): boolean {
  const o = ownerOf(data)
  return o === null || o === userId
}

// ── ★★ ADOPTING THE ANONYMOUS PURSE (2026-08-23, Alex: "split it per account") ──────────────────
//
// Scoping the wallet without this would show every existing player a balance of zero on the day it
// shipped, with their coins sitting one key over. For a world save that reads as "my garden is
// gone"; for a CURRENCY it reads as being robbed, which is worse, because the player can name the
// number they lost.
//
// ★ WHY A CLAIM KEY HERE AND AN IN-BLOB STAMP FOR SHIMMER — the two are not interchangeable and
// this is the reason, not a preference. Shimmer's stamp has to survive a round trip through the
// SERVER, so the server can refuse a foreign blob; a browser-local key cannot do that job. But the
// stamp only survives if every writer preserves it, and both of these blobs are rewritten WHOLESALE
// on every change — `wallet.write` builds a fresh `{marks, totalEarned, totalSpent}` and the card
// game saves a fresh stats object — so a stamp would be erased by the first coin earned, silently
// re-opening the slot for adoption by a second account. Neither uploads, so neither needs the
// server half. A claim key survives a blob rewrite by construction.
//
// ⚠ SHIMMER IS NOT IN HERE. Its adoption lives in `play3d/page.tsx`, tangled with the cloud pull it
// has to happen around; a second mechanism reaching for that slot is how one of them ends up
// adopting a garden the other already moved.

/** Who consumed this browser's anonymous non-cloud slots. */
export const SLOT_CLAIM = 'ather:save:anon-claim'

/** The slots this mechanism owns. Deliberately not `shimmer` — see the note above. */
export const ADOPTABLE: readonly SaveGame[] = ['wallet', 'magii']

export interface SlotAdoption {
  moves: Array<[string, string]>
  claim: boolean
  reason: 'adopted' | 'nothing-anonymous' | 'someone-elses' | 'anonymous'
}

/**
 * ★ PURE, so the rules are reachable by a test holding a list of strings — the same split
 * `voxel3d/save.ts` and `keeper-local.ts` draw, for the same reason.
 *
 * Per-game rather than all-or-nothing: an account that already has a purse but has never opened the
 * card game should still inherit the anonymous card save. The claim is family-wide because the
 * QUESTION it answers is family-wide — "has anybody already taken this browser's anonymous state".
 *
 * ⚠ A GAME THE ACCOUNT ALREADY HAS IS NEVER OVERWRITTEN. Their own balance is the newer claim on
 * that purse, and adopting over it would DESTROY COINS rather than merely misfile them.
 */
export function planSlotAdoption(keys: string[], claimedBy: string | null, userId: string | null): SlotAdoption {
  if (!userId) return { moves: [], claim: false, reason: 'anonymous' }
  if (claimedBy && claimedBy !== userId) return { moves: [], claim: false, reason: 'someone-elses' }

  const anonPresent = ADOPTABLE.filter(g => keys.includes(gameSlot(g, null)))
  if (!anonPresent.length) return { moves: [], claim: false, reason: 'nothing-anonymous' }

  const moves = anonPresent
    .filter(g => !keys.includes(gameSlot(g, userId)))
    .map(g => [gameSlot(g, null), gameSlot(g, userId)] as [string, string])
  return { moves, claim: true, reason: 'adopted' }
}

/**
 * Move this browser's anonymous purse and card save into the account signing in — once, ever.
 *
 * ★ WRITE EVERY DESTINATION BEFORE DELETING ANY SOURCE. localStorage has no transaction, so an
 * interruption has to leave the player holding BOTH copies rather than neither. Reversed, a tab
 * closed at the wrong millisecond is a balance that no longer exists anywhere.
 */
export function adoptAnonSlots(userId: string | null = ownerId): SlotAdoption {
  const nothing: SlotAdoption = { moves: [], claim: false, reason: 'anonymous' }
  if (!userId) return nothing
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k) keys.push(k)
    }
    const plan = planSlotAdoption(keys, localStorage.getItem(SLOT_CLAIM), userId)
    for (const [from, to] of plan.moves) {
      const v = localStorage.getItem(from)
      if (v !== null) localStorage.setItem(to, v)
    }
    for (const [from] of plan.moves) localStorage.removeItem(from)
    if (plan.claim) localStorage.setItem(SLOT_CLAIM, userId)
    return plan
  } catch { return nothing }
}
