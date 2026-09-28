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
 *   · a new vessel arrives WITH its word's letters grown in (09-27; it used to arrive empty)
 *   · equipping is free and instant; a cozy game does not tax changing your mind
 *   · a vessel has a TIER (0–3), and the tier is the MATERIAL (canon) — see the tier section below
 *
 * ── ★★ THE TIER MODEL, REWORKED AGAINST THE NO-CRAFT RULING (Magii + Alex, 2026-09-04) ──────────
 * The 09-04 plan had tiers 2–3 GROWN from the brief's materials. Struck: *"a keeper never makes a
 * vessel. They are found, won, bought, or given"* (`CANON_GAPS.md`, `shimmer-casting-vessels.md`
 * § A VESSEL IS NOT CRAFTED). The tier tables are what a vessel is MADE OF, not recipes. So there is
 * no recipe anywhere in this file and no gathering ladder feeds one. The four verbs are the four
 * doors, and `VesselSource` names them:
 *   · GIVEN  — Greg's tier-0 pair, `withFloor`: derived on every read, exactly like `ensureBasicTools`
 *   · BOUGHT — the Passage cuts tier 1 to order, `buyVessel` → `grantVessel`
 *   · FOUND / WON — tiers 2–3 turn up in the world and as prizes, through `grantVessel` only.
 *     Where they drop and what awards them is Jin's (the boundary widened to say so) and is NOT
 *     in this file: this is the door, not the world. `/vessel` on the console is the dev door.
 *
 * ★ GREG'S PAIR IS A PERMANENT FLOOR, OUTSIDE THE CAP (ruled 2026-09-04): *never break, never
 * bonus, never lost* — the Worn tools' promise, made about magic. So `FLOOR_TIER` rows are not
 * saved state a keeper can lose: `loadStowed` puts one of each kind back whenever it is missing
 * and not being worn, `clearStowed` (a rebirth) cannot remove them, and `MAX_PER_KIND` counts only
 * ACQUIRED vessels (tier ≥ 1). Three grown gloves still have Greg's underneath.
 *
 * ★ AND THE FLOOR IS ONE SEAT EACH, cut for a one-letter word (ruled). JIN'S CALL on WHICH word,
 * forced by the build's own rune model: on day one every one-letter word a keeper can read is in
 * their birth rune, and a birth-rune word is body-held (`isBodyHeld`) — it needs no paper at all.
 * So Greg cannot have cut the pair for a word the keeper holds at hand-out. The floor therefore
 * arrives UNCUT and takes the first one-letter word the keeper chooses to write on it (`setWord`,
 * `seatCapOf`), and from then on is that word's paper like any other vessel. One choice, not a
 * re-cuttable blank — the one-word law holds once it is made.
 *
 * ── VOCABULARY ── ✅ vessel, bracelet, focus, stow / stowed, equip, worn, held, tier, floor,
 * given / bought / found / won.  ⛔ pair (retired with the model), slot (the Citadel's), band,
 * socket, craft / recipe / grow (a vessel has none — ruled 2026-09-04).
 */
import { keeperKey } from '@/lib/keeper-local'
import { LOADOUT_KEY, rawLoadout, saveLoadout, type Loadout } from './loadout'
import { VESSELS_KEY, WORN_WORD_KEY, loadLetters, saveLetters, lettersOf, missingLetters, takeStones, wornWord, saveWornWord, VESSELS, VESSEL_FOR_KIND, VESSEL_CAP, STONE_CREDIT, type Vessel, type Letters } from './gems'
import { eligibleMoves } from './cast'
import { learn, type Book } from './scroll-market'
import { imbuedWord, markImbued } from './greg-pair'
import { saveBook } from './book'
import { moveById, KEEPER_MOVES, type KeeperMove } from './keeper-moves'
import { ALL_BANDS, LANE_FOR_KIND, laneRunes, isBuilt } from './cast'
export { WORN_WORD_KEY, wornWord, saveWornWord }
import { loadRuneInventory } from './rune-inventory'

export const STOWED_KEY = 'ather:shimmer:stowed'
/** ⚠ read ONCE, by `loadStowed`, then removed. The 09-03 pairs; see the legacy-door note above. */
export const LEGACY_PAIRS_KEY = 'ather:shimmer:parked'

/** the tier of the WORN vessel of each kind — the one field the two live keys do not carry */
export const WORN_TIER_KEY = 'ather:shimmer:worn-tier'

export const VESSEL_PRICE = 75
/** acquired vessels of a kind, worn or stowed — Greg's floor sits OUTSIDE it (ruled 2026-09-04) */
export const MAX_PER_KIND = 3

/** The tier IS the material (canon). 0 = Greg's mortal pair; 1–3 = the brief's rows. */
export type VesselTier = 0 | 1 | 2 | 3
export const TIERS: readonly VesselTier[] = [0, 1, 2, 3]
export const FLOOR_TIER: VesselTier = 0
/**
 * ★ THE BIRTH LETTER COMES FIRST (ruled 2026-09-28, /magii + Alex). Both of Greg's vessels are cut for a word
 * that BEGINS with the keeper's birth rune: the birth letter sits in the first seat and glows from day one,
 * and the seats after it stand empty and say what is missing. So neither floor vessel is one seat any more
 * (the one-seat bracelet of 09-04 is retired with the one-letter word it was cut for: a one-letter birth
 * word is body-held and needs no paper). Every tier bears what its word needs, up to the cap.
 */
export const seatCapOf = (_tier: VesselTier, _kind: Vessel): number => VESSEL_CAP
/** the material of each tier, per kind — the brief's tables, quoted not restated; the tier reads off this at a glance */
export const TIER_MATERIAL: Record<Vessel, Record<VesselTier, string>> = {
  focus:    { 0: 'mortal cloth', 1: 'goldwood', 2: 'shimmeroak', 3: 'starwillow' },
  bracelet: { 0: 'mortal cord',  1: 'goldwood', 2: 'shimmerscale', 3: 'pearlshell' },
}
/** canon's four verbs — the only ways a vessel reaches a keeper */
export type VesselSource = 'given' | 'bought' | 'found' | 'won'
/**
 * The word on screen for each kind. The build's kind id stays `focus` (a cast-slot word); canon's
 * noun for the object is GLOVE (`shimmer-casting-vessels.md`, hand vs wrist). Sprite ids and drop
 * ids are keyed by THIS, never by the kind id — `vessel_focus_t1` is a grey chip. One spelling, here.
 */
export const VESSEL_NOUN: Record<Vessel, string> = { bracelet: 'bracelet', focus: 'glove' }

/** a vessel the keeper owns but is not wearing: its own letters, its own word, its own material */
export interface StowedVessel { kind: Vessel; gems: string[]; move: string | null; tier: VesselTier }

/**
 * Which cast band each vessel bears, DERIVED from `VESSEL_FOR_KIND` rather than restated.
 * A hand-kept `{bracelet: 0, focus: 1}` here would be a mirror of that map that agrees with it
 * until the day the bands change — the exact shape PATTERNS calls a copy reading as corroboration.
 */
export const BAND_FOR_VESSEL: Record<Vessel, number> = VESSELS.reduce((acc, v) => {
  acc[v] = ALL_BANDS.findIndex((kind) => VESSEL_FOR_KIND[kind] === v)
  return acc
}, {} as Record<Vessel, number>)

/** an empty vessel of `kind`; tier 1 (bought) unless said — the tier a pre-tier save is read as */
export const emptyVessel = (kind: Vessel, tier: VesselTier = 1): StowedVessel => ({ kind, gems: [], move: null, tier })

/**
 * ★ GREG'S PAIR ARRIVES CUT (Alex, 2026-09-11, on his real save: *"vessels should already come with
 * prerequisite gems … the player should be able to see the vessel, insert the required gems for the move
 * it's made for"*). The floor used to arrive UNCUT and hand a brand-new keeper a dropdown as their first
 * act; now it is made for the first one-letter word on the keeper's own lane — a word they will grow
 * into, whose empty seat says which rune it wants. Deterministic: registry order, a word that OPENS a
 * collar preferred (it is the word the road fight is answered with). `null` when the lane holds no
 * one-letter word at all — the glove on many lanes (filed in CANON_GAPS 2026-09-11), which then stays
 * uncut and says so.
 */
export function floorWordFor(kind: Vessel, birth: string | null, owned: readonly string[] = []): string | null {
  const pick = birth ? rulePick(kind, birth) : undefined
  if (pick && isFloorWord(kind, birth, pick)) return pick
  const fits = floorCandidates(kind, birth)
  const opens = (m: KeeperMove) => (m as { collar?: string }).collar === 'opens'
  // ★ a word the keeper can ALREADY write comes first (Alex held Lightning when Greg's bracelet was cut,
  // and a bracelet made for Enlighten — a rune he did not hold — would have refused the gem in his hand);
  // then a word that opens a collar; then the registry's first
  const writable = fits.filter(m => m.runes.every(r => owned.includes(r)))
  return (writable.find(opens) ?? writable[0] ?? fits.find(opens) ?? fits[0])?.id ?? null
}
/** every word Greg could cut the `kind` floor for, on this birth's lane: a one-letter tactical, or the lane's smallest signature */
export function floorCandidates(kind: Vessel, birth: string | null): KeeperMove[] {
  const band = ALL_BANDS[BAND_FOR_VESSEL[kind]]
  const lane = band ? LANE_FOR_KIND[band] : null
  if (!band || !birth || !lane) return []
  const onIt = laneRunes(birth, lane)
  // ★ a word BEGINNING with the birth rune (09-28): it carries the birth rune and at least one letter more,
  // so there is a seat for Greg's gems to fill. Every lane has one since the birth-first pass (a2e2843).
  const onLane = KEEPER_MOVES.filter(m => m.tier === band && !m.birthExclusive && m.runes.includes(birth)
    && lettersOf(m, birth).length >= 2 && m.runes.every(r => onIt.has(r)))
  // the SMALLEST such word (the glove's 09-11 rule, narrowed by one clause; the bracelet's word is the
  // ruled `GREG_BRACELET_PICK`, and this is only its fallback), and a word the sim can run before one it cannot
  const size = Math.min(...onLane.map(m => lettersOf(m, birth).length))
  const fit = onLane.filter(m => lettersOf(m, birth).length === size)
  const built = fit.filter(m => isBuilt(m.id))
  return built.length ? built : fit
}
/**
 * ★ GREG'S BRACELET, BY BIRTH RUNE — the 17 (RULED 09-28, /magii + Alex, athernyx 8432ebf;
 * `design-briefs/shimmer-casting-vessels.md`). The word per birth is CANON; a pick here beats the derived
 * default, and must still pass `isFloorWord` (floor-pair.test asserts every row does).
 */
export const GREG_BRACELET_PICK: Readonly<Partial<Record<string, string>>> = {
  manalic: 'emberglass', star: 'emberglass',
  barrier: 'living-architecture', life: 'mending-thread', enchant: 'mending-thread',
  lightning: 'bolt-snipe', illuminate: 'bolt-snipe',
  tempest: 'wind-shear', breeze: 'wind-shear',
  stone: 'lava-stride', magma: 'lava-stride', gem: 'volcano-spike', metalergy: 'forge-fist',
  freeze: 'flash-freeze', fluid: 'flash-freeze', hydro: 'riptide', mist: 'drowning-grasp',
}
/**
 * ★ GREG'S GLOVE, BY BIRTH RUNE (the glove column of THE DEFAULT LOADOUT, RULED 09-28, athernyx a450b4a;
 * the three ties Alex picked: Manalic Monolith, Life Exhale, Tempest Pyroclast). READ, never derived: a new
 * move can never silently change a keeper's glove. `floorCandidates` remains only as the fallback.
 */
export const GREG_GLOVE_PICK: Readonly<Partial<Record<string, string>>> = {
  manalic: 'monolith', barrier: 'overpressure', star: 'firestorm', life: 'exhale', enchant: 'gate',
  lightning: 'stormbank', tempest: 'pyroclast', breeze: 'exhale', illuminate: 'gate', stone: 'monolith',
  gem: 'overpressure', magma: 'pyroclast', metalergy: 'gate', freeze: 'shatterfield', hydro: 'overpressure',
  mist: 'stormbank', fluid: 'healing-stream',
}
/** the ruled word for Greg's `kind` on this birth (the one table, both columns) */
export const rulePick = (kind: Vessel, birth: string): string | undefined =>
  kind === 'bracelet' ? GREG_BRACELET_PICK[birth] : kind === 'focus' ? GREG_GLOVE_PICK[birth] : undefined
/** is `move` a word Greg's `kind` could be cut for on this birth? A saved floor for anything else is recut */
export const isFloorWord = (kind: Vessel, birth: string | null, move: string | null): boolean => {
  if (!move || !birth) return false
  // the bracelet's word is RULED per birth: a save cut for the old derived default (Life's was Living
  // Architecture) is recut for the ruled word on load
  const ruled = rulePick(kind, birth)
  if (ruled && move !== ruled) return false
  const band = ALL_BANDS[BAND_FOR_VESSEL[kind]]
  const lane = band ? LANE_FOR_KIND[band] : null
  const m = moveById(move)
  if (!m || !lane) return false
  const onIt = laneRunes(birth, lane)
  return m.tier === band && m.runes.includes(birth) && lettersOf(m, birth).length >= 2 && m.runes.every(r => onIt.has(r))
}
/** Greg's vessel of `kind`, cut for the keeper's lane — `emptyVessel` at the floor tier with its word */
export const floorVessel = (kind: Vessel, birth: string | null, owned: readonly string[] = []): StowedVessel => {
  const move = floorWordFor(kind, birth, owned)
  return { ...emptyVessel(kind, FLOOR_TIER), move, gems: grownLetters(move, birth) }
}
/** the keeper this browser holds — read here so the floor can be cut without every caller passing it */
const keeperOf = (): { birth: string | null; owned: string[] } => { try { const r = loadRuneInventory(); return { birth: r.birth ?? null, owned: [...r.owned] } } catch { return { birth: null, owned: [] } } }
export const isFloor = (v: Pick<StowedVessel, 'tier'>): boolean => v.tier === FLOOR_TIER

/**
 * ★ THE LETTERS GROW IN (RULED 2026-09-27, `shimmer-casting-vessels.md` › THE LETTERS GROW IN): a vessel
 * arrives whole, paper and letters together, whichever road it came by. The letters a vessel carries are
 * therefore DERIVED from its word, never set by a keeper — this is the one place they are grown.
 */
export const grownLetters = (move: string | null, birth: string | null): string[] => {
  const m = move ? moveById(move) : undefined
  return m ? lettersOf(m, birth) : []
}

const isVessel = (x: unknown): x is Vessel => typeof x === 'string' && (VESSELS as readonly string[]).includes(x)
const gemList = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((r): r is string => typeof r === 'string').slice(0, VESSEL_CAP) : []
const moveOf = (x: unknown): string | null => (typeof x === 'string' ? x : null)
/** a saved tier, or 1: every vessel saved before tiers existed was bought at the Passage */
const tierOf = (x: unknown): VesselTier => (TIERS as readonly number[]).includes(x as number) ? (x as VesselTier) : 1

function parseStowed(raw: unknown): StowedVessel[] {
  if (!Array.isArray(raw)) return []
  const out: StowedVessel[] = []
  for (const p of raw) {
    const o = (p && typeof p === 'object' ? p : {}) as { kind?: unknown; gems?: unknown; move?: unknown; tier?: unknown }
    if (!isVessel(o.kind)) continue
    const tier = tierOf(o.tier)
    const move = moveOf(o.move)
    // ★ a saved floor from before 2026-09-11 is uncut; it takes its lane's word on read, the way a new one does
    const k = keeperOf()
    // ★ and a floor cut before 09-28 for a word that does not begin with the birth rune is recut the same way
    const stale = tier === FLOOR_TIER && !!k.birth && !isFloorWord(o.kind, k.birth, move)
    const word = stale || !move ? (tier === FLOOR_TIER ? floorWordFor(o.kind, k.birth, k.owned) : move) : move
    // ★ grown on read (09-27): a vessel from the binding days that sat half-written arrives whole. A word the
    // registry no longer has keeps what was saved — nothing to grow from, and nothing a keeper had is erased
    out.push({ kind: o.kind, gems: (word && moveById(word) ? grownLetters(word, k.birth) : gemList(o.gems)).slice(0, seatCapOf(tier, o.kind)), move: word, tier })
  }
  return capped(out)
}

/**
 * A stowed list may hold at most `MAX_PER_KIND` ACQUIRED vessels of each kind, and ONE floor vessel
 * of each kind. Trimmed per KIND, not globally — a global cap would let three bracelets crowd out the
 * focus. ⚠ The cap is on the list, not `MAX_PER_KIND - 1`: with nothing (or the floor) worn, all three
 * acquired ones may sit here — the old `- 1` assumed the worn vessel was always an acquired one, and
 * refused to let a keeper with two spares take off the one they wore. The BUY door counts the worn one.
 */
function capped(list: readonly StowedVessel[]): StowedVessel[] {
  const seen: Record<string, number> = {}
  const floors = new Set<Vessel>()
  const out: StowedVessel[] = []
  for (const v of list) {
    if (isFloor(v)) {
      if (floors.has(v.kind)) continue      // Greg gave ONE of each; a second is a save that lied
      floors.add(v.kind)
    } else {
      const n = (seen[v.kind] ?? 0) + 1
      if (n > MAX_PER_KIND) continue
      seen[v.kind] = n
    }
    out.push(v)
  }
  return out
}

// ── the worn tier: one small record beside the two live keys ────────────────────────────────
function loadWornTiers(): Record<Vessel, VesselTier> {
  const out = { bracelet: 1, focus: 1 } as Record<Vessel, VesselTier>
  try {
    const raw = JSON.parse(localStorage.getItem(keeperKey(WORN_TIER_KEY)) ?? 'null') as unknown
    if (raw && typeof raw === 'object') for (const k of VESSELS) out[k] = tierOf((raw as Record<string, unknown>)[k])
  } catch { /* unreadable → every worn vessel reads as bought */ }
  return out
}
function saveWornTier(kind: Vessel, tier: VesselTier): void {
  try { localStorage.setItem(keeperKey(WORN_TIER_KEY), JSON.stringify({ ...loadWornTiers(), [kind]: tier })) } catch { /* private mode */ }
}
/** the tier of what is worn on `kind` — meaningful only while something IS worn (`wornPresent`) */
export const wornTier = (kind: Vessel): VesselTier => loadWornTiers()[kind]


/**
 * Is anything worn on `kind`? Read RAW off the two live keys, never through `loadLetters` — that
 * seeds (writes) when absent, and a count must not create the thing it counts.
 */
export function wornPresent(kind: Vessel): boolean {
  const band = BAND_FOR_VESSEL[kind]
  if (band >= 0 && rawLoadout()[band]) return true
  try {
    const v = JSON.parse(localStorage.getItem(keeperKey(VESSELS_KEY)) ?? 'null') as Record<string, unknown> | null
    return !!v && Array.isArray(v[kind]) && (v[kind] as unknown[]).length > 0
  } catch { return false }
}

/**
 * ★ GREG'S PAIR, NEVER LOST: every read puts a floor vessel of each kind back unless one is already
 * here or is the one being worn. Derived, not stored — the same guarantee `ensureBasicTools` makes
 * for the Worn tools, and the reason a rebirth's `clearStowed` cannot take them.
 */
function withFloor(list: StowedVessel[]): StowedVessel[] {
  const tiers = loadWornTiers()
  for (const kind of VESSELS) {
    // ★ a WORN floor cut before 09-28 is recut on the wrist, the way a stowed one is recut in the satchel
    if (wornPresent(kind) && tiers[kind] === FLOOR_TIER) {
      const k = keeperOf()
      if (k.birth && !isFloorWord(kind, k.birth, wornWord(kind))) saveWornWord(kind, floorWordFor(kind, k.birth, k.owned))
    }
    if (list.some(v => v.kind === kind && isFloor(v))) continue
    if (wornPresent(kind) && tiers[kind] === FLOOR_TIER) continue
    const k = keeperOf()
    list.push(floorVessel(kind, k.birth, k.owned))
  }
  // acquired first, the floor last — stable, so an index a host took from one read names the same
  // vessel on the next, and Greg's pair reads as what sits UNDER the rest rather than ahead of it
  return [...list.filter(v => !isFloor(v)), ...list.filter(isFloor)]
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
      out.push({ kind, gems: gemList(o.vessels?.[kind]), move: band >= 0 ? moveOf(slots[band]) : null, tier: 1 })
    }
  }
  return capped(out)
}

/**
 * ⚠ A CUT MADE ON READ IS SAVED ON READ. The floor's word is chosen from the keeper's hand at the moment
 * it is cut (`floorWordFor`), and a hand grows — so a floor that was minted or migrated in this read is
 * written back at once, or the same bracelet could read as made for a different word tomorrow. The
 * one-word law needs the word to be a fact, not a derivation.
 */
function settle(list: StowedVessel[], before: string | null): StowedVessel[] {
  const after = JSON.stringify(capped(list))
  if (after !== before) saveStowed(list)
  return list
}
export function loadStowed(): StowedVessel[] {
  try {
    const raw = localStorage.getItem(keeperKey(STOWED_KEY))
    if (raw) return settle(withFloor(parseStowed(JSON.parse(raw))), raw)
    const legacy = localStorage.getItem(keeperKey(LEGACY_PAIRS_KEY))
    if (!legacy) return settle(withFloor([]), null)
    const migrated = migratePairs(JSON.parse(legacy))
    saveStowed(migrated)
    localStorage.removeItem(keeperKey(LEGACY_PAIRS_KEY))   // once, so it cannot double-credit
    return withFloor(migrated)
  } catch { return withFloor([]) }
}

export function saveStowed(list: readonly StowedVessel[]): void {
  try { localStorage.setItem(keeperKey(STOWED_KEY), JSON.stringify(capped(list))) } catch { /* private mode */ }
}

export function clearStowed(): void {
  try {
    localStorage.removeItem(keeperKey(STOWED_KEY))
    localStorage.removeItem(keeperKey(LEGACY_PAIRS_KEY))   // a reborn keeper keeps no pairs either
    localStorage.removeItem(keeperKey(WORN_TIER_KEY))      // ⚠ NOT the floor: `withFloor` hands Greg's pair back on the next read
    localStorage.removeItem(keeperKey(WORN_WORD_KEY))
  } catch { /* private mode */ }
}

/**
 * How many of `kind` the keeper has ACQUIRED: the worn one if it is not Greg's, plus every stowed one
 * above the floor. Greg's pair is never in this number — the cap governs what a keeper acquires; the
 * floor sits under it (ruled 2026-09-04).
 */
export function ownedCount(kind: Vessel): number {
  const worn = wornPresent(kind) && !isFloor({ tier: wornTier(kind) }) ? 1 : 0
  return worn + loadStowed().filter(v => v.kind === kind && !isFloor(v)).length
}

export type VesselRefusal = 'too-dear' | 'at-cap' | 'no-such-word' | 'too-many-seats' | 'not-given'
export interface VesselPurchase { ok: boolean; marks: number; why?: VesselRefusal; say: string }
export interface VesselGrant { ok: boolean; why?: VesselRefusal; say: string; index?: number }


/**
 * ★ THE ONE DOOR A VESSEL COMES THROUGH — bought, found or won. Given (Greg's floor) is `withFloor`
 * and is refused here on purpose: a granted tier-0 would be a second floor, and canon has one.
 * `word` may be null only for a blank (the satchel cuts it later); a word must fit the tier's seats
 * and the kind's band. Persists on success. The caller spends Marks, rolls loot, or names the prize.
 */
export function grantVessel(kind: Vessel, tier: VesselTier, word: string | null, source: VesselSource): VesselGrant {
  if (isFloor({ tier }) || source === 'given') {
    return { ok: false, why: 'not-given', say: `Greg gave you the ${VESSEL_NOUN[kind]} you have. Nobody hands out a second.` }
  }
  const m = word !== null ? moveById(word) : undefined
  if (word !== null && (!m || ALL_BANDS[BAND_FOR_VESSEL[kind]] !== m.tier)) {
    return { ok: false, why: 'no-such-word', say: `Nobody down here has heard of that word for a ${kind}.` }
  }
  const seats = m ? lettersOf(m, null).length : 0
  if (seats > seatCapOf(tier, kind)) {
    return { ok: false, why: 'too-many-seats', say: `${m!.name} asks ${seats} seats; a ${TIER_MATERIAL[kind][tier]} ${kind} bears ${seatCapOf(tier, kind)}.` }
  }
  if (ownedCount(kind) >= MAX_PER_KIND) {
    return { ok: false, why: 'at-cap', say: `Three ${kind}s is what a keeper can carry, and Greg's underneath. Nobody down here will sell you a fourth.` }
  }
  // ★ the letters grow in at the making — every road, not only the cutter's (09-27)
  saveStowed([...loadStowed(), { kind, gems: grownLetters(m?.id ?? null, keeperOf().birth), move: m?.id ?? null, tier }])
  // its index in the NEXT read: acquired vessels sort first, and this one is the newest of them
  const index = loadStowed().filter(v => !isFloor(v)).length - 1
  const how = { bought: 'yours', found: 'found', won: 'won', given: 'given' }[source]
  return {
    ok: true, index,
    // copy says canon's noun (a GLOVE of starwillow), never the kind id
    say: m ? `A ${VESSEL_NOUN[kind]} of ${TIER_MATERIAL[kind][tier]} for ${m.name}, ${seats} letter${seats === 1 ? '' : 's'} grown in — ${how}.`
           : `A ${VESSEL_NOUN[kind]} of ${TIER_MATERIAL[kind][tier]}, uncut — ${how}. Write something on it.`,
  }
}

/** the least the cutter takes for the work, however many stones a keeper hands over */
export const CUTTER_FLOOR = 15

/**
 * ★ HELD STONES ARE PART-PAYMENT (ruled 2026-09-27): the cutter takes, from a keeper's loose stones, one of
 * each letter the word is written in, `STONE_CREDIT` Marks off apiece, never below `CUTTER_FLOOR`. What a
 * price would be before any Marks move — the panel shows it, the counter charges it.
 */
export function cutterPrice(base: number, word: string | null, l: Letters | null, birth: string | null): { price: number; stones: string[] } {
  if (!l || !word) return { price: base, stones: [] }
  const { taken } = takeStones(l, grownLetters(word, birth))
  // only as many stones as it takes to reach the floor — the cutter does not eat a stone it cannot credit
  const room = Math.max(0, Math.ceil((base - CUTTER_FLOOR) / STONE_CREDIT))
  const stones = taken.slice(0, room)
  return { price: Math.max(CUTTER_FLOOR, base - stones.length * STONE_CREDIT), stones }
}

/**
 * Buy one vessel: the Passage's stock is TIER 1, cut to order. Persists on success; the caller spends
 * the Marks and saves the returned `letters` (the stones the cutter took). `l` omitted = no stones offered.
 */
export function buyVessel(kind: Vessel, marks: number, word?: string, l: Letters | null = null, birth: string | null = null): VesselPurchase & { letters?: Letters } {
  // ★ MADE FOR ONE WORD (Alex, 2026-09-04). The Passage makes the paper to order, for a word the keeper
  // already holds, and its letters grow in (09-27). Refusals are ordered so the cheapest to fix comes last.
  const m = word !== undefined ? moveById(word) : undefined
  if (word !== undefined && (!m || ALL_BANDS[BAND_FOR_VESSEL[kind]] !== m.tier)) {
    return { ok: false, marks, why: 'no-such-word', say: `Nobody down here has heard of that word for a ${kind}.` }
  }
  if (ownedCount(kind) >= MAX_PER_KIND) {
    return { ok: false, marks, why: 'at-cap', say: `Three ${kind}s is what a keeper can carry, and Greg's underneath. Nobody down here will sell you a fourth.` }
  }
  const { price, stones } = cutterPrice(VESSEL_PRICE, m?.id ?? null, l, birth)
  if (marks < price) {
    return { ok: false, marks, why: 'too-dear', say: `${price} Marks — grown, not ridden in. Come back with them.` }
  }
  const g = grantVessel(kind, 1, m?.id ?? null, 'bought')
  if (!g.ok) return { ok: false, marks, why: g.why, say: g.say }
  const letters = l && stones.length ? takeStones(l, stones).letters : undefined
  const paid = stones.length ? ` The cutter took ${stones.length} of your stone${stones.length === 1 ? '' : 's'} toward it.` : ''
  return { ok: true, marks: marks - price, say: g.say + paid, letters }
}

/**
 * The vessel of `kind` the keeper is WEARING, read off the two live keys — its letters from the
 * letters record, its word from the saved loadout. This is the half that never moved.
 */
export function equippedVessel(kind: Vessel, birth: string | null, starter?: string): StowedVessel {
  const active = loadLetters(birth, rawLoadout(), starter)
  const band = BAND_FOR_VESSEL[kind]
  // the vessel's own word first; the band only for a save from before the word was recorded
  const move = wornWord(kind) ?? (band >= 0 ? (rawLoadout()[band] ?? null) : null)
  return { kind, gems: move ? grownLetters(move, birth) : [...active.vessels[kind]], move, tier: wornTier(kind) }
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
  // ★ ONLY A VESSEL MADE FOR A WORD IS GEAR. Its letters are grown in (09-27), so that is the whole test here;
  // whether they are LIT is the keeper's knowledge, and the rack offers only lit ones (`completeVessels`).
  if (!isComplete(next, birth)) return false
  const band = BAND_FOR_VESSEL[kind]
  if (band < 0) return false
  const active = loadLetters(birth, rawLoadout(), starter)
  const slots: Loadout = ALL_BANDS.map((_, k) => rawLoadout()[k] ?? null)
  // The one coming off goes to the satchel with its word and letters. Wearing NOTHING (after a
  // take-off) must not mint a blank vessel out of thin air — the slot is simply taken.
  if (slots[band] || active.vessels[kind].length) stowed[i] = { kind, gems: [...active.vessels[kind]], move: wornWord(kind) ?? slots[band] ?? null, tier: wornTier(kind) }
  else stowed.splice(i, 1)
  saveStowed(stowed)
  saveWornTier(kind, next.tier)   // the material goes on with the paper
  saveWornWord(kind, next.move)   // and so does the WORD — the vessel's number, bound or not

  slots[band] = next.move
  saveLoadout(slots)
  saveLetters({ bag: active.bag, vessels: { ...active.vessels, [kind]: [...next.gems] } })
  return true
}

// ── ★ GREG'S GEMS AND THE FIRST ERRAND (ruled 2026-09-28, THE BIRTH LETTER COMES FIRST) ───────────────
// The birth letter of Greg's pair is lit from day one; the seats after it stand EMPTY (not dark) until they
// are filled: the bracelet's by the Enchant Temple, from the gems Greg put in the keeper's hand; the glove's
// when the keeper earns its word. How a seat reads is derived, never saved, so a ruling that moves the line
// moves every save with it.
export type SeatLight = 'lit' | 'dark' | 'empty'
/** each seat of `v` in order: lit, dark (grown in, word not known), or empty (Greg's pair, still to fill) */
export function seatLights(v: Pick<StowedVessel, 'kind' | 'move' | 'tier'>, owned: readonly string[], birth: string | null, book: Book): SeatLight[] {
  const need = seatLetters(v, birth)
  if (isLit(v, owned, birth, book)) return need.map(() => 'lit')
  if (!isFloor(v)) return need.map(() => 'dark')
  return need.map(r => (r === birth ? 'lit' : 'empty'))
}
/** the word Greg's `kind` is cut for, worn or stowed */
export function gregWord(kind: Vessel): string | null {
  if (wornPresent(kind) && wornTier(kind) === FLOOR_TIER) return wornWord(kind)
  return loadStowed().find(v => v.kind === kind && isFloor(v))?.move ?? null
}
/** does the keeper still carry Greg's gems — the bracelet not yet imbued at the Enchant Temple? */
export const gregGemsInHand = (): boolean => { const w = gregWord('bracelet'); return !!w && imbuedWord() !== w }
/** the gems Greg handed over: the bracelet word's letters after the birth letter */
export const gregGems = (birth: string | null): string[] => {
  const w = gregWord('bracelet')
  return w ? seatLetters({ move: w }, birth).filter(r => r !== birth) : []
}

export type ImbueResult =
  | { ok: true; word: string; book: Book; worn: boolean }
  | { ok: false; why: 'no-bracelet' | 'already'; word: string | null }
/**
 * THE ENCHANT TEMPLE IMBUES GREG'S BRACELET, AND TEACHES ITS WORD AS IT DOES. The gems go into the empty
 * seats (`markImbued`, which is also the one word the seat-gem exception covers), the word goes into the
 * book, and the bracelet leaves lit. If Greg's bracelet is worn its band is bound at once; if nothing is
 * worn on the wrist it is put on. A keeper wearing another bracelet keeps it, and finds Greg's lit in the satchel.
 */
export function imbueGregBracelet(birth: string | null, book: Book, starter?: string): ImbueResult {
  const word = gregWord('bracelet')
  if (!word) return { ok: false, why: 'no-bracelet', word: null }
  if (imbuedWord() === word && book.learned.includes(word)) return { ok: false, why: 'already', word }
  markImbued(word)
  const taught = learn(book, word)
  saveBook(taught)
  const band = BAND_FOR_VESSEL.bracelet
  let worn = false
  if (wornPresent('bracelet') && wornTier('bracelet') === FLOOR_TIER) {
    const slots: Loadout = ALL_BANDS.map((_, k) => rawLoadout()[k] ?? null)
    slots[band] = word
    saveLoadout(slots)
    worn = true
  } else if (!wornPresent('bracelet') && !rawLoadout()[band]) {
    const i = loadStowed().findIndex(v => v.kind === 'bracelet' && isFloor(v))
    worn = i >= 0 && equip('bracelet', i, birth, starter)
  }
  return { ok: true, word, book: taught, worn }
}

/** the keys an equip writes — restated for the guard that checks every keeper key is registered */
export const EQUIP_WRITES: readonly string[] = [LOADOUT_KEY, VESSELS_KEY, WORN_TIER_KEY, WORN_WORD_KEY]

// ── ★ A VESSEL IS MADE FOR ONE WORD, AND BEARS EXACTLY THE SEATS THAT WORD NEEDS (Alex, 2026-09-04) ──
// *"each vessel is unique that its made the word and none other so if the move its meant to represent
// has one slot then it only needs the one slot."* So `move` on a stowed vessel is not "what happens to
// be written on it" — it is what the paper was CUT for. The seat count is derived from the word, never
// stored; a word's letters come from `lettersOf`, which is also what the cast layer needs to run it, so
// the seats and the requirement cannot drift apart. `VESSEL_CAP` is the ceiling a word can ask for, not
// a property of every vessel. Filed for Magii to land in the brief (CANON_GAPS, 2026-09-04).
//
// The flow (since 2026-09-27, THE LETTERS GROW IN): a vessel arrives made for its word with its letters in
// it → it sits in the SATCHEL, DARK until the keeper knows the word (`isLit`) → lit, it is gear → equip /
// take off (`takeOffWorn`), and it goes back to the satchel whole. No keeper ever sets or removes a stone.

/** The letters this vessel's seats were cut for. A legacy blank (bought before the ruling) has none yet. */
export function seatLetters(v: Pick<StowedVessel, 'move'>, birth: string | null): string[] {
  if (!v.move) return []
  const m = moveById(v.move)
  return m ? lettersOf(m, birth) : []
}
export const seatCount = (v: Pick<StowedVessel, 'move'>, birth: string | null): number => seatLetters(v, birth).length
/** Which of its own letters this vessel still lacks — always none since the letters grow in (09-27); kept so old reads stay honest. */
export const shortOf = (v: StowedVessel, birth: string | null): string[] => missingLetters(seatLetters(v, birth), v.gems)
/** Made for a word = finished: its letters grew in with it (09-27). A legacy blank is not, until it is cut. */
export const isComplete = (v: StowedVessel, birth: string | null): boolean => !!v.move && shortOf(v, birth).length === 0

/**
 * ★ LIT = THE KEEPER KNOWS THE WORD (ruled 2026-09-27). The guard that replaced the gem: a vessel for a word
 * the keeper has not learned — or cannot read, or that sits off their lane — is finished paper that stays
 * DARK. "Knows" is exactly what lets a word be bound (`eligibleMoves`), so a dark vessel and an unbindable
 * word can never disagree.
 */
export function isLit(v: Pick<StowedVessel, 'kind' | 'move'>, owned: readonly string[], birth: string | null, book: Book): boolean {
  if (!v.move) return false
  const band = ALL_BANDS[BAND_FOR_VESSEL[v.kind]]
  return !!band && eligibleMoves([...owned], birth, band, book).some(m => m.id === v.move)
}

/**
 * The stowed vessels of a kind a keeper can put on — made for a word, and (when the keeper is passed) LIT.
 * A dark vessel stays in the satchel saying which word would light it.
 */
export function completeVessels(kind: Vessel, birth: string | null, knows?: { owned: readonly string[]; book: Book }): { v: StowedVessel; i: number }[] {
  return loadStowed().map((v, i) => ({ v, i }))
    .filter(({ v }) => v.kind === kind && isComplete(v, birth) && (!knows || isLit(v, knows.owned, birth, knows.book)))
}

/**
 * ★ THE REVERSE MIGRATION (2026-09-11). For three hours on 09-10 a vessel with no letters was an ITEM in
 * the bag (`a822483`, reverted the same evening). Saves written in that window hold `vessel_<noun>_t<n>`
 * stacks the game no longer knows — they sat in Alex's HOTBAR as junk. Every such stack comes OUT of the
 * bag: an acquired one (tier ≥ 1) goes back to the stowed list cut for its word; Greg's tier-0 pair is
 * simply dropped, because `withFloor` mints it on every read and a second would be a lie. Returns the
 * emptied slot indices so the host can say what it did. Pure over the slots array it is handed.
 */
export function stripVesselItems<T extends { itemId: string; vesselData?: { move: string | null } }>(slots: (T | null)[]): { slots: (T | null)[]; stowedBack: number; dropped: number } {
  let stowedBack = 0, dropped = 0
  const back: StowedVessel[] = []
  const out = slots.map(st => {
    if (!st) return st
    const v = parseVesselItem(st.itemId)
    if (!v) return st
    if (isFloor(v)) dropped++
    else { back.push({ kind: v.kind, gems: [], move: st.vesselData?.move ?? null, tier: v.tier }); stowedBack++ }
    return null
  })
  if (back.length) saveStowed([...loadStowed().filter(v => !isFloor(v)), ...back])
  return { slots: out, stowedBack, dropped }
}
const NOUN_KIND: Record<string, Vessel> = Object.fromEntries(VESSELS.map(k => [VESSEL_NOUN[k], k]))
/** `vessel_glove_t2` → `{ kind: 'focus', tier: 2 }`; anything else → null. Keyed by the NOUN. Lives here so the migration above needs no import from the drops module. */
export function parseVesselItem(itemId: string): { kind: Vessel; tier: VesselTier } | null {
  const m = /^vessel_([a-z]+)_t([0-3])$/.exec(itemId)
  if (!m) return null
  const kind = NOUN_KIND[m[1]!]
  return kind ? { kind, tier: Number(m[2]) as VesselTier } : null
}
/**
 * Take the WORN vessel OFF: it goes back to the satchel whole, its letters still in it (they grew in and do
 * not come out, 09-27), in its own material; the band clears. Never refused for the cap — the worn vessel was
 * already counted. A keeper with nothing worn still casts their birth move; a body-held word needs no paper.
 */
export function takeOffWorn(kind: Vessel, birth: string | null, starter?: string): boolean {
  const band = BAND_FOR_VESSEL[kind]
  if (band < 0) return false
  const slots: Loadout = ALL_BANDS.map((_, k) => rawLoadout()[k] ?? null)
  // the vessel's own word — the band may already be unbound (a word the keeper no longer knows)
  const active = loadLetters(birth, slots, starter)
  const word = wornWord(kind) ?? (active.vessels[kind].length ? slots[band] ?? null : null)
  if (!word && !active.vessels[kind].length) return false
  saveStowed([...loadStowed(), { kind, gems: grownLetters(word, birth), move: word, tier: wornTier(kind) }])
  saveLetters({ bag: active.bag, vessels: { ...active.vessels, [kind]: [] } })
  slots[band] = null
  saveLoadout(slots)
  saveWornWord(kind, null)
  return true
}

/**
 * Cut an uncut vessel for its word — a legacy blank, or Greg's floor taking its one-letter word; its letters
 * grow in as it is cut. Refuses if the vessel already has one, if the word asks more seats than the tier bears
 * (`seatCapOf`: the floor takes ONE letter), or if the word is body-held (no paper needed).
 */
export function setWord(i: number, word: string, birth: string | null): boolean {
  const stowed = loadStowed()
  const v = stowed[i]
  if (!v || v.move) return false
  const m = moveById(word)
  if (!m || ALL_BANDS[BAND_FOR_VESSEL[v.kind]] !== m.tier) return false
  const seats = lettersOf(m, birth).length
  if (seats === 0 || seats > seatCapOf(v.tier, v.kind)) return false
  stowed[i] = { ...v, move: word, gems: grownLetters(word, birth) }   // cut, and its letters grow in
  saveStowed(stowed)
  return true
}
