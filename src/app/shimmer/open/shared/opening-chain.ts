// ── THE OPENING CHAIN: ATHER TO NYX (BETA M73) ─────────────────────────────────────────────────────────────────────────
// The keeper starts in the Ather with Kael's invite folded in the bag. Reading it starts THE DIG; so does Morel's ping,
// which comes after the keeper's FIRST death, once the backpack they dropped is recovered or has run out (no pack = it is
// already settled). The ping fires ONCE (never on a second death), and only while the note is still unread. A nudge follows
// once, a long while later, if the note is still folded. At a gate with The Dig on and the note read, Morel says where the
// flip button is, once (MOREL_HINT.digFlip).
//
// Steps:  invite  (note in the bag, The Dig not started)
//      -> dig     (The Dig: nearest gate, flip the map, Rune Hold, then the shipyard above it)
//      -> yard    (s3: the keeper stood in Kael's yard above Rune Hold: empty, the ship broken. Kael's journal page is FOUND
//                  there (handed into the bag once); reading it sends the keeper to Veyra at the Travelers Station)
//      -> repair  (Veyra Unit 1 v2's send line played: THE SHIP-REPAIR FLAG (shipRepair). STOP: the repair quest = M108)
// Veyra's talk is pure too (veyraOpen / veyraPick below): the asked and where lines in either order, the send after both,
// or after just one when the keeper takes the '…' instead of the other question (the script's send trigger).
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

export type ChainStep = 'invite' | 'dig' | 'yard' | 'repair'
const STEPS: readonly ChainStep[] = ['invite', 'dig', 'yard', 'repair']
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
  /** s3: Kael's journal page was handed into the bag at the yard (once) */
  page: boolean
  /** s3: the keeper read the page: Veyra is next (station:veyra-1) */
  pageRead: boolean
}

export const newChain = (): Chain => ({ v: 1, step: 'invite', read: false, died: false, pinged: false, nudged: false, hinted: false, flipped: false, page: false, pageRead: false })

/** A saved record, or null (then `migrate` decides). Anything malformed is null, never a half chain. */
export function parseChain(raw: unknown): Chain | null {
  const c = raw as Chain | null
  if (!c || c.v !== 1 || !STEPS.includes(c.step)) return null
  const b = (x: unknown) => x === true
  return {
    v: 1, step: c.step, read: b(c.read), died: b(c.died), pinged: b(c.pinged), nudged: b(c.nudged), hinted: b(c.hinted), flipped: b(c.flipped), page: b(c.page), pageRead: b(c.pageRead),
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

/** still before the yard (the note's beats) */
const early = (c: Chain) => c.step === 'invite' || c.step === 'dig'

export type ChainSay = 'ping' | 'nudge' | 'hint'

/** One look at the world (called on a timer while the page runs). `packLying` = a backpack is still on the ground.
 *  Returns the next chain and what Morel says now (at most one line per tick). */
export function tick(c: Chain, w: { packLying: boolean; now: number }): { chain: Chain; say: ChainSay | null } {
  if (c.past) return { chain: c, say: null }
  if (!c.pinged && c.died && !w.packLying) {
    // the ping's line is about the UNREAD note: a keeper who already read it has The Dig on and is owed nothing (nor is one
    // who walked to the yard without it: the chain is already past the note)
    if (c.read || !early(c)) return { chain: { ...c, pinged: true, nudged: true }, say: null }
    return { chain: { ...c, pinged: true, pingAt: w.now, step: 'dig' }, say: 'ping' }
  }
  if (c.pinged && !c.nudged && !c.read && early(c) && c.pingAt !== undefined && w.now - c.pingAt >= NUDGE_MS) {
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
/** Rune Hold pulses in the Nyx door list while The Dig is on (the yard ends it: step 'yard'). */
export const runeHoldPulse = (c: Chain) => digActive(c)

// ── s3: THE YARD -> THE JOURNAL PAGE -> VEYRA -> THE SHIP-REPAIR FLAG ─────────────────────────────────────────────────────
/** the journal page's bag id (kael-journal-page-script.md, SIGNED b317812); kept on a fall like the note */
export const KAEL_PAGE = 'kael_page'
/** the bag's one-off gift mark: the page is found once per keeper */
export const GIFT_KAEL_PAGE = 'kael_page'

/** The keeper stands in Kael's yard (the inherited shipyard plot above Rune Hold). From the invite or The Dig (a keeper who
 *  walked up without reading the note still found the yard); a past keeper and a later step are left alone. */
export function onYard(c: Chain): Chain {
  if (c.past || !early(c)) return c
  return { ...c, step: 'yard' }
}
/** Should the yard hand the page into the bag now? (once; the store retries while the bag is full) */
export const wantsPage = (c: Chain) => c.step === 'yard' && !c.page && !c.past
export function pageFound(c: Chain): Chain { return c.page ? c : { ...c, page: true } }
/** The keeper read the page (only once it is theirs, at the yard step): Veyra is next. */
export function readPage(c: Chain): Chain {
  if (c.step !== 'yard' || !c.page || c.pageRead) return c
  return { ...c, pageRead: true }
}

/** ★ THE SHIP-REPAIR FLAG (M73 s3 -> M108 + world-destmap read this). Set by Veyra's send line. A past keeper (Kael's chest
 *  already open before the chain shipped) has stood in the yard and is past Veyra too, so the flag reads set for them. */
export const shipRepair = (c: Chain) => c.step === 'repair' || c.past === true
/** Veyra's send line played (station:veyra-1:send): the flag sets. Only from the yard with the page read. */
export function onVeyraSend(c: Chain): Chain {
  if (c.step !== 'yard' || !c.pageRead) return c
  return { ...c, step: 'repair' }
}

/** What Veyra has for the keeper at the Travelers Station: Unit 1 v2 (page read), the bark (flag set, the ship not yet
 *  flown: nothing flies yet), or nothing (the Station opens straight to its panel, as before). */
export type VeyraDue = 'unit1' | 'bark' | null
export function veyraDue(c: Chain): VeyraDue {
  if (c.past) return null
  if (c.step === 'yard' && c.pageRead) return 'unit1'
  if (c.step === 'repair') return 'bark'
  return null
}

/** Veyra's talk, as a cursor over the SIGNED lines (veyra-lines.ts carries the text; this carries the order). */
export type VeyraBeat = 'open' | 'kaels' | 'asked1' | 'asked2' | 'where1' | 'where2' | 'send' | 'bark'
export interface VeyraTalk { at: VeyraBeat; asked: boolean; where: boolean }
export type VeyraPick = 'next' | 'asked' | 'where'
export const veyraOpen = (due: Exclude<VeyraDue, null>): VeyraTalk => ({ at: due === 'bark' ? 'bark' : 'open', asked: false, where: false })
/** the keeper's options at a beat ('next' = the '…' continue) */
export function veyraOptions(t: VeyraTalk): VeyraPick[] {
  if (t.at === 'kaels') return ['asked', 'where']
  // after one question's last line: the other question, or '…' (the send fires after just the one)
  if (t.at === 'asked2' && !t.where) return ['where', 'next']
  if (t.at === 'where2' && !t.asked) return ['asked', 'next']
  return ['next']
}
/** the next cursor, or 'done' (the talk closes). `send` = this pick plays the send line's beat away: the flag sets when
 *  the send line is SHOWN, which the caller does when the cursor lands on 'send'. */
export function veyraPick(t: VeyraTalk, p: VeyraPick): VeyraTalk | 'done' {
  if (!veyraOptions(t).includes(p)) return t
  switch (t.at) {
    case 'open': return { ...t, at: 'kaels' }
    case 'kaels': return p === 'asked' ? { ...t, at: 'asked1', asked: true } : { ...t, at: 'where1', where: true }
    case 'asked1': return { ...t, at: 'asked2' }
    case 'where1': return { ...t, at: 'where2' }
    case 'asked2': return p === 'where' ? { ...t, at: 'where1', where: true } : { ...t, at: 'send' }
    case 'where2': return p === 'asked' ? { ...t, at: 'asked1', asked: true } : { ...t, at: 'send' }
    default: return 'done'   // send, bark
  }
}
