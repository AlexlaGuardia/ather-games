// A BREWING — the hands at one cauldron, and what the pour pays each of them.
//
// RULED 2026-09-16 (athernyx fc63a33, `game/alchemy.md` › THE BREWING'S PARTS › 2 and 4). Alex:
// *"set up all the pieces for players to host alchemy parties on their home plot… the host starts
// the recipe and the guests participate and all who participate get rewarded with the potion."*
//   · **A hand counts.** An ingredient is a contribution and a performed step is a contribution.
//     Two guests — one brought Sunpetal and stood there, one brought nothing and ground for three
//     steps — both leave the pour with a bottle.
//   · **The host starts the recipe** (holds the fold open, lights the cauldron, chooses the potion).
//   · **Skill follows the hand**: the XP for a step goes to whoever performed it, at anyone's pot.
//   · **More hands brew more per ingredient**, flattening near four stands (08-29) — that is what
//     pays for feeding a hand; the host loses nothing.
//   · **Bottle only.** A guest may brew a potion they cannot make yet and leaves with the bottle,
//     the XP and the company — never the recipe. `pour()` returns no recipe for anyone; learning is
//     the keeper's own road (`recipe-ladder`, canon's *Yarrow teaches the first*).
//
// ★ PURE. No world, no inventory, no network: this is the ledger and the arithmetic. The host
// applies it — today with ONE hand (the keeper is host and every hand), which is why the numbers
// below reduce to the solo potion exactly (`yieldFor(1) === 1`). When the presence layer can put a
// guest on a plot, the ledger is what it fills in; nothing here changes.
//
// ⚖ Numbers are Jin's (the ruling says so): the yield curve, the floor of one, the step XP slice.

import { POTION_DEFS } from '../engine/alchemy'
import { roadOf, alchemyRecipe, craftWordOf, ROAD_STATION, ALCHEMY_STATIONS, ALCHEMY_RUN_MS, type RoadStep, type AlchemyStationId } from './alchemy-chain'

// ── ★★ THE BREWING IS THE PLOT'S EVENT, AND THE STATIONS ARE ITS HANDS (2026-09-21) ──────────
// Alex: *"a homeplot event that is started at the cauldron but triggers other workstations across
// the map so if i have an area with a cauldron and multiple of the other stations any of them can
// complete the required step in the recipe."* Until today the road was an ITEM pipeline: the
// mortar made a "— ground" stage item, the keeper carried it to the still, the still made a
// "— distilled" one, and so on to the pot; every station was an island with its own list, and a
// second mortar on a plot meant nothing. The ledger below (09-16) already said the truer thing —
// the host starts the recipe at the pot, a performed step is a contribution — and had no consumer.
//
// Now the pot HOLDS the brewing. The ingredients go in at the cauldron; the road's steps are open
// jobs; ANY station of the right kind in the brewing's reach (`inReach`) takes the next one and
// runs it on its own clock (`beginStep` → `settle`); when the road is walked the host lights the
// pot (`light`) and it pours after the cauldron's run (`pourReady` → `pour`). No stage items, no
// carrying. Two mortars serve two brewings at once, which is what makes owning two worth it.
//
// ★ REACH: on the plot, the plot — the bank's own scope (one pool, any door). Anywhere else, a
// radius of the cauldron (`REACH_BLOCKS`): a settlement's still on the far side of the square is
// this pot's; one in the next valley is not.
//
// ★ THE RECORD LIVES WITH THE KEEPER (`PlayerSave.brewings`), keyed by the cauldron, for the bank's
// reason: a still must be able to ask "what is open near me" without walking to the pot's column.
// The lit cauldron block is still swapped by the host (`CAULDRON_LIT`) so the world shows it.

/** How far a brewing reaches off the plot, in blocks (horizontal). */
export const REACH_BLOCKS = 32

export interface BrewingAt { space: string; x: number; y: number; z: number }
export const brewingKey = (at: BrewingAt): string => `${at.space}:${at.x},${at.y},${at.z}`
export const stationKeyOf = (x: number, y: number, z: number): string => `${x},${y},${z}`

/** A road step being run at one station right now. */
export interface StepRun {
  /** The station's block key (`x,y,z` in the brewing's space). */
  station: string
  /** 1-based step of the road. */
  step: number
  since: number
  /** The hand that set it going — paid the step when it settles. */
  by: string
}

/** Every open brewing the keeper can see, keyed by `brewingKey`. */
export type Brewings = Record<string, Brewing>

export interface Hand {
  id: string
  name: string
  /** Road steps this hand performed. */
  steps: number
  /** Ingredient units this hand brought. */
  ingredients: number
}

export interface Brewing {
  potionId: string
  /** The hand that started it — holds the fold open, chooses the potion. */
  host: string
  hands: Record<string, Hand>
  /** Road steps done so far (0..road.length); the cauldron comes after the last. */
  stage: number
  /** The host has lit the cauldron — the road is walked and the pot is on. */
  lit: boolean
  startedAt: number
  /** Where the pot is. Absent only on a bare ledger (tests, the party arithmetic). */
  at?: BrewingAt
  /** The step a station is running now, if any. One at a time: a road is walked in order. */
  run?: StepRun
  /** When the host lit it — the pour is ready `brewMs` after. */
  litAt?: number
}

export function startBrewing(potionId: string, host: { id: string; name: string }, now: number, at?: BrewingAt): Brewing | null {
  if (!POTION_DEFS[potionId]) return null
  const b: Brewing = { potionId, host: host.id, hands: { [host.id]: { id: host.id, name: host.name, steps: 0, ingredients: 0 } }, stage: 0, lit: false, startedAt: now }
  if (at) b.at = at
  return b
}

// ── the physical layer: reach, the next step, a station's run, the pot's clock ────────────────

/** The road step the brewing is waiting on, or null when the road is walked. */
export function nextStep(b: Brewing): RoadStep | null {
  return roadOf(b.potionId)[b.stage] ?? null
}
/** The station kind that can take the next step, or null. */
export function nextStation(b: Brewing): AlchemyStationId | null {
  const st = nextStep(b)
  return st ? ROAD_STATION[st] : null
}

/** Is a station at (space, x, z) within this brewing's reach? */
export function inReach(b: Brewing, space: string, x: number, z: number): boolean {
  if (!b.at || b.at.space !== space) return false
  if (space === 'plot') return true
  return Math.hypot(x - b.at.x, z - b.at.z) <= REACH_BLOCKS
}

/**
 * The brewings a station of `kind` at (space, x, z) could take a step of right now: in reach,
 * waiting on this station's step, and nobody running it. Oldest first — the pot that has waited
 * longest is served first, so a plot with two brewings and one still does not starve one.
 */
export function openFor(all: Brewings, kind: AlchemyStationId, space: string, x: number, z: number): Brewing[] {
  // (No `!b.lit` clause: a lit pot has a walked road, so `nextStation` is already null for it —
  // a mutation sweep showed the extra clause could never fire.)
  return Object.values(all)
    .filter(b => !b.run && inReach(b, space, x, z) && nextStation(b) === kind)
    .sort((a, b) => a.startedAt - b.startedAt)
}

/** The brewing this station is running a step of, if any. */
export function runningAt(all: Brewings, stationKey: string): Brewing | null {
  return Object.values(all).find(b => b.run?.station === stationKey) ?? null
}

/** How long the brewing's CURRENT step runs at its station. */
export function stepMs(b: Brewing): number {
  const st = nextStep(b)
  return st ? ALCHEMY_STATIONS[ROAD_STATION[st]].runMs : 0
}

/** A station begins the next road step. Refused if the road is walked, a run is on, or the pot is lit. */
export function beginStep(b: Brewing, stationKey: string, handId: string, now: number): Brewing | null {
  if (b.lit || b.run || !nextStep(b)) return null
  const h = b.hands[handId]
  if (!h) return null
  return { ...b, run: { station: stationKey, step: b.stage + 1, since: now, by: handId } }
}

/** 0..1 through the current run; 0 when nothing runs. */
export function runProgress(b: Brewing, now: number): number {
  if (!b.run) return 0
  return Math.max(0, Math.min(1, (now - b.run.since) / stepMs(b)))
}

/**
 * Settle a finished run into the ledger: the stage advances, the hand that set it going is paid
 * the step. Idempotent — a run not yet done is returned as is. Called on every read of a
 * brewing, so a step finishes on the clock whether or not anyone is standing at the station
 * (the mortar ground it; nobody has to watch the mortar).
 */
export function settle(b: Brewing, now: number): Brewing {
  if (!b.run || now - b.run.since < stepMs(b)) return b
  const { run, ...rest } = b
  return step({ ...rest }, run.by)
}

/** The pot's own run once lit — a cordial ages. */
export function brewMs(b: Brewing): number {
  const def = POTION_DEFS[b.potionId]
  return def && craftWordOf(def) === 'cordial' ? ALCHEMY_RUN_MS.age : ALCHEMY_STATIONS.cauldron.runMs
}
/** Lit and its run is up — the host may pour. */
export function pourReady(b: Brewing, now: number): boolean {
  return b.lit && b.litAt !== undefined && now - b.litAt >= brewMs(b)
}
/** 0..1 through the pot's run; 0 before lighting. */
export function brewProgress(b: Brewing, now: number): number {
  if (!b.lit || b.litAt === undefined) return 0
  return Math.max(0, Math.min(1, (now - b.litAt) / brewMs(b)))
}

/** The ingredient rows the host put in the pot — what an abandon before lighting gives back. */
export function ingredientsOf(b: Brewing): { itemId: string; count: number }[] {
  return POTION_DEFS[b.potionId]?.recipe.map(r => ({ itemId: r.itemId, count: r.count })) ?? []
}
/**
 * Abandon a brewing. Before the pot is lit the ingredients come back — a half-walked road cost
 * time, not stuff. Once lit, nothing: the pot has them. The caller removes the record.
 */
export function abandonRefund(b: Brewing): { itemId: string; count: number }[] {
  return b.lit ? [] : ingredientsOf(b)
}

/** One line for the HUD / panel: `distil → mix → pour · at the still`. */
export function roadLine(b: Brewing): string {
  const road = roadOf(b.potionId)
  const words = road.map((st, i) => {
    const w = ALCHEMY_STATIONS[ROAD_STATION[st]].name.toLowerCase()
    return i < b.stage ? `✓ ${w}` : i === b.stage && b.run ? `⟳ ${w}` : w
  })
  words.push(b.lit ? '⟳ pour' : 'pour')
  return words.join(' → ')
}

/** A hand joins (or is already here). Joining alone is not a contribution — see `contributed`. */
export function join(b: Brewing, hand: { id: string; name: string }): Brewing {
  if (b.hands[hand.id]) return b
  return { ...b, hands: { ...b.hands, [hand.id]: { id: hand.id, name: hand.name, steps: 0, ingredients: 0 } } }
}

/** A hand brings `n` ingredient units. */
export function bring(b: Brewing, handId: string, n: number): Brewing {
  const h = b.hands[handId]
  if (!h || n <= 0) return b
  return { ...b, hands: { ...b.hands, [handId]: { ...h, ingredients: h.ingredients + n } } }
}

/**
 * A hand performs the next road step. Refused when the road is done (the cauldron is not a road
 * step — it is lit by the host, `light`) or when the hand is not at the brewing.
 */
export function step(b: Brewing, handId: string): Brewing {
  const h = b.hands[handId]
  if (!h || b.stage >= roadOf(b.potionId).length) return b
  return { ...b, stage: b.stage + 1, hands: { ...b.hands, [handId]: { ...h, steps: h.steps + 1 } } }
}

/** The host lights the cauldron: allowed only once the road is walked (and no run is on). */
export function light(b: Brewing, now?: number): Brewing | null {
  if (b.run || b.stage < roadOf(b.potionId).length) return null
  return now === undefined ? { ...b, lit: true } : { ...b, lit: true, litAt: now }
}

/** Did this hand contribute — an ingredient, or a step? Standing there is not a contribution. The host always did: the pot, the fold, the recipe. */
export const contributed = (b: Brewing, h: Hand): boolean => h.id === b.host || h.steps > 0 || h.ingredients > 0

/**
 * Bottles the pour yields in total for `hands` contributing hands, as a multiple of the potion's
 * solo `resultCount`. 1 → 1.0 · 2 → 1.65 · 3 → 1.92 · 4 → 2.12 · 8 → 2.72: rising, and flattening
 * near four stands. Rounded up so a second hand always adds at least one bottle.
 */
export const yieldFor = (hands: number): number => hands <= 1 ? 1 : 1 + 0.65 * Math.sqrt(hands - 1)

export interface Pour {
  /** Bottles per hand id. Every contributing hand gets at least one; the host takes the remainder. */
  bottles: Record<string, number>
  /** Alchemy XP per hand id — each road step's slice to the hand that did it, the pour's to the host. */
  xp: Record<string, number>
  /** Always empty: a brewing hands out bottles, never recipes. Here so a caller cannot forget the rule. */
  recipes: Record<string, never>
}

/**
 * The pour. `contributedOnly` are the hands paid; a hand that neither brought nor did anything
 * leaves with the company. XP per road step is that step's row XP; the pour's XP is the finish row's.
 */
export function pour(b: Brewing): Pour | null {
  const def = POTION_DEFS[b.potionId]
  const road = roadOf(b.potionId)
  if (!def || !b.lit || b.stage < road.length) return null
  const paid = Object.values(b.hands).filter(h => contributed(b, h))
  const bottles: Record<string, number> = {}
  const xp: Record<string, number> = {}
  const total = Math.max(paid.length, Math.ceil(def.resultCount * yieldFor(paid.length)))
  // One each, then the rest to the host (the host's is the pot, the fold, the recipe).
  for (const h of paid) bottles[h.id] = 1
  const host = b.hands[b.host]
  if (host) bottles[host.id] = (bottles[host.id] ?? 0) + (total - paid.length)
  // XP: the road's XP split by the steps each hand did (which step is not recorded — every step of
  // a road pays the same slice, so the split is exact); the pour's XP to the host, who lit it.
  const stepXp = road.reduce((n, _, i) => n + (alchemyRecipe(`road:${b.potionId}:${i + 1}`)?.xp ?? 0), 0)
  const stepsDone = Object.values(b.hands).reduce((n, h) => n + h.steps, 0)
  for (const h of paid) xp[h.id] = stepsDone > 0 ? Math.round(stepXp * (h.steps / stepsDone)) : 0
  if (host) xp[host.id] = (xp[host.id] ?? 0) + (alchemyRecipe(`finish:${b.potionId}`)?.xp ?? 0)
  return { bottles, xp, recipes: {} }
}

// ── the save ─────────────────────────────────────────────────────────────────────────────────
/**
 * The record back from `PlayerSave.brewings`. Shape-checked per entry: a pot whose potion no
 * longer exists, or whose key does not match its `at`, is dropped rather than left to throw in a
 * panel. Absent and malformed both load as no brewings.
 */
export function brewingsFromSave(saved: unknown): Brewings {
  const out: Brewings = {}
  if (!saved || typeof saved !== 'object') return out
  for (const [k, v] of Object.entries(saved as Record<string, unknown>)) {
    const b = v as Partial<Brewing> | null
    if (!b || typeof b !== 'object' || typeof b.potionId !== 'string' || !POTION_DEFS[b.potionId]) continue
    if (!b.at || typeof b.at !== 'object' || brewingKey(b.at) !== k) continue
    if (typeof b.host !== 'string' || !b.hands || typeof b.hands !== 'object' || !b.hands[b.host]) continue
    const road = roadOf(b.potionId)
    const stage = Math.max(0, Math.min(road.length, Number(b.stage) || 0))
    const rec: Brewing = {
      potionId: b.potionId, host: b.host, hands: b.hands, stage, lit: !!b.lit,
      startedAt: Number(b.startedAt) || 0, at: { space: b.at.space, x: b.at.x, y: b.at.y, z: b.at.z },
    }
    if (b.run && typeof b.run === 'object' && typeof b.run.station === 'string' && b.hands[b.run.by ?? '']) {
      rec.run = { station: b.run.station, step: stage + 1, since: Number(b.run.since) || 0, by: b.run.by! }
    }
    if (rec.lit) rec.litAt = Number(b.litAt) || 0
    out[k] = rec
  }
  return out
}
