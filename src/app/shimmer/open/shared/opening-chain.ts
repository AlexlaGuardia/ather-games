// ── THE OPENING CHAIN: ATHER TO NYX (BETA M73) ─────────────────────────────────────────────────────────────────────────
// The keeper starts in the Ather with Kael's invite folded in the bag. Reading it starts THE DIG; so does Morel's ping,
// which comes after the keeper's FIRST death, once the backpack they dropped is recovered or has run out (no pack = it is
// already settled). The ping fires ONCE (never on a second death), and only while the note is still unread. A nudge follows
// once, a long while later, if the note is still folded. At a gate with The Dig on and the note read, Morel says where the
// flip button is, once (MOREL_HINT.digFlip).
//
// Steps:  invite  (note in the bag, The Dig not started)
//      -> dig     (The Dig: nearest gate, flip the map, Rune Hold, then the shipyard above it)
//      -> (next slice: the yard, the journal page, Veyra Unit 1 v2, the ship-repair flag; STOP there, canon OPEN past it)
//
// ★ OLD SAVES (no chain record): a keeper whose Kael's chest is already open (loadout.kael) has stood in Kael's yard, so
//   they are PAST every beat this chain has: marked `past`, no note, no ping, no pulses. Every other keeper, old or new,
//   starts at the invite with the note handed once (the bag's `gifts` gate), and the ping waits for their NEXT death (a
//   death before this shipped was never recorded, and the ping must come after a pack, not out of nowhere on load).
//
// PURE (no React, no storage): the store is opening-chain-store.ts. Lines: kael-invite-lines.ts + morel-lines.ts (SIGNED).

export const CHAIN_KEY = 'open.chain.v1'

/** The note's bag id. Kept on the keeper when they fall (ather/backpack.ts): it is the chain's start, never pack loot. */
export const KAEL_INVITE = 'kael_invite'
/** the bag's one-off gift mark: the note is handed once per keeper */
export const GIFT_KAEL_INVITE = 'kael_invite'

/** The nudge waits this long (wall clock) after the ping. Morel's script leaves the wait to the build. */
export const NUDGE_MS = 10 * 60 * 1000

export type ChainStep = 'invite' | 'dig'
export interface Chain {
  v: 1
  step: ChainStep
  /** old save already past every beat here (Kael's chest open): the chain says nothing and pulses nothing */
  past?: boolean
  /** the note has been read */
  read: boolean
  /** a death since the chain began: the ping waits for the pack it dropped */
  died: boolean
  /** Morel's ping went (once, ever) */
  pinged: boolean
  pingAt?: number
  nudged: boolean
  /** Morel's gate hint went (once) */
  hinted: boolean
  /** the keeper turned the fold map to the Athernyx side with The Dig on: the flip button stops pulsing */
  flipped: boolean
}

export const newChain = (): Chain => ({ v: 1, step: 'invite', read: false, died: false, pinged: false, nudged: false, hinted: false, flipped: false })

/** A saved record, or null (then `migrate` decides). Anything malformed is null, never a half chain. */
export function parseChain(raw: unknown): Chain | null {
  const c = raw as Chain | null
  if (!c || c.v !== 1 || (c.step !== 'invite' && c.step !== 'dig')) return null
  const b = (x: unknown) => x === true
  return {
    v: 1, step: c.step, read: b(c.read), died: b(c.died), pinged: b(c.pinged), nudged: b(c.nudged), hinted: b(c.hinted), flipped: b(c.flipped),
    ...(b(c.past) ? { past: true } : {}), ...(Number.isFinite(c.pingAt) ? { pingAt: c.pingAt } : {}),
  }
}

/** No record yet: the old-save rule (header). `kaelChestOpen` = loadout.kael. */
export function migrate(o: { kaelChestOpen: boolean }): Chain {
  return o.kaelChestOpen ? { ...newChain(), step: 'dig', past: true, read: true, pinged: true, nudged: true, hinted: true, flipped: true } : newChain()
}

/** The Dig is on: the gate, the flip pulse and Rune Hold are pointing (not for a keeper already past it). */
export const digActive = (c: Chain) => c.step === 'dig' && !c.past
/** Should the bag hold the note? (an old keeper past the yard is not handed one) */
export const wantsInvite = (c: Chain) => !c.past

/** The keeper read the note: The Dig starts (or was already on through the ping). */
export function readInvite(c: Chain): Chain {
  if (c.read) return c
  return { ...c, read: true, step: 'dig' }
}

/** The keeper fell. Only the FIRST death matters (`died` sticks); a past keeper ignores it. */
export function onDeath(c: Chain): Chain {
  if (c.past || c.died) return c
  return { ...c, died: true }
}

export type ChainSay = 'ping' | 'nudge' | 'hint'

/** One look at the world (called on a timer while the page runs). `packLying` = a backpack is still on the ground.
 *  Returns the next chain and what Morel says now (at most one line per tick). */
export function tick(c: Chain, w: { packLying: boolean; now: number }): { chain: Chain; say: ChainSay | null } {
  if (c.past) return { chain: c, say: null }
  if (!c.pinged && c.died && !w.packLying) {
    // the ping's line is about the UNREAD note: a keeper who already read it has The Dig on and is owed nothing
    if (c.read) return { chain: { ...c, pinged: true, nudged: true }, say: null }
    return { chain: { ...c, pinged: true, pingAt: w.now, step: 'dig' }, say: 'ping' }
  }
  if (c.pinged && !c.nudged && !c.read && c.pingAt !== undefined && w.now - c.pingAt >= NUDGE_MS) {
    return { chain: { ...c, nudged: true }, say: 'nudge' }
  }
  return { chain: c, say: null }
}

/** A gate panel opened (the fold map, with travel). The hint goes once, only with The Dig on AND the note read
 *  (morel-dig-ping-script §3: Morel may not speak of a note the keeper has not opened). */
export function onGateOpen(c: Chain): { chain: Chain; say: ChainSay | null } {
  if (!digActive(c) || !c.read || c.hinted) return { chain: c, say: null }
  return { chain: { ...c, hinted: true }, say: 'hint' }
}

/** The flip button pulses while The Dig is on and the keeper has not yet turned the map over. */
export const flipPulse = (c: Chain) => digActive(c) && !c.flipped
/** The keeper turned the map to the Athernyx side. */
export function onFlip(c: Chain, to: 'ather' | 'athernyx'): Chain {
  if (to !== 'athernyx' || !digActive(c) || c.flipped) return c
  return { ...c, flipped: true }
}
/** Rune Hold pulses in the Nyx door list while The Dig is on (until the yard beat lands, next slice). */
export const runeHoldPulse = (c: Chain) => digActive(c)
