/**
 * vessels.ts — THE VESSELS A KEEPER OWNS, AND THE LETTERS THAT RIDE THEM.
 *
 * ── ★★ RULED 2026-09-03 (Alex, in the inventory-menu conversation): GEMS RIDE THE VESSEL ───────
 * *"the load out should be where the collected vessels can be equipt"* + *"yes, gems ride the
 * vessel"*. Canon already said the vessel is the PAPER (`shimmer-skilling.md` § THE CASTING
 * VESSELS); this makes that literal. A bracelet IS its letters and the word written in them —
 * equip a different one and its tactical comes with it.
 *
 * ── ⚠ THIS REPLACES `loadouts.ts`, WHICH SHIPPED THE DAY BEFORE, AND THE REASON MATTERS ────────
 * That file sold a PAIR: focus + bracelet welded together, bought as one, swapped as one. The pair
 * was **Jin's call, never canon** — it said so itself, under JIN'S CALLS: *"a pair is a pair."*
 * Canon's actual sentence (`shimmer-skilling.md` § One loadout = one focus + one bracelet, Alex
 * verbatim 2026-09-03) is *"they will need to acquire more of both the focus and accessories"* —
 * **two acquisitions**, not one bundle. So this is not a departure from canon, it is a correction
 * TOWARD it, and it buys the obvious thing the pair forbade: wear bracelet A, hold focus B.
 *
 * A concept is DELETED rather than added. There is no "parked loadout" any more: the vessels you
 * own ARE your loadouts, and the Loadout tab equips them into a worn slot and a held slot.
 *
 * ── THE MODEL, AND WHY THE ACTIVE VESSELS DID NOT MOVE ──
 * Exactly the trick `loadouts.ts` got right and is worth keeping: the EQUIPPED bracelet and focus
 * live where they always have — their letters under `VESSELS_KEY`, their moves under `LOADOUT_KEY`
 * — so `resolveLoadout`, the cast bar, the letters card, `/rune` and `/reborn` read the same two
 * keys and know nothing about this file. What is new is the STOWED list: every vessel the keeper
 * owns but is not wearing, each carrying its own gems and its own word. Equipping exchanges one
 * stowed vessel with the equipped one OF THE SAME KIND; the host bumps `runeTick` to re-resolve.
 *
 * ── ⚠ THE LEGACY DOOR IS LOAD-BEARING, NOT TIDINESS ────────────────────────────────────────────
 * Keepers bought pairs for 150 Marks on 2026-09-03. Renaming the key without reading the old one
 * would silently take back what they paid for. `loadStowed` migrates `ather:shimmer:parked` on
 * first read — each pair splits into the two vessels it always was — and then removes it, so the
 * migration runs once and cannot double-credit.
 *
 * ── JIN'S CALLS (canon rules that more loadouts need more vessels; these are the build's) ──
 *   · a bracelet and a focus cost `VESSEL_PRICE` Marks EACH at the Passage's vessel shelf, any day.
 *     75 + 75 = the 150 the retired pair cost, so nobody pays more for the change than they did
 *     before it — a correction should not arrive as a price rise
 *   · `MAX_PER_KIND` of each kind in all, counting the one you are wearing
 *   · a new vessel arrives EMPTY: no letters, no word. The bag is shared; the paper is not
 *   · equipping is free and instant; a cozy game does not tax changing your mind
 *   · vessel tiers and materials are still not modelled: a bracelet is a bracelet
 *
 * ── VOCABULARY ── ✅ vessel, bracelet, focus, stow / stowed, equip, worn, held.
 * ⛔ pair (retired with the model), slot (the Citadel's), band, socket.
 */
import { keeperKey } from '@/lib/keeper-local'
import { LOADOUT_KEY, rawLoadout, saveLoadout, type Loadout } from './loadout'
import { VESSELS_KEY, loadLetters, saveLetters, lettersOf, missingLetters, unbindLetters, VESSELS, VESSEL_FOR_KIND, VESSEL_CAP, type Vessel, type Letters } from './gems'
import { moveById } from './keeper-moves'
import { ALL_BANDS } from './cast'

export const STOWED_KEY = 'ather:shimmer:stowed'
/** ⚠ read ONCE, by `loadStowed`, then removed. The 09-03 pairs; see the legacy-door note above. */
export const LEGACY_PAIRS_KEY = 'ather:shimmer:parked'

export const VESSEL_PRICE = 75
export const MAX_PER_KIND = 3

/** a vessel the keeper owns but is not wearing: its own letters, its own word */
export interface StowedVessel { kind: Vessel; gems: string[]; move: string | null }

/**
 * Which cast band each vessel bears, DERIVED from `VESSEL_FOR_KIND` rather than restated.
 * A hand-kept `{bracelet: 0, focus: 1}` here would be a mirror of that map that agrees with it
 * until the day the bands change — the exact shape PATTERNS calls a copy reading as corroboration.
 */
export const BAND_FOR_VESSEL: Record<Vessel, number> = VESSELS.reduce((acc, v) => {
  acc[v] = ALL_BANDS.findIndex((kind) => VESSEL_FOR_KIND[kind] === v)
  return acc
}, {} as Record<Vessel, number>)

export const emptyVessel = (kind: Vessel): StowedVessel => ({ kind, gems: [], move: null })

const isVessel = (x: unknown): x is Vessel => typeof x === 'string' && (VESSELS as readonly string[]).includes(x)
const gemList = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((r): r is string => typeof r === 'string').slice(0, VESSEL_CAP) : []
const moveOf = (x: unknown): string | null => (typeof x === 'string' ? x : null)

function parseStowed(raw: unknown): StowedVessel[] {
  if (!Array.isArray(raw)) return []
  const out: StowedVessel[] = []
  for (const p of raw) {
    const o = (p && typeof p === 'object' ? p : {}) as { kind?: unknown; gems?: unknown; move?: unknown }
    if (!isVessel(o.kind)) continue
    out.push({ kind: o.kind, gems: gemList(o.gems), move: moveOf(o.move) })
  }
  return capped(out)
}

/**
 * A stowed list may hold at most `MAX_PER_KIND - 1` of each kind: the keeper is wearing the other
 * one. Trimmed per KIND, not globally — a global cap would let three bracelets crowd out the focus.
 */
function capped(list: readonly StowedVessel[]): StowedVessel[] {
  const seen: Record<string, number> = {}
  const out: StowedVessel[] = []
  for (const v of list) {
    const n = (seen[v.kind] ?? 0) + 1
    if (n > MAX_PER_KIND - 1) continue
    seen[v.kind] = n
    out.push(v)
  }
  return out
}

/**
 * The 09-03 pairs, as the vessels they always were. Each `{slots, vessels}` becomes one bracelet
 * and one focus, each keeping the letters that were set in it and the word bound to its band.
 */
function migratePairs(raw: unknown): StowedVessel[] {
  if (!Array.isArray(raw)) return []
  const out: StowedVessel[] = []
  for (const p of raw) {
    const o = (p && typeof p === 'object' ? p : {}) as { slots?: unknown; vessels?: Record<string, unknown> }
    const slots: unknown[] = Array.isArray(o.slots) ? (o.slots as unknown[]) : []
    for (const kind of VESSELS) {
      const band = BAND_FOR_VESSEL[kind]
      out.push({ kind, gems: gemList(o.vessels?.[kind]), move: band >= 0 ? moveOf(slots[band]) : null })
    }
  }
  return capped(out)
}

export function loadStowed(): StowedVessel[] {
  try {
    const raw = localStorage.getItem(keeperKey(STOWED_KEY))
    if (raw) return parseStowed(JSON.parse(raw))
    const legacy = localStorage.getItem(keeperKey(LEGACY_PAIRS_KEY))
    if (!legacy) return []
    const migrated = migratePairs(JSON.parse(legacy))
    saveStowed(migrated)
    localStorage.removeItem(keeperKey(LEGACY_PAIRS_KEY))   // once, so it cannot double-credit
    return migrated
  } catch { return [] }
}

export function saveStowed(list: readonly StowedVessel[]): void {
  try { localStorage.setItem(keeperKey(STOWED_KEY), JSON.stringify(capped(list))) } catch { /* private mode */ }
}

export function clearStowed(): void {
  try {
    localStorage.removeItem(keeperKey(STOWED_KEY))
    localStorage.removeItem(keeperKey(LEGACY_PAIRS_KEY))   // a reborn keeper keeps no pairs either
  } catch { /* private mode */ }
}

/** how many of `kind` the keeper owns: the one they are wearing plus every stowed one */
export function ownedCount(kind: Vessel): number {
  return 1 + loadStowed().filter(v => v.kind === kind).length
}

export type VesselRefusal = 'too-dear' | 'at-cap' | 'no-such-word'
export interface VesselPurchase { ok: boolean; marks: number; why?: VesselRefusal; say: string }

const NOUN: Record<Vessel, string> = { bracelet: 'A bracelet', focus: 'A focus' }

/** Buy one vessel: a new, EMPTY one, stowed. Persists on success; the caller spends the Marks. */
export function buyVessel(kind: Vessel, marks: number, word?: string): VesselPurchase {
  const stowed = loadStowed()
  // ★ MADE FOR ONE WORD (Alex, 2026-09-04). The Passage makes the paper to order, for a word the keeper
  // already holds; the vessel's seats are that word's letters. `word` is optional only for the legacy
  // blank (a vessel bought before the ruling), which the satchel lets a keeper assign a word to.
  const m = word !== undefined ? moveById(word) : undefined
  if (word !== undefined && (!m || ALL_BANDS[BAND_FOR_VESSEL[kind]] !== m.tier)) {
    return { ok: false, marks, why: 'no-such-word', say: `Nobody down here has heard of that word for a ${kind}.` }
  }
  if (1 + stowed.filter(v => v.kind === kind).length >= MAX_PER_KIND) {
    return { ok: false, marks, why: 'at-cap', say: `Three ${kind}s is what a keeper can carry. Nobody down here will sell you a fourth.` }
  }
  if (marks < VESSEL_PRICE) {
    return { ok: false, marks, why: 'too-dear', say: `${VESSEL_PRICE} Marks — grown, not ridden in. Come back with them.` }
  }
  saveStowed([...stowed, { kind, gems: [], move: m?.id ?? null }])
  const seats = m ? lettersOf(m, null).length : 0
  return {
    ok: true, marks: marks - VESSEL_PRICE,
    say: m ? `${NOUN[kind]} for ${m.name}, ${seats} seat${seats === 1 ? '' : 's'} cut. Set its letters and it is yours to wear.`
           : `${NOUN[kind]}, empty. Write something on it.`,
  }
}

/**
 * The vessel of `kind` the keeper is WEARING, read off the two live keys — its letters from the
 * letters record, its word from the saved loadout. This is the half that never moved.
 */
export function equippedVessel(kind: Vessel, birth: string | null, starter?: string): StowedVessel {
  const active = loadLetters(birth, rawLoadout(), starter)
  const band = BAND_FOR_VESSEL[kind]
  return { kind, gems: [...active.vessels[kind]], move: band >= 0 ? (rawLoadout()[band] ?? null) : null }
}

/**
 * Equip stowed vessel `i`, exchanging it with the one of the same kind the keeper is wearing. The
 * bag is untouched — loose letters are the keeper's, not the paper's. Returns false when `i` names
 * nothing, or names a vessel of the other kind (the worn slot does not take a focus).
 *
 * ⚠ Reads the active letters through `loadLetters` with the ACTIVE saved loadout, so a keeper who
 * has never been seeded is seeded FIRST (the migration door) rather than having an empty vessel
 * swapped in over letters they were about to be granted.
 */
export function equip(kind: Vessel, i: number, birth: string | null, starter?: string): boolean {
  const stowed = loadStowed()
  const next = stowed[i]
  if (!next || next.kind !== kind) return false
  // ★ ONLY A WRITTEN VESSEL IS GEAR (Alex, 2026-09-04): every seat its word cut must hold its letter.
  if (!isComplete(next, birth)) return false
  const band = BAND_FOR_VESSEL[kind]
  if (band < 0) return false
  const active = loadLetters(birth, rawLoadout(), starter)
  const slots: Loadout = ALL_BANDS.map((_, k) => rawLoadout()[k] ?? null)
  // The one coming off goes to the satchel with its word and letters. Wearing NOTHING (after a
  // dismantle) must not mint a blank vessel out of thin air — the slot is simply taken.
  if (slots[band] || active.vessels[kind].length) stowed[i] = { kind, gems: [...active.vessels[kind]], move: slots[band] ?? null }
  else stowed.splice(i, 1)
  saveStowed(stowed)

  slots[band] = next.move
  saveLoadout(slots)
  saveLetters({ bag: active.bag, vessels: { ...active.vessels, [kind]: [...next.gems] } })
  return true
}

/** the two keys an equip writes — restated for the guard that checks every keeper key is registered */
export const EQUIP_WRITES: readonly string[] = [LOADOUT_KEY, VESSELS_KEY]

// ── ★ A VESSEL IS MADE FOR ONE WORD, AND BEARS EXACTLY THE SEATS THAT WORD NEEDS (Alex, 2026-09-04) ──
// *"each vessel is unique that its made the word and none other so if the move its meant to represent
// has one slot then it only needs the one slot."* So `move` on a stowed vessel is not "what happens to
// be written on it" — it is what the paper was CUT for. The seat count is derived from the word, never
// stored; a word's letters come from `lettersOf`, which is also what the cast layer needs to run it, so
// the seats and the requirement cannot drift apart. `VESSEL_CAP` is the ceiling a word can ask for, not
// a property of every vessel. Filed for Magii to land in the brief (CANON_GAPS, 2026-09-04).
//
// The flow: the Passage makes a vessel for a word → it sits in the SATCHEL as a part → the keeper places
// the gems they hold (`placeGems`) → every seat filled = the word is WRITTEN = it moves to Gear
// (`isComplete`) → equip / dismantle. Dismantle returns the letters (canon: unbind is free) and the
// vessel goes back to the satchel, still cut for its word.

/** The letters this vessel's seats were cut for. A legacy blank (bought before the ruling) has none yet. */
export function seatLetters(v: StowedVessel, birth: string | null): string[] {
  if (!v.move) return []
  const m = moveById(v.move)
  return m ? lettersOf(m, birth) : []
}
export const seatCount = (v: StowedVessel, birth: string | null): number => seatLetters(v, birth).length
/** Which of its own letters this vessel still lacks. */
export const shortOf = (v: StowedVessel, birth: string | null): string[] => missingLetters(seatLetters(v, birth), v.gems)
/** Written = made for a word AND every seat holds its letter. Only a written vessel is gear. */
export const isComplete = (v: StowedVessel, birth: string | null): boolean => !!v.move && shortOf(v, birth).length === 0
/** The stowed vessels of a kind that are written — what the Gear dropdown may offer to equip. */
export function completeVessels(kind: Vessel, birth: string | null): { v: StowedVessel; i: number }[] {
  return loadStowed().map((v, i) => ({ v, i })).filter(({ v }) => v.kind === kind && isComplete(v, birth))
}

export interface Placement { ok: boolean; placed: string[]; short: string[]; complete: boolean; say: string }
/**
 * Place, from the bag, every letter this vessel is still short — as many as the bag holds. Writes the
 * stowed list; RETURNS the letters for the caller to save (same shape as `imbue`, so a private-mode
 * refusal to persist is the caller's to notice). `ok` means at least one gem moved.
 */
export function placeGems(i: number, birth: string | null, l: Letters): { r: Placement; letters: Letters } {
  const stowed = loadStowed()
  const v = stowed[i]
  if (!v) return { r: { ok: false, placed: [], short: [], complete: false, say: 'No such vessel.' }, letters: l }
  if (!v.move) return { r: { ok: false, placed: [], short: [], complete: false, say: 'This one was never cut for a word. Choose one first.' }, letters: l }
  const bag = { ...l.bag }
  const placed: string[] = []
  const short: string[] = []
  for (const r of shortOf(v, birth)) {
    if ((bag[r] ?? 0) > 0) { bag[r] = bag[r]! - 1; placed.push(r) } else short.push(r)
  }
  if (!placed.length) {
    return { r: { ok: false, placed, short, complete: false, say: `You hold none of what it is short: ${short.join(', ')}.` }, letters: l }
  }
  stowed[i] = { ...v, gems: [...v.gems, ...placed] }
  saveStowed(stowed)
  const tidy: Record<string, number> = {}
  for (const [k, n] of Object.entries(bag)) if (n > 0) tidy[k] = n
  const complete = short.length === 0
  return {
    r: { ok: true, placed, short, complete,
         say: complete ? `Written. It is gear now — find it on the Gear tab.` : `${placed.length} set. Still short: ${short.join(', ')}.` },
    letters: { bag: tidy, vessels: l.vessels },
  }
}
/** Take a stowed vessel apart: its gems go back to the bag; the paper stays cut for its word. Returns the letters to save. */
export function dismantle(i: number, l: Letters): Letters {
  const stowed = loadStowed()
  const v = stowed[i]
  if (!v || !v.gems.length) return l
  const bag = { ...l.bag }
  for (const r of v.gems) bag[r] = (bag[r] ?? 0) + 1
  stowed[i] = { ...v, gems: [] }
  saveStowed(stowed)
  return { bag, vessels: l.vessels }
}
/**
 * Take the WORN vessel apart: its letters return to the bag, its band clears, and the empty paper goes
 * back to the satchel still cut for its word. Refuses at the stowed cap (three of a kind is what a
 * keeper carries, worn or not). A keeper with nothing worn still casts their birth move — the floor.
 */
export function dismantleWorn(kind: Vessel, birth: string | null, starter?: string): boolean {
  const band = BAND_FOR_VESSEL[kind]
  if (band < 0) return false
  const slots: Loadout = ALL_BANDS.map((_, k) => rawLoadout()[k] ?? null)
  const word = slots[band] ?? null
  const active = loadLetters(birth, slots, starter)
  if (!word && !active.vessels[kind].length) return false
  const stowed = loadStowed()
  if (stowed.filter(v => v.kind === kind).length >= MAX_PER_KIND - 1) return false
  saveStowed([...stowed, { kind, gems: [], move: word }])
  saveLetters(unbindLetters(active, kind))
  slots[band] = null
  saveLoadout(slots)
  return true
}
/** Give a legacy blank its word. Refuses if the vessel already has one, or holds gems its new word cannot seat. */
export function setWord(i: number, word: string, birth: string | null): boolean {
  const stowed = loadStowed()
  const v = stowed[i]
  if (!v || v.move) return false
  const m = moveById(word)
  if (!m || ALL_BANDS[BAND_FOR_VESSEL[v.kind]] !== m.tier) return false
  if (missingLetters(v.gems, lettersOf(m, birth)).length) return false
  stowed[i] = { ...v, move: word }
  saveStowed(stowed)
  return true
}
