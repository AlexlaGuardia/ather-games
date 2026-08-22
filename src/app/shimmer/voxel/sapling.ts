// Saplings — a tree you planted, on a clock.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// Alex, 2026-08-13, ruling the forestry loop: felled trees STAY felled, and the way a forest comes
// back is that you plant it. His three rules, verbatim: *"they grow after a certain time of being
// planted, have no blocks above them, and only plantable on dirt."* All three are here. Two of them
// were already law somewhere else in this folder and are REUSED rather than restated — that is the
// point of the file, not an implementation detail.
//
// ── ★ THE MATERIAL IS THE STATE, AND THE CLOCK IS THE ONE THING IT CANNOT HOLD ──────────────────
// Copied wholesale from `voxel3d/pot.ts`, which solved this exact shape for Mana Seeds: a sapling
// is a MATERIAL, so it survives a reload, an evict and a walk to the Outfields through the ordinary
// save diff with no new persistence layer. The single thing a material id cannot carry is WHEN it
// was planted, so that — and only that — is stored beside it.
//
// ⚠ ABSOLUTE STAMPS, NEVER COUNTDOWNS. `decay.ts` states the reason and it is the same one here:
// come back an hour later and the tree should be STANDING, because it grew while you were gone. A
// countdown pauses whenever the game is not running, which turns "plant a forest and come back
// tomorrow" into "plant a forest and watch it".
//
// ⚠ A MISSING STAMP READS AS *JUST PLANTED*, NEVER AS *NEVER* — pot.ts's rule, kept for pot.ts's
// reason. A keeper who loses a few minutes is annoyed; a keeper whose sapling can never grow has
// lost it with no way to find out why.

import { MAT, TURF } from './depth'
import { AIR } from './section'
import { SPECIES, crownAt, type TreeSpecies, type TreeStart } from './trees'
import { hash2 } from './noise'
import { morningsBetween } from './clock'

/**
 * How many MORNINGS a sapling needs.
 *
 * ── ★★ ALEX, 2026-08-22, watching one come up: *"they did grow (a bit fast tho; what if every
 * morning in-game we could have it grow.. so it takes three days for it to reach ful grown and
 * mineable)"* ─────────────────────────────────────────────────────────────────────────────────
 * This was elapsed milliseconds — goldwood in two real minutes — so planting a tree was a countdown
 * you stood next to rather than something you came back to. Counting dawns makes a planted tree a
 * thing the world does while you are away, which is the whole feel of the front door.
 *
 * ⚠ THE RARITY LADDER SURVIVES, IN DAYS, AND THE STEP IS MINE NOT ALEX'S. He gave one number —
 * three days — and it is goldwood's, the day-one tree. The old table scaled 2/5/9/15 minutes on a
 * stated reason (*"dawnwood is weight 4 and finding one is an event, so cultivating one is meant to
 * be a commitment"*), and flattening every species to three would have deleted that decision as a
 * side effect of honouring a different one. Carrying the old RATIOS across would have put dawnwood
 * at twenty-two days, which is not a cozy game — so the ladder is compressed to a single day per
 * rung. If the ladder should be flat at three, this table is the one line to change.
 *
 * ⚠ 64 REAL MINUTES TO THE IN-GAME DAY (`CYCLE_MS`), so goldwood is ~3.2 real hours and dawnwood
 * ~6.4. Both are "come back later", which is the point, and neither is "come back next week".
 */
export const GROW_DAYS: Record<string, number> = {
  goldwood: 3,
  shimmeroak: 4,
  starwillow: 5,
  dawnwood: 6,
}

/** Planting times by world position, `"x,y,z"` → epoch ms. Persisted beside the player save. */
export type SaplingClock = Record<string, number>

export const saplingKey = (x: number, y: number, z: number): string => `${x},${y},${z}`

/**
 * ★ THE ONE SET THAT SAYS WHAT A TREE MAY STAND ON — imported from the generator, never copied.
 *
 * `trees.ts` refuses to plant a wild trunk on anything but topsoil, and that refusal is what makes
 * woodland read as woodland instead of as noise on sand and stone. A sapling asking a second,
 * separately-maintained question is how a player ends up able to grow a forest on a beach that the
 * world itself would never put one on. One law, one place.
 */
// ⚠ THE SAME SET THE GENERATOR PLANTS ON (2026-08-19). A sapling rule that disagreed with the
// world's own planter is the worst kind of disagreement: the forest around you grew on this ground
// and your sapling refuses it, which reads as a broken item rather than a rule.
export const PLANTABLE_GROUND: ReadonlySet<number> = TURF

export type MaterialAt = (x: number, y: number, z: number) => number

/** Why a sapling is not growing right now. `null` from `blockedBy` means it may grow. */
export type Blocker = 'ground' | 'clearance' | 'sky' | 'time'

/**
 * The envelope a grown tree of this species will occupy, as offsets from the sapling's own cell.
 *
 * ★ DERIVED FROM `crownAt`, WHICH IS THE SHAPE THE TREE WILL ACTUALLY GROW INTO. This is the whole
 * reason the crown layout became a value earlier today. A hand-written "check N blocks up" constant
 * is a second description of a tree's size, and the moment anyone retunes `maxHeight` or a crown
 * radius it silently starts under-reserving — a dawnwood growing up through a floor the player
 * built, with nothing in the code that looks wrong.
 *
 * ⚠ THE TALLEST ROLL, NOT THE AVERAGE. Height is rolled at growth time and a sapling cannot know
 * which it will get, so the check reserves for `maxHeight`. Reserving for the mean would let a tall
 * roll punch through a ceiling that had been checked and approved.
 */
export function envelope(sp: TreeSpecies): { dx: number; dy: number; dz: number }[] {
  const out: { dx: number; dy: number; dz: number }[] = []
  // The trunk, at its tallest. `growTree` writes it from groundY + 1 upward, and a sapling stands on
  // that same cell — so offset 0 is the sapling itself and the trunk starts there.
  for (let i = 0; i < sp.maxHeight; i++) out.push({ dx: 0, dy: i, dz: 0 })

  // The crown, asked of the real function with a synthetic tallest start. `groundY = -1` puts
  // `baseY` at 0, so every offset comes back relative to the sapling's own cell.
  const start: TreeStart = { x: 0, z: 0, species: sp, height: sp.maxHeight, seed: 1 }
  const crown = crownAt(start, -1)
  if (crown) {
    for (const lo of crown.lobes) {
      const r = Math.ceil(lo.r)
      // The lobe is an ellipsoid; reserving its bounding box is deliberately generous. A sapling
      // that refuses to grow in a tight spot is a puzzle the player can solve by clearing more
      // room. A sapling that grows THROUGH their wall is a bug they will report as "trees eat
      // buildings", and the two are not equally bad.
      const ry = Math.ceil(lo.r / Math.sqrt(lo.squash))
      for (let dy = -ry; dy <= ry; dy++)
        for (let dz = -r; dz <= r; dz++)
          for (let dx = -r; dx <= r; dx++)
            out.push({ dx: crown.x + lo.dx + dx, dy: crown.y + lo.dy + dy, dz: crown.z + lo.dz + dz })
    }
  }
  return out
}

/**
 * May a sapling of this species be PLANTED at (x, y, z)? The cell itself must be free and the cell
 * below must be ground the world would plant on.
 *
 * ⚠ PLANTING IS DELIBERATELY LOOSER THAN GROWING. It checks ground and sky, not clearance. You are
 * allowed to plant somewhere cramped; the sapling simply waits until there is room. Refusing the
 * plant would mean a player clearing a forest cannot replant it until they have also cleared the
 * canopy of the trees still standing around them, which is exactly backwards.
 */
export function canPlant(at: MaterialAt, openToSky: (x: number, z: number, y: number) => boolean,
                         x: number, y: number, z: number): boolean {
  if (at(x, y, z) !== AIR) return false
  if (!PLANTABLE_GROUND.has(at(x, y - 1, z))) return false
  return openToSky(x, z, y)
}

/**
 * Why this sapling is not growing, or `null` if it is ready.
 *
 * ★★ EVERY CONDITION IS RE-CHECKED HERE, AT GROWTH TIME — not cached from planting time, and that
 * is the single most important line in this file. Alex's rule was "no blocks above them", and the
 * trap inside it is WHEN you ask. Check only at planting and the player plants a sapling, builds a
 * shed over it while it grows, and a dawnwood comes up through the roof — having passed a check
 * that was true four minutes ago. The world moves between planting and growing; the question has to
 * be asked against the world that exists at the moment the tree would appear.
 *
 * ⚠ AND A BLOCKED SAPLING WAITS. It does not die and it does not grow anyway. Killing it would be
 * the same failure one step later: a player loses a rare dawnwood sapling to a floor they laid, and
 * nothing in the game ever tells them that is what happened. Waiting is recoverable — clear the
 * space and it grows.
 */
export function blockedBy(
  clock: SaplingClock, at: MaterialAt, openToSky: (x: number, z: number, y: number) => boolean,
  sp: TreeSpecies, x: number, y: number, z: number, now: number,
): Blocker | null {
  if (!PLANTABLE_GROUND.has(at(x, y - 1, z))) return 'ground'
  if (!openToSky(x, z, y)) return 'sky'

  const planted = clock[saplingKey(x, y, z)]
  // A missing stamp is "planted now" (see the header), which means it is not yet due.
  if (planted === undefined
      || morningsBetween(planted, now) < (GROW_DAYS[sp.id] ?? GROW_DAYS.goldwood)) return 'time'

  for (const c of envelope(sp)) {
    // The sapling's own cell is the one thing in the envelope that is legitimately occupied — by
    // the sapling. Everything else has to be air or foliage the tree may grow through.
    if (c.dx === 0 && c.dy === 0 && c.dz === 0) continue
    const m = at(x + c.dx, y + c.dy, z + c.dz)
    if (m !== AIR) return 'clearance'
  }
  return null
}

/** 0..1 toward growing, for a HUD hint. Never gates the growth itself — `blockedBy` does. */
export function progress(clock: SaplingClock, sp: TreeSpecies, x: number, y: number, z: number, now: number): number {
  const at = clock[saplingKey(x, y, z)]
  if (at === undefined) return 0
  // ⚠ WHOLE MORNINGS, so this steps rather than creeps — and that is honest rather than coarse.
  // A smooth bar would tick upward all afternoon and then not grow the tree, because elapsed time is
  // no longer what growth is measured in. The bar has to count the same thing the gate counts.
  const t = morningsBetween(at, now) / (GROW_DAYS[sp.id] ?? GROW_DAYS.goldwood)
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/** The species a sapling item grows into. One sapling item per species — see the note in `drops`. */
export function speciesOf(id: string): TreeSpecies | null {
  return SPECIES.find(s => s.id === id) ?? null
}

/**
 * Sapling material per species, and its inverse.
 *
 * ★ THE MATERIAL CARRIES THE SPECIES, which is why there are four of them rather than one generic
 * sapling plus a record. The world alone then answers "what grows here" — the clock only ever has
 * to hold the one thing a material id cannot, which is WHEN. Lose the clock and you lose minutes;
 * lose a species sidecar and you have a sapling nobody can identify.
 */
export const SAPLING_MAT: Record<string, number> = {
  goldwood: MAT.SAPLING_GOLDWOOD,
  shimmeroak: MAT.SAPLING_SHIMMEROAK,
  starwillow: MAT.SAPLING_STARWILLOW,
  dawnwood: MAT.SAPLING_DAWNWOOD,
}

const BY_MAT = new Map<number, TreeSpecies>(
  SPECIES.filter(s => SAPLING_MAT[s.id] !== undefined).map(s => [SAPLING_MAT[s.id], s]),
)

/** Which species is this sapling block, or null if the material is not a sapling at all. */
export const saplingSpecies = (material: number): TreeSpecies | null => BY_MAT.get(material) ?? null

/** Is this material any sapling? One test the host can use without knowing the four ids. */
export const isSaplingMat = (material: number): boolean => BY_MAT.has(material)

/**
 * The height a planted sapling grows to.
 *
 * ⚠ ROLLED FROM POSITION, NOT FROM `Math.random`, so it is stable: the clearance check and the tree
 * that actually appears must agree about how tall it will be, and they run minutes apart. A random
 * roll at growth time could exceed the height the envelope reserved and put a crown through a
 * ceiling that had been checked and approved.
 */
export function plantedHeight(sp: TreeSpecies, x: number, z: number): number {
  const h = hash2(x, z, 0x5a71)
  return sp.minHeight + Math.floor(h * (sp.maxHeight - sp.minHeight + 1))
}
