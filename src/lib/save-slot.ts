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

/** Every slot this game owns starts with this, so an epoch reset can find them all. */
export const SAVE_KEY_PREFIX = ANON_SAVE_KEY

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
  ownerId = userId
  resolved = true
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
  return ownerId ? `${ANON_SAVE_KEY}:${ownerId}` : ANON_SAVE_KEY
}

/** The slot a given account would use. Used by adoption, which reasons about a slot it is not in. */
export function slotFor(userId: string | null): string {
  return userId ? `${ANON_SAVE_KEY}:${userId}` : ANON_SAVE_KEY
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
