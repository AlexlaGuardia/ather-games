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
//
// ── ★★★ THE TOWN IS A HILLSIDE OF BANDS, NOT A RING ON A PLANE ───────────────────────────────
// The first greybox ringed five masses around a square on flat ground and read, in Alex's words, as
// *"a blank space with a bunch of abstract shapes."* It was not short of buildings. It was short of
// the one thing canon actually says about this place: **carved into a hillside, streets that wind
// UPWARD.** A town whose defining property is verticality had exactly one mass off the ground.
//
// ⚠ AND FLAT WAS NOT MERELY BLAND — IT WAS INCOHERENT, IN THREE WAYS NOTHING COULD SEE:
//   · `station` had no `y` at all, so the Travelers Station stood on the ground while the road that
//     reaches it climbed two terraces. The road delivered you to the building's SIDE.
//   · `eyuun-bookstore` sat at terrace 1 on the SOUTH face while every street climbed north and
//     east. It floated a full terrace above ground with nothing reaching it.
//   · `square-north` left the square's north EDGE at terrace 1 — straight through the Spirit
//     Corner, the one door canon opens in v1.
// Every one of those passed the oracle, because the oracle checked heights and widths and nothing
// checked whether a thing STOOD on anything. ★ A guard that asks "is this face a tier" cannot ask
// "is there ground under it."
//
// ★ SO THE GROUND IS NOW A VALUE. `Terrace` plates are the hillside itself — disjoint shelves
// stepping north, one `terraceRise` apart. Masses stand on a band, streets begin and end on a band,
// and `townFaults` asserts exactly that. The hill is derived from the same metrics as everything
// else, so it re-derives with the mannequin like the rest of the town.
//
// ★ THE STREETS WIND BECAUSE THE CLIMBS ALTERNATE SIDES. Climb to band 1 at the east lane, cross
// the band, climb to band 2 at the west lane. That is canon's "wind upward" as a derivation rather
// than as a shape someone drew, and it is why the Station cannot be reached without crossing the
// town twice.

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

/**
 * A shelf of the hillside — the GROUND, as a value.
 *
 * ★ THIS IS THE PIECE THE FLAT GREYBOX WAS MISSING, AND ITS ABSENCE WAS INVISIBLE. Masses carried a
 * `y` and streets carried a terrace index, so every part of the town had an OPINION about how high
 * it stood and nothing said what it stood ON. Bands are disjoint in plan by construction and step
 * one `terraceRise` apart, which is what makes "carved into a hillside" a derivation instead of a
 * description.
 */
export interface Terrace {
  id: string
  /** How many terraces up. `y` is always `level * terraceRise`. */
  level: number
  x0: number; x1: number; z0: number; z1: number
}

export interface Town {
  body: Body
  /** Height of one terrace step. Snapped, so climbing the town is always a verb. */
  terraceRise: number
  square: { x: number; z: number; size: number }
  /** The hillside itself, low band first. Everything else stands on one of these. */
  terraces: Terrace[]
  masses: Mass[]
  streets: Street[]
  /** The sky-port at the town's edge. Not a storefront; reached through the town. */
  station: { x: number; y: number; z: number; w: number; d: number; h: number }
}

const inside = (t: Terrace, x0: number, x1: number, z0: number, z1: number) =>
  x0 >= t.x0 - 1e-9 && x1 <= t.x1 + 1e-9 && z0 >= t.z0 - 1e-9 && z1 <= t.z1 + 1e-9

/** Plan overlap with real area. Touching edges is not overlap — bands are meant to meet. */
const overlaps = (a: Terrace, b: Terrace) =>
  Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1e-9 &&
  Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 1e-9

/**
 * Build the town for a given mannequin.
 *
 * ★ THE SQUARE IS SIZED FROM `laneStreet`, NOT PICKED. Canon calls it the crossroads and the
 * landing — the place a keeper arrives and chooses. `laneStreet` is defined in `metrics.ts` as wide
 * enough that lurch and slide-hop have room to be used, so a square of several of those is a space
 * the movement kit can actually be exercised in rather than a courtyard that reads as a corridor.
 *
 * ★ THE HILL CLIMBS NORTH (−z). Band 0 is the landing and holds the square plus the fronts that
 * ring it; every band above is a shelf behind the last. Nothing here picks a distance — a band is
 * `walk + laneStreet` deep because that is a street plus the deepest thing that stands on it.
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

  const walk = W.lanePair          // the run you walk along a band
  const frontD = W.lanePair        // how deep a storefront is
  const bandD = walk + W.laneStreet // ★ a band holds a street plus the deepest mass on it
  const halfX = half + bandD       // the town's half-width — band 0's collar sets it

  // Band n runs from `bandSouth(n)` (nearest the square) to `bandNorth(n)` (into the hill).
  const bandSouth = (n: number) => (n === 0 ? halfX : -halfX - (n - 1) * bandD)
  const bandNorth = (n: number) => (n === 0 ? -halfX : bandSouth(n) - bandD)
  /** Centreline of the walk strip on band n — the street that runs along it. */
  const walkZ = (n: number) => bandSouth(n) - walk / 2

  // ★ THE CLIMBS ALTERNATE SIDES, WHICH IS WHAT MAKES THE STREETS WIND. A lane sits clear of the
  // face-centred fronts by construction: they span `lanePair` either side of centre and this is
  // out past the square's own edge.
  const lane = (level: number) => (level % 2 === 1 ? 1 : -1) * (half + walk / 2)

  const topTerrace = Math.max(...FRONTS.map(f => f.terrace)) + 1 // one shelf above the last front, for the Station

  const terraces: Terrace[] = []
  for (let n = 0; n <= topTerrace; n++)
    terraces.push({ id: `band-${n}`, level: n, x0: -halfX, x1: halfX, z0: bandNorth(n), z1: bandSouth(n) })

  // Fronts on the landing ring the square; fronts above it line the back of their own band, so a
  // terraced shop reads as cut INTO the hill rather than perched on it.
  const upper = FRONTS.filter(f => f.terrace > 0)
  const masses: Mass[] = FRONTS.map((f) => {
    const y = f.terrace * terraceRise
    // The notice board is furniture, not a shop — chest-high and standing ON the square, so it never
    // blocks the sightline across the square that the square exists to provide.
    const isBoard = f.id === 'notice-board'
    if (isBoard)
      return { id: f.id, x: W.lanePair, y, z: -(half - W.lanePair), w: W.laneSingle, d: W.passMin,
               h: snapHeight(M.cover.stand, body) }

    const w = W.lanePair * 2
    let x: number, z: number, fw: number, fd: number
    if (f.terrace === 0) {
      const off = half + walk + frontD / 2
      const [dx, dz] = f.face === 0 ? [0, -off] : f.face === 1 ? [off, 0] : f.face === 2 ? [0, off] : [-off, 0]
      x = dx; z = dz
      // A front on an east/west face is deep in x and wide in z, not the other way round.
      fw = f.face === 1 || f.face === 3 ? frontD : w
      fd = f.face === 1 || f.face === 3 ? w : frontD
    } else {
      const slot = upper.findIndex(u => u.id === f.id)
      const step = (2 * halfX) / (upper.length + 1)
      x = -halfX + step * (slot + 1)
      z = bandNorth(f.terrace) + frontD / 2
      fw = w; fd = frontD
    }
    return { id: f.id, x, y, z, w: fw, d: fd, h: snapHeight(M.cover.full * 2, body) }
  })

  // ★ THE ROUTE IS A LADDER OF THREE MOVES REPEATED: reach the lane, climb one band, cross it.
  // Every climb rises exactly one terrace, so the face the player meets on the way to the Station is
  // the same face they learned leaving the square.
  const streets: Street[] = [
    { id: 'square-run', from: [lane(1), 0], to: [lane(1), bandNorth(0) + walk], width: W.lanePair, fromTerrace: 0, toTerrace: 0 },
  ]
  for (let n = 1; n <= topTerrace; n++) {
    // ★ THE STATION ROAD IS THE LAST CLIMB, NOT A SPUR. Canon: the Station is reached THROUGH the
    // town and never bypassed — so it is not a rule bolted on, it is the only way the ladder ends.
    const id = n === topTerrace ? 'station-road' : `climb-${n}`
    // ⚠ A CLIMB STARTS WHERE THE RUN BELOW IT ENDS, NOT AT THE BAND EDGE. Both are walkable ground,
    // so a gap between them is invisible in play and a hole in the route graph — the shape that let
    // a shop float unreached. The mouth of climb 1 is the square's own run; every one above starts
    // on the walk strip of the band below.
    streets.push({ id, from: [lane(n), n === 1 ? bandNorth(0) + walk : walkZ(n - 1)], to: [lane(n), walkZ(n)],
                   width: W.lanePair, fromTerrace: n - 1, toTerrace: n })
    if (n < topTerrace)
      streets.push({ id: `run-${n}`, from: [lane(n), walkZ(n)], to: [lane(n + 1), walkZ(n)],
                     width: W.lanePair, fromTerrace: n, toTerrace: n })
  }

  const stationD = W.laneStreet
  const station = {
    x: 0, y: topTerrace * terraceRise, z: bandNorth(topTerrace) + stationD / 2,
    w: stationD, d: stationD,
    h: snapHeight(M.cover.full * 3, body),
  }

  return { body, terraceRise, square, terraces, masses, streets, station }
}

/** Why a greybox would not read to the walker. Each names the piece, never a bare count. */
export type TownFault =
  | { why: 'face-is-ambiguous'; id: string; height: number }
  | { why: 'street-too-narrow'; id: string; width: number }
  | { why: 'terrace-not-a-tier'; height: number }
  | { why: 'wrong-open-door-count'; open: number }
  | { why: 'station-bypasses-town'; id: string }
  | { why: 'stands-on-nothing'; id: string; level: number }
  | { why: 'street-ends-in-air'; id: string; level: number }
  | { why: 'bands-overlap'; id: string; other: string }
  | { why: 'street-through-a-mass'; id: string; mass: string }

/**
 * Sweep the town against the walker it was authored for.
 *
 * ★ FAULTS NAME THE PIECE, NOT A TALLY. A red count invites the cheapest lie that makes it green;
 * `{ why, id, height }` invites a fix. Same reasoning as `courtFits`.
 */
export function townFaults(town: Town): TownFault[] {
  const out: TownFault[] = []
  const M = metricsFor(town.body)
  const bandAt = (level: number) => town.terraces.find(t => t.level === level)

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

  // ── ★★ IS THERE GROUND UNDER IT? ────────────────────────────────────────────────────────────
  // ⚠ THE THREE BUGS THIS EXISTS FOR ALL PASSED EVERY CHECK ABOVE: a station with no `y`, a shop
  // floating a terrace over open ground, and a raised street through the one open door. Heights and
  // widths were all fine. **Nothing asked what anything stood on**, so nothing could tell.
  for (const m of town.masses) {
    const level = Math.round(m.y / town.terraceRise)
    const b = bandAt(level)
    if (!b || !inside(b, m.x - m.w / 2, m.x + m.w / 2, m.z - m.d / 2, m.z + m.d / 2))
      out.push({ why: 'stands-on-nothing', id: m.id, level })
  }
  {
    const level = Math.round(town.station.y / town.terraceRise)
    const b = bandAt(level)
    if (!b || !inside(b, town.station.x - town.station.w / 2, town.station.x + town.station.w / 2,
                      town.station.z - town.station.d / 2, town.station.z + town.station.d / 2))
      out.push({ why: 'stands-on-nothing', id: 'travelers-station', level })
  }

  // A street's two ends live on two different bands — that is what a climb IS. Check each end
  // against its OWN band, or a leg that starts in mid-air reads as a perfectly valid ramp.
  for (const s of town.streets) {
    const p = s.width / 2
    for (const [pt, level] of [[s.from, s.fromTerrace], [s.to, s.toTerrace]] as const) {
      const b = bandAt(level)
      if (!b || !inside(b, pt[0] - p, pt[0] + p, pt[1] - p, pt[1] + p))
        out.push({ why: 'street-ends-in-air', id: s.id, level })
    }
  }

  // ★★ AND A STREET MUST NOT RUN THROUGH A BUILDING — the third bug, and the one every other check
  // here is blind to. `square-north` left the square at terrace 1 straight through the Spirit
  // Corner: its width was legal, its rise was one terrace, both its ends stood on real ground, and
  // it drove a raised road through the only door canon opens in v1. ⚠ Level is deliberately NOT
  // part of the test — a street at the shop's own height is a road through its doorway, and one a
  // terrace up is a road through its roof. Neither is a street.
  for (const s of town.streets) {
    const p = s.width / 2
    const sb: Terrace = { id: s.id, level: 0,
      x0: Math.min(s.from[0], s.to[0]) - p, x1: Math.max(s.from[0], s.to[0]) + p,
      z0: Math.min(s.from[1], s.to[1]) - p, z1: Math.max(s.from[1], s.to[1]) + p }
    for (const m of town.masses) {
      const mb: Terrace = { id: m.id, level: 1, x0: m.x - m.w / 2, x1: m.x + m.w / 2, z0: m.z - m.d / 2, z1: m.z + m.d / 2 }
      if (overlaps(sb, mb)) out.push({ why: 'street-through-a-mass', id: s.id, mass: m.id })
    }
  }

  // ⚠ A HILLSIDE CANNOT HAVE TWO GROUNDS IN ONE COLUMN. Two bands sharing plan area means one of
  // them is a roof, and the walker resolving a floor there gets whichever the loop reached first.
  for (let i = 0; i < town.terraces.length; i++)
    for (let j = i + 1; j < town.terraces.length; j++)
      if (town.terraces[i].level !== town.terraces[j].level && overlaps(town.terraces[i], town.terraces[j]))
        out.push({ why: 'bands-overlap', id: town.terraces[i].id, other: town.terraces[j].id })

  return out
}

/** The tier ladder a reviewer can read off, for whichever body the town was built for. */
export const ladderFor = (body: Body) => ({
  flow: STEP_FLOW, vault: LEDGE_VAULT, ...metricsFor(body).widths,
})
