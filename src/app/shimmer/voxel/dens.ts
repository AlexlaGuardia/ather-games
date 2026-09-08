// Dens — the mouth dug into a bank, and the fourth thing a land does with its ground.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ── ★★ CANON FIRST, BECAUSE THE WORD IS ALREADY TAKEN AND IT IS TAKEN BY THE VILLAIN ───────────
// `game/shimmer-geography.md` (RULED 2026-07-30) owns the word BURROW and rules it collar-culture:
// *"a burrow is a mouth, a hold is the hand behind it"* — collared Moglins tunnel into a plot
// through burrows near its edge and keep pressing for as long as that area's hold stands. That is
// hand-authored infrastructure with an address (`world/spawn-placements.ts` IS the burrow set, and
// `engine/burrows.ts` is built on the ruling); the boundary line hands *placement, rates and reset
// cadence* to Jin, and hands nothing else.
//
// ⚠ SO A GENERATOR MAY NOT SCATTER BURROWS. A burrow with no hold behind it contradicts the ruling
// in one word, and a burrow in every meadow makes the incursion — the liberation arc stated as
// terrain — into ambient scenery. What this file places is a **DEN**: an animal hole. Canon already
// has those and does not need asking, in the habitat column of `world/mana_beasts.md` — Gemdigger
// *"grassland burrow colonies"*, Quillfang *"burrows, forest undergrowth"*, Embermole *"burrows
// through warm rock"*. Ambient nature, no collar, no hold, nothing hostile, nothing at all.
//
// ⚠⚠ AND IT STAYS EMPTY THIS SLICE, DELIBERATELY. The moment a den emits a creature it is answering
// `CANON_GAPS.md` Gap 2 — *"is there a wild free source a keeper can simply discover, or is 'you
// freed him' the only road to a Moglin who will work with you?"* — which is **[OPEN]** and is a
// books-level question about how the world's kindness is supplied. A hole in a bank asserts nothing
// and blocks nothing. A hole in a bank that hands you a friend rules an open gap by shipping.
//
// ── ★★ carve.ts WROTE THIS FEATURE'S BRIEF A MONTH AGO AND DID NOT BUILD IT ─────────────────────
// `CarveConfig.surfaceClearance` leaves 3 voxels of ground under every tunnel, and says why in its
// own doc: *"A cave mouth is a fine thing to have, but an invisible single-voxel hole you drop 40
// blocks down is not a cave mouth — it is a bug that reads as one. Cave entrances should be a
// DELIBERATE FEATURE (a widened, visible mouth), not a side effect of a tunnel happening to graze
// the surface."* This is that deliberate feature. It is the only thing in the generator allowed to
// open ground to the sky-side, and it earns it by being placed against a bank rather than by
// getting lucky with one.
//
// ── ★★ A DEN IS A CARVE, AND LIVING IN THE CARVED STAGE IS LOAD-BEARING, NOT TIDY ──────────────
// It removes cells, so every ordering argument boulders make runs backwards here.
//   • **Carved, not Vegetation.** Post-carve ore runs after us, so `discardOnAirExposure` sees a
//     den's walls the same way it sees a tunnel's and ore is dealt around them for free. In the
//     vegetation stage we would instead be DELETING ore that had already been placed — the element
//     -crystal rarity bug boulders found, in the one direction a `put` guard cannot fully undo,
//     because removal leaves nothing behind to notice. The refusal below is still there as a belt.
//   • **After `carveStack`,** so a den that meets a tunnel joins it rather than being half-filled.
//   • **Before the vegetation stage,** so `placeSites`, `plantWaystones` and the hold walls all
//     land on top: a den can never hole a ruin, a lit post, or Brack's curtain.
//   • **After the bare-terrain snapshot**, exactly like `carveStack` — so the diff records a den as
//     a stage write and `generatedVoxel` agrees with the world. Getting that wrong is the class of
//     bug that regrew chopped trees.
//
// ── ★ THE HOME PLOT NEEDS NO GUARD, AND THE REASON IS WORTH KNOWING ────────────────────────────
// `plot-column.ts` is a SEPARATE GENERATOR — the host switches `isPlot ? generatePlotColumn(...)`
// and the continent's stages never run there at all. `plot.ts` says it in its own header: *"No ore.
// No caves. No respawning anything."* A den cannot reach the garden because this code never runs
// in it. (A hold CAN be reached — the continent generates those — hence `holdIndexAt` below.)

import { Section, AIR } from './section'
import { hash2, mixSeed } from './noise'
import { isLogMat, isLeafMat } from './trees'
import { isSeam } from './seams'
import { holdIndexAt } from './holds'
import { landMix, LAND_IDS, type LandId } from './character'
import { type BiomeConfig, DEFAULT_BIOME, greyness } from './biome'
import { type HeightConfig, DEFAULT_HEIGHT } from './height'

export interface DenConfig {
  /** Expected den ATTEMPTS per chunk at `denK` 1. Most attempts find no bank — see `minDrop`. */
  perChunk: number
  /** How far out the bank is measured, in blocks. Also the throat's reach back out to daylight. */
  probe: number
  /**
   * Blocks the ground must fall across `probe` for a den to be dug there.
   *
   * ★★ THIS IS THE WHOLE FEATURE, NOT A FILTER ON IT. A den is a hole in a BANK; on flat ground the
   * same geometry is a pit, and a pit you cannot see the bottom of is the exact thing carve.ts
   * refused to ship.
   *
   * ⚠⚠ AND THE FIRST NUMBER HERE WAS PICKED FROM A PICTURE OF THE TERRAIN THAT IS NOT THE TERRAIN.
   * I reached for a fall of 5 across 3 — a terrace face — because "a den is in a bank" makes you
   * imagine a cliff. **Measured, this world almost has no cliffs**: at probe 3 only **0.5%** of
   * columns fall 5, `dell` and `tableland` have literally **zero** such faces, and the whole feature
   * realised at **one den per ~450 chunks** — rarer than the story road, and unfindable. The
   * heightfield is smooth; its steep-looking country is terraced by the SLUMP layer, which is a
   * half-block lip and not a fall at all. Measured curve at probe 4: `>=2` 23.3% · `>=3` 9.4% ·
   * `>=4` 4.0% · `>=5` 1.7%. Nothing about this was guessable from reading the generator.
   */
  minDrop: number
  /**
   * How many steps in from the mouth may remove a SURFACE block — the mouth notch.
   *
   * ★★ THIS IS THE HONEST HALF OF `surfaceClearance`, NOT A HOLE IN IT. On ground this gentle the
   * strict rule (`y < surface`, everywhere, no exceptions) does not make a safe den — it makes NO
   * den. The interior floor sits at the outside ground level, so one step in the ground has climbed
   * into the floor row and the passage is plugged by the very turf the rule protects. Every den in
   * the world would be a sealed cavity behind a decorative dip: invisible, unreachable, and green
   * on any assert that only counts cells.
   *
   * So a den is allowed to cut a NOTCH, and the notch is bounded three ways at once — only in the
   * throat, only within this many steps of the mouth, and only across the `headroom` rows the
   * passage occupies. That makes it the deliberate, visible, downhill-facing mouth `carve.ts` asked
   * for in writing, and it keeps the invariant sharp enough to test: away from a den's own mouth,
   * NOTHING in this file may remove a block a keeper is standing on.
   */
  apronSteps: number
  /**
   * Extra blocks the throat drives past the start point, so the chamber sits under real ground.
   *
   * ⚠⚠ THE MINIMUM IS NOT A TASTE SETTING — IT SEPARATES THE CHAMBER FROM THE NOTCH. The mouth is
   * `probe` out from the anchor and the chamber `throatExtraMin` back in, so the chamber's near
   * face stands `probe + throatExtraMin - chamberRadiusMax·(1+warp)` from the mouth. Let that fall
   * to `apronSteps` or less and the chamber itself acquires permission to cut surface blocks —
   * which stops being a mouth and becomes an open pit with a tunnel attached. `dens.test.ts` §4
   * asserts the separation against these numbers directly, so lowering this fails rather than
   * quietly widening the hole.
   */
  throatExtraMin: number
  throatExtraMax: number
  /** Throat half-width. 1.25 gives a 3-wide passage — a mouth you walk into, not a rabbit hole. */
  throatRadius: number
  /** Interior height, in blocks, measured up from the floor. */
  headroom: number
  chamberRadiusMin: number
  chamberRadiusMax: number
  /** Chamber vertical squash. A den is wider than it is tall; nothing here is a shaft. */
  chamberSquash: number
  /** Chamber radius warp, as a fraction of r. 0 reads as a golf ball, same as a boulder's. */
  warp: number
  /** Solid blocks demanded between the chamber's crown and daylight. See `denAt`. */
  minRoof: number
  /** Never dig below this — the same floor the carvers respect. */
  floorGuard: number
  /** Above this altitude nothing is dug — the treeline's reason: the shell is up there. */
  maxAltitude: number
}

export const DEFAULT_DENS: DenConfig = {
  perChunk: 0.60,
  probe: 4,
  minDrop: 3,
  apronSteps: 3,
  throatExtraMin: 4,
  throatExtraMax: 7,
  throatRadius: 1.25,
  headroom: 3,
  chamberRadiusMin: 2.0,
  chamberRadiusMax: 3.2,
  chamberSquash: 0.62,
  warp: 0.25,
  minRoof: 2,
  floorGuard: 4,
  maxAltitude: 200,
}

/**
 * Per-land den multiplier.
 *
 * ★ THE TABLE ANSWERS "CAN A PAW DIG HERE, AND IS THERE ANYTHING TO DIG INTO", WHICH IS NOT THE
 * SAME QUESTION AS `rockK`. It lives here rather than in `SCATTER_DRESS` because a den is dug, not
 * shed, and rather than in `LandCharacter` because that interface takes its materials as arguments
 * (`depth.ts` builds it and would have to thread a dial it never reads).
 *
 * ★ CANON SUPPLIES THE SHAPE OF THIS TABLE — `world/mana_beasts.md`'s habitat column names
 * grassland colonies (Gemdigger), forest undergrowth (Quillfang) and warm rock (Embermole), so
 * open green country and wooded country both dig, and bare rock digs least. Nothing was invented.
 *
 * ★ MARSH IS 0 AND IT IS THE DESIGN. A den in saturated ground is a flooded hole; canon's marsh
 * reads as reeds and standing water, and the one land whose ground cannot hold a roof should say
 * so. Same statement `crag: treeK 0` makes from the other side.
 *
 * ⚠ THE NUMBER IN THIS TABLE IS NOT THE NUMBER IN THE WORLD, AND THAT IS UNAVOIDABLE HERE. Every
 * other dial in the generator scales a density directly; this one scales ATTEMPTS, and an attempt
 * only becomes a den where the ground already falls `minDrop`. So a land's realised den count is
 * `denK × how banked that land is`, and the two are correlated: uplands are steep and would run
 * away with it on a flat dial. The table is compensated against MEASURED bank frequency (see
 * `dens.test.ts` § the realised-rate table) rather than set to what reads well in the abstract.
 */
export interface DenDials { denK: number }

export const DEN_DRESS: Readonly<Record<LandId, DenDials>> = {
  meadow:    { denK: 1.60 },  // canon's grassland colonies — the land that digs most
  woodland:  { denK: 1.30 },  // undergrowth — the Quillfang set
  deepwood:  { denK: 1.40 },  // deeper litter, softer ground; the wood's core out-digs its edge
  dell:      { denK: 1.40 },  // damp green valley floor, easy digging
  marsh:     { denK: 0 },     // floods. See above.
  tableland: { denK: 0.80 },  // open stony pan — thin soil over rock
  barrens:   { denK: 0.60 },
  highland:  { denK: 0.30 },  // banked everywhere, so a LOW dial still reads — see the table below
  crag:      { denK: 0.12 },  // bare rock: canon's warm-rock burrower only, and the rarest of them
}

/** Loosest dial anywhere in the table — the oracle's upper bound, asserted against the table. */
export const MAX_DEN_K = 1.60

/** The blended den dial at a column. Blended, never rolled — the sibling law's continuous half. */
export function denCharacterAt(
  x: number, z: number, seed: number,
  dress: Readonly<Record<LandId, DenDials>> = DEN_DRESS,
  cfg: BiomeConfig = DEFAULT_BIOME, hcfg: HeightConfig = DEFAULT_HEIGHT,
): number {
  const w = landMix(x, z, seed, cfg, hcfg)
  let denK = 0
  for (let i = 0; i < w.length; i++) denK += w[i] * dress[LAND_IDS[i]].denK
  return denK
}

export interface DenStart {
  /** The attempt's anchor — where the chamber ends up, roughly. */
  x: number
  z: number
  seed: number
  chamberR: number
  throatExtra: number
}

/** How many chunk columns out to scan for dens that reach into this one. */
export const denScanRadius = (size: number, cfg: DenConfig = DEFAULT_DENS): number =>
  Math.ceil((cfg.probe + cfg.throatExtraMax + cfg.chamberRadiusMax * (1 + cfg.warp)) / size) + 1

const unit = (x: number, z: number, seed: number): number => hash2(x, z, seed)

/** The eight compass directions, unit length. Diagonals are normalised so `probe` is a real distance. */
const D = Math.SQRT1_2
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [D, D], [D, -D], [-D, D], [-D, -D],
]

/**
 * The den attempts anchored in chunk (cx, cz).
 *
 * ★ THE LAND SCALES AN EXPECTED COUNT, IT DOES NOT VETO — same construction as `treeStartsAt` and
 * `boulderStartsAt`, so a land's den count eases across a border instead of switching on at a
 * contour. A veto would draw a line exactly where the blend exists to remove one.
 */
export function denStartsAt(
  seed: number, cx: number, cz: number, size: number, cfg: DenConfig = DEFAULT_DENS,
): DenStart[] {
  const base = (hash2(cx, cz, seed ^ 0xde41a1) * 4294967296) | 0
  const k = denCharacterAt(cx * size + size / 2, cz * size + size / 2, seed)
  const expected = cfg.perChunk * k
  const whole = Math.floor(expected)
  const n = whole + (unit(cx, cz, seed ^ 0xd3a1) < expected - whole ? 1 : 0)
  const out: DenStart[] = []
  for (let i = 0; i < n; i++) {
    const s = mixSeed(base, i)
    out.push({
      x: cx * size + Math.floor(unit(s, 1, seed ^ 0xd1) * size),
      z: cz * size + Math.floor(unit(s, 2, seed ^ 0xd2) * size),
      seed: s,
      chamberR: cfg.chamberRadiusMin + unit(s, 3, seed ^ 0xd3) * (cfg.chamberRadiusMax - cfg.chamberRadiusMin),
      throatExtra: cfg.throatExtraMin
        + Math.floor(unit(s, 4, seed ^ 0xd4) * (cfg.throatExtraMax - cfg.throatExtraMin + 1)),
    })
  }
  return out
}

/**
 * Low-frequency chamber warp — the same construction, and the same warning, as `boulderWarp`.
 *
 * ⚠ HASHED ON THE OFFSET FROM THE CHAMBER'S OWN CENTRE, never on world position — but read the
 * next paragraph before repeating boulders' reason for it, because it is NOT the reason here.
 *
 * ★ DEMOTED FROM MECHANISM TO GUARD, by a mutation that came back green. `boulderWarp` carries a
 * warning that world-space hashing would crack every boulder on a chunk boundary, and I copied it.
 * It is false of dens: a den's cells are derived entirely from its PLAN, and `denAt` reads only the
 * heightfield, so both chunk alignments build the identical plan and therefore the identical cell
 * set — the geometry is alignment-independent by construction, not by how this hash is salted. A
 * mutation that salted the warp with the offset survived the seam assert for exactly that reason.
 * Offset-hashing stays because it also makes a den look like itself wherever it sits; the seam
 * assert in `dens.test.ts` §9 stays as an end-to-end regression guard on the construction. What is
 * gone is the sentence claiming this line is what protects it. A comment claiming a mechanism no
 * test can feel is decoration, and this tree has had to delete that kind of sentence before.
 */
export function denWarp(dx: number, dy: number, dz: number, s: number, amp: number): number {
  const a = hash2(Math.round(dx * 1.7), Math.round(dz * 1.7) + Math.round(dy * 3.1), s ^ 0x7c31)
  const b = hash2(Math.round(dx * 3.9) + Math.round(dy * 2.3), Math.round(dz * 3.9), s ^ 0x4e19)
  return 1 + amp * ((a - 0.5) + 0.5 * (b - 0.5))
}

export interface DenCell {
  x: number
  y: number
  z: number
  /**
   * May this cell remove a block AT the surface? True only for throat cells inside the mouth notch.
   *
   * ⚠ THE FLAG IS COMPUTED HERE AND ENFORCED IN `dig`, ON PURPOSE. Deciding it at the point of
   * writing would let a later reader "simplify" the two into one rule and silently widen the notch
   * to the whole den — which is the difference between a mouth and a trench through the hilltop.
   */
  apron: boolean
}

export interface DenPlan {
  /** Mouth foot, in world blocks — the outside ground the den opens onto. */
  mouthX: number
  mouthZ: number
  /** Floor level: the first AIR row, so a keeper stands here. Equals the mouth ground + 1. */
  floorY: number
  /** Unit vector pointing OUT of the den, downhill. */
  dx: number
  dz: number
  /** Chamber centre. */
  cxw: number
  cyw: number
  czw: number
  chamberR: number
  /** Throat length in steps, from the mouth back to the chamber. */
  steps: number
  /**
   * The attempt's stream, carried through so the chamber warp differs per den.
   *
   * ⚠ IT WAS A LITERAL `0` UNTIL A MUTATION EXPOSED IT. Every chamber in the world was warped by
   * the identical lump pattern — deterministic, seam-safe, tested green, and nine lands of dens all
   * the same shape. Nothing asserts "these two dens differ", which is why it survived: the bug is
   * invisible to every property the oracle checks and obvious the moment you stand in two of them.
   */
  seed: number
}

/**
 * Resolve an attempt into a plan, or `null` if this ground will not take a den.
 *
 * ★ EVERY REFUSAL HERE IS A PRECONDITION, NOT A HOPE, AND THAT PHRASING IS FROM A SCAR. The
 * boulder oracle shipped three surviving mutations because its fixtures never contained the
 * collision the asserts were about — deleting a guard changed nothing, so the guard read as tested.
 * A plan that cannot satisfy its own invariants must be refused HERE, where a test can count the
 * refusals, rather than clipped cell-by-cell later where an empty result looks like a quiet success.
 */
export function denAt(
  st: DenStart, seed: number, surfaceAt: (x: number, z: number) => number, seaLevel: number,
  cfg: DenConfig = DEFAULT_DENS,
): DenPlan | null {
  // A hold is generated terrain, unlike the plot, so it is the one thing that needs saying no to.
  if (holdIndexAt(st.x, st.z) >= 0) return null

  const hUp = surfaceAt(st.x, st.z)
  if (hUp >= cfg.maxAltitude) return null

  // ⚠ AN EARLY-OUT, NOT A GUARD, AND THE DISTINCTION IS WHY IT IS LABELLED. Deleting this line
  // changes no output at all: the mouth is by construction the LOWEST point of the den, so
  // `hDown <= hUp`, and the mouth's own waterline check below already refuses everything this
  // could. A mutation deleting it therefore survives the whole suite — correctly, because there is
  // nothing to catch. It stays because most of the world's sub-sea columns are lake bed and this
  // skips eight `surfaceAt` calls for each of them. Left unlabelled it reads as a safety property,
  // and the next person writes a test for a condition that cannot occur.
  if (hUp < seaLevel) return null

  // ── the bank: steepest descent over `probe` ────────────────────────────────────────────────
  let best = -1, bdx = 0, bdz = 0, hDown = 0
  for (const [ux, uz] of DIRS) {
    const px = Math.round(st.x + ux * cfg.probe), pz = Math.round(st.z + uz * cfg.probe)
    const h = surfaceAt(px, pz)
    if (hUp - h > best) { best = hUp - h; bdx = ux; bdz = uz; hDown = h }
  }
  if (best < cfg.minDrop) return null
  if (hDown < seaLevel) return null              // a mouth below the waterline is a drowned hole

  const floorY = hDown + 1
  if (floorY - 1 < cfg.floorGuard) return null

  const steps = cfg.probe + st.throatExtra
  const cxw = st.x - bdx * st.throatExtra
  const czw = st.z - bdz * st.throatExtra
  const cyw = floorY + (cfg.headroom - 1) / 2

  // ⚠ THE ROOF IS CHECKED AT THE CHAMBER, WHERE IT IS THINNEST RELATIVE TO THE SPAN. The per-cell
  // rule below already forbids breaking the surface, so a thin roof cannot become a skylight — it
  // becomes something worse to find: a wide chamber under a one-block crust, which reads fine until
  // a keeper mines the turf above it and drops through a ceiling nothing warned them about.
  const ry = st.chamberR * cfg.chamberSquash
  const crown = cyw + ry * (1 + cfg.warp)
  if (surfaceAt(Math.round(cxw), Math.round(czw)) - crown < cfg.minRoof) return null

  return {
    mouthX: st.x + bdx * cfg.probe, mouthZ: st.z + bdz * cfg.probe,
    floorY, dx: bdx, dz: bdz, cxw, cyw, czw, chamberR: st.chamberR, steps, seed: st.seed,
  }
}

/**
 * Every cell a den wants, as world coordinates. Exported for the oracle — the digger writes through
 * `Section`s, which a test cannot easily read a shape back out of.
 *
 * ⚠ THIS RETURNS WHAT THE DEN WANTS, NOT WHAT IT GETS. The surface rule and the material refusals
 * live in `dig` and are deliberately NOT applied here, so a test can measure both sets and see the
 * difference. Filtering here would make the no-skylight assert tautological — it would be checking
 * that the filter it is testing had been applied.
 */
export function denCells(plan: DenPlan, cfg: DenConfig = DEFAULT_DENS): DenCell[] {
  const out: DenCell[] = []
  const seen = new Map<string, DenCell>()
  const push = (x: number, y: number, z: number, apron: boolean) => {
    const key = `${x},${y},${z}`
    const had = seen.get(key)
    // The chamber and the deep throat overlap; if ANY contributor is apron-eligible the cell is.
    if (had) { if (apron) had.apron = true; return }
    const cell: DenCell = { x, y, z, apron }
    seen.set(key, cell)
    out.push(cell)
  }

  // ── the throat: a flat-floored tube from the mouth back to the chamber ─────────────────────
  const tr = Math.ceil(cfg.throatRadius)
  for (let s = 0; s <= plan.steps; s++) {
    const ax = plan.mouthX - plan.dx * s, az = plan.mouthZ - plan.dz * s
    for (let dz = -tr; dz <= tr; dz++) {
      for (let dx = -tr; dx <= tr; dx++) {
        // Distance from the tube's AXIS, measured perpendicular — a disc swept along the walk.
        const px = ax + dx, pz = az + dz
        const ox = px - ax, oz = pz - az
        const along = ox * plan.dx + oz * plan.dz
        const perp = Math.hypot(ox - along * plan.dx, oz - along * plan.dz)
        if (perp > cfg.throatRadius) continue
        // ⚠⚠ APRON IS THE CELL'S OWN DISTANCE FROM THE MOUTH, NOT THE STEP INDEX `s`, AND THE
        // DIFFERENCE IS A REAL WIDENING. Each step's cross-section is taken over a (2·tr+1)² patch
        // filtered by perpendicular distance, so a step also reaches up to `tr` cells ALONG the
        // axis — step 3 already contains cells 5 out. Keying the notch to `s` therefore declares a
        // 3-step mouth and cuts a 5-step one, and the bound in the config doc stops being true.
        // Measuring from the mouth makes the declared number the actual number, and it is what
        // `dens.test.ts` §4 can then assert exactly rather than with a tolerance.
        const dm = Math.hypot(Math.round(px) - plan.mouthX, Math.round(pz) - plan.mouthZ)
        for (let h = 0; h < cfg.headroom; h++) push(Math.round(px), plan.floorY + h, Math.round(pz), dm <= cfg.apronSteps)
      }
    }
  }

  // ── the chamber: a warped, squashed ellipsoid sitting on the same floor ────────────────────
  const ry = plan.chamberR * cfg.chamberSquash
  const rad = Math.ceil(plan.chamberR * (1 + cfg.warp))
  const radY = Math.ceil(ry * (1 + cfg.warp))
  for (let y = Math.floor(plan.cyw - radY); y <= Math.ceil(plan.cyw + radY); y++) {
    if (y < plan.floorY) continue                  // never dig below the floor you walk in on
    const fy = y - plan.cyw
    const wy = Math.round(fy)
    for (let dz = -rad; dz <= rad; dz++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const w = denWarp(dx, wy, dz, plan.seed, cfg.warp)
        const nx = dx / (plan.chamberR * w), ny = fy / (ry * w), nz = dz / (plan.chamberR * w)
        if (nx * nx + ny * ny + nz * nz > 1) continue
        push(Math.round(plan.cxw) + dx, y, Math.round(plan.czw) + dz, false)
      }
    }
  }
  return out
}

interface Ctx {
  sections: (Section | null)[]
  ox: number; oy0: number; oz: number
  size: number; yTop: number
}

/**
 * ⚠ TWO RULES, AND WHICH ONE APPLIES IS THE WHOLE SAFETY ARGUMENT. Away from the mouth a cell is
 * refused at or above its own column's surface (`y >= surface`), so there is no altitude anywhere
 * in the world at which a den removes the block a keeper is standing on. Inside the mouth notch —
 * `apron`, set by the planner from the cell's distance to the mouth — the bound relaxes by exactly
 * one row (`y > surface`), which is what cuts the visible opening in the bank face.
 *
 * ★ THE STRICT RULE ALONE DOES NOT MAKE A SAFE DEN, IT MAKES NO DEN, and that is measured rather
 * than argued. The interior floor sits at the outside ground level, so one step in on this world's
 * gentle slopes the ground has already climbed into the floor row and the passage is plugged by the
 * very turf the rule protects — every den a sealed cavity behind a decorative dip, invisible in
 * play and green on any assert that only counts cells. The relaxation is bounded three ways at
 * once (throat only, near the mouth only, `headroom` rows only) and `dens.test.ts` §6/§6b assert it
 * by exact set membership rather than by a distance tolerance: a slack radius reads as a bound
 * without being one, and an earlier version of that assert let a mutation widening the notch to the
 * ENTIRE den pass unnoticed.
 *
 * ⚠ THE APRON FLAG IS DECIDED IN `denCells` AND ONLY OBEYED HERE. Recomputing it at the point of
 * writing is the tempting simplification and it is how the notch quietly becomes a trench: the
 * planner knows where the mouth is, the writer only knows a cell.
 *
 * ⚠ AND IT REFUSES SEAM, LOGS AND LEAVES. Ore is belt-and-braces — living in the Carved stage means
 * post-carve ore is dealt around us — but a REMOVAL bug is strictly nastier than the addition bug
 * boulders found: a boulder converting an element crystal leaves stone where the crystal was, and
 * a den simply leaves nothing, so there is no artefact for anyone to notice. Each element gates ten
 * canon second forms, so a silent shave off crystal rarity moves a third of the evolution grid.
 * Logs and leaves are refused because a den under a trunk that ate its base floats a whole tree and
 * fires leaf decay on a canopy whose support vanished — a gameplay bug with no error and no wrong
 * pixel, which is exactly the trade `plantBoulders` makes and states.
 */
function dig(
  c: Ctx, wx: number, wy: number, wz: number, surface: number, floorGuard: number, apron: boolean,
): boolean {
  if (wx < c.ox || wx >= c.ox + c.size || wz < c.oz || wz >= c.oz + c.size) return false
  if (wy < c.oy0 || wy >= c.yTop) return false
  if (apron ? wy > surface : wy >= surface) return false
  if (wy < floorGuard) return false
  const si = ((wy - c.oy0) / c.size) | 0
  const sec = c.sections[si]
  if (!sec) return false
  const li = sec.idx(wx - c.ox, wy - c.oy0 - si * c.size, wz - c.oz)
  const cur = sec.data[li]
  if (cur === AIR) return false
  if (isLogMat(cur) || isLeafMat(cur) || isSeam(cur)) return false
  sec.data[li] = AIR
  return true
}

/**
 * Dig every den that reaches into this column. Returns how many cells were opened.
 *
 * `surfaceAt` is the generated heightfield, the same one the carvers and the planters read — never
 * the written column, so a den asks about the ground rather than about what an earlier stage did
 * to it, and two chunk alignments therefore agree.
 */
export function digDens(
  sections: (Section | null)[], ox: number, oy0: number, oz: number, size: number, seed: number,
  surfaceAt: (x: number, z: number) => number,
  seaLevel: number,
  cfg: DenConfig = DEFAULT_DENS,
): number {
  const first = sections.find(Boolean)
  if (!first) return 0
  const c: Ctx = { sections, ox, oy0, oz, size, yTop: oy0 + sections.length * size }
  const rad = denScanRadius(size, cfg)
  const c0x = Math.floor(ox / size), c0z = Math.floor(oz / size)
  let opened = 0

  for (let cz = c0z - rad; cz <= c0z + rad; cz++) {
    for (let cx = c0x - rad; cx <= c0x + rad; cx++) {
      for (const st of denStartsAt(seed, cx, cz, size, cfg)) {
        const plan = denAt(st, seed, surfaceAt, seaLevel, cfg)
        if (!plan) continue
        for (const cell of denCells(plan, cfg)) {
          if (dig(c, cell.x, cell.y, cell.z, surfaceAt(cell.x, cell.z), cfg.floorGuard, cell.apron)) opened++
        }
      }
    }
  }
  return opened
}

/** Loosest expected den ATTEMPTS per chunk anywhere in the world — the oracle's upper bound. */
export const maxAttemptsPerChunk = (cfg: DenConfig = DEFAULT_DENS): number => cfg.perChunk * MAX_DEN_K

// ── ★★★ ADITS — THE CAVE MOUTH `carve.ts` SPECIFIED A MONTH AGO AND NOBODY BUILT ────────────────
//
// ⚠⚠ THE WORLD'S CAVES WERE SEALED, AND EVERY FILE INVOLVED WAS CORRECT. `carve.ts` refuses to
// breach the surface (`surfaceClearance` 3) for a good reason it states in full — an invisible
// one-voxel hole you fall forty blocks down is a bug that reads as a cave mouth — and it hands the
// job of a real entrance to "a DELIBERATE FEATURE (a widened, visible mouth)". This file was built
// as that feature and its header says so. But a den digs its own small chamber for an animal; it
// was never the thing that connects the CARVED NETWORK, and it only ever joins a tunnel by luck.
// So the brief was written, the file that claims it was built, and the actual job was never done.
//
// Measured before this existed (`scripts/cave-map.mts`, 320x320 blocks of Wilds): 889,677 cells of
// cave air below the surface, and the wind — canon's third precondition — reached 14,295 of them.
// **1.61%.** 14 of 400 columns had any opening at all. A second instrument with no flood in it
// agreed from the other side: 62.8% of the world has a cave under it, and the histogram of solid
// lid over the topmost cave air has its tallest bar at exactly 3, which is `surfaceClearance`.
// Nobody had met a Hollow underground because nobody could get underground.
//
// ── ★★ AN ADIT IS A DEN WITH A DIFFERENT FAR END, AND REUSE IS THE POINT ───────────────────────
// It shares this file's bank probe, its throat, its apron notch and its `dig` rule verbatim. That
// is not tidiness: those rules are the entire safety argument for opening ground to the sky-side
// (bounded three ways, asserted by exact set membership), and a second file restating them would
// be the hand-kept mirror this tree keeps paying for. Living HERE also keeps this file's own
// header true — it is still the only thing in the generator allowed to open ground to daylight.
//
// ── ★★ IT CUTS THE LID; IT DOES NOT DIG A CAVE ────────────────────────────────────────────────
// The whole feature rests on that histogram: 13.8% of cave-bearing cells have a tunnel exactly
// three blocks down. So an adit does not need to sink a shaft to the mean lid of 44 — it needs to
// find one of the many places the network already reaches the crust, and open it at a BANK so the
// result is a mouth in a hillside rather than a pit in a lawn.
//
// ⚠ THE TUNNEL IS FOUND PURELY, VIA `carveTopAt`, NEVER BY READING `sections`. A plan resolved
// from a neighbouring column must be the same plan, or the seam is half a cave mouth — the same
// law that keeps `denAt` reading only `surfaceAt`. See that function's own header for why it is a
// derivation of the carver's walk rather than a second copy of it.

export interface AditConfig {
  /** Expected adit ATTEMPTS per chunk. Most find no bank, and most of those find no tunnel. */
  perChunk: number
  /** Bank probe distance, in blocks — also the throat's run from the mouth back to the anchor. */
  probe: number
  /** Blocks the ground must fall across `probe`. A mouth in flat ground is a pit. See `DenConfig`. */
  minDrop: number
  /** How many steps in from the mouth may remove a SURFACE block. Same meaning as a den's. */
  apronSteps: number
  throatRadius: number
  headroom: number
  /**
   * How far below the surface the tunnel may lie and still be worth opening.
   *
   * ★★ THIS IS THE FEATURE'S WHOLE SELECTIVITY, AND IT IS SET FROM A MEASUREMENT, NOT A FEELING.
   * The lid histogram (`scripts/cave-map.mts`'s sibling reading) is not smooth: it spikes at
   * exactly 3 — `carve.surfaceClearance`, where a tunnel ran up into the crust and was clipped —
   * and then falls to a long flat tail averaging 44. So a small number here selects the spike and
   * a large one starts sinking shafts through solid rock to reach nothing in particular. 6 keeps
   * the spike and one block of slop either side of it.
   */
  maxLid: number
  /** Steps driven PAST the anchor at the tunnel's own level, so the throat breaks properly in. */
  breakInMin: number
  breakInMax: number
  /**
   * Multiplier on `perChunk` in fully blighted ground, eased continuously with `greyness`.
   *
   * ── ★★ WHY THIS EXISTS AND WHY IT IS NOT THE LAND DIAL THIS FILE REFUSED ─────────────────────
   * `aditStartsAt` argues against a `DEN_DRESS`-style dial and that argument stands: a den is dug
   * BY AN ANIMAL, so canon's habitat column tells you which grounds dig, and an adit is not dug by
   * anything. This is a different kind of dial. It is a RATE, which the boundary line hands to Jin
   * outright, and it is set from a gameplay measurement rather than from a claim about soil.
   *
   * ⚠⚠ THE MEASUREMENT THAT FORCED IT. Adits and greyfields are two independent conditions that
   * know nothing about each other — a mouth needs a bank plus a tunnel near the crust, and the
   * ruling needs `greyness >= 0.5`, which is 6-9% of the world. Their intersection was therefore
   * thin BY ACCIDENT: swept over ±2880 blocks, **91 mouths on blighted ground out of 7,710 grey
   * columns**, and the nearest one to spawn was **~950 blocks away**. Alex walked into the cave the
   * console gave him, found a mana seam and nothing else, and reported the feature broken. It was
   * not broken. It was unreachable, which in play is the same thing and is worse to diagnose.
   *
   * ★ EASED IN `greyness`, NEVER GATED ON IT. Same law `denStartsAt` states: a dial scales an
   * expected count and must not veto, or it draws a hard line exactly where the blend exists to
   * remove one. A contour at the eligibility threshold would put a visible wall of cave mouths
   * along an invisible boundary.
   *
   * ⚠ AND IT DOES NOT KNOW ABOUT `HOLLOW_GREY_MIN`, DELIBERATELY. That constant lives in
   * `voxel3d/hollows.ts` and this file is PURE CORE — `purity.test.ts` forbids the import. Reaching
   * for it would mean copying the number, which is the hand-kept mirror this tree keeps paying for.
   * A linear ease needs no knee and cannot drift from a threshold it never mentions.
   */
  greyBias: number
  maxAltitude: number
  floorGuard: number
}

export const DEFAULT_ADITS: AditConfig = {
  perChunk: 1.2,
  probe: 4,
  minDrop: 3,
  apronSteps: 3,
  throatRadius: 1.25,
  headroom: 3,
  maxLid: 6,
  breakInMin: 2,
  breakInMax: 5,
  greyBias: 6,
  maxAltitude: 200,
  floorGuard: 4,
}

export interface AditStart { x: number; z: number; seed: number; breakIn: number }

export interface AditPlan {
  /** Mouth foot, in world blocks — the outside ground the adit opens onto. */
  mouthX: number
  mouthZ: number
  /** Floor at the mouth: the first AIR row, so a keeper walks in here. Outside ground + 1. */
  floorY: number
  /** Unit vector pointing OUT of the adit, downhill. */
  dx: number
  dz: number
  /** The anchor — where the tunnel was found — and the altitude of its topmost open cell. */
  anchorX: number
  anchorZ: number
  tunnelY: number
  /** Steps from the mouth to the anchor, then past it. */
  steps: number
  breakIn: number
}

export const aditScanRadius = (size: number, cfg: AditConfig = DEFAULT_ADITS): number =>
  Math.ceil((cfg.probe + cfg.breakInMax) / size) + 1

/**
 * The adit attempts anchored in chunk (cx, cz).
 *
 * ★ NO LAND DIAL, DELIBERATELY, AND THE ABSENCE IS AN ARGUMENT. `DEN_DRESS` exists because a den
 * is DUG BY AN ANIMAL and canon's habitat column says which grounds animals dig. An adit is not
 * dug by anything — it is a place the rock already opened and the hillside already fell away, so
 * scaling it by how well a paw digs would be borrowing a reason that does not apply. If cave
 * mouths should read differently by land, the honest dial is a ROCK one and it should be derived
 * from where the carvers actually reach the crust, which is measurable rather than guessable.
 */
export function aditStartsAt(
  seed: number, cx: number, cz: number, size: number, cfg: AditConfig = DEFAULT_ADITS,
): AditStart[] {
  const base = (hash2(cx, cz, seed ^ 0xad17e5) * 4294967296) | 0
  // The blight bias, read at the chunk's centre exactly as `denStartsAt` reads its land dial —
  // pure, per-chunk, no neighbour, so two alignments compute the same count and the seam holds.
  const g = greyness(cx * size + size / 2, cz * size + size / 2, seed)
  const expected = cfg.perChunk * (1 + (cfg.greyBias - 1) * Math.max(0, Math.min(1, g)))
  const whole = Math.floor(expected)
  const n = whole + (unit(cx, cz, seed ^ 0xad17) < expected - whole ? 1 : 0)
  const out: AditStart[] = []
  for (let i = 0; i < n; i++) {
    const s = mixSeed(base, i)
    out.push({
      x: cx * size + Math.floor(unit(s, 1, seed ^ 0xa1) * size),
      z: cz * size + Math.floor(unit(s, 2, seed ^ 0xa2) * size),
      seed: s,
      breakIn: cfg.breakInMin
        + Math.floor(unit(s, 3, seed ^ 0xa3) * (cfg.breakInMax - cfg.breakInMin + 1)),
    })
  }
  return out
}

/**
 * Resolve an attempt into a plan, or `null` if this ground will not take an adit.
 *
 * `carveTop` answers "the highest cell a carver opens in this column, or -1" — `carve.ts`'s
 * `carveTopAt`, injected rather than imported so the oracle can hand this function a tunnel it
 * placed itself and assert the mouth reaches it. Every refusal below is a precondition a test can
 * count, for the reason `denAt` states: a plan clipped cell-by-cell later looks like quiet success.
 */
export function aditAt(
  st: AditStart, surfaceAt: (x: number, z: number) => number, seaLevel: number,
  carveTop: (x: number, z: number) => number,
  cfg: AditConfig = DEFAULT_ADITS,
): AditPlan | null {
  if (holdIndexAt(st.x, st.z) >= 0) return null

  const hUp = surfaceAt(st.x, st.z)
  if (hUp >= cfg.maxAltitude) return null
  if (hUp < seaLevel) return null

  // ── the bank: steepest descent over `probe`, exactly as a den finds one ────────────────────
  let best = -1, bdx = 0, bdz = 0, hDown = 0
  for (const [ux, uz] of DIRS) {
    const px = Math.round(st.x + ux * cfg.probe), pz = Math.round(st.z + uz * cfg.probe)
    const h = surfaceAt(px, pz)
    if (hUp - h > best) { best = hUp - h; bdx = ux; bdz = uz; hDown = h }
  }
  if (best < cfg.minDrop) return null
  if (hDown < seaLevel) return null              // a mouth below the waterline is a drowned hole

  const floorY = hDown + 1
  if (floorY - 1 < cfg.floorGuard) return null

  // ── is there a tunnel just under the crust here? ──────────────────────────────────────────
  // ⚠⚠ ASKED LAST, AND THE ORDER IS A REAL COST, NOT A STYLE. `carveTopAt` re-walks every carver
  // in a 5x5 chunk scan box — the same work `carveStack` does to generate a whole column — while
  // every test above it is a handful of `surfaceAt` calls. The first version of this function
  // asked it FIRST, on the reasoning that it is the rarest condition and should reject earliest.
  // Rarest and cheapest are different properties and only one of them belongs in this decision:
  // the bank test alone refuses ~90% of attempts, so putting it in front turns roughly eleven
  // full carver walks per column into one.
  const tunnelY = carveTop(st.x, st.z)
  if (tunnelY < cfg.floorGuard) return null
  if (hUp - tunnelY > cfg.maxLid) return null

  // ⚠⚠ THE GRADE IS A PRECONDITION, NOT A CLAMP, AND IT IS ASSERTED FROM BOTH SIDES. The mouth
  // sits at the foot of the bank and the tunnel sits under its top, so the throat has to climb or
  // fall between two altitudes neither of which this feature chose. A rise steeper than one block
  // per step is a wall a keeper cannot step up — the passage would be visibly open and physically
  // one-way, which is worse than no adit at all. Bounding it symmetrically also refuses the plunge
  // in the other direction, where the "mouth" is the lip of a drop into a tunnel roof.
  if (Math.abs(tunnelY - floorY) > cfg.probe) return null

  return {
    mouthX: st.x + bdx * cfg.probe, mouthZ: st.z + bdz * cfg.probe,
    floorY, dx: bdx, dz: bdz,
    anchorX: st.x, anchorZ: st.z, tunnelY,
    steps: cfg.probe, breakIn: st.breakIn,
  }
}

/**
 * Every cell an adit wants, as world coordinates. Like `denCells`, this returns what it WANTS —
 * the surface rule and the material refusals live in `dig`, so a test can measure both sets and
 * see the difference rather than checking that a filter it is testing had been applied.
 */
export function aditCells(plan: AditPlan, cfg: AditConfig = DEFAULT_ADITS): DenCell[] {
  const out: DenCell[] = []
  const seen = new Map<string, DenCell>()
  const push = (x: number, y: number, z: number, apron: boolean) => {
    const key = `${x},${y},${z}`
    const had = seen.get(key)
    if (had) { if (apron) had.apron = true; return }
    const cell: DenCell = { x, y, z, apron }
    seen.set(key, cell)
    out.push(cell)
  }

  const tr = Math.ceil(cfg.throatRadius)
  const total = plan.steps + plan.breakIn
  for (let s = 0; s <= total; s++) {
    // Floor interpolates mouth -> tunnel over `steps`, then stays at the tunnel's own level for
    // the break-in run. A passage that kept climbing past the anchor would surface behind the hill.
    const t = Math.min(1, s / plan.steps)
    const floor = Math.round(plan.floorY + (plan.tunnelY - plan.floorY) * t)
    const ax = plan.mouthX - plan.dx * s, az = plan.mouthZ - plan.dz * s
    for (let dz = -tr; dz <= tr; dz++) {
      for (let dx = -tr; dx <= tr; dx++) {
        const px = ax + dx, pz = az + dz
        const ox = px - ax, oz = pz - az
        const along = ox * plan.dx + oz * plan.dz
        const perp = Math.hypot(ox - along * plan.dx, oz - along * plan.dz)
        if (perp > cfg.throatRadius) continue
        // ⚠ APRON IS THE CELL'S OWN DISTANCE FROM THE MOUTH, NOT THE STEP INDEX. `denCells` states
        // the reason in full: a step's cross-section already reaches `tr` cells along the axis, so
        // keying the notch to `s` declares a 3-step mouth and cuts a 5-step one.
        const dm = Math.hypot(Math.round(px) - plan.mouthX, Math.round(pz) - plan.mouthZ)
        for (let h = 0; h < cfg.headroom; h++) push(Math.round(px), floor + h, Math.round(pz), dm <= cfg.apronSteps)
      }
    }
  }
  return out
}

/**
 * Dig every adit that reaches into this column. Returns how many cells were opened.
 *
 * ⚠⚠ THE TUNNEL QUERY IS BATCHED ACROSS THE WHOLE SCAN BOX, AND THAT IS WHY THIS FUNCTION
 * ENUMERATES ITS ATTEMPTS BEFORE IT PLANS ANY OF THEM. Asked one at a time, `carveTopAt` re-walks
 * every carver in a 5x5 chunk box per attempt and took column generation from 288ms to 736ms per
 * four columns. Asked once for every anchor in this column, it walks them once. `carve.ts` states
 * the identical lesson about its own inner loop; this is the second place it applies.
 *
 * ★ IT COSTS THE CHEAP-FIRST ORDERING INSIDE `aditAt` AND THAT IS THE RIGHT TRADE. Batching means
 * every attempt gets a tunnel answer, including the ~90% the bank test would have refused — but
 * an extra point costs one box-rejected distance test, while an extra attempt used to cost a whole
 * walk. The ordering inside `aditAt` still stands for any caller that asks one at a time.
 */
export function digAdits(
  sections: (Section | null)[], ox: number, oy0: number, oz: number, size: number, seed: number,
  surfaceAt: (x: number, z: number) => number,
  seaLevel: number,
  carveTops: (pts: ReadonlyArray<{ x: number; z: number }>) => number[],
  cfg: AditConfig = DEFAULT_ADITS,
): number {
  const first = sections.find(Boolean)
  if (!first) return 0
  const c: Ctx = { sections, ox, oy0, oz, size, yTop: oy0 + sections.length * size }
  const rad = aditScanRadius(size, cfg)
  const c0x = Math.floor(ox / size), c0z = Math.floor(oz / size)

  const starts: AditStart[] = []
  for (let cz = c0z - rad; cz <= c0z + rad; cz++) {
    for (let cx = c0x - rad; cx <= c0x + rad; cx++) starts.push(...aditStartsAt(seed, cx, cz, size, cfg))
  }
  if (!starts.length) return 0
  const tops = carveTops(starts.map(st => ({ x: st.x, z: st.z })))
  const top = new Map<string, number>()
  for (let i = 0; i < starts.length; i++) top.set(`${starts[i].x},${starts[i].z}`, tops[i])
  const carveTop = (x: number, z: number) => top.get(`${x},${z}`) ?? -1

  let opened = 0
  for (const st of starts) {
    const plan = aditAt(st, surfaceAt, seaLevel, carveTop, cfg)
    if (!plan) continue
    for (const cell of aditCells(plan, cfg)) {
      if (dig(c, cell.x, cell.y, cell.z, surfaceAt(cell.x, cell.z), cfg.floorGuard, cell.apron)) opened++
    }
  }
  return opened
}
