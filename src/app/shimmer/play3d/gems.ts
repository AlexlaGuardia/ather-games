/**
 * gems.ts — THE LETTERS AND THE PAPER. Rune-gems a keeper carries, and the two vessels they are set in.
 *
 * ── THE FOUR LAYERS (RULED 2026-09-03, /magii + Alex — `shimmer-skilling.md` § THE CASTING VESSELS) ──
 *   rune        = identity, born or trained, never bought (08-03)      → `rune-inventory.ts`
 *   rune-gem    = the LETTER, countable, found/bought/bound            → the BAG here (`GemStock`)
 *   combination = the WORD, taught by a master or carried by a scroll → the book (`book.ts`)
 *   vessel      = the PAPER, bears at most three gems, innately        → the VESSELS here
 *
 * Alex's sentence — *"if two moves require the same rune the player would need to acquire two of that
 * rune"* — is answered exactly: two Barrier GEMS. A keeper learns Barrier once because Barrier is a
 * thing they are; what a second move consumes is a second letter.
 *
 * ── THE VESSELS ──
 *   BRACELET — worn at the wrist — bears the TACTICALS, and takes only ELEMENT-lane gems.
 *   FOCUS    — held —              bears the SIGNATURE, and takes only STATE-lane gems.
 * The vessel gates the lane physically: the Lane Law stops being a tooltip and becomes an object.
 * One loadout = one focus + one bracelet; a keeper starts with one of each.
 *
 * ⚠ `Vessels` HERE IS THE PAIR THE KEEPER IS *WEARING*, NOT EVERY VESSEL THEY OWN (2026-09-03).
 * Alex ruled that gems ride the vessel: a bracelet IS its letters and the word written in them, and
 * the Loadout tab equips the one you want. `vessels.ts` owns the ones you are not wearing and swaps
 * them through these same two keys — which is why nothing in this file had to learn about it.
 *
 * ── ⛔ THE FLOOR ──
 * The doubled-focus tactical and the Manifestation — a move written in the birth rune ALONE — take no
 * gem and no vessel; they are held in the body. So are the birth-exclusive traits and every passive
 * (canon: a passive occupies an INNATE socket). "The vessel holds what you learned; your body holds
 * what you are." There is no state of this economy in which a keeper is disarmed by poverty.
 *
 * ── ★★ THE LETTERS GROW IN (RULED 2026-09-27, /magii + Alex — `shimmer-casting-vessels.md` › THE LETTERS GROW IN) ──
 * A vessel's letters grow into it when it is MADE (cut, found or won). A keeper never sets a stone and
 * there is no casting bag any more. So everything above about binding is history: `Vessels` is always
 * exactly the worn word's letters (`growWorn` makes it so on every read), and `bag` holds LOOSE STONES —
 * material, sold at the Passage's counter (`sellStones`) or taken by the cutter as part-payment
 * (`takeStones`). Nothing in the build puts a stone in the bag any more; what is there came from before.
 * The guard that replaced the gem: the letters stay DARK until the keeper knows the word (`vessels.ts` › `isLit`).
 *
 * ── JIN'S CALLS ──
 *   · a loose stone sells for `STONE_SELL` Marks; the cutter takes one of the word's own letters for
 *     `STONE_CREDIT` off its price. The cutter is the better road, the way imbuing used to be
 *   · a keeper whose worn vessel held the wrong letters (a save from the binding days) keeps them as loose stones
 *   · gem quality is still not modelled; when it is, it lands on the vessel, not the stone (ruled)
 *
 * ── VOCABULARY (canon) ── ✅ gem / rune-gem, stone (loose), bracelet, focus, grown in, lit / dark.
 * ⛔ never: socket, sigil, slot (the Citadel's), amulet / pendant (Lazerin's), cuff / collar, forge, band.
 */
import { ALL_BANDS, LANE_FOR_KIND, laneRunes, type SlotKind } from './cast'
import { moveById, type KeeperMove } from './keeper-moves'
import { keeperKey } from '@/lib/keeper-local'

export const GEMS_KEY = 'ather:shimmer:gems'
export const VESSELS_KEY = 'ather:shimmer:vessels'
/**
 * the WORD the worn vessel of each kind was cut for. Lives here (not in `vessels.ts`, which re-exports it)
 * so `loadLetters` can grow the worn letters without importing its own importer.
 */
export const WORN_WORD_KEY = 'ather:shimmer:worn-word'
/** Marks the Passage counter pays for one loose stone */
export const STONE_SELL = 15
/** Marks the cutter takes off a vessel's price for each of its word's letters the keeper hands over as a stone */
export const STONE_CREDIT = 30
/** a vessel bears at most three gems — canon's cap, arrived at innately (no socket) */
export const VESSEL_CAP = 3

export type Vessel = 'bracelet' | 'focus'
/** which vessel a cast slot reads. Passives/traits are body-held: no vessel. */
export const VESSEL_FOR_KIND: Record<SlotKind, Vessel | null> = {
  tactical: 'bracelet', ultimate: 'focus', passive: null, trait: null,
}
export const VESSELS: readonly Vessel[] = ['bracelet', 'focus']

/** loose letters in the bag: rune id → how many gems of it */
export type GemStock = Record<string, number>
/** letters SET into each vessel, one entry per gem */
export type Vessels = Record<Vessel, string[]>
export interface Letters { bag: GemStock; vessels: Vessels }

export const EMPTY_LETTERS: Letters = { bag: {}, vessels: { bracelet: [], focus: [] } }

/** Held in the body: a move written in the birth rune alone, a birth-exclusive trait, any passive. */
export function isBodyHeld(m: KeeperMove, birth: string | null): boolean {
  if (m.tier === 'passive' || m.tier === 'trait') return true
  if (m.birthExclusive) return true
  return m.runes.length === 1 && m.runes[0] === birth
}

/**
 * The letters a move is written in. Empty for a body-held move — it needs no paper.
 * ★ The birth letter comes first (09-28): a word carrying the keeper's birth rune is written from it.
 */
export function lettersOf(m: KeeperMove, birth: string | null): string[] {
  if (isBodyHeld(m, birth)) return []
  return birth && m.runes.includes(birth) ? [birth, ...m.runes.filter(r => r !== birth)] : [...m.runes]
}

/** The vessel whose lane a gem of `rune` may be set in, for this keeper — or null if neither. */
export function vesselForGem(rune: string, birth: string | null): Vessel | null {
  for (const v of VESSELS) {
    const kind = VESSELS_KIND[v]
    const lane = LANE_FOR_KIND[kind]
    if (lane && laneRunes(birth, lane).has(rune)) return v
  }
  return null
}
const VESSELS_KIND: Record<Vessel, SlotKind> = { bracelet: 'tactical', focus: 'ultimate' }

function countOf(list: readonly string[]): GemStock {
  const out: GemStock = {}
  for (const r of list) out[r] = (out[r] ?? 0) + 1
  return out
}

/** Letters of `need` not covered by `have` (a multiset difference), in `need` order. */
export function missingLetters(need: readonly string[], have: readonly string[]): string[] {
  const pool = countOf(have)
  const out: string[] = []
  for (const r of need) {
    if ((pool[r] ?? 0) > 0) pool[r]! -= 1
    else out.push(r)
  }
  return out
}

function bagList(bag: GemStock): string[] {
  return Object.entries(bag).flatMap(([r, n]) => Array.from({ length: Math.max(0, n) }, () => r))
}

/** Can this move be SET in this vessel from what is there plus what is in the bag? Names what is short. */
export function shortFor(m: KeeperMove, birth: string | null, l: Letters, vessel: Vessel): string[] {
  const need = lettersOf(m, birth)
  if (!need.length) return []
  return missingLetters(need, [...l.vessels[vessel], ...bagList(l.bag)])
}

/**
 * Bind: move the move's letters from the bag into the vessel. Returns null when a letter is missing,
 * a gem is off the vessel's lane, or the vessel would exceed its cap — the caller refuses the bind.
 * Letters already set in the vessel count (re-binding the same move is a no-op on the gems).
 */
export function bindLetters(l: Letters, vessel: Vessel, m: KeeperMove, birth: string | null): Letters | null {
  const need = lettersOf(m, birth)
  if (!need.length) return l
  const lane = LANE_FOR_KIND[VESSELS_KIND[vessel]]
  const onLane = lane ? laneRunes(birth, lane) : null
  if (onLane && need.some((r) => !onLane.has(r))) return null   // the vessel gates the lane, physically
  const fromVessel = missingLetters(need, l.vessels[vessel])     // what the vessel does not already hold
  const set = need.length - fromVessel.length
  const bag = { ...l.bag }
  for (const r of fromVessel) {
    if ((bag[r] ?? 0) <= 0) return null
    bag[r] = bag[r]! - 1
  }
  const held = [...l.vessels[vessel]]
  // letters the vessel holds that this move does not use go back to the bag — one move per vessel today
  const spare = missingLetters(held, need)
  for (const r of spare) { bag[r] = (bag[r] ?? 0) + 1; held.splice(held.indexOf(r), 1) }
  if (held.length + fromVessel.length > VESSEL_CAP) return null
  void set
  return { bag: tidy(bag), vessels: { ...l.vessels, [vessel]: [...held, ...fromVessel] } }
}

/** Unbind: return everything set in the vessel to the bag. Free — Jin's call. */
export function unbindLetters(l: Letters, vessel: Vessel): Letters {
  const bag = { ...l.bag }
  for (const r of l.vessels[vessel]) bag[r] = (bag[r] ?? 0) + 1
  return { bag: tidy(bag), vessels: { ...l.vessels, [vessel]: [] } }
}

/** Put gems in the bag (a find, a purchase, Gregory's gift, the dev door). */
export function addGems(l: Letters, rune: string, n = 1): Letters {
  const bag = { ...l.bag, [rune]: (l.bag[rune] ?? 0) + n }
  return { bag: tidy(bag), vessels: l.vessels }
}

function tidy(bag: GemStock): GemStock {
  const out: GemStock = {}
  for (const [r, n] of Object.entries(bag)) if (n > 0) out[r] = n
  return out
}

/** every letter a keeper has, set or loose, as counts */
export function allLetters(l: Letters): GemStock {
  return countOf([...bagList(l.bag), ...l.vessels.bracelet, ...l.vessels.focus])
}

// ── the worn word, and the letters that grow from it ─────────────────────────────────────────

function loadWornWords(): Record<Vessel, string | null> {
  const out = { bracelet: null, focus: null } as Record<Vessel, string | null>
  try {
    const raw = JSON.parse(localStorage.getItem(keeperKey(WORN_WORD_KEY)) ?? 'null') as unknown
    if (raw && typeof raw === 'object') for (const k of VESSELS) { const v = (raw as Record<string, unknown>)[k]; out[k] = typeof v === 'string' ? v : null }
  } catch { /* private mode */ }
  return out
}
export function saveWornWord(kind: Vessel, move: string | null): void {
  try { localStorage.setItem(keeperKey(WORN_WORD_KEY), JSON.stringify({ ...loadWornWords(), [kind]: move })) } catch { /* private mode */ }
}
/** the word the worn vessel of `kind` was cut for, or null when nothing is recorded */
export const wornWord = (kind: Vessel): string | null => loadWornWords()[kind]

const bandOf = (kind: Vessel): number => ALL_BANDS.findIndex((k) => VESSEL_FOR_KIND[k] === kind)

/**
 * The word the WORN vessel of `kind` is made for: the recorded one, else — for a save from before the
 * record — the bound band, but only while something is actually worn (letters present). Null = nothing worn.
 */
export function wornWordFor(kind: Vessel, bound: readonly (string | null)[], held: readonly string[]): string | null {
  const rec = wornWord(kind)
  if (rec) return rec
  const b = bandOf(kind)
  return held.length && b >= 0 ? (bound[b] ?? null) : null
}

/**
 * ★ THE LETTERS GROW IN: the worn vessel holds exactly its word's letters. A worn vessel short a letter
 * (the binding days let a keeper wear one half-written) is given it; a letter it held that its word does
 * not use comes out as a loose stone. Pure.
 */
export function growWorn(l: Letters, birth: string | null, bound: readonly (string | null)[]): Letters {
  let bag = { ...l.bag }
  const vessels = { ...l.vessels }
  for (const kind of VESSELS) {
    const word = wornWordFor(kind, bound, l.vessels[kind])
    const m = word ? moveById(word) : undefined
    const grown = m ? lettersOf(m, birth) : []
    if (!word) continue
    for (const r of missingLetters(l.vessels[kind], grown)) bag[r] = (bag[r] ?? 0) + 1   // spare letters → loose stones
    vessels[kind] = grown
  }
  bag = tidy(bag)
  return { bag, vessels }
}

/** Loose stones, as one count. */
export const stoneCount = (l: Letters): number => Object.values(l.bag).reduce((a, n) => a + n, 0)

/**
 * The cutter's part-payment: take, from the loose stones, one of each of `word`'s letters the keeper
 * holds. Returns the letters left and what was taken. Pure; the caller prices it (`STONE_CREDIT` each).
 */
export function takeStones(l: Letters, need: readonly string[]): { letters: Letters; taken: string[] } {
  const bag = { ...l.bag }
  const taken: string[] = []
  for (const r of need) if ((bag[r] ?? 0) > 0) { bag[r] = bag[r]! - 1; taken.push(r) }
  return { letters: { bag: tidy(bag), vessels: l.vessels }, taken }
}

/** Take `n` loose stones of `rune` off the keeper for the counter. Null when they hold fewer. */
export function sellStones(l: Letters, rune: string, n = 1): Letters | null {
  if (n <= 0 || (l.bag[rune] ?? 0) < n) return null
  return { bag: tidy({ ...l.bag, [rune]: l.bag[rune]! - n }), vessels: l.vessels }
}

// ── persistence ──────────────────────────────────────────────────────────────────────────────

function parse(raw: string | null): unknown {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

/**
 * Read the letters, SEEDING a keeper who has none saved.
 *
 * @param birth   the keeper's birth rune — decides what is body-held and needs no letter
 * @param bound   the saved loadout EXACTLY as stored (`rawLoadout`) — a keeper keeps what they carry
 * @param starter Gregory's gift — kept for the signature; since 2026-09-27 it adds no loose letters
 *
 * ★ THE SEED IS THE MIGRATION. Every keeper alive when this shipped had moves bound with no gem
 * anywhere; stripping them would be the worst first contact with a feature that exists to make
 * moves feel OWNED. So the letters of what they had bound are seeded SET (grown, since 09-27).
 */
export function loadLetters(birth: string | null, bound: readonly (string | null)[], starter?: string): Letters {
  let rawBag: unknown = null, rawVessels: unknown = null
  try {
    rawBag = parse(localStorage.getItem(keeperKey(GEMS_KEY)))
    rawVessels = parse(localStorage.getItem(keeperKey(VESSELS_KEY)))
  } catch {
    return seedLetters(birth, bound, starter)   // private mode: no persistence, never an empty bag
  }
  if (rawVessels && typeof rawVessels === 'object') {
    const v = rawVessels as Partial<Record<Vessel, unknown>>
    const list = (x: unknown) => Array.isArray(x) ? x.filter((r): r is string => typeof r === 'string').slice(0, VESSEL_CAP) : []
    const bag: GemStock = {}
    if (rawBag && typeof rawBag === 'object') {
      for (const [r, n] of Object.entries(rawBag as Record<string, unknown>)) if (typeof n === 'number' && n > 0) bag[r] = Math.floor(n)
    }
    const read: Letters = { bag, vessels: { bracelet: list(v.bracelet), focus: list(v.focus) } }
    const grown = growWorn(read, birth, bound)
    if (JSON.stringify(grown) !== JSON.stringify(read)) saveLetters(grown)   // the grow is a migration: write it once
    return grown
  }
  const seeded = seedLetters(birth, bound, starter)
  saveLetters(seeded)
  return seeded
}

export function seedLetters(birth: string | null, bound: readonly (string | null)[], starter?: string): Letters {
  let l: Letters = { bag: {}, vessels: { bracelet: [], focus: [] } }
  ALL_BANDS.forEach((kind, i) => {
    const id = bound[i]
    const vessel = VESSEL_FOR_KIND[kind]
    const m = id ? moveById(id) : undefined
    if (!m || !vessel) return
    for (const r of lettersOf(m, birth)) l = addGems(l, r)
    l = bindLetters(l, vessel, m, birth) ?? l
  })
  // ★ Gregory's gift no longer arrives as loose letters (2026-09-27): letters grow into vessels, never the bag
  void starter
  return l
}

export function saveLetters(l: Letters): void {
  try {
    localStorage.setItem(keeperKey(GEMS_KEY), JSON.stringify(l.bag))
    localStorage.setItem(keeperKey(VESSELS_KEY), JSON.stringify(l.vessels))
  } catch { /* private mode */ }
}

/** Forget every letter — a rebirth is a different keeper. */
export function clearLetters(): void {
  try {
    localStorage.removeItem(keeperKey(GEMS_KEY))
    localStorage.removeItem(keeperKey(VESSELS_KEY))
  } catch { /* private mode */ }
}
