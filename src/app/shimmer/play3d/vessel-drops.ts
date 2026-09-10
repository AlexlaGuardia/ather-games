/**
 * vessel-drops.ts — WHERE A VESSEL TURNS UP: the FOUND door and the WON door, as tables.
 *
 * ── ★★ CANON (Magii + Alex, 2026-09-04): a keeper never makes a vessel ───────────────────────
 * *"They are found, won, bought, or given."* `vessels.ts` is the model (the tiers, the floor, the
 * one door `grantVessel`); the Passage is BOUGHT (tier 1) and `withFloor` is GIVEN (Greg's pair).
 * This file is the other two verbs. The boundary widened Jin's side to exactly this: *"where
 * vessels drop, what prizes award them ... every number"* — so everything here is a build number
 * and none of it is lore. A drop says WHAT was found; it never says WHO lost it.
 *
 * ── THE TWO DOORS ──
 *   · FOUND = `dig`. A rare roll when a keeper breaks deep rock: a vessel somebody lost, buried. It
 *     falls out of the block as a drop with id `vessel_<noun>_t<tier>` — the same family as the icon
 *     ids, so the drop draws as the thing it is — and is TAKEN on pickup into the satchel, never into
 *     the bag (`takeVessel`). At the cap the pickup is refused and the drop stays on the ground, yours.
 *   · WON = `trial`. A prize for clearing a trial — today the Three Puppet Guards in the range
 *     (`Shimmer3D.tsx`, `EncounterState.cleared`). The first clear of a trial is a SURE prize; later
 *     clears roll. The ledger is per keeper (`TRIALS_KEY`), so the sure prize cannot be farmed by
 *     toggling the range. ⚠ The range is a dev door today; the hook is where the real Throne
 *     encounter will fire from, and it costs nothing to have it there first.
 *
 * ── ★ "FINDING ONE IS INHERITING AN INTENTION" (canon) ──
 * A found vessel is CUT for a word — somebody made it for something. `chooseWord` picks that word
 * for THIS keeper: on their lane (a bracelet for a word off the keeper's element lane can never be
 * bound, so it would be a brick with a story), seats that fit the tier, never body-held, never a
 * word that already has a vessel while another is possible. Words the keeper can already read weigh
 * `readyWeight`; words they cannot yet read weigh `stretchWeight` — *"some of which they grow into"*
 * is a sentence canon wrote, and a stretch word is how the build says it.
 *
 * ── JIN'S NUMBERS (all of them; tune here, nowhere else) ──
 *   · dig: DEEP_STONE 1 in 250 blocks, STONE 1 in 800; tier 2 (shimmeroak / shimmerscale)
 *   · trial: tier 3 (starwillow / pearlshell); first clear sure, then 1 in 3
 *   · a duplicate (a second vessel for a word that has one) is avoided, not forbidden — and when it
 *     happens (the pool exhausted), IT IS A SPARE. Ruled Jin's side 2026-09-05: a duplicate neither
 *     trades in nor breaks down; `dismantle` already returns its letters and the paper stays cut, so
 *     a second glove for one word is one more paper to write on, nothing more. No trade-in table.
 *
 * ── VOCABULARY ── ✅ found, won, dig, trial, prize, buried, taken.
 * ⛔ craft / recipe / grow (no vessel has one), loot-as-noun in copy (canon's word is *found*), chest
 *    (a vessel is not stored in a block), drop-as-noun in copy (the DROP is the mechanism, the copy
 *    says what was found).
 */
import { keeperKey } from '@/lib/keeper-local'
import { MAT } from '../voxel/depth'
import { KEEPER_MOVES, type KeeperMove } from './keeper-moves'
import { ALL_BANDS, LANE_FOR_KIND, laneRunes } from './cast'
import { lettersOf, VESSELS, type Vessel } from './gems'
import { rawLoadout } from './loadout'
import {
  grantVessel, ownedCount, seatCapOf, loadStowed, MAX_PER_KIND, BAND_FOR_VESSEL, VESSEL_NOUN, TIER_MATERIAL,
  type VesselTier, type VesselGrant,
} from './vessels'

export const TRIALS_KEY = 'ather:shimmer:trials'

/**
 * ★ THE ROADS, AS DOORS. `dig` and `cache` are both canon's FOUND road and they are kept apart
 * because they are different acts: a dig is luck while you were mining for something else, a cache
 * is a thing you went and got. They pay the same tier and read differently, which is the whole
 * reason the copy is keyed on the door rather than on the tier.
 */
export type DropDoor = 'dig' | 'cache' | 'trial'
export type TrialId = 'puppet-guards'

export const DROP_TUNING = {
  /** chance per block BROKEN, by material; anything not listed never yields */
  dig: { [MAT.DEEP_STONE]: 1 / 250, [MAT.STONE]: 1 / 800 } as Readonly<Record<number, number>>,
  digTier: 2 as VesselTier,
  /**
   * ★★ THE CACHE ROAD IS CAPPED AT TIER 2, AND THE CAP IS THE LADDER (canon, 2026-09-05).
   * `design-briefs/shimmer-casting-vessels.md` › THE THREE ROADS puts the Crucible band — *the
   * paper for an ultimate* — at the top *"structurally unbuyable rather than merely expensive"*,
   * and a cache that could pay it would collapse the three roads into one. So a warren pays what a
   * dig pays. What a warren buys over a dig is CERTAINTY: a cache is always there and always gives
   * one, where deep rock is 1 in 250. The road trades luck for a walk, never rarity for a walk.
   */
  cacheTier: 2 as VesselTier,
  trialTier: 3 as VesselTier,
  /** a trial's first clear is a sure prize; every clear after rolls this */
  trialAgain: 1 / 3,
  /** word weights: a word the keeper can read now vs one they cannot yet */
  readyWeight: 4,
  stretchWeight: 1,
} as const

// ── the drop id: the icon family, so the drop draws as the thing it is ───────────────────────
const NOUN_KIND: Record<string, Vessel> = Object.fromEntries(VESSELS.map(k => [VESSEL_NOUN[k], k]))
export const vesselItemId = (kind: Vessel, tier: VesselTier): string => `vessel_${VESSEL_NOUN[kind]}_t${tier}`
/** `vessel_glove_t2` → `{ kind: 'focus', tier: 2 }`; anything else → null. Keyed by the NOUN. */
export function parseVesselItem(itemId: string): { kind: Vessel; tier: VesselTier } | null {
  const m = /^vessel_([a-z]+)_t([0-3])$/.exec(itemId)
  if (!m) return null
  const kind = NOUN_KIND[m[1]!]
  return kind ? { kind, tier: Number(m[2]) as VesselTier } : null
}
export const isVesselItem = (itemId: string): boolean => parseVesselItem(itemId) !== null
/** Can the satchel take one more of `kind`? The pickup gate — a refused vessel stays on the ground. */
export const vesselRoom = (kind: Vessel): boolean => ownedCount(kind) < MAX_PER_KIND

// ── FOUND: the dig roll ───────────────────────────────────────────────────────────────────────
/** One roll per block broken. `null` almost always; a kind + tier when the rock gives something up. */
export function rollDig(material: number, rng: () => number = Math.random): { kind: Vessel; tier: VesselTier } | null {
  const chance = DROP_TUNING.dig[material]
  if (chance === undefined || rng() >= chance) return null
  const kind = VESSELS[Math.min(VESSELS.length - 1, Math.floor(rng() * VESSELS.length))]!
  return { kind, tier: DROP_TUNING.digTier }
}

/**
 * What this cache holds. Unlike `rollDig` there is no chance gate — a cache always gives one, and
 * that certainty is what the descent buys. Pure: the caller passes the rng.
 */
export function rollCache(rng: () => number = Math.random): { kind: Vessel; tier: VesselTier } {
  const kind = VESSELS[Math.min(VESSELS.length - 1, Math.floor(rng() * VESSELS.length))]!
  return { kind, tier: DROP_TUNING.cacheTier }
}

// ── the word a found vessel was cut for ──────────────────────────────────────────────────────
/** words of `kind`'s band this keeper could ever bind, whose seats fit `tier` */
export function wordPool(kind: Vessel, tier: VesselTier, birth: string | null): KeeperMove[] {
  const band = ALL_BANDS[BAND_FOR_VESSEL[kind]]
  const lane = band ? LANE_FOR_KIND[band] : null
  const onIt = lane ? laneRunes(birth, lane) : new Set<string>()
  return KEEPER_MOVES.filter(m => {
    if (m.tier !== band) return false
    if (m.birthExclusive && m.birthExclusive !== birth) return false
    const n = lettersOf(m, birth).length
    if (n < 1 || n > seatCapOf(tier)) return false           // body-held needs no paper; the floor bears one
    return m.runes.every(r => onIt.has(r))                    // a word off the lane could never be bound
  })
}
/** the words that already have a vessel, worn or stowed — a duplicate is avoided while another word is possible */
function vesseledWords(kind: Vessel): Set<string> {
  const band = BAND_FOR_VESSEL[kind]
  const out = new Set<string>(loadStowed().filter(v => v.kind === kind && v.move).map(v => v.move!))
  const worn = band >= 0 ? rawLoadout()[band] : null
  if (worn) out.add(worn)
  return out
}
/**
 * Pick the word. Ready words (every rune owned) weigh `readyWeight`, stretch words `stretchWeight`;
 * words that already have a vessel are dropped from the pool unless that empties it. `null` only
 * when the keeper's lane holds no word at all — then the vessel arrives uncut.
 */
export function chooseWord(kind: Vessel, tier: VesselTier, owned: readonly string[], birth: string | null, rng: () => number = Math.random): string | null {
  let pool = wordPool(kind, tier, birth)
  const taken = vesseledWords(kind)
  const fresh = pool.filter(m => !taken.has(m.id))
  if (fresh.length) pool = fresh
  if (!pool.length) return null
  const have = new Set(owned)
  const weights = pool.map(m => (m.runes.every(r => have.has(r)) ? DROP_TUNING.readyWeight : DROP_TUNING.stretchWeight))
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng() * total
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!
    if (roll < 0) return pool[i]!.id
  }
  return pool[pool.length - 1]!.id
}

// ── taking one off the ground / off the trial ─────────────────────────────────────────────────
const DOOR_LINE: Record<DropDoor, string> = {
  dig: 'Dug out of the rock —',
  // ⚠ THE COPY SAYS WHAT WAS FOUND AND REFUSES TO SAY WHO LEFT IT, which is canon and not restraint
  // for its own sake: *"somebody made it for a word they meant to write, and the keeper who digs it
  // out will never learn who or why."* Naming a builder here would rule an OPEN gap by shipping.
  cache: 'Left in the dark for somebody —',
  trial: 'The trial\'s prize —',
}
function lower(s: string): string { return s.charAt(0).toLowerCase() + s.slice(1) }

/**
 * Take a vessel drop into the satchel: parse the id, choose its word for this keeper, grant it
 * through the one door. `ok:false` at the cap (the drop stays) or on a foreign id.
 */
export function takeVessel(itemId: string, door: DropDoor, owned: readonly string[], birth: string | null, rng: () => number = Math.random): VesselGrant {
  const v = parseVesselItem(itemId)
  if (!v) return { ok: false, why: 'no-such-word', say: 'That is not a vessel.' }
  const word = chooseWord(v.kind, v.tier, owned, birth, rng)
  // ★ TWO DOORS, ONE ROAD: `dig` and `cache` are both canon's FOUND. Only the trial is WON.
  const g = grantVessel(v.kind, v.tier, word, door === 'trial' ? 'won' : 'found')
  return g.ok ? { ...g, say: `${DOOR_LINE[door]} ${lower(g.say)}` } : g
}

// ── WON: the trial ledger ─────────────────────────────────────────────────────────────────────
export function loadTrials(): Partial<Record<TrialId, number>> {
  try {
    const raw = JSON.parse(localStorage.getItem(keeperKey(TRIALS_KEY)) ?? 'null') as unknown
    if (!raw || typeof raw !== 'object') return {}
    const out: Partial<Record<TrialId, number>> = {}
    for (const [k, n] of Object.entries(raw as Record<string, unknown>)) if (typeof n === 'number' && n > 0) out[k as TrialId] = Math.floor(n)
    return out
  } catch { return {} }
}
function saveTrials(t: Partial<Record<TrialId, number>>): void {
  try { localStorage.setItem(keeperKey(TRIALS_KEY), JSON.stringify(t)) } catch { /* private mode */ }
}
export function clearTrials(): void {
  try { localStorage.removeItem(keeperKey(TRIALS_KEY)) } catch { /* private mode */ }
}
/** Does THIS clear pay? The first ever is sure; after that `trialAgain`. Pure — the ledger is passed in. */
export function trialPays(clearsBefore: number, rng: () => number = Math.random): boolean {
  return clearsBefore === 0 || rng() < DROP_TUNING.trialAgain
}
export interface TrialResult { paid: boolean; clears: number; grant?: VesselGrant; say: string }
/**
 * Record a clear and, if it pays, hand a tier-3 vessel through the WON door. Which kind is the
 * trial's call (`kind`), or the roll's. Call ONCE per clear — the host owns the edge.
 */
export function clearTrial(trial: TrialId, owned: readonly string[], birth: string | null, kind?: Vessel, rng: () => number = Math.random): TrialResult {
  const ledger = loadTrials()
  const before = ledger[trial] ?? 0
  ledger[trial] = before + 1
  saveTrials(ledger)
  if (!trialPays(before, rng)) return { paid: false, clears: before + 1, say: 'Cleared. Nothing left behind this time.' }
  const k = kind ?? VESSELS[Math.min(VESSELS.length - 1, Math.floor(rng() * VESSELS.length))]!
  const tier = DROP_TUNING.trialTier
  if (!vesselRoom(k)) {
    return { paid: false, clears: before + 1, say: `Cleared — a ${TIER_MATERIAL[k][tier]} ${VESSEL_NOUN[k]} was here for the taking, and you carry all the ${VESSEL_NOUN[k]}s a keeper can.` }
  }
  const grant = takeVessel(vesselItemId(k, tier), 'trial', owned, birth, rng)
  return { paid: grant.ok, clears: before + 1, grant, say: grant.say }
}
