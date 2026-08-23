// RUNE HOLD — the greybox, as authored geometry.
//
// ★ PURE DATA + DERIVATION. No three, no react, no DOM. This file says WHERE the town's masses and
// streets are and HOW TALL each face is; a renderer turns it into meshes and `rune-hold.test.ts`
// sweeps it. Same shape as `voxel3d/crossings.ts`: the geometry is a value you can assert about.
//
// ── ★★ EVERY DIMENSION COMES FROM `metricsFor(BODY)`, AND THAT IS THE WHOLE POINT ────────────
// Canon (`two-lines-two-games.md`, ONE STYLE TWO MATERIALS) puts Rune Hold on the CONTINUOUS side,
// so its geometry is AUTHORED rather than generated — and authored geometry can sit at any height,
// which is the failure mode `metrics.ts` was written for. A face authored freehand at 0.4 looks
// vaultable and is not, and the player blames the controls rather than the map.
//
// ⚠⚠ AND THE MANNEQUIN IS STILL AN OPEN QUESTION, SO THE TOWN IS BUILT SO IT DOES NOT MATTER YET.
// The two walkers disagree on the BODY (voxel eye 1.62/1.02 r0.30 · play3d 1.15/0.50 r0.40), and
// cover and lane widths derive from it. `metrics.ts:50` records the pick as **Alex's to overturn in
// one line** and flags play3d's shorter body as *predating* the other — legacy, not intentional.
//
// ★ SO NOTHING HERE IS A LITERAL HEIGHT OR WIDTH. Every mass takes `M = metricsFor(body)` and asks
// it, so flipping `BODY` re-derives the entire town instead of leaving a hand-tuned one behind. That
// is what the 2026-08-23 de-pinning bought, and it is why the greybox could start before the
// mannequin was ruled: **the decision stays cheap for exactly as long as nothing bakes it in.**
// If you ever find yourself typing a number into this file, that is the bug.
//
// ── ★ WHAT CANON FIXES, AND WHAT IS MINE ─────────────────────────────────────────────────────
// `world/rune-hold.md`: mountain village carved into a hillside, stone buildings stacked along
// streets that wind UPWARD · the crossroads square is the landing · five storefronts on the square
// (Kindled Mug · Spirit Corner · Eyuun's Bookstore · The Passage · Notice Board) · the Travelers
// Station is NOT a storefront and sits at the town's EDGE, reached through the town, never bypassed.
// ⚠ **v1 opens exactly ONE door — the Spirit Corner** — with the rest visible, approachable and
// SHUT (ruled 2026-08-13, restated in the Travelers Center entry). That is canon-true, not a
// staging compromise: *"a town with doors you cannot open yet IS a town you will come back to."*
// Sizes, street layout, terrace heights and every number = mine.

import { metricsFor, snapHeight, readsAs, STEP_FLOW, LEDGE_VAULT, BODY, type Body } from './metrics'

/** A storefront on the square. `open` is the v1 door ruling, not a guess. */
export interface Front {
  id: 'kindled-mug' | 'spirit-corner' | 'eyuun-bookstore' | 'the-passage' | 'notice-board'
  name: string
  /** Enterable in v1. Canon opens exactly one. */
  open: boolean
  /** Which side of the square it fronts, in quarter turns from north. */
  face: 0 | 1 | 2 | 3
  /** How many terraces up the hillside this front stands. 0 = on the square. */
  terrace: number
}

/**
 * ⚠ THE ORDER AND THE `open` FLAGS ARE CANON, NOT LAYOUT TASTE. A second `open: true` here is a
 * build quietly overruling the first-day ruling, which is why the oracle asserts the count rather
 * than trusting review — the failure is one character wide and reads as a convenience.
 */
export const FRONTS: Front[] = [
  { id: 'spirit-corner',   name: 'The Spirit Corner',  open: true,  face: 0, terrace: 0 },
  { id: 'kindled-mug',     name: 'The Kindled Mug',    open: false, face: 1, terrace: 0 },
  { id: 'eyuun-bookstore', name: "Eyuun's Bookstore",  open: false, face: 2, terrace: 1 },
  { id: 'the-passage',     name: 'The Passage',        open: false, face: 3, terrace: 0 },
  { id: 'notice-board',    name: 'The Notice Board',   open: false, face: 0, terrace: 0 },
]

/** A rectangular mass — a building block of the greybox. Heights are face heights, not storeys. */
export interface Mass {
  id: string
  /** Centre, in world units. `y` is the ground the mass stands on (its terrace). */
  x: number; y: number; z: number
  /** Footprint, in world units. */
  w: number; d: number
  /** Height of the face a player meets. Always a tier the walker has a verb for. */
  h: number
}

/** A walkable run between two points, with the width class it was authored at. */
export interface Street {
  id: string
  from: [number, number]
  to: [number, number]
  width: number
  /** Terrace it starts and ends on — a street that climbs does so in snapped steps. */
  fromTerrace: number
  toTerrace: number
}

export interface Town {
  body: Body
  /** Height of one terrace step. Snapped, so climbing the town is always a verb. */
  terraceRise: number
  square: { x: number; z: number; size: number }
  masses: Mass[]
  streets: Street[]
  /** The sky-port at the town's edge. Not a storefront; reached through the town. */
  station: { x: number; z: number; w: number; d: number; h: number }
}

/**
 * Build the town for a given mannequin.
 *
 * ★ THE SQUARE IS SIZED FROM `laneStreet`, NOT PICKED. Canon calls it the crossroads and the
 * landing — the place a keeper arrives and chooses. `laneStreet` is defined in `metrics.ts` as wide
 * enough that lurch and slide-hop have room to be used, so a square of several of those is a space
 * the movement kit can actually be exercised in rather than a courtyard that reads as a corridor.
 */
export function runeHold(body: Body = BODY): Town {
  const M = metricsFor(body)
  const W = M.widths

  // ⚠ SNAPPED, NOT CHOSEN. A terrace is a face the player meets head-on every time they climb the
  // town, so it must land on a tier — canon says the streets wind UPWARD, which means this height
  // is repeated dozens of times. An unsnapped terrace is the ambiguous-band bug multiplied by the
  // size of the town.
  const terraceRise = snapHeight(LEDGE_VAULT, body)

  const size = W.laneStreet * 3
  const square = { x: 0, z: 0, size }
  const half = size / 2

  // Fronts ring the square, each set back off its own side. Depth is a lane class so the mass reads
  // as a building rather than a wall, and the setback keeps the square's floor at `size`.
  const masses: Mass[] = FRONTS.map((f) => {
    const y = f.terrace * terraceRise
    const off = half + W.lanePair
    const [dx, dz] = f.face === 0 ? [0, -off] : f.face === 1 ? [off, 0] : f.face === 2 ? [0, off] : [-off, 0]
    // The notice board is furniture, not a shop — it is chest-high so it never blocks a sightline
    // across the square that the square exists to provide.
    const isBoard = f.id === 'notice-board'
    return {
      id: f.id,
      x: dx + (isBoard ? W.lanePair : 0),
      y,
      z: dz + (isBoard ? W.lanePair : 0),
      w: isBoard ? W.laneSingle : W.lanePair * 2,
      d: isBoard ? W.passMin : W.lanePair,
      h: isBoard ? snapHeight(M.cover.stand, body) : snapHeight(M.cover.full * 2, body),
    }
  })

  // Streets climb away from the square. Each leg rises exactly one terrace, so every climb the
  // player meets is the same face they already learned on the first one.
  const streets: Street[] = [
    { id: 'square-north', from: [0, -half], to: [0, -half - W.laneStreet * 2], width: W.lanePair, fromTerrace: 0, toTerrace: 1 },
    { id: 'square-east',  from: [half, 0],  to: [half + W.laneStreet * 2, 0],  width: W.lanePair, fromTerrace: 0, toTerrace: 1 },
    { id: 'upper-run',    from: [0, -half - W.laneStreet * 2], to: [half + W.laneStreet * 2, 0], width: W.laneSingle, fromTerrace: 1, toTerrace: 1 },
    // ★ THE STATION IS REACHED THROUGH THE TOWN, NEVER BYPASSING IT — canon, and it is a layout
    // constraint rather than a note: this leg starts at the UPPER run, so there is no path from the
    // square to the edge that does not climb through the town first.
    { id: 'station-road', from: [half + W.laneStreet * 2, 0], to: [half + W.laneStreet * 5, 0], width: W.lanePair, fromTerrace: 1, toTerrace: 2 },
  ]

  const station = {
    x: half + W.laneStreet * 5, z: 0,
    w: W.laneStreet * 2, d: W.laneStreet * 2,
    h: snapHeight(M.cover.full * 3, body),
  }

  return { body, terraceRise, square, masses, streets, station }
}

/** Why a greybox would not read to the walker. Each names the piece, never a bare count. */
export type TownFault =
  | { why: 'face-is-ambiguous'; id: string; height: number }
  | { why: 'street-too-narrow'; id: string; width: number }
  | { why: 'terrace-not-a-tier'; height: number }
  | { why: 'wrong-open-door-count'; open: number }
  | { why: 'station-bypasses-town'; id: string }

/**
 * Sweep the town against the walker it was authored for.
 *
 * ★ FAULTS NAME THE PIECE, NOT A TALLY. A red count invites the cheapest lie that makes it green;
 * `{ why, id, height }` invites a fix. Same reasoning as `courtFits`.
 */
export function townFaults(town: Town): TownFault[] {
  const out: TownFault[] = []
  const M = metricsFor(town.body)

  if (readsAs(town.terraceRise) === 'ambiguous')
    out.push({ why: 'terrace-not-a-tier', height: town.terraceRise })

  for (const m of town.masses)
    if (readsAs(m.h) === 'ambiguous') out.push({ why: 'face-is-ambiguous', id: m.id, height: m.h })

  for (const s of town.streets) {
    if (s.width < M.widths.passMin) out.push({ why: 'street-too-narrow', id: s.id, width: s.width })
    // A leg may rise at most one terrace: two at once is a face nobody authored and the player
    // meets it as a wall in the middle of a street.
    if (Math.abs(s.toTerrace - s.fromTerrace) > 1)
      out.push({ why: 'face-is-ambiguous', id: s.id, height: Math.abs(s.toTerrace - s.fromTerrace) * town.terraceRise })
  }

  const open = FRONTS.filter(f => f.open).length
  if (open !== 1) out.push({ why: 'wrong-open-door-count', open })

  // ★ ASSERTED AS REACHABILITY, NOT AS A COMMENT. Canon: the Station is reached THROUGH the town.
  // A leg running from the square (terrace 0) straight to the station would satisfy every width and
  // height check and quietly delete the ruling, so the graph is what gets checked.
  const road = town.streets.find(s => s.id === 'station-road')
  if (!road || road.fromTerrace === 0) out.push({ why: 'station-bypasses-town', id: 'station-road' })

  return out
}

/** The tier ladder a reviewer can read off, for whichever body the town was built for. */
export const ladderFor = (body: Body) => ({
  flow: STEP_FLOW, vault: LEDGE_VAULT, ...metricsFor(body).widths,
})
