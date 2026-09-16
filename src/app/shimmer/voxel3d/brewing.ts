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
import { roadOf, alchemyRecipe } from './alchemy-chain'

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
}

export function startBrewing(potionId: string, host: { id: string; name: string }, now: number): Brewing | null {
  if (!POTION_DEFS[potionId]) return null
  return { potionId, host: host.id, hands: { [host.id]: { id: host.id, name: host.name, steps: 0, ingredients: 0 } }, stage: 0, lit: false, startedAt: now }
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

/** The host lights the cauldron: allowed only once the road is walked. */
export function light(b: Brewing): Brewing | null {
  if (b.stage < roadOf(b.potionId).length) return null
  return { ...b, lit: true }
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
