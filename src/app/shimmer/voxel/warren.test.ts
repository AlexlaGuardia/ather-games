// Warren oracle — the descent under a ruin. Run: npx tsx src/app/shimmer/voxel/warren.test.ts
//
// ★ THE FAILURE MODES HERE ARE ALL SILENT AND MOST OF THEM ARE INVISIBLE FROM THE SURFACE, which
// is what makes an oracle worth more for this feature than for the ruin above it. A ruin that
// generates wrong is a thing you can SEE from a hilltop. A warren that generates wrong is under
// nine blocks of rock: a stair that ends in stone, a room whose ceiling broke daylight, a cache
// walled into solid brick, a far room sliced off at a cell seam. Every one of those looks like
// nothing at all from outside, and a player would report it as "the stairs go nowhere".
//
// ⚠⚠ EVERY WORLD ASSERT READS THROUGH THE REAL COLUMN PIPELINE (`makeColumn` + `placeSites`), not
// through `warrenPlan`. `ather-games` has paid for this lesson twice — the bridge oracle that
// called `bridgeVoxelAt` while the game reached it through `materialAt`, and the prebuilt worker
// vs source import. A plan-level assert here would be green while the shipped world discarded the
// warren entirely, because both halves would be internally consistent about different things.
//
// Each assert below was mutation-tested against the bug it is written for; the mutations are named
// in the comment above each block so the next reader can re-run them.

import { DEFAULT_SITES, siteAt, placeSites, SITE_REACH } from './sites'
import { RUIN_REACH } from './ruins'
import {
  DEFAULT_WARREN, WARREN_PIECES, WARREN_REACH, warrenPlan, hasDescent, warrenFloor, cacheCell,
  type WarrenPart,
} from './warren'
import { columnHeight } from './height'
import { MAT } from './depth'
import { AIR } from './section'
import { blockDef } from './registry'
// ⚠ A TEST MAY reach into the host: `purity.test.ts` scans `*.ts` and skips `*.test.ts`, so the
// port boundary binds the core and not its oracle. That is what lets this file check the render
// tables at all — and those tables are exactly where this feature was broken.
import { MATERIAL_COLOR, EMISSIVE } from '../voxel3d/attrs'
import { makeColumn, SECTION } from './column'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337

/** Every site in a slab of country, so the asserts run against real warrens and not a fixture. */
const sites = []
for (let cz = -60; cz <= 60; cz++) for (let cx = -60; cx <= 60; cx++) {
  const s = siteAt(SEED, cx, cz)
  if (s) sites.push(s)
}
const withDescent = sites.filter(s => hasDescent(s) && warrenPlan(s, SEED).length > 0)
ok(sites.length > 10, `found ruins to inspect (${sites.length})`)
// ⚠ AN EMPTY MEASUREMENT WINDOW CAN ONLY EVER RETURN ONE ANSWER. If no site in the slab has a
// warren, every assert below passes vacuously and the file reports green on a dead feature.
ok(withDescent.length > 5, `found warrens to inspect (${withDescent.length} of ${sites.length} ruins)`)

// ── 1. THE REACH INEQUALITY — a correctness bound shared with ruins ──────────────────────────
// Mutation: set `envelope: 50` in DEFAULT_WARREN → this fires. Without it a warren silently loses
// its outer rooms at cell seams, on one side only, identically on every load.
{
  ok(DEFAULT_SITES.separation * 16 > SITE_REACH + 1,
    `a warren can never leave its cell — separation ${DEFAULT_SITES.separation * 16} outreaches ${SITE_REACH}`)
  ok(SITE_REACH >= WARREN_REACH && SITE_REACH >= RUIN_REACH,
    `the column clip covers BOTH structures (site ${SITE_REACH}, ruin ${RUIN_REACH}, warren ${WARREN_REACH})`)
  ok(WARREN_PIECES.every(p => p.w % 2 === 1 && p.d % 2 === 1),
    'every warren piece has odd extents — an even edge has no midpoint for a socket to sit on')
  ok(WARREN_PIECES.some(p => p.terminal) && WARREN_PIECES.some(p => !p.terminal),
    'both pools exist — an empty terminator pool leaves every deep branch hanging')
}

// ── 2. DETERMINISM — the plan is a pure function of the site, from any column, forever ────────
// Mutation: key any roll in `warrenPlan` on a counter instead of the socket's world position.
{
  const sig = (parts: WarrenPart[]) => parts.map(p => `${p.def.id}@${p.x0},${p.z0},${p.x1},${p.z1},${p.floor}`).join('|')
  let checked = 0
  for (const s of withDescent.slice(0, 20)) {
    ok(sig(warrenPlan(s, SEED)) === sig(warrenPlan(s, SEED)), `the same site digs the same warren (${s.x},${s.z})`)
    checked++
  }
  ok(checked > 5, `determinism checked on ${checked} warrens`)
}

// ── 3. THE DESCENT IS RARE BUT REAL, AND THE ROLL IS INDEPENDENT OF THE RUIN'S ───────────────
// ⚠ THE SECOND HALF IS THE ONE THAT MATTERS. A descent roll that shared a salt with `ruinPlan`
// would correlate the two layouts, and nothing on the ground would say so.
// Mutation: change `hasDescent`'s salt to `0x57a7` (the start-piece salt) → the share skews.
{
  const share = sites.filter(s => hasDescent(s)).length / sites.length
  ok(share > 0.15 && share < 0.55, `descents are a minority of ruins, not all or none (${(share * 100).toFixed(1)}%)`)
  // A warren must be able to FAIL to exist for reasons other than the roll — thin ground.
  const rolled = sites.filter(s => hasDescent(s))
  ok(rolled.length > withDescent.length - rolled.length - 1, 'the roll, not the terrain, is the main gate')
}

// ── 4. ⚠⚠ THE COVER RULE, READ OUT OF THE REAL WORLD ─────────────────────────────────────────
// The claim: no warren room ever breaks the surface. This is the assert whose absence would ship a
// hole in a hillside with a staircase visible from outside.
// ★ IT ASSERTS THE AFFORDANCE, NOT THE MEMBERSHIP: it does not ask "did the ground rule return
// non-null", it asks the GENERATED surface how much rock is actually over each room.
//
// ⚠⚠ THE FIRST VERSION OF THIS BLOCK WAS BLIND AND IT IS THE MOST INSTRUCTIVE MISS IN THE FILE.
// It compared the surface against `top + DEFAULT_WARREN.cover` — the SAME CONSTANT the generator
// reads. So setting `cover: 0` moved the code and the assert together, and the mutation that
// opens every warren to the sky passed 53/53 clean. **A guard keyed on the value it is guarding
// cannot fail.** The fix is a threshold this file owns outright: whatever `cover` is tuned to,
// there must be at least ONE solid block over a ceiling, because zero is a hole in a hillside.
// The configured cover is then checked separately, and going red there is a tuning question
// rather than a correctness one.
const HARD_MIN_COVER = 1
{
  let rooms = 0, breached = 0, underCfg = 0
  for (const s of withDescent) {
    for (const p of warrenPlan(s, SEED)) {
      rooms++
      const top = p.floor + p.def.h + 1
      let worstCover = Infinity
      for (let z = p.z0; z <= p.z1; z++) {
        for (let x = p.x0; x <= p.x1; x++) worstCover = Math.min(worstCover, columnHeight(x, z, SEED) - top)
      }
      if (worstCover < HARD_MIN_COVER) breached++
      if (worstCover < DEFAULT_WARREN.cover) underCfg++
    }
  }
  ok(rooms > 20, `cover checked over ${rooms} rooms`)
  ok(breached === 0, `every room keeps rock overhead — ${breached} of ${rooms} came within ${HARD_MIN_COVER} of the surface`)
  ok(underCfg === 0, `every room clears the configured cover of ${DEFAULT_WARREN.cover} (${underCfg} did not)`)
}

// ── 5. NO ROOM GROWS THROUGH ANOTHER, AND NONE LEAVES THE ENVELOPE ───────────────────────────
// Mutation: delete the AABB-reject in `jigsaw.ts` → overlaps appear immediately.
{
  let overlaps = 0, escaped = 0, checkedParts = 0
  for (const s of withDescent) {
    const parts = warrenPlan(s, SEED)
    for (let i = 0; i < parts.length; i++) {
      const a = parts[i]!
      checkedParts++
      if (Math.abs(a.x0 - s.x) > WARREN_REACH || Math.abs(a.x1 - s.x) > WARREN_REACH ||
          Math.abs(a.z0 - s.z) > WARREN_REACH || Math.abs(a.z1 - s.z) > WARREN_REACH) escaped++
      for (let j = i + 1; j < parts.length; j++) {
        const b = parts[j]!
        if (a.x0 + 1 <= b.x1 - 1 && b.x0 + 1 <= a.x1 - 1 && a.z0 + 1 <= b.z1 - 1 && b.z0 + 1 <= a.z1 - 1) overlaps++
      }
    }
  }
  ok(checkedParts > 20, `${checkedParts} rooms checked for overlap and escape`)
  ok(overlaps === 0, `no room is grown through another (${overlaps})`)
  ok(escaped === 0, `no room leaves the envelope (${escaped})`)
}

// ── 6. THE CACHE — one per warren, in a room, and never the landing room ─────────────────────
// ⚠ AND ONE HONEST NOTE: starting `cacheCell`'s scan at index 0 instead of 1 is an INERT mutation,
// not a caught one. `parts[0]` sits AT the site centre by construction, so its distance is 0 and a
// max-distance scan can never choose it while any other room exists. The `i = 1` is belt and
// braces. Recording that here rather than claiming a kill: a mutation that changes no behaviour
// proves nothing about the guard, and banking it as a pass is how a blind assert survives a sweep.
{
  let placed = 0, atShaft = 0, outside = 0
  for (const s of withDescent) {
    const parts = warrenPlan(s, SEED)
    const c = cacheCell(parts, s)
    if (!c) continue
    placed++
    const host = parts.find(p => p.x0 <= c.x && c.x <= p.x1 && p.z0 <= c.z && c.z <= p.z1)
    if (!host) { outside++; continue }
    if (host === parts[0]) atShaft++
  }
  ok(placed > 5, `${placed} warrens hold a cache`)
  ok(outside === 0, `every cache sits inside a room (${outside} did not)`)
  ok(atShaft === 0, `no cache is in the room the stairs land in (${atShaft} were)`)
}

// ── 7. ⚠⚠ THE WORLD ASSERT — read the shipped voxels through the real pipeline ────────────────
// Everything above reasons about a PLAN. This reasons about what `placeSites` actually wrote, in
// world coordinates, out of a column built by `makeColumn` — the same door the game comes through.
//
// ⚠⚠ AND THE SEALED-ROOM CHECK READS MANY WARRENS, NOT ONE, BECAUSE ONE WENT BLIND. It sampled a
// single hand-picked subject until 2026-09-05. Widening `run` to w5 changed that subject's layout so
// it no longer contained a wall-into-interior collision — and the mutation that collapses the two
// build passes, which had fired at w3, **passed 60/60 clean**. The guard had not been fixed and the
// bug had not gone away: the sample simply stopped containing the phenomenon. A structural claim
// about a generator cannot rest on one seed's worth of output, and a guard whose power depends on
// which warren you happened to pick goes quiet on a tuning change and says nothing about it.
//
// Mutation A: cut the shaft BEFORE the rooms in `buildWarren` → the landing assert dies.
// Mutation B: drop `buildWarren` from `placeSites` → every count here goes to zero.
// Mutation C: collapse the two passes back into one → the sealed-room assert fires (36 cells).
//
// ⚠⚠ AND ONE MUTATION THIS BLOCK CANNOT SEE, RECORDED RATHER THAN HIDDEN: swapping `SITE_REACH`
// back to `RUIN_REACH` in `placeSites` PASSES CLEAN. Measured over the 121×121-cell slab: 214
// warrens, and the furthest any part sits from its site centre is **21 blocks** — inside
// `RUIN_REACH` (22), so the wider clip is not currently load-bearing and no world read can tell
// the two apart. That does not make `SITE_REACH` wrong; `envelope` is a BOUND (30) and the
// observed 21 is a consequence of `maxPieces: 12` and `sizeBias`, both of which are taste knobs
// somebody will raise. The clip is defensive against that day.
// ★ SO THE GUARD ASSERTS THE INVARIANT INSTEAD OF THE SYMPTOM (§9): every part of every warren
// must lie within the radius the clip actually uses. That one CAN fail — it goes red the moment
// the pool outgrows the clip, which is the event, rather than waiting for someone to notice a
// missing room, which is the symptom.
{
  const world = new Map<string, ReturnType<typeof makeColumn>>()
  const at = (x: number, y: number, z: number): number => {
    const cx = Math.floor(x / SECTION), cz = Math.floor(z / SECTION)
    const k = `${cx},${cz}`
    let col = world.get(k)
    if (!col) {
      const ox = cx * SECTION, oz = cz * SECTION
      col = makeColumn(ox, oz, SEED)
      placeSites(col.sections, ox, 0, oz, SECTION, SEED)
      world.set(k, col)
    }
    return col.get(x - cx * SECTION, y, z - cz * SECTION)
  }

  // One warren, walked in full. Picked as the first with several rooms so the walk is worth taking.
  const subject = withDescent.find(s => warrenPlan(s, SEED).length >= 4) ?? withDescent[0]!
  const parts = warrenPlan(subject, SEED)
  const floor = warrenFloor(subject)!

  // 7a. THE STAIR IS WALKABLE END TO END — the affordance, not the block list. At every level of
  // the shaft there is exactly one cell you can stand on with headroom, and the drop from one to
  // the next is a step, never a fall.
  let treads = 0, badRise = 0
  type Cell = { x: number; z: number }
  let prev: Cell | null = null
  for (let y = subject.floor; y > floor; y--) {
    const stood: Cell[] = []
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = subject.x + dx, z = subject.z + dz
      if (at(x, y, z) !== AIR && at(x, y + 1, z) === AIR && at(x, y + 2, z) === AIR) stood.push({ x, z })
    }
    // The newel is solid at every level and is not a tread — a tread is a solid cell you can stand
    // on, and the centre post has the step beside it, so both read as standable. One of them is
    // adjacent to the previous tread; that is the one the keeper actually walks.
    if (stood.length) {
      treads++
      const from = prev as Cell | null
      const next: Cell | undefined =
        from ? stood.find(c => Math.abs(c.x - from.x) + Math.abs(c.z - from.z) <= 2) : stood[0]
      if (!next) badRise++
      else prev = next
    }
  }
  ok(treads >= DEFAULT_WARREN.depth - 2, `the shaft has a tread at nearly every level (${treads} over ${DEFAULT_WARREN.depth})`)
  ok(badRise === 0, `every tread is a step from the one above it, never a fall (${badRise} breaks)`)

  // 7b. THE LANDING IS OPEN — the stairs end in air inside the first room, not in stone. This is
  // the assert that catches the rooms-then-shaft ordering being reversed.
  ok(at(subject.x, floor + 1, subject.z) === AIR || at(subject.x, floor + 2, subject.z) === AIR,
    'the stairs land in open air, not sealed under the landing room ceiling')

  // 7c. ⚠⚠ THE ROOMS ARE HOLLOW IN THE SHIPPED WORLD — and this assert reads a VOLUME, not a cell.
  //
  // ★ IT WAS A SINGLE CENTRE SAMPLE FIRST, AND THAT WAS THE WRONG INSTRUMENT IN BOTH DIRECTIONS.
  // It reported three rooms solid: two were the assert sampling the newel and the cache, which are
  // supposed to be there — a false alarm — and the third was a REAL sealed room, 12 of its 21
  // interior cells filled by a neighbouring vault's wall. One cell cannot tell those apart, and a
  // room that is 40% brick reads as perfectly hollow if the one cell you look at happens to be air.
  // So: count every interior cell, and allow only the two occupants that are meant to be solid.
  //
  // ⛔ THE TEMPTING FIX WAS TO SKIP THE SHAFT ROOM AND THE CACHE ROOM. That is the cheapest thing
  // that turns this green and it would have hidden the real defect completely, since the sealed
  // room was neither of them.
  let solidCells = 0, interiorCells = 0, warrensRead = 0
  const worst: string[] = []
  // ★ A POPULATION, NOT A SPECIMEN. Enough warrens that a collision somewhere in the set is near
  // certain, few enough that building their columns stays well inside the suite's budget.
  for (const subj of withDescent.slice(0, 8)) {
   const subjParts = warrenPlan(subj, SEED)
   const subjFloor = warrenFloor(subj)!
   const subjCache = cacheCell(subjParts, subj)
   warrensRead++
   for (const p of subjParts) {
    for (let z = p.z0 + 1; z <= p.z1 - 1; z++) {
      for (let x = p.x0 + 1; x <= p.x1 - 1; x++) {
        for (let y = p.floor + 1; y <= p.floor + p.def.h; y++) {
          interiorCells++
          if (at(x, y, z) === AIR) continue
          // The things allowed to stand inside a room: the STAIR, and the cache itself.
          //
          // ⚠ THE STAIR GREW INTO THE ROOM WHEN THE CORRIDOR WIDENED, and that is architecture, not
          // a regression. At `run` w3 a corridor's interior was a SINGLE column — the newel — so the
          // spiral's treads landed in the wall and this assert never saw them. At w5 the interior is
          // three wide, so the bottom three steps are genuinely inside the landing room, which is
          // what a staircase descending into a room looks like. Measured before it was excluded:
          // three cells, all MOSSY_CUT_STONE, all inside the 3×3 at descending heights — the steps.
          //
          // ★ THE EXCLUSION IS THE STAIR'S EXACT DOMAIN, not the whole column. `buildWarren` writes
          // the 3×3 only between `floor + 1` and the ruin floor, so a solid cell there is a tread or
          // the newel and nothing else. Excluding the column at ALL heights would hide a real seal
          // in the busiest part of the warren — the room everyone arrives in.
          // ⛔ And the tempting fix was `solidCells <= 3`, which would swallow a genuinely sealed
          // room forever to buy three cells of convenience. Name what is allowed to be there.
          const inStair = Math.abs(x - subj.x) <= 1 && Math.abs(z - subj.z) <= 1
            && y >= subjFloor + 1 && y <= subj.floor
          const isCache = !!subjCache && x === subjCache.x && y === subjCache.y && z === subjCache.z
          if (!inStair && !isCache) {
            solidCells++
            if (worst.length < 5) worst.push(`${p.def.id}@${x},${y},${z} mat=${at(x, y, z)}`)
          }
        }
      }
    }
   }
  }
  ok(warrensRead >= 5, `the sealed-room check read ${warrensRead} warrens, not one`)
  ok(interiorCells > 1000, `${interiorCells} interior cells read out of the built world`)
  ok(solidCells === 0,
    `no room is sealed by a neighbour's wall — ${solidCells} of ${interiorCells} interior cells were solid${worst.length ? ' — ' + worst.join(', ') : ''}`)

  // 7d. THE CACHE IS IN THE WORLD, in air, reachable — not walled into brick.
  const c = cacheCell(parts, subject)
  ok(c !== null, 'this warren has a cache')
  if (c) {
    ok(at(c.x, c.y, c.z) === MAT.CACHE, `the cache is written into the world at ${c.x},${c.y},${c.z}`)
    ok(at(c.x, c.y + 1, c.z) === AIR, 'there is standing room over the cache — it can be reached and broken')
  }
}

// ── 8. CANON GUARDS — the ruling this feature implements, asserted so it cannot drift back ────
// ⚠ THESE ARE NOT STYLE ASSERTS. Each pins a sentence from `shimmer-casting-vessels.md` › THE
// THREE ROADS that the build could silently violate later without anything else going red.
// Mutation: give the cache row `drops` or `placeable: true` → fires. Set it to MAT.CHEST → fires.
{
  const def = blockDef(MAT.CACHE)
  ok(!!def, 'the cache is a registered block')
  // ⚠⚠ `MAT.CACHE !== MAT.CHEST` STOOD HERE AND TSC REJECTED IT OUTRIGHT: *types '86' and '30' have
  // no overlap*. Both are `as const` literals, so the compiler PROVES the comparison — it can never
  // be false, and an assert that cannot fail is decoration. It read as the sharpest canon guard in
  // the file. The compiler caught what a reader would not have.
  //
  // ★ WHAT CAN ACTUALLY GO WRONG is an id COLLISION — the next material appended to `MAT` reusing
  // 86 — and a NAME collision, which is the half canon actually rules: *"a lootable container
  // sharing that noun would be two things wearing one label."* Both of those have an input that
  // makes them fire.
  const ids = Object.entries(MAT).filter(([, v]) => v === MAT.CACHE).map(([k]) => k)
  ok(ids.length === 1, `the cache's material id is its own — ${ids.join(', ')} share ${MAT.CACHE}`)
  ok(!/chest/i.test(blockDef(MAT.CACHE)!.name),
    'a cache is not called a chest — canon: "two things wearing one label"')
  ok(blockDef(MAT.CHEST)!.name !== blockDef(MAT.CACHE)!.name,
    'the chest and the cache are separate objects with separate names')
  ok(def!.drops.length === 0,
    'the cache has no static drops — WHICH vessel, at what tier, cut for which word is a per-keeper question')
  ok(def!.placeable !== true, 'a cache is not furniture — it is a thing that was left somewhere once')
  ok((def!.emit ?? 0) > 0,
    'the cache emits — in a warren with no sky channel it is the only lit thing, and that is how it is found')
}

// ── 10. ⚠⚠ THE RENDER TABLES — TWO OF THEM, AND `emit` IS IN NEITHER ─────────────────────────
// ★ THIS BLOCK EXISTS BECAUSE THE FEATURE WAS ALREADY WRONG WHEN IT WAS WRITTEN. `registry.emit`
// drives `light.ts`'s block-light BFS and nothing else; what a block LOOKS like comes from two
// separate tables in `voxel3d/attrs.ts`, and the cache had a row in neither. The proof that these
// are genuinely independent is in the tree: `MAT.WAYMARK` has `emit: 7` and no `EMISSIVE` row, so
// it lights the ground around it while looking like ordinary stone. Correct for a landmark.
//
// For the cache it would have shipped the design inverted: a 6-block pool of light in a black
// corridor with a plain grey cube at the centre of it — light with nothing to walk towards, which
// reads as a lighting bug rather than as a find. The whole feature is "the cache is the only lit
// thing down there", and two of the three tables that make that true are not the one the registry
// owns.
//
// ⚠ AND THE EXISTING PALETTE GUARD COULD NOT HAVE CAUGHT IT: `break-fx-spec.test.ts` asserts chip
// colours agree with `MATERIAL_COLOR` only `if (c !== undefined)` — a missing colour is EXEMPT, so
// coverage is exactly the case it does not check. Same shape as every exemption in PATTERNS: a
// silent promise that somebody is watching that corner.
// Mutation: delete either `attrs.ts` row → the matching assert fires.
{
  ok(MATERIAL_COLOR[MAT.CACHE] !== undefined,
    'the cache has a colour — an unmapped material renders as the loud magenta fallback')
  ok(MATERIAL_COLOR[MAT.CACHE] !== 0xff00ff, 'and it is not the fallback itself')
  ok((EMISSIVE[MAT.CACHE] ?? 0) > 0,
    '★ the cache READS as self-lit, not merely as a light source — see the note above')
  ok((EMISSIVE[MAT.CACHE] ?? 0) < (EMISSIVE[MAT.MANA_LANTERN] ?? 1),
    'and it stays under the lantern — a cache is a thing you glimpse and go to, not the light you carry')
}

// ── 9. ⚠⚠ THE CLIP COVERS THE STRUCTURE — asserted as a relationship, not observed as a slice ─
// See the note in §7. `placeSites` skips any site whose structures cannot reach the column being
// built, so a clip radius smaller than a warren's true extent drops its outer rooms silently, on
// one side only, identically on every load, and invisibly from the surface.
// Mutation: raise `maxPieces` to 40 in DEFAULT_WARREN → warrens grow past the clip and this fires.
{
  let worst = 0, worstAt = ''
  for (const s of withDescent) {
    for (const p of warrenPlan(s, SEED)) {
      const d = Math.max(Math.abs(p.x0 - s.x), Math.abs(p.x1 - s.x), Math.abs(p.z0 - s.z), Math.abs(p.z1 - s.z))
      if (d > worst) { worst = d; worstAt = `${s.x},${s.z}` }
    }
  }
  ok(worst > 0, `warren reach measured over ${withDescent.length} warrens`)
  // ⚠⚠ `worst <= SITE_REACH` STOOD HERE AND COULD NOT FAIL. `assemble` rejects any box outside
  // `origin ± envelope` before the ground rule ever runs, and `SITE_REACH` is DERIVED from that
  // same envelope — so the inequality is true by construction and `maxPieces: 40` passed it clean.
  // It read like the strongest assert in the file and was decoration. (PATTERNS: *ask of any
  // assert whether there is an input that makes it fire*.)
  //
  // ★ WHAT CAN ACTUALLY FAIL IS THE DERIVATION GOING AWAY. The clip is only safe because
  // `SITE_REACH` is computed from both envelopes rather than written down beside them; a literal
  // would be correct the day it was typed and silently wrong the first time either envelope moved.
  // So this asserts the derivation, not the value — the event, not the symptom.
  ok(SITE_REACH === Math.max(RUIN_REACH, WARREN_REACH),
    `the clip radius is DERIVED from both envelopes, never written down (${SITE_REACH})`)
  ok(worst <= WARREN_REACH, `no warren exceeds its own declared envelope (${worst} <= ${WARREN_REACH})`)
  console.log(`   ℹ furthest warren room: ${worst} blocks at ${worstAt}, against an envelope of ${WARREN_REACH}`)
}

if (fails.length) {
  console.error(`❌ ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 12)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ there is something down there — ${pass} passed`)
