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

/**
 * A named place in Rune Hold.
 *
 * ── ★★★ SIZE COMES FROM THE PROGRAM, NEVER FROM THE FACADE ───────────────────────────────────
 * The first roster was five masses of IDENTICAL dimensions — 4.8 x 2.4 x 5.14, every one. Canon's
 * feel line asks for *"shops you remember by name"*, and five boxes you cannot tell apart is the
 * exact opposite of that: a name needs a silhouette to attach to. ⚠ And the fix is not to pick five
 * different sizes by eye, because a hand-picked size is a literal in a file whose whole law is that
 * nothing is a literal.
 *
 * ★ SO A BUILDING IS AS BIG AS THE SPACE ITS FUNCTION NEEDS. `heads` is how many people are in the
 * room at once; `floors` is how that ground divides; `rise` is how much headroom the room wants;
 * `aspect` is what the function does to the plan. Footprint falls out of those four in body-derived
 * units, so the Mug is the biggest thing on the square because it is the social heart and the
 * Spirit Corner is small because canon calls it *"small café, unassuming storefront"* — not because
 * someone typed 4.16.
 *
 * ⚠⚠ CANON SIZED THE SPIRIT CORNER IN WORDS AND THE BUILD IGNORED IT FOR A WEEK. It was the same
 * box as the tavern, painted gold as the hero of the square. Canon says the opposite: small,
 * unassuming, *"Reality: portal gate business, by referral only."* The one door that opens in v1 is
 * meant to be the one you would walk past. A prose fact is still a fact.
 */
export type PlaceKind =
  | 'front'     // a storefront you approach
  | 'fixture'   // furniture on the square
  | 'descent'   // a way DOWN, not a mass
  | 'infra'     // not a shop: the Inn, the Station
  | 'outlying'  // adjacent to the town proper, on its own ground
  | 'scatter'   // the small ones canon says are scattered through the streets

export interface Place {
  id: string
  name: string
  kind: PlaceKind
  /** ⚠ CANON: exactly five storefronts stand on the crossroads square. Not a layout preference. */
  square: boolean
  /**
   * Is this place's INTERIOR enterable in the opening?
   *
   * ⚠ CANON SAYS NO, FOR EVERY STOREFRONT — `world/rune-hold.md` › *★ NO INTERIOR OPENS* (ruled
   * 2026-08-24). The old *"One door opens"* staging is struck: the Spirit Corner is *"a face on the
   * town, not a space that loads"*, and **stepping through Gregory's framed doorway IS the
   * crossing** — no room in between. The 07-12 Hub ruling had already said *"an outdoor town, not
   * an interior"*; the opening staging carved out one exception and Alex removed the exception.
   * ★ The field stays because the four doors will each flip one, and **when each opens is scope,
   * not truth** — mine, on canon's own *"they open when the systems behind them exist"*.
   */
  open: boolean
  /** People in the room at once. The program — this is what makes one building bigger than another. */
  heads: number
  /** Floors the ground divides into. Lodging stacks; a cafe does not. */
  floors: number
  /** Storey-heights of headroom. A hall is one floor and two rises; an inn is three of each. */
  rise: number
  /** What the function does to the plan: wide frontage, long wall-run, or compact. */
  aspect: 'broad' | 'deep' | 'compact'
  /** Which band it stands on. */
  terrace: number
}

/**
 * ⚠ THE ROSTER IS CANON AND THE NUMBERS ARE MINE, AND THE SPLIT IS EXACT.
 *
 * ⚠⚠ ALEX'S FOUR DOORS ARE NOT IN THIS LIST, AND THAT IS THE RULING RATHER THAN AN OMISSION.
 * The town's enterable interiors and travel node are the **Kindled Mug's basement**, the **Travelers
 * Station**, **The Passage** and the **square's Ather gate**. *"The Spirit Corner was never in that
 * list because it is not that kind of thing. It is a storefront with a person and a gate in it."*
 * (`world/rune-hold.md` › ★ NO INTERIOR OPENS.) The Mug's basement is still **unruled** and is not
 * built here; the other three are the `descent`, the station mass, and a `Gate`.
 *
 * Canon (`world/rune-hold.md`, `world/locations.md`) fixes: that these places exist, what each one
 * IS, that five storefronts stand on the square, that no storefront interior opens, that the
 * Bookstore *"sits near The Spirit Corner"*, that the Passage is *"under Rune Hold — hidden tunnel
 * market"* with entry *"word of mouth only, no signs"*, that the Enchant Temple is *"adjacent to the
 * town proper"*, that the inventor shops are *"scattered throughout the winding streets"*, and that
 * the Travelers Station sits at the town's edge with the practice range beside it.
 *
 * `heads` / `floors` / `rise` / `aspect` are game design, and they are the only thing here I chose.
 *
 * ★★ THE STATION AND THE CENTER ARE TWO DIFFERENT RULED PLACES and it is easy to collapse them.
 * The **Travelers Station** (ruled 08-05) is the way OUT — a sky-port at the town's edge, the
 * practice range with it. The **Travelers Center** (ruled 08-13) is the muster hall, where you find
 * a party. One is how you leave; the other is who you leave with.
 */
export const PLACES: Place[] = [
  // ── the five storefronts canon puts on the square ──────────────────────────────────────────
  { id: 'kindled-mug',      name: 'The Kindled Mug',      kind: 'front',    square: true,  open: false, heads: 28, floors: 2, rise: 2, aspect: 'broad',   terrace: 0 },
  { id: 'spirit-corner',    name: 'The Spirit Corner',    kind: 'front',    square: true,  open: false, heads:  6, floors: 1, rise: 1, aspect: 'compact', terrace: 0 },
  { id: 'eyuun-bookstore',  name: "Eyuun's Bookstore",    kind: 'front',    square: true,  open: false, heads:  8, floors: 2, rise: 2, aspect: 'deep',    terrace: 0 },
  { id: 'notice-board',     name: 'The Notice Board',     kind: 'fixture',  square: true,  open: false, heads:  0, floors: 1, rise: 0, aspect: 'compact', terrace: 0 },
  { id: 'the-passage',      name: 'The Passage',          kind: 'descent',  square: true,  open: false, heads:  0, floors: 1, rise: 0, aspect: 'compact', terrace: 0 },
  // ── the rest of the village ────────────────────────────────────────────────────────────────
  { id: 'travelers-center', name: 'The Travelers Center', kind: 'front',    square: false, open: false, heads: 20, floors: 1, rise: 2, aspect: 'broad',   terrace: 1 },
  { id: 'forgelight-inn',   name: 'The Forgelight Inn',   kind: 'infra',    square: false, open: false, heads: 10, floors: 3, rise: 3, aspect: 'compact', terrace: 1 },
  { id: 'enchant-temple',   name: 'Enchant Temple',       kind: 'outlying', square: false, open: false, heads: 12, floors: 1, rise: 2, aspect: 'broad',   terrace: 1 },
  { id: 'travelers-station',name: 'The Travelers Station',kind: 'infra',    square: false, open: false, heads: 24, floors: 1, rise: 2, aspect: 'broad',   terrace: 2 },
  // Canon says "scattered", plural, and unnamed. ⚠ NAMING one would be accidental canon — these are
  // the trade of the village, not characters, and the scatter is what makes a corner worth turning.
  { id: 'inventor-1',       name: 'Inventor Shop',        kind: 'scatter',  square: false, open: false, heads:  3, floors: 1, rise: 1, aspect: 'compact', terrace: 0 },
  { id: 'inventor-2',       name: 'Inventor Shop',        kind: 'scatter',  square: false, open: false, heads:  4, floors: 2, rise: 2, aspect: 'deep',    terrace: 0 },
  { id: 'inventor-3',       name: 'Inventor Shop',        kind: 'scatter',  square: false, open: false, heads:  5, floors: 1, rise: 1, aspect: 'broad',   terrace: 1 },
  { id: 'smithy-1',         name: 'Smithy',               kind: 'scatter',  square: false, open: false, heads:  5, floors: 1, rise: 2, aspect: 'broad',   terrace: 0 },
  { id: 'smithy-2',         name: 'Smithy',               kind: 'scatter',  square: false, open: false, heads:  4, floors: 1, rise: 2, aspect: 'compact', terrace: 1 },
]

/**
 * The five storefronts canon puts on the crossroads square.
 *
 * ★ DERIVED FROM `PLACES`, NEVER RESTATED. A second hand-kept list of the same five would agree
 * with this one right up until somebody edited one of them, and it would agree hardest at the moment
 * someone came looking — the mirror trap this repo has already paid for. The `open` flag is one
 * character wide and canon-ruled, so it lives in exactly one place.
 */
export const FRONTS = PLACES.filter(p => p.square)

/** A rectangular mass — a building block of the greybox. Heights are face heights, not storeys. */
export interface Mass {
  id: string
  name: string
  kind: PlaceKind
  /** Centre, in world units. `y` is the ground the mass stands on (its terrace). */
  x: number; y: number; z: number
  /** Footprint, in world units. */
  w: number; d: number
  /** Height of the face a player meets. */
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
  /** A branch off the main route rather than a link in it. The temple path is the only one. */
  spur?: boolean
}

/**
 * A shelf of the hillside — the GROUND, as a value.
 *
 * ★ THIS IS THE PIECE THE FLAT GREYBOX WAS MISSING, AND ITS ABSENCE WAS INVISIBLE. Masses carried a
 * `y` and streets carried a terrace index, so every part of the town had an OPINION about how high
 * it stood and nothing said what it stood ON. Bands step one `terraceRise` apart and never share
 * plan area, which is what makes "carved into a hillside" a derivation instead of a description.
 */
export interface Terrace {
  id: string
  /** How many terraces up. `y` is always `level * terraceRise`. */
  level: number
  x0: number; x1: number; z0: number; z1: number
}

/**
 * A gate, and the one thing its SHAPE is required to tell the truth about.
 *
 * ── ★★★ THE FRAME IS THE TUNING, SO THE FORM IS A CLAIM ABOUT PERMANENCE ─────────────────────
 * `world/gates.md` › *What a gate LOOKS like* (ruled 2026-08-24): **bare spiral = untuned or
 * temporary** — a dropped gate-rune, a wild fold-mouth, *"a note struck and holding itself"*.
 * **Framed doorway = tuned and KEPT by someone** — *"the Spirit Corner · the Rune Hold square's
 * public landing · every socket of a keeper's Gate Station"*. Nobody frames a gate they do not
 * intend to keep.
 *
 * ★ THAT MAKES `form` A DERIVED FACT, NOT A STYLING CHOICE, and it is why `kept` and `form` are
 * both stored and then checked against each other. Canon's claim is that a player learns the whole
 * travel layer's cost model *by looking* — so a kept gate drawn as a bare spiral does not merely
 * look wrong, it tells the player this crossing is going away. `townFaults` fails on the mismatch.
 */
export type GateForm = 'bare-spiral' | 'framed'

export interface Gate {
  id: string
  /** What it is for, in the town's own words. */
  name: string
  x: number; z: number
  /** The opening a walker steps through. Body-derived, like every other clearance in this file. */
  w: number; h: number
  /** Is somebody spending craft to hold this open past today? */
  kept: boolean
  form: GateForm
}

/** The Passage: a way DOWN, tucked where you would only find it if you were shown. */
export interface Descent {
  id: string
  x: number; z: number; w: number; d: number
  /** How far below its band the mouth drops. */
  depth: number
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
  /** The Passage. Not a mass — canon has it under the town, entered by word of mouth. */
  descent: Descent
  /** Every gate that stands in the town. Canon names two, and both are kept. */
  gates: Gate[]
  /** The sky-port at the town's edge. ★ THE SAME OBJECT as its entry in `masses`, not a copy. */
  station: Mass
}

const inside = (t: Terrace, x0: number, x1: number, z0: number, z1: number) =>
  x0 >= t.x0 - 1e-9 && x1 <= t.x1 + 1e-9 && z0 >= t.z0 - 1e-9 && z1 <= t.z1 + 1e-9

/** Plan overlap with real area. Touching edges is not overlap — bands are meant to meet. */
const overlaps = (a: Terrace, b: Terrace) =>
  Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1e-9 &&
  Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 1e-9

const box = (m: { x: number; z: number; w: number; d: number }): Terrace =>
  ({ id: '', level: 0, x0: m.x - m.w / 2, x1: m.x + m.w / 2, z0: m.z - m.d / 2, z1: m.z + m.d / 2 })

/**
 * Ground a place needs, and how that ground wants to be shaped.
 *
 * ★ ONE PERSON'S SHARE IS A LANE TIMES A BODY, both body-derived, so a room that holds twenty is
 * twenty times that and the whole roster re-scales with the mannequin exactly like the streets do.
 */
/**
 * Head clearance for a door a walker uses.
 *
 * ★ SHARED WITH THE CALIBRATION ROOM ON PURPOSE. That room's whole argument is that a doorway at
 * the walker's own scale is the most legible proportion test there is; if the town's gates and the
 * ruler disagreed about what a door is, the ruler would be measuring against a lie.
 */
export const doorwayHeight = (body: Body): number => body.eyeStand + 0.5

export function footprintOf(p: Place, body: Body): { w: number; d: number; h: number } {
  const M = metricsFor(body)
  const W = M.widths
  const perHead = W.laneSingle * W.lanePair
  const area = Math.max(p.heads, 1) * perHead / p.floors
  // Frontage-to-depth. Broad fronts the street; deep wants wall run for shelving and stalls.
  const ratio = p.aspect === 'broad' ? 2 : p.aspect === 'deep' ? 0.5 : 1
  const d = Math.sqrt(area / ratio)
  // ⚠ A STOREY IS SNAPPED AND THE TOTAL IS NOT. The face of one storey is a thing the walker meets
  // and must land on a tier; a three-storey inn is a WALL, which is the correct read — you are not
  // meant to climb the inn. Snapping the total would flatten every building to the same silhouette,
  // which is the bug this whole roster exists to fix.
  const storey = snapHeight(M.cover.full, body)
  return { w: area / d, d, h: p.rise * storey }
}

/**
 * Build the town for a given mannequin.
 *
 * ★ THE SQUARE IS SIZED FROM `laneStreet`, NOT PICKED. Canon calls it the crossroads and the
 * landing — the place a keeper arrives and chooses. `laneStreet` is defined in `metrics.ts` as wide
 * enough that lurch and slide-hop have room to be used.
 *
 * ★ THE HILL CLIMBS NORTH (−z). Band 0 is the landing and holds the square, the three storefronts
 * that ring it and the scattered trade on its apron; every band above is a shelf behind the last.
 * The Enchant Temple gets a spur of its own because canon puts it *adjacent to the town proper*.
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

  const walk = W.lanePair
  // ★★ A BAND IS AS DEEP AS ITS STREET PLUS THE DEEPEST THING THAT STANDS ON IT, AND THAT IS NOW
  // MEASURED RATHER THAN ASSERTED. The first cut wrote `walk + laneStreet` under a comment claiming
  // exactly this rule, and the Travelers Center's program came out deeper than `laneStreet` — so the
  // muster hall hung out of the back of its own shelf and the run along the band went through it.
  // ⚠ A comment that states a derivation is not the derivation. Ask the roster.
  const deepest = Math.max(...PLACES.map(q => footprintOf(q, body).d))
  const bandD = walk + deepest + walk
  const halfX = half + bandD

  const bandSouth = (n: number) => (n === 0 ? halfX : -halfX - (n - 1) * bandD)
  const bandNorth = (n: number) => (n === 0 ? -halfX : bandSouth(n) - bandD)
  const walkZ = (n: number) => bandSouth(n) - walk / 2
  // ★ THE FIRST LANE THREADS THE GAP THE RING LEAVES. Collar buildings seat their inner face at
  // `half + walk`, so a street centred half a walk out of the square runs between the two and can
  // never be pushed into a shopfront by a program change. Every lane above it hugs the town's own
  // edge, alternating sides — which is both what makes the streets WIND and what keeps a climb out
  // of the building row it has to pass.
  const lane = (level: number) =>
    level <= 1 ? half + walk / 2 : (level % 2 === 1 ? 1 : -1) * (halfX - walk / 2)

  const topTerrace = Math.max(...PLACES.map(p => p.terrace)) + 0
  // ⚠ THE SPUR TOUCHES THE TOWN, IT DOES NOT FLOAT BESIDE IT. A gap of even one walk between band 0
  // and the temple's ground is a hole the path crosses over nothing — and `street-ends-in-air` only
  // ever looks at the two ENDS, so it would have passed. Adjacent means sharing an edge.
  // ★ AND THE SPUR IS AS BIG AS THE TEMPLE NEEDS, measured off the temple. A shelf sized by eye is
  // the same literal-in-a-file this whole roster exists to stop.
  const templeF = footprintOf(PLACES.find(q => q.id === 'enchant-temple')!, body)
  const spurX0 = halfX, spurX1 = halfX + walk + templeF.w + walk

  const terraces: Terrace[] = []
  for (let n = 0; n <= topTerrace; n++)
    terraces.push({ id: `band-${n}`, level: n, x0: -halfX, x1: halfX, z0: bandNorth(n), z1: bandSouth(n) })
  // ★ THE TEMPLE'S OWN GROUND. Canon: *"adjacent to the town proper"* — so it is not on a band, it
  // is beside them. A spur east of band 0 at band 1's height reads as separate without being remote.
  terraces.push({ id: 'temple-spur', level: 1, x0: spurX0, x1: spurX1, z0: -W.laneStreet * 2, z1: W.laneStreet * 2 })

  const at = (id: string) => PLACES.find(p => p.id === id)!
  const place = (id: string, x: number, z: number): Mass => {
    const p = at(id)
    const f = footprintOf(p, body)
    return { id: p.id, name: p.name, kind: p.kind, x, z, y: p.terrace * terraceRise, w: f.w, d: f.d, h: f.h }
  }
  /** Same, with the footprint turned a quarter so a front can face east or west. */
  const turned = (id: string, x: number, z: number): Mass => {
    const m = place(id, x, z)
    return { ...m, w: m.d, d: m.w }
  }

  // ★ NOTHING PICKS A COORDINATE OFF A RULER. A building seats itself off the face it fronts, so
  // its own size decides where its centre lands — which is why widening a program can never quietly
  // push a wall into the street that serves it.
  const collarZ = (m: Mass) => half + walk + m.d / 2          // band 0's ring, measured from the square
  const rowZ = (n: number, m: Mass) => bandSouth(n) - walk - m.d / 2 // a band's building row, north of its walk

  const seat = (id: string, x: number, z: (m: Mass) => number, turn = false): Mass => {
    const p = at(id)
    const f = footprintOf(p, body)
    const m: Mass = { id: p.id, name: p.name, kind: p.kind, x, z: 0, y: p.terrace * terraceRise,
                      w: turn ? f.d : f.w, d: turn ? f.w : f.d, h: f.h }
    return { ...m, z: z(m) }
  }
  /** A front on the east or west side is seated in x instead, its depth pointing at the square. */
  const seatSide = (id: string, sign: number, z: number): Mass => {
    const m = seat(id, 0, () => z, true)
    return { ...m, x: sign * (half + walk + m.w / 2) }
  }

  // ★★ A BAND'S ROW PACKS ITSELF, WEST TO EAST, CLEAR OF THE CLIMB THAT SERVES IT. Hand-picked
  // offsets were the wrong tool the moment the buildings stopped being the same size: every one is
  // a literal, and every one is wrong again for the other mannequin. Packing means a widened
  // program pushes its neighbours along instead of growing into them, and the gap between two
  // shops is a walk, which is the unit a person actually experiences it in.
  const row = (n: number, ids: string[]): Mass[] => {
    let cursor = lane(n + 1) + walk
    return ids.map(id => {
      const m = seat(id, 0, mm => rowZ(n, mm))
      const x = cursor + m.w / 2
      cursor = x + m.w / 2 + walk
      return { ...m, x }
    })
  }

  const masses: Mass[] = [
    // ── the square's three built fronts ──────────────────────────────────────────────────────
    // ★ THE MUG TAKES THE EAST SIDE. It is the social heart and the biggest program in town, and
    // canon's four-seat Magii table is the only interior anything has already furnished.
    seatSide('kindled-mug', 1, 0),
    // ★ CANON ADJACENCY, NOT LAYOUT TASTE: the Bookstore *"sits near The Spirit Corner"*. They share
    // the north side, shoulder to shoulder — and the Corner is visibly the smaller of the two, which
    // is canon's *"unassuming"* rendered as geometry rather than as a note.
    seat('spirit-corner',   -W.lanePair * 1.2, m => -collarZ(m)),
    seat('eyuun-bookstore',  W.lanePair * 1.1, m => -collarZ(m)),
    { ...seat('notice-board', W.lanePair, () => -(half - W.lanePair)),
      w: W.laneSingle, d: W.passMin, h: snapHeight(M.cover.stand, body) },
    // ── the trade canon says is scattered through the streets ────────────────────────────────
    // ⚠ SCATTERED MEANS IRREGULAR, AND IRREGULAR IS THE POINT. A ring is legible at a glance and
    // gives the eye nothing to walk toward; offsets that do not line up are what make a corner.
    seatSide('smithy-1', -1, W.laneStreet * 0.9),
    seat('inventor-1', -W.laneStreet * 1.1, m => collarZ(m)),
    seat('inventor-2',  W.laneStreet * 0.5, m => collarZ(m)),
    // ── band 1: the muster hall, the inn, and more trade ─────────────────────────────────────
    ...row(1, ['travelers-center', 'forgelight-inn', 'inventor-3', 'smithy-2']),
    // ── the spur, and the top ────────────────────────────────────────────────────────────────
    seat('enchant-temple', spurX0 + walk + templeF.w / 2, () => 0),
    seat('travelers-station', 0, m => rowZ(topTerrace, m)),
  ]

  // ★★ THE PASSAGE IS A CORNER, NOT A SHOPFRONT. Canon: *"under Rune Hold — hidden tunnel market"*,
  // entry *"word of mouth only. No signs. No directions."* So it is a mouth in the ground on the
  // apron behind the smithy, where the square cannot see it — and the occlusion is asserted rather
  // than hoped for, because "hidden" is the one property this place cannot be built without.
  // ★ IT SITS ON THE SQUARE'S OWN SIGHTLINE TO THE SMITHY, FURTHER OUT — so the smithy is between
  // the landing and the mouth by construction, not by a coordinate that happened to work. The
  // oracle then asserts the occlusion, because "hidden" is the one property canon will not let this
  // place be built without.
  const shade = masses.find(m => m.id === 'smithy-1')!
  const descent: Descent = {
    id: 'the-passage',
    x: shade.x * 1.28, z: shade.z * 1.28,
    w: W.lanePair, d: W.lanePair, depth: terraceRise * 2,
  }

  const streets: Street[] = [
    { id: 'square-run', from: [lane(1), 0], to: [lane(1), bandNorth(0) + walk], width: W.lanePair, fromTerrace: 0, toTerrace: 0 },
  ]
  for (let n = 1; n <= topTerrace; n++) {
    const id = n === topTerrace ? 'station-road' : `climb-${n}`
    // ⚠ A CLIMB STARTS WHERE THE RUN BELOW IT ENDS, NOT AT THE BAND EDGE. Both are walkable ground,
    // so a gap between them is invisible in play and a hole in the route graph — the shape that let
    // a shop float unreached.
    streets.push({ id, from: [lane(n), n === 1 ? bandNorth(0) + walk : walkZ(n - 1)], to: [lane(n), walkZ(n)],
                   width: W.lanePair, fromTerrace: n - 1, toTerrace: n })
    if (n < topTerrace)
      streets.push({ id: `run-${n}`, from: [lane(n), walkZ(n)], to: [lane(n + 1), walkZ(n)],
                     width: W.lanePair, fromTerrace: n, toTerrace: n })
  }
  // ★ THE TEMPLE'S OWN STEP UP. Canon calls it adjacent to the town proper, so the approach is a
  // single face at the join rather than a road — you are still in Rune Hold when you take it.
  streets.push({ id: 'temple-path', from: [halfX - walk / 2, 0], to: [halfX + walk / 2, 0],
                 width: W.lanePair, fromTerrace: 0, toTerrace: 1, spur: true })

  // ── ★★ THE TWO GATES, AND THE SOURCE IS ONE ENTRY, NOT TWO ──────────────────────────────────
  // ⚠ CITE 2026-08-12, NOT TODAY: `world/gates.md` › *★ WHERE IT LETS OUT: THE RUNE HOLD TOWN
  // SQUARE* is where the public landing was ruled, on Alex's override — *"i would like it to be the
  // town square and the player decides where they go from there."* What legalizes it lives there
  // too, and that is the load-bearing half: Rune Hold is the rune town in the era Gregory's
  // commercialization made gatecraft common, so **a public landing is what a commonized craft LOOKS
  // like**. Two known crossings out of the garden, differing in kind — the Corner is Gregory's
  // private door, the square is the town's civic plaza. Passage-class, so no home-cost.
  //
  // ⚠⚠ AND I ALMOST CITED A SECOND WITNESS THAT WAS THE SAME WITNESS. The 08-24 gate-look table
  // names the Spirit Corner and the landing in one sentence, which reads like independent
  // confirmation — it was written FROM the 08-12 crossing table, so it is downstream of the only
  // source there is. ★ A copy reads as corroboration, and that is the one kind of agreement that
  // proves nothing. Today's Gate Station table restates the landing as the centre socket's far end;
  // it did not originate it.
  //
  // ★ THE CORNER'S GATE IS THE SHOPFRONT DOOR ITSELF, which is why it sits ON the face and not
  // behind it: you approach, Gregory admits you, and stepping through is the crossing. No interior.
  //
  // ★ A DOORWAY IS THE ONE PROPORTION EVERY PLAYER READS WITHOUT BEING TOLD — you either duck or
  // you do not. Its clearance is the same derivation the calibration room uses, taken from the
  // body rather than restated, so the two cannot drift into disagreeing about what a door is.
  const doorH = doorwayHeight(body)
  const corner = masses.find(m => m.id === 'spirit-corner')!
  const gates: Gate[] = [
    { id: 'square-landing', name: "The Landing", x: square.x, z: square.z,
      w: W.lanePair, h: doorH, kept: true, form: 'framed' },
    { id: 'spirit-corner-gate', name: "Gregory's door", x: corner.x, z: corner.z + corner.d / 2,
      w: W.laneSingle, h: doorH, kept: true, form: 'framed' },
  ]

  const station = masses.find(m => m.id === 'travelers-station')!
  return { body, terraceRise, square, terraces, masses, streets, descent, gates, station }
}

/** Why a greybox would not read to the walker. Each names the piece, never a bare count. */
export type TownFault =
  | { why: 'face-is-ambiguous'; id: string; height: number }
  | { why: 'street-too-narrow'; id: string; width: number }
  | { why: 'terrace-not-a-tier'; height: number }
  | { why: 'storefront-interior-opens'; id: string }
  | { why: 'wrong-square-front-count'; fronts: number }
  | { why: 'station-bypasses-town'; id: string }
  | { why: 'stands-on-nothing'; id: string; level: number }
  | { why: 'street-ends-in-air'; id: string; level: number }
  | { why: 'bands-overlap'; id: string; other: string }
  | { why: 'street-through-a-mass'; id: string; mass: string }
  | { why: 'masses-collide'; id: string; other: string }
  | { why: 'two-shops-one-size'; id: string; other: string }
  | { why: 'nothing-to-discover'; hidden: number }
  | { why: 'the-passage-is-in-plain-sight'; id: string }
  | { why: 'canon-adjacency-broken'; id: string; near: string; gap: number }
  | { why: 'gate-lies-about-permanence'; id: string; kept: boolean; form: GateForm }
  | { why: 'gate-you-cannot-walk-through'; id: string; height: number }
  | { why: 'gate-stands-inside-a-mass'; id: string; mass: string }

/** Does the segment from `a` to `b` cross this footprint? Slab test, plan only. */
function crosses(a: [number, number], b: [number, number], m: Terrace): boolean {
  let t0 = 0, t1 = 1
  const d = [b[0] - a[0], b[1] - a[1]]
  const lo = [m.x0, m.z0], hi = [m.x1, m.z1]
  for (let i = 0; i < 2; i++) {
    if (Math.abs(d[i]) < 1e-12) { if (a[i] < lo[i] || a[i] > hi[i]) return false; continue }
    let n0 = (lo[i] - a[i]) / d[i], n1 = (hi[i] - a[i]) / d[i]
    if (n0 > n1) [n0, n1] = [n1, n0]
    t0 = Math.max(t0, n0); t1 = Math.min(t1, n1)
    if (t0 > t1) return false
  }
  return true
}

/**
 * Sweep the town against the walker it was authored for, and against canon.
 *
 * ★ FAULTS NAME THE PIECE, NOT A TALLY. A red count invites the cheapest lie that makes it green;
 * `{ why, id, height }` invites a fix.
 */
export function townFaults(town: Town): TownFault[] {
  const out: TownFault[] = []
  const M = metricsFor(town.body)
  const bandAt = (level: number) => town.terraces.filter(t => t.level === level)
  const standsOn = (level: number, b: Terrace) => bandAt(level).some(t => inside(t, b.x0, b.x1, b.z0, b.z1))

  if (readsAs(town.terraceRise) === 'ambiguous')
    out.push({ why: 'terrace-not-a-tier', height: town.terraceRise })

  for (const s of town.streets) {
    if (s.width < M.widths.passMin) out.push({ why: 'street-too-narrow', id: s.id, width: s.width })
    if (Math.abs(s.toTerrace - s.fromTerrace) > 1)
      out.push({ why: 'face-is-ambiguous', id: s.id, height: Math.abs(s.toTerrace - s.fromTerrace) * town.terraceRise })
  }

  // ── canon, asserted rather than reviewed ────────────────────────────────────────────────────
  // ⚠ THE RULING INVERTED THIS ASSERT. It used to demand EXACTLY ONE open door and name the Spirit
  // Corner; `rune-hold.md` › ★ NO INTERIOR OPENS struck that staging on 2026-08-24. A storefront
  // that quietly grows an interior is the failure now, and it is still one character wide.
  for (const p of PLACES)
    if (p.open && p.kind === 'front') out.push({ why: 'storefront-interior-opens', id: p.id })
  if (FRONTS.length !== 5) out.push({ why: 'wrong-square-front-count', fronts: FRONTS.length })

  const road = town.streets.find(s => s.id === 'station-road')
  if (!road || road.fromTerrace === 0) out.push({ why: 'station-bypasses-town', id: 'station-road' })

  // ★ CANON PUTS THE BOOKSTORE NEAR THE SPIRIT CORNER — the same keeper-grimoire network runs
  // through both. ⚠ THIS FIRED FOR REAL: fixing a floating shop moved the Bookstore a whole terrace
  // away, trading a geometry bug for a canon one, because heights were checked and the file was not.
  // "Near" is asserted as a distance the square itself sets, so it cannot drift into a vibe.
  {
    const a = town.masses.find(m => m.id === 'eyuun-bookstore'), b = town.masses.find(m => m.id === 'spirit-corner')
    if (a && b) {
      const gap = Math.hypot(a.x - b.x, a.z - b.z)
      if (gap > town.square.size / 2) out.push({ why: 'canon-adjacency-broken', id: a.id, near: b.id, gap })
    }
  }

  // ── is there ground under it? ───────────────────────────────────────────────────────────────
  for (const m of town.masses) {
    const level = Math.round(m.y / town.terraceRise)
    if (!standsOn(level, box(m))) out.push({ why: 'stands-on-nothing', id: m.id, level })
    if (readsAs(m.h) === 'ambiguous') out.push({ why: 'face-is-ambiguous', id: m.id, height: m.h })
  }
  if (!standsOn(0, box(town.descent))) out.push({ why: 'stands-on-nothing', id: town.descent.id, level: 0 })

  for (const s of town.streets) {
    const p = s.width / 2
    for (const [pt, level] of [[s.from, s.fromTerrace], [s.to, s.toTerrace]] as const)
      if (!standsOn(level, { id: '', level, x0: pt[0] - p, x1: pt[0] + p, z0: pt[1] - p, z1: pt[1] + p }))
        out.push({ why: 'street-ends-in-air', id: s.id, level })
  }

  // ── nothing may occupy the same plan as anything else ───────────────────────────────────────
  // ★★ A STREET MUST NOT RUN THROUGH A BUILDING, and level is deliberately not part of the test — a
  // street at the shop's height is a road through its doorway, one a terrace up is a road through
  // its roof, and neither is a street. Same for two buildings: with a scattered roster placed by
  // hand-free derivation, an overlap is the failure mode, not a typo.
  for (const s of town.streets) {
    const p = s.width / 2
    const sb: Terrace = { id: s.id, level: 0,
      x0: Math.min(s.from[0], s.to[0]) - p, x1: Math.max(s.from[0], s.to[0]) + p,
      z0: Math.min(s.from[1], s.to[1]) - p, z1: Math.max(s.from[1], s.to[1]) + p }
    for (const m of town.masses) if (overlaps(sb, box(m))) out.push({ why: 'street-through-a-mass', id: s.id, mass: m.id })
    if (overlaps(sb, box(town.descent))) out.push({ why: 'street-through-a-mass', id: s.id, mass: town.descent.id })
  }
  for (let i = 0; i < town.masses.length; i++)
    for (let j = i + 1; j < town.masses.length; j++)
      if (Math.round(town.masses[i].y) === Math.round(town.masses[j].y) &&
          overlaps(box(town.masses[i]), box(town.masses[j])))
        out.push({ why: 'masses-collide', id: town.masses[i].id, other: town.masses[j].id })

  for (let i = 0; i < town.terraces.length; i++)
    for (let j = i + 1; j < town.terraces.length; j++)
      if (town.terraces[i].level !== town.terraces[j].level && overlaps(town.terraces[i], town.terraces[j]))
        out.push({ why: 'bands-overlap', id: town.terraces[i].id, other: town.terraces[j].id })

  // ── ★★ THE GATE GRAMMAR, WHICH IS A CLAIM THE SHAPE MAKES TO THE PLAYER ─────────────────────
  // ⚠ THIS IS NOT A STYLE ASSERT. Canon rules that a player reads *"will this still be here
  // tomorrow"* off the form alone, so a kept gate drawn bare tells them a permanent crossing is
  // going away — and a temporary one drawn framed promises a crossing that will not be there. The
  // cheapest wrong answer is to treat `form` as art and let it drift off `kept`; storing both and
  // comparing them is what stops that being invisible.
  for (const g of town.gates) {
    if (g.kept !== (g.form === 'framed'))
      out.push({ why: 'gate-lies-about-permanence', id: g.id, kept: g.kept, form: g.form })
    // A gate is a thing you step through, so its opening answers to the body, not to taste.
    if (g.h < doorwayHeight(town.body) - 1e-9 || g.w < M.widths.passMin)
      out.push({ why: 'gate-you-cannot-walk-through', id: g.id, height: g.h })
    // ⚠ AND IT MUST NOT BE SWALLOWED — but a door FLUSH IN A WALL is the correct shape, not a bug.
    // Canon calls the Spirit Corner's gate *"a door in a wall"* and lists *"a shop's back door"* as a
    // framed form, so a footprint test would fail the one example canon gives. ★ The question is
    // whether the gate's own centre is INSIDE a building — a landing behind a shopfront is
    // unreachable; a doorway on its face is how you get in.
    for (const m of town.masses) {
      const b = box(m)
      if (g.x > b.x0 + 1e-9 && g.x < b.x1 - 1e-9 && g.z > b.z0 + 1e-9 && g.z < b.z1 - 1e-9)
        out.push({ why: 'gate-stands-inside-a-mass', id: g.id, mass: m.id })
    }
  }

  // ── ★★★ CANON'S FEEL LINE, AS A CHECK ───────────────────────────────────────────────────────
  // *"Shops you remember by name. Corners that reward curiosity."* Both halves are layout specs and
  // the first roster failed both: five identical boxes, and a town wholly visible from the square.
  //
  // ⚠ SIZE FIRST — a name needs a silhouette to attach to. Two shops that agree on BOTH dimensions
  // are the same building wearing two names, however different their programs read on paper.
  const shops = town.masses.filter(m => m.kind === 'front' || m.kind === 'scatter' || m.kind === 'infra')
  for (let i = 0; i < shops.length; i++)
    for (let j = i + 1; j < shops.length; j++)
      if (Math.abs(shops[i].w - shops[j].w) < 0.05 && Math.abs(shops[i].d - shops[j].d) < 0.05 &&
          Math.abs(shops[i].h - shops[j].h) < 0.05)
        out.push({ why: 'two-shops-one-size', id: shops[i].id, other: shops[j].id })

  // ⚠ THEN OCCLUSION. A town you can read off in one glance from the landing has no corners in it,
  // whatever its street plan looks like on paper. Sight is taken from the square's centre because
  // that is where canon puts the keeper on arrival.
  const eye: [number, number] = [town.square.x, town.square.z]
  const occluded = (t: { x: number; z: number; w: number; d: number; id: string }) =>
    town.masses.some(o => o.id !== t.id && crosses(eye, [t.x, t.z], box(o)))
  const hidden = town.masses.filter(m => m.kind !== 'fixture' && occluded(m)).length
  if (hidden === 0) out.push({ why: 'nothing-to-discover', hidden })

  // ★ AND THE PASSAGE IS THE ONE PLACE THAT CANNOT BE BUILT WITHOUT THIS PROPERTY. Canon: entry is
  // *"word of mouth only. No signs. No directions."* A mouth in the ground the square can see is a
  // signpost, whatever it is labelled.
  if (!occluded({ ...town.descent })) out.push({ why: 'the-passage-is-in-plain-sight', id: town.descent.id })

  return out
}

/** The tier ladder a reviewer can read off, for whichever body the town was built for. */
export const ladderFor = (body: Body) => ({
  flow: STEP_FLOW, vault: LEDGE_VAULT, ...metricsFor(body).widths,
})
