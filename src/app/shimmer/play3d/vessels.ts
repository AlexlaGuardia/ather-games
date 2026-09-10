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
 *   · a new vessel arrives EMPTY, as an ITEM in the bag (2026-09-10) — cut for its word, no letters
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
 * ── ★★ RULED 2026-09-10 (Alex, opening the real satchel): A VESSEL IS AN ITEM UNTIL A LETTER IS SET ──
 * *"its an item untill the gems are put into it then its a vessel"*. So a vessel with NO letters in it
 * is an `ItemStack` in the keeper's BAG — `vessel_<noun>_t<tier>` with `vesselData: { move }` carrying
 * the word it was cut for — and it moves, chests and drops like any item. The moment its first letter
 * is set (`writeFromBag`) it leaves the bag and becomes a STOWED vessel here (parts, then gear when
 * every seat is written). Taking every letter back out (`dismantle`, `dismantleWorn`) turns it back
 * into an item in the bag. The invariant, stated once: **a stowed vessel always bears at least one
 * letter; a vessel with none is an item.** `sweepEmptyToBag` is the migration for saves from before.
 *   · every door (`grantVessel`, and through it bought / found / won) lands in the BAG and takes an
 *     `Inventory`; a full bag refuses with `no-room` the way a full bag refuses any pickup
 *   · the cap (`ownedCount`) counts worn + stowed + bag, so the bag cannot hold a fourth
 *   · Greg's pair is still never lost, but it is no longer minted on every `loadStowed` read — it is
 *     an item, so `ensureFloor(inv)` puts one back in the bag when a kind has none worn, stowed or
 *     bagged. Same promise as before, checked where the bag is. ⚠ A floor item parked in a CHEST is
 *     out of that check's sight and Greg will hand out another — a mortal-cloth one-seat blank, so
 *     the exploit buys nothing, and reading every chest in the world for it is not worth the trip.
 *   · this is the imbue precedent, run the other way: a crystal (item) becomes a gem (keeper state);
 *     a vessel (item) becomes a stowed vessel (keeper state) when a gem goes in.
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
import { VESSELS_KEY, loadLetters, saveLetters, lettersOf, missingLetters, unbindLetters, VESSELS, VESSEL_FOR_KIND, VESSEL_CAP, type Vessel, type Letters } from './gems'
import { moveById } from './keeper-moves'
import { ALL_BANDS } from './cast'
import { firstEmptySlot, type Inventory, type ItemStack } from '../engine/inventory'

export const STOWED_KEY = 'ather:shimmer:stowed'
/** ⚠ read ONCE, by `loadStowed`, then removed. The 09-03 pairs; see the legacy-door note above. */
export const LEGACY_PAIRS_KEY = 'ather:shimmer:parked'

/** the tier of the WORN vessel of each kind — the one field the two live keys do not carry */
export const WORN_TIER_KEY = 'ather:shimmer:worn-tier'
/**
 * the WORD the worn vessel of each kind was cut for. ★ ADDED 2026-09-09 (Alex: "fix the 1/0 count so
 * it follows the vessel"). The word used to live only in the BAND (`slots[band]`), so the moment the
 * loadout resolver unbound a band — a word the keeper no longer knows, a re-resolve after rebirth —
 * the letters stayed seated in `vessels[kind]` while the vessel's seat count read as ZERO: the rack
 * showed `1/0`, a letter in a vessel with nowhere to put it. The band is a BINDING; the vessel bears
 * its word whether or not it is bound, and that is what this key records.
 */
export const WORN_WORD_KEY = 'ather:shimmer:worn-word'

export const VESSEL_PRICE = 75
/** acquired vessels of a kind, worn or stowed — Greg's floor sits OUTSIDE it (ruled 2026-09-04) */
export const MAX_PER_KIND = 3

/** The tier IS the material (canon). 0 = Greg's mortal pair; 1–3 = the brief's rows. */
export type VesselTier = 0 | 1 | 2 | 3
export const TIERS: readonly VesselTier[] = [0, 1, 2, 3]
export const FLOOR_TIER: VesselTier = 0
/** Greg's pair was cut for one-letter words; every other tier bears whatever its word needs, up to the cap. */
export const FLOOR_SEATS = 1
export const seatCapOf = (tier: VesselTier): number => (tier === FLOOR_TIER ? FLOOR_SEATS : VESSEL_CAP)
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

// ── the vessel as an ITEM: id family, the stack, and reading the bag ────────────────────────
const NOUN_KIND: Record<string, Vessel> = Object.fromEntries(VESSELS.map(k => [VESSEL_NOUN[k], k]))
/** the item id — the icon family, keyed by the NOUN, so the thing draws as what it is */
export const vesselItemId = (kind: Vessel, tier: VesselTier): string => `vessel_${VESSEL_NOUN[kind]}_t${tier}`
/** `vessel_glove_t2` → `{ kind: 'focus', tier: 2 }`; anything else → null. Keyed by the NOUN. */
export function parseVesselItem(itemId: string): { kind: Vessel; tier: VesselTier } | null {
  const m = /^vessel_([a-z]+)_t([0-3])$/.exec(itemId)
  if (!m) return null
  const kind = NOUN_KIND[m[1]!]
  return kind ? { kind, tier: Number(m[2]) as VesselTier } : null
}
export const isVesselItem = (itemId: string): boolean => parseVesselItem(itemId) !== null
/** the stack a vessel is in the bag: one, unique, carrying its word (2026-09-10) */
export const vesselStack = (kind: Vessel, tier: VesselTier, move: string | null): ItemStack =>
  ({ itemId: vesselItemId(kind, tier), count: 1, vesselData: { move } })
/** a vessel sitting in the bag as an item, and where */
export interface BagVessel { slot: number; kind: Vessel; tier: VesselTier; move: string | null }
/**
 * Every vessel in the bag. An item IS a vessel when it carries `vesselData` — a bare `vessel_*` id
 * with no data is not one (a drop is taken through `takeVessel`, which writes the data; nothing else
 * makes one). Read fresh each time: the bag is live.
 */
export function bagVessels(inv: Inventory | null | undefined): BagVessel[] {
  const out: BagVessel[] = []
  inv?.slots.forEach((s, slot) => {
    if (!s || !s.vesselData) return
    const v = parseVesselItem(s.itemId)
    if (v) out.push({ slot, kind: v.kind, tier: v.tier, move: s.vesselData.move ?? null })
  })
  return out
}

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
export const isFloor = (v: Pick<StowedVessel, 'tier'>): boolean => v.tier === FLOOR_TIER

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
    out.push({ kind: o.kind, gems: gemList(o.gems).slice(0, seatCapOf(tier)), move: moveOf(o.move), tier })
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

// ── the worn word: the vessel's own number, whether or not the band is bound ─────────────────
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
/**
 * the word the worn vessel of `kind` was cut for, or null when nothing recorded. A save from before
 * this key has nothing here; callers fall back to the band (`wornWord(kind) ?? slots[band]`), which
 * is exactly the old reading and is right whenever the band IS bound.
 */
export const wornWord = (kind: Vessel): string | null => loadWornWords()[kind]

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
 * ★ GREG'S PAIR, NEVER LOST — AS AN ITEM (2026-09-10; was minted into the stowed list on every read).
 * Puts a floor vessel of each kind into the BAG when that kind has none worn, none stowed and none
 * bagged. Derived, not stored, the same guarantee `ensureBasicTools` makes for the Worn tools, and the
 * reason a rebirth's `clearStowed` cannot take them — the host calls this after the bag loads. Returns
 * the kinds it handed out. A full bag hands out nothing and tries again next time.
 */
export function ensureFloor(inv: Inventory): Vessel[] {
  const tiers = loadWornTiers()
  const stowed = loadStowed()
  const bag = bagVessels(inv)
  const added: Vessel[] = []
  for (const kind of VESSELS) {
    if (wornPresent(kind) && tiers[kind] === FLOOR_TIER) continue
    if (stowed.some(v => v.kind === kind && isFloor(v))) continue
    if (bag.some(v => v.kind === kind && isFloor(v))) continue
    const slot = firstEmptySlot(inv.slots)
    if (slot < 0) break
    inv.slots[slot] = vesselStack(kind, FLOOR_TIER, null)
    added.push(kind)
  }
  return added
}

/**
 * ★ THE MIGRATION, AND THE INVARIANT'S KEEPER: every stowed vessel with NO letters becomes an item in
 * the bag (2026-09-10). Saves from before the ruling hold unwritten vessels here; so does a legacy
 * blank. Returns how many moved. One that finds no room stays stowed until there is — the satchel
 * grid says so rather than losing it.
 */
export function sweepEmptyToBag(inv: Inventory): number {
  const stowed = loadStowed()
  const keep: StowedVessel[] = []
  let moved = 0
  for (const v of stowed) {
    if (v.gems.length) { keep.push(v); continue }
    const slot = firstEmptySlot(inv.slots)
    if (slot < 0) { keep.push(v); continue }
    inv.slots[slot] = vesselStack(v.kind, v.tier, v.move)
    moved++
  }
  if (moved) saveStowed(keep)
  return moved
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
    localStorage.removeItem(keeperKey(WORN_TIER_KEY))      // ⚠ NOT the floor: `ensureFloor` hands Greg's pair back into the bag
    localStorage.removeItem(keeperKey(WORN_WORD_KEY))
  } catch { /* private mode */ }
}

/**
 * How many of `kind` the keeper has ACQUIRED: the worn one if it is not Greg's, every stowed one above
 * the floor, and every one sitting in the BAG as an item (2026-09-10). Greg's pair is never in this
 * number — the cap governs what a keeper acquires; the floor sits under it (ruled 2026-09-04).
 */
export function ownedCount(kind: Vessel, inv: Inventory | null | undefined): number {
  const worn = wornPresent(kind) && !isFloor({ tier: wornTier(kind) }) ? 1 : 0
  return worn + loadStowed().filter(v => v.kind === kind && !isFloor(v)).length
       + bagVessels(inv).filter(v => v.kind === kind && !isFloor(v)).length
}

export type VesselRefusal = 'too-dear' | 'at-cap' | 'no-such-word' | 'too-many-seats' | 'not-given' | 'no-room'
export interface VesselPurchase { ok: boolean; marks: number; why?: VesselRefusal; say: string }
/** `slot` is where in the BAG it landed (2026-09-10; was `index` into the stowed list) */
export interface VesselGrant { ok: boolean; why?: VesselRefusal; say: string; slot?: number }


/**
 * ★ THE ONE DOOR A VESSEL COMES THROUGH — bought, found or won. Given (Greg's floor) is `withFloor`
 * and is refused here on purpose: a granted tier-0 would be a second floor, and canon has one.
 * `word` may be null only for a blank (the satchel cuts it later); a word must fit the tier's seats
 * and the kind's band. Persists on success. The caller spends Marks, rolls loot, or names the prize.
 */
export function grantVessel(inv: Inventory, kind: Vessel, tier: VesselTier, word: string | null, source: VesselSource): VesselGrant {
  if (isFloor({ tier }) || source === 'given') {
    return { ok: false, why: 'not-given', say: `Greg gave you the ${VESSEL_NOUN[kind]} you have. Nobody hands out a second.` }
  }
  const m = word !== null ? moveById(word) : undefined
  if (word !== null && (!m || ALL_BANDS[BAND_FOR_VESSEL[kind]] !== m.tier)) {
    return { ok: false, why: 'no-such-word', say: `Nobody down here has heard of that word for a ${kind}.` }
  }
  const seats = m ? lettersOf(m, null).length : 0
  if (seats > seatCapOf(tier)) {
    return { ok: false, why: 'too-many-seats', say: `${m!.name} asks ${seats} seats; a ${TIER_MATERIAL[kind][tier]} ${kind} bears ${seatCapOf(tier)}.` }
  }
  if (ownedCount(kind, inv) >= MAX_PER_KIND) {
    return { ok: false, why: 'at-cap', say: `Three ${kind}s is what a keeper can carry, and Greg's underneath. Nobody down here will sell you a fourth.` }
  }
  // ★ IT LANDS IN THE BAG (2026-09-10): an item until a letter goes in. A full bag refuses, the way it
  // refuses any pickup — the vessel stays on the shelf / on the ground / in the prize line.
  const slot = firstEmptySlot(inv.slots)
  if (slot < 0) return { ok: false, why: 'no-room', say: `Your bag is full. Make room and the ${VESSEL_NOUN[kind]} is yours.` }
  inv.slots[slot] = vesselStack(kind, tier, m?.id ?? null)
  const how = { bought: 'yours', found: 'found', won: 'won', given: 'given' }[source]
  return {
    ok: true, slot,
    // copy says canon's noun (a GLOVE of starwillow), never the kind id
    say: m ? `A ${VESSEL_NOUN[kind]} of ${TIER_MATERIAL[kind][tier]} for ${m.name}, ${seats} seat${seats === 1 ? '' : 's'} cut — ${how}. It is in your bag; set its first letter and it is yours to write.`
           : `A ${VESSEL_NOUN[kind]} of ${TIER_MATERIAL[kind][tier]}, uncut — ${how}. It is in your bag; cut it for a word.`,
  }
}

/** Buy one vessel: the Passage's stock is TIER 1, cut to order. Persists on success; the caller spends the Marks. */
export function buyVessel(inv: Inventory, kind: Vessel, marks: number, word?: string): VesselPurchase {
  // ★ MADE FOR ONE WORD (Alex, 2026-09-04). The Passage makes the paper to order, for a word the keeper
  // already holds; the vessel's seats are that word's letters. `word` is optional only for the legacy
  // blank (a vessel bought before the ruling), which the satchel lets a keeper assign a word to.
  // Refusals are ordered so the cheapest to fix comes last: a wrong word, then the cap, then the price.
  const m = word !== undefined ? moveById(word) : undefined
  if (word !== undefined && (!m || ALL_BANDS[BAND_FOR_VESSEL[kind]] !== m.tier)) {
    return { ok: false, marks, why: 'no-such-word', say: `Nobody down here has heard of that word for a ${kind}.` }
  }
  if (ownedCount(kind, inv) >= MAX_PER_KIND) {
    return { ok: false, marks, why: 'at-cap', say: `Three ${kind}s is what a keeper can carry, and Greg's underneath. Nobody down here will sell you a fourth.` }
  }
  if (marks < VESSEL_PRICE) {
    return { ok: false, marks, why: 'too-dear', say: `${VESSEL_PRICE} Marks — grown, not ridden in. Come back with them.` }
  }
  const g = grantVessel(inv, kind, 1, m?.id ?? null, 'bought')
  return g.ok ? { ok: true, marks: marks - VESSEL_PRICE, say: g.say } : { ok: false, marks, why: g.why, say: g.say }
}

/**
 * The vessel of `kind` the keeper is WEARING, read off the two live keys — its letters from the
 * letters record, its word from the saved loadout. This is the half that never moved.
 */
export function equippedVessel(kind: Vessel, birth: string | null, starter?: string): StowedVessel {
  const active = loadLetters(birth, rawLoadout(), starter)
  const band = BAND_FOR_VESSEL[kind]
  // the vessel's own word first; the band only for a save from before the word was recorded
  return { kind, gems: [...active.vessels[kind]], move: wornWord(kind) ?? (band >= 0 ? (rawLoadout()[band] ?? null) : null), tier: wornTier(kind) }
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
// The flow (amended 2026-09-10): the Passage makes a vessel for a word → it sits in the BAG as an ITEM →
// the keeper sets its first letter (`writeFromBag`) and it becomes a STOWED vessel, a part → the rest of
// its letters (`placeGems`) → every seat filled = the word is WRITTEN = it moves to Gear (`isComplete`)
// → equip / dismantle. Dismantle returns the letters (canon: unbind is free) and the empty vessel goes
// back to the BAG as an item, still cut for its word.

/** The letters this vessel's seats were cut for. A legacy blank (bought before the ruling) has none yet. */
export function seatLetters(v: Pick<StowedVessel, 'move'>, birth: string | null): string[] {
  if (!v.move) return []
  const m = moveById(v.move)
  return m ? lettersOf(m, birth) : []
}
export const seatCount = (v: Pick<StowedVessel, 'move'>, birth: string | null): number => seatLetters(v, birth).length
/** Which of its own letters this vessel still lacks. */
export const shortOf = (v: StowedVessel, birth: string | null): string[] => missingLetters(seatLetters(v, birth), v.gems)
/** Written = made for a word AND every seat holds its letter. Only a written vessel is gear. */
export const isComplete = (v: StowedVessel, birth: string | null): boolean => !!v.move && shortOf(v, birth).length === 0
/** The stowed vessels of a kind that are written — what the Gear dropdown may offer to equip. */
export function completeVessels(kind: Vessel, birth: string | null): { v: StowedVessel; i: number }[] {
  return loadStowed().map((v, i) => ({ v, i })).filter(({ v }) => v.kind === kind && isComplete(v, birth))
}

export interface Placement { ok: boolean; placed: string[]; short: string[]; complete: boolean; say: string }
const refuse = (say: string): Placement => ({ ok: false, placed: [], short: [], complete: false, say })

/**
 * ★ THE ITEM BECOMES A VESSEL (2026-09-10): set, from the bag of letters, as many of this bag-vessel's
 * letters as the keeper holds. With at least one set, the item leaves its slot and joins the stowed
 * list — parts until every seat is filled. Same return shape as `placeGems`; `index` is where it now
 * sits in the stowed list, for a host that wants to keep it selected.
 */
export function writeFromBag(inv: Inventory, slot: number, birth: string | null, l: Letters): { r: Placement; letters: Letters; index: number | null } {
  const s = inv.slots[slot]
  const v = s ? parseVesselItem(s.itemId) : null
  if (!s || !v) return { r: refuse('No such vessel.'), letters: l, index: null }
  const move = s.vesselData?.move ?? null
  if (!move) return { r: refuse('This one was never cut for a word. Choose one first.'), letters: l, index: null }
  const bag = { ...l.bag }
  const placed: string[] = []
  const short: string[] = []
  for (const r of seatLetters({ move }, birth)) {
    if ((bag[r] ?? 0) > 0) { bag[r] = bag[r]! - 1; placed.push(r) } else short.push(r)
  }
  if (!placed.length) return { r: { ...refuse(`You hold none of what it needs: ${short.join(', ')}.`), short }, letters: l, index: null }
  const stowed = [...loadStowed(), { kind: v.kind, gems: placed, move, tier: v.tier }]
  saveStowed(stowed)
  inv.slots[slot] = null
  const tidy: Record<string, number> = {}
  for (const [k, n] of Object.entries(bag)) if (n > 0) tidy[k] = n
  const complete = short.length === 0
  return {
    r: { ok: true, placed, short, complete,
         say: complete ? `Written. It is gear now — find it on the Gear tab.` : `${placed.length} set. It is a vessel now — still short: ${short.join(', ')}.` },
    letters: { bag: tidy, vessels: l.vessels },
    index: loadStowed().length - 1,
  }
}
/**
 * Cut an uncut vessel IN THE BAG for its word — a legacy blank, or Greg's floor taking its one-letter word.
 * Refuses if it already has one, if the word asks more seats than the tier bears (`seatCapOf`: the floor
 * takes ONE letter), if the word is off the kind's band, or if it is body-held (no paper needed).
 */
export function setWordOnItem(inv: Inventory, slot: number, word: string, birth: string | null): boolean {
  const s = inv.slots[slot]
  const v = s ? parseVesselItem(s.itemId) : null
  if (!s || !v || s.vesselData?.move) return false
  const m = moveById(word)
  if (!m || ALL_BANDS[BAND_FOR_VESSEL[v.kind]] !== m.tier) return false
  const seats = lettersOf(m, birth).length
  if (seats === 0 || seats > seatCapOf(v.tier)) return false
  inv.slots[slot] = { ...s, vesselData: { move: word } }
  return true
}
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
/**
 * Take a stowed vessel apart: its gems go back to the bag of letters, and the vessel — empty now, so an
 * ITEM again (2026-09-10) — goes back to the bag of things, still cut for its word. Refused when the bag
 * has no room: nothing moves, and `say` says why. Returns the letters to save.
 */
export function dismantle(i: number, l: Letters, inv: Inventory): { ok: boolean; say: string; letters: Letters } {
  const stowed = loadStowed()
  const v = stowed[i]
  if (!v) return { ok: false, say: 'No such vessel.', letters: l }
  const slot = firstEmptySlot(inv.slots)
  if (slot < 0) return { ok: false, say: 'Your bag is full — nowhere to put the empty vessel.', letters: l }
  const bag = { ...l.bag }
  for (const r of v.gems) bag[r] = (bag[r] ?? 0) + 1
  stowed.splice(i, 1)
  saveStowed(stowed)
  inv.slots[slot] = vesselStack(v.kind, v.tier, v.move)
  return { ok: true, say: 'Taken apart. The letters are back in your bag, and so is the vessel.', letters: { bag, vessels: l.vessels } }
}
/**
 * Take the WORN vessel apart: its letters return to the bag, its band clears, and the empty paper goes
 * back to the BAG as an item, still cut for its word, in its own material. Never refused for the cap — the worn
 * vessel was already counted, so taking it off cannot put a keeper over. A keeper with nothing worn
 * still casts their birth move; a body-held word needs no paper.
 */
export function dismantleWorn(kind: Vessel, birth: string | null, inv: Inventory, starter?: string): boolean {
  const band = BAND_FOR_VESSEL[kind]
  if (band < 0) return false
  // ★ the empty vessel is an ITEM (2026-09-10): it needs a bag slot, and a full bag refuses before any write
  const slot = firstEmptySlot(inv.slots)
  if (slot < 0) return false
  const slots: Loadout = ALL_BANDS.map((_, k) => rawLoadout()[k] ?? null)
  // the vessel's own word — the band may already be unbound (a word the keeper no longer knows) and
  // the vessel still comes back to the satchel cut for what it was cut for
  const word = wornWord(kind) ?? slots[band] ?? null
  const active = loadLetters(birth, slots, starter)
  if (!word && !active.vessels[kind].length) return false
  inv.slots[slot] = vesselStack(kind, wornTier(kind), word)
  saveLetters(unbindLetters(active, kind))
  slots[band] = null
  saveLoadout(slots)
  saveWornWord(kind, null)
  return true
}
// `setWord` (cut a STOWED blank) retired 2026-09-10: a stowed vessel always bears a letter, so always a
// word. Cutting happens on the item in the bag — `setWordOnItem`.
