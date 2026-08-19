// Terrain slump oracle. Run: npx tsx src/app/shimmer/voxel/slump.test.ts
//
// The claim under test is Alex's ruling — GARDEN STROLLS, WILDS CLAMBER — plus the safety property
// that makes it shippable: slump may never turn a walkable rise into a vault, and never deepen a
// wall. (Not "never grow a rise" — see § 2, which measured why.) These asserts are written to fail
// on the SHAPE of the regressions, not on their symptoms:
//
//   · someone "improving" the lip rule to slump any column with a lower neighbour (dropping the
//     nothing-higher clause) — caught by the § 2 sweep, which is the reason that clause exists at
//     all: it turns a 2-block wall into 2.5 and puts it out of mantle range;
//   · someone hard-thresholding the strength so zone edges get a visible ring of harder ground —
//     caught by the fringe-mixture assert;
//   · someone letting the wilds soften "so low-level keepers aren't walled out" — the same
//     player-relative pressure `mist-difficulty.ts` documents, caught by the wild-country assert;
//   · a half cell under something standing on it (a trunk, a wall, a placed block) — the floating
//     half-block, caught directly against a generated column.

import { columnHeight } from './height'
import { slumpStrength, slumpAllowed, isLip, slumpMask } from './slump'
import { ZONE_ANCHORS } from './zones'
import { blockDef, materialForItem } from './registry'
import { greedyMesh, halfKey } from './greedy'
import { Section } from './section'
import { dropsFor } from './mine'
import { makeColumn, isHalfCell, meshColumn, SECTION } from './column'
import { MAT, isPlant, isHalfMat, isTopSlab, baseOf, HALF_BIT, TOP_BIT } from './depth'
import { AIR } from './section'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const h = (x: number, z: number) => columnHeight(x, z, SEED)

/**
 * ── ★ THE TENDED SAMPLE ORIGIN, AND WHY IT IS NOT THE GARDEN ANCHOR (moved 2026-08-19) ──────────
 * Three sections below sample "tended country with slumped lips in it" and all three used the
 * `garden` anchor at (0, 0). That anchor is now entirely INSIDE the home plot — the fold starts at
 * a 300-block radius and the whole 4×4 and 8×8 chunk sweeps land in plot geometry, which is built
 * by `plot-column.ts` and never slumps. Measured: **0 lips at the garden anchor, 356 at Moonwell
 * Glade**, and every other tended zone in the hundreds.
 *
 * ⚠ THIS WAS ALREADY BROKEN BEFORE THE CHARACTER LAYER — verified by running this oracle against
 * the pre-change tree, where it crashes identically. The sections were not measuring a weaker
 * version of the claim, they were measuring the wrong PLACE, and the crash they finally produced
 * was `dropsFor(undefined)` rather than a failed assert, which is why it read as a broken test
 * rather than as a broken world. **A test whose fixture silently moved out from under it asserts
 * nothing, and reports that as a pass right up until it reports it as a crash.**
 *
 * Moonwell Glade is the substitute for a reason: `tended: 1` like the garden, a ruled zone rather
 * than a patch of wild country, and 640 blocks out — comfortably clear of any plot radius Greg can
 * upgrade to (canon tops out around 500).
 */
const TENDED = ZONE_ANCHORS.find(a => a.id === 'moonwell-glade')!

// ── 1. the lip rule, stated directly ────────────────────────────────────────────────────────────
{
  ok(isLip(11, 10, 11, 11, 11), 'a lip one above its neighbour slumps')
  ok(!isLip(11, 11, 11, 11, 11), 'flat ground has nothing to slump')
  ok(!isLip(11, 10, 12, 11, 11), '★ a column with anything higher beside it never slumps')
  ok(!isLip(13, 11, 13, 13, 13), 'a 2-block wall is not a lip — slump does not touch cliffs')
  ok(isLip(11, 10, 11, 9, 11), 'a lip above two different drops still slumps')
}

// ── 2. ★ NEVER WORSEN — the safety property, over real generated country ────────────────────────
// Every 4-neighbour pair in a big tended sample: the rise between them after slump must be no
// larger than it was before. This is the assert the nothing-higher clause exists to satisfy, and
// it is checked over the terrain rather than argued from the rule.
{
  const garden = ZONE_ANCHORS.find(a => a.id === 'garden')!
  const N = 220
  const hs = new Int32Array(N * N)
  const sl = new Uint8Array(N * N)
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) hs[z * N + x] = h(garden.x + x, garden.z + z)
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    const i = z * N + x
    if (isLip(hs[i], hs[i - 1], hs[i + 1], hs[i - N], hs[i + N])
      && slumpAllowed(garden.x + x, garden.z + z, SEED)) sl[i] = 1
  }
  // Ground top: h + 1 (materialAt is solid for y <= h), less half a voxel where it slumps.
  const top = (i: number) => hs[i] + 1 - (sl[i] ? 0.5 : 0)

  // ★ THE PROPERTY IS NOT "NEVER LARGER" — IT IS "NEVER UNWALKABLE" (measured 2026-08-11).
  // The first cut of this assert demanded no rise ever grow, and it failed on 11797 pairs. Every
  // one of them was the SAME transition, 0 → 0.5: the flat ground behind a slumped lip, now half a
  // voxel above it. That is the feature's own signature — the terrace edge wearing down — and it
  // costs the player exactly nothing, because locomotion auto-steps anything ≤ 0.5. So the two
  // asserts below say what the design actually guarantees, and the third pins the 0 → 0.5 lip as
  // the ONLY way slump is ever allowed to grow a rise. Loosening these back to a single
  // "never larger" is how the nothing-higher clause gets deleted as dead weight.
  let strollToVault = 0, deepened = 0, otherGrowth = 0, softened = 0, wholeBefore = 0, wholeAfter = 0
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    const i = z * N + x
    for (const j of [i + 1, i + N]) {
      const before = Math.abs((hs[i] + 1) - (hs[j] + 1))
      const after = Math.abs(top(i) - top(j))
      if (before <= 0.5 + 1e-9 && after > 0.5 + 1e-9) strollToVault++
      if (before > 0.5 + 1e-9 && after > before + 1e-9) deepened++
      if (after > before + 1e-9 && !(before === 0 && Math.abs(after - 0.5) < 1e-9)) otherGrowth++
      if (after < before - 1e-9) softened++
      // A rise the walker must vault: locomotion steps <= 0.5 and blocks anything above it.
      if (before > 0.5 + 1e-9) wholeBefore++
      if (after > 0.5 + 1e-9) wholeAfter++
    }
  }
  ok(strollToVault === 0, `★ slump never turns a walkable rise into a vault (${strollToVault})`)
  ok(deepened === 0, `★ slump never deepens a wall — the nothing-higher clause (${deepened})`)
  ok(otherGrowth === 0, `the only rise slump grows is the lip itself, 0 → 0.5 (${otherGrowth} others)`)
  ok(softened > 0, `slump actually softens the garden (${softened} pairs)`)
  ok(wholeAfter < wholeBefore, `vaults in the garden fall (${wholeBefore} → ${wholeAfter})`)
  // The headline: most of what the rounding invented is gone. Bound is wide — this is a build
  // number over one seed's country, not a canon claim.
  const cut = 1 - wholeAfter / wholeBefore
  ok(cut > 0.3, `★ GARDEN STROLLS: ${(cut * 100).toFixed(1)}% of the garden's vaults removed`)
}

// ── 3. ★ WILDS CLAMBER — untended country keeps every whole step it has ─────────────────────────
{
  let allowed = 0, sampled = 0
  for (let z = -600; z <= 600; z += 37) for (let x = 4200; x <= 5600; x += 37) {
    // Deliberately far from every anchor: wild country, no zone membership at all.
    if (slumpStrength(x, z, SEED) > 0) continue
    sampled++
    if (slumpAllowed(x, z, SEED)) allowed++
  }
  ok(sampled > 100 && allowed === 0, `★ wild country never softens (${allowed}/${sampled})`)

  const wild = slumpMask(4800, 900, SECTION, SEED, h)
  ok(wild.mask.every(v => v === 0), 'a wild column carries no slump at all')
}

// ── 4. strength rides tended, and the zone edge FRAYS rather than ringing ───────────────────────
{
  const garden = ZONE_ANCHORS.find(a => a.id === 'garden')!
  const out = ZONE_ANCHORS.find(a => a.id === 'the-outfields')!
  ok(slumpStrength(garden.x, garden.z, SEED) > 0.95, 'the tended heart is fully soft')
  // The Outfields are the frayed edge (tended 0.45) — soft in patches, never wholly one or other.
  let soft = 0, hard = 0
  for (let z = -300; z <= 300; z += 23) for (let x = -300; x <= 300; x += 23) {
    (slumpAllowed(out.x + x, out.z + z, SEED) ? () => soft++ : () => hard++)()
  }
  ok(soft > 0 && hard > 0, `★ the Outfields fray: ${soft} soft / ${hard} hard, never a clean ring`)
  const frac = soft / (soft + hard)
  ok(frac > 0.2 && frac < 0.75, `Outfields softness tracks tended 0.45 (${frac.toFixed(2)})`)

  // The fringe of a fully-tended zone must MIX rather than step: sample a band across the garden's
  // edge and demand both answers inside it. A hard threshold on t*tended would give a clean split.
  let mixed = 0, bands = 0
  for (let ang = 0; ang < 8; ang++) {
    const dx = Math.cos(ang), dz = Math.sin(ang)
    let s = 0, hh = 0
    // The fringe proper: membership runs 1 → 0 across d = 1 .. 1 + EDGE_BAND, so this band is where
    // a hard threshold WOULD draw its ring. Sampling shallower (0.82..1.12) only reaches t ≈ 0.66,
    // where a dithered gate is legitimately soft nearly everywhere — that measured 4/8 and was the
    // assert being wrong about where to look, not the dither failing.
    for (let r = 0.98; r <= 1.36; r += 0.02) {
      const x = Math.round(garden.x + dx * garden.rx * r), z = Math.round(garden.z + dz * garden.rz * r)
      slumpAllowed(x, z, SEED) ? s++ : hh++
    }
    bands++
    if (s > 0 && hh > 0) mixed++
  }
  ok(mixed >= bands - 1, `★ zone edges fray, not step (${mixed}/${bands} radials mix)`)
}

// ── 5. the half cell agrees with the world it sits in ───────────────────────────────────────────
{
  const garden = TENDED
  const gx = Math.floor(garden.x / SECTION) * SECTION, gz = Math.floor(garden.z / SECTION) * SECTION
  let found = 0, buried = 0, offSurface = 0, hollow = 0
  for (let cz = 0; cz < 8; cz++) {
    for (let cx = 0; cx < 8; cx++) {
      const col = makeColumn(gx + cx * SECTION, gz + cz * SECTION, SEED)
      for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
        const s = col.heightAt(x, z)
        for (let y = 0; y < 256; y++) {
          if (!isHalfCell(col, x, y, z)) continue
          found++
          if (y !== s) offSurface++
          if (col.get(x, y, z) === AIR) hollow++
          // Ground cover is the ONE thing allowed to stand on a lip: a plant is non-solid and the
          // renderer stands it on the ground top, so it neither floats nor cancels the lip. Anything
          // SOLID above must still restore full height — that is what this assert protects.
          if (!(col.get(x, y + 1, z) === AIR || isPlant(col.get(x, y + 1, z)))) buried++
        }
      }
    }
  }
  ok(found > 0, `the generated garden really carries half cells (${found})`)
  ok(offSurface === 0, 'a half cell is only ever the generated surface voxel')
  ok(hollow === 0, 'a half cell is never air')
  ok(buried === 0, '★ nothing SOLID ever stands on a half cell — trunks and walls restore full height')
}

// ── 6. slump never touches water's edge ─────────────────────────────────────────────────────────
// A bank that softened below its waterline would leak a standing water face — the exact failure
// the river system spent three models killing. The AIR-above clause is what prevents it; assert it
// against real river country rather than trusting the reading.
{
  let wet = 0
  for (let cz = 0; cz < 6; cz++) for (let cx = 0; cx < 6; cx++) {
    const col = makeColumn(cx * SECTION, -700 + cz * SECTION, SEED)
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      const y = col.heightAt(x, z)
      if (isHalfCell(col, x, y, z) && col.get(x, y + 1, z) === MAT.WATER) wet++
    }
  }
  ok(wet === 0, '★ no half cell under water — banks keep their full height at the waterline')
}

// ── 7. ★ THE MESH AGREES WITH THE COLLISION — the half pass, drawn ─────────────────────────────
// The riskiest half of this feature: a lip the walker steps onto but the mesher drew as a full
// cube is a wall you can see and walk through. Mesh real garden columns and check the geometry
// itself — that half cells produce a surface at exactly +0.5, and that NOTHING is drawn in the
// upper half of a cell the walker treats as empty.
{
  const garden = TENDED
  const gx = Math.floor(garden.x / SECTION) * SECTION, gz = Math.floor(garden.z / SECTION) * SECTION
  const cols = new Map<string, ReturnType<typeof makeColumn>>()
  for (let cz = -1; cz <= 4; cz++) for (let cx = -1; cx <= 4; cx++)
    cols.set(`${cx},${cz}`, makeColumn(gx + cx * SECTION, gz + cz * SECTION, SEED))

  let halfTops = 0, aboveHalf = 0, meshed = 0
  for (let cz = 0; cz <= 3; cz++) {
    for (let cx = 0; cx <= 3; cx++) {
      const col = cols.get(`${cx},${cz}`)!
      // The half cells of this column, keyed by their world column footprint.
      const lips = new Map<string, number>()
      for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
        const y = col.heightAt(x, z)
        if (isHalfCell(col, x, y, z)) lips.set(`${x},${z}`, y)
      }
      if (!lips.size) continue
      meshed++
      for (const sm of meshColumn(col, {
        negX: cols.get(`${cx - 1},${cz}`), posX: cols.get(`${cx + 1},${cz}`),
        negZ: cols.get(`${cx},${cz - 1}`), posZ: cols.get(`${cx},${cz + 1}`),
      })) {
        const p = sm.mesh.positions
        for (let v = 0; v < p.length; v += 3) {
          const lx = p[v], wy = sm.wy + p[v + 1], lz = p[v + 2]
          // Vertices sit on cell corners, so a lip's footprint is any of its four corners.
          for (const [dx, dz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]] as const) {
            const lip = lips.get(`${lx + dx},${lz + dz}`)
            if (lip === undefined) continue
            if (Math.abs(wy - (lip + 0.5)) < 1e-6) halfTops++
            // Strictly inside the upper half of the lip cell: the walker reads that space as
            // empty, so no triangle may live there.
            if (wy > lip + 0.5 + 1e-6 && wy < lip + 1 - 1e-6) aboveHalf++
          }
        }
      }
    }
  }
  ok(meshed > 0, `garden columns carrying lips were meshed (${meshed})`)
  ok(halfTops > 0, `★ the mesher really draws geometry at the half plane (${halfTops} vertices)`)
  ok(aboveHalf === 0, `★ nothing is drawn in the empty upper half of a lip (${aboveHalf} vertices)`)
}

// ── 8. ★ A LIP IS A SLAB, AND A SLAB IS A BLOCK (2026-08-11, Alex's ruling) ────────────────────
// He found the first fix went around the issue: "the fix is to make half blocks an actual item."
// Right — half-ness has to live on the MATERIAL, or it is a property of the ground that any block
// dropped into the cell inherits. Mine a lip and you get a slab item; place stone and you get
// stone. These asserts are about the material, because that is now the whole mechanism.
{
  const garden = TENDED
  const gx = Math.floor(garden.x / SECTION) * SECTION, gz = Math.floor(garden.z / SECTION) * SECTION
  let slabs = 0, wrongBase = 0, standing = 0
  for (let cz = 0; cz < 4; cz++) for (let cx = 0; cx < 4; cx++) {
    const col = makeColumn(gx + cx * SECTION, gz + cz * SECTION, SEED)
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      const y = col.heightAt(x, z)
      const m = col.get(x, y, z)
      if (!isHalfMat(m)) continue
      slabs++
      // A slab is its base material wearing a bit — it must resolve to a real block.
      if (!blockDef(baseOf(m))) wrongBase++
      const up = col.get(x, y + 1, z)
      if (!(up === AIR || isPlant(up))) standing++
    }
  }
  ok(slabs > 100, `the garden generates real slab voxels (${slabs})`)
  ok(wrongBase === 0, 'every slab resolves to a real base block')
  ok(standing === 0, '★ nothing stands on a slab — trunks and walls clear the bit')

  // ★ Alex's exact sequence, now answered by the material alone.
  const col = makeColumn(gx, gz, SEED)
  let lx = -1, ly = -1, lz = -1
  for (let z = 0; z < SECTION && lx < 0; z++) for (let x = 0; x < SECTION && lx < 0; x++) {
    const y = col.heightAt(x, z)
    if (isHalfMat(col.get(x, y, z))) { lx = x; ly = y; lz = z }
  }
  ok(lx >= 0, 'found a lip to work with')
  const slab = col.get(lx, ly, lz)
  ok(isHalfCell(col, lx, ly, lz), 'the generated lip reads as half')
  // 1. mine it → a SLAB item, not a whole block.
  const drop = dropsFor(slab)[0] as { itemId: string } | undefined
  ok(!!drop && drop.itemId.endsWith('_slab'), `★ mining a lip drops a SLAB item (${drop?.itemId})`)
  // ⚠ WIDENED 2026-08-19, and the widening is the RULE not a concession. This asserted
  // `materialForItem(drop.itemId) === slab` — true only while every slumping surface was a block
  // that drops ITSELF. The character layer's grounds drop plain soil (a ground is what the world
  // grows, not a thing you pocket), so mining a forest-loam lip correctly yields a TOPSOIL slab.
  // The claim worth keeping is the one that was always the point: a slab item places a SLAB, never
  // a whole block, and it round-trips through the block's own DROP rather than through whichever
  // ground you happened to be standing on.
  // ⚠ GUARDED, because the failure this section exists to catch produces a MISSING drop — and
  // `drop!.itemId` on a missing one throws, which exits before the reporter runs and turns a red
  // assert into a stack trace. A test that crashes on the regression it was written for is a test
  // nobody reads the output of; verified by re-introducing the bug (M8) and watching this stay red.
  const placed = (drop ? materialForItem(drop.itemId) : 0) ?? 0
  ok(!!drop && isHalfMat(placed), `★ and that item places a SLAB back, not a whole block (${placed})`)
  const wholeDrop = dropsFor(baseOf(slab))[0]
  ok(!!wholeDrop && !!drop && baseOf(placed) === (materialForItem(wholeDrop.itemId) ?? -1),
    'the slab round-trips through the same item its whole block drops')

  // ── ★ EVERY GROUND THE WORLD CAN SLUMP HAS A SLAB ROW ──────────────────────────────────────
  // The general form of the bug found on 2026-08-19, and the reason `BlockDef.ground` exists. A
  // half cell whose base has no slab row has NO DEFINITION: no hardness, no drops, no name — a lip
  // a keeper swings at forever with nothing happening and nothing logged. Grey soil had been in
  // that state since the greyfield shipped, at 1.5% of lips, which is exactly why nobody saw it.
  // Sampling the REAL generator rather than a list, so a ground added later is covered by having
  // been generated, not by being remembered here.
  {
    const seen = new Set<number>()
    let broken = 0
    for (let cz = -30; cz <= 30; cz += 3) for (let cx = -30; cx <= 30; cx += 3) {
      const c = makeColumn(cx * SECTION, cz * SECTION, SEED)
      for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
        const m = c.get(x, c.heightAt(x, z), z)
        if (!isHalfMat(m)) continue
        seen.add(baseOf(m))
        if (!blockDef(m) || dropsFor(m).length === 0) broken++
      }
    }
    ok(seen.size >= 4, `the sweep met several grounds slumping (${seen.size})`)
    ok(broken === 0, `★ every lip the world generates is a mineable block (${broken} dead lips)`)
  }
  // 2. put STONE in the cell → a whole stone block, because the material says so.
  const s0 = (ly / SECTION) | 0
  col.sections[s0].set(lx, ly - s0 * SECTION, lz, MAT.STONE)
  ok(!isHalfCell(col, lx, ly, lz), '★ STONE placed in a lip is a WHOLE block — Alex\'s bug')
  // 3. and a stone SLAB placed there is half, anywhere, with no terrain rule involved.
  col.sections[s0].set(lx, ly - s0 * SECTION, lz, MAT.STONE | HALF_BIT)
  ok(isHalfCell(col, lx, ly, lz), '★ a stone slab is half wherever you put it')
  ok(baseOf(MAT.STONE | HALF_BIT) === MAT.STONE, 'a slab keeps its base material')
}

// ── 9. ★ TOP SLABS AND MERGING (2026-08-11) ─────────────────────────────────────────────────────
// A slab is a block, so it must work as one: it can sit in either half, it resolves to the same
// definition either way, and two halves make a whole.
{
  const stoneSlab = MAT.STONE | HALF_BIT
  const stoneTop = stoneSlab | TOP_BIT
  ok(isHalfMat(stoneTop) && isTopSlab(stoneTop), 'a top slab is a slab, in the upper half')
  ok(!isTopSlab(stoneSlab), 'a bottom slab is not a top one')
  ok(baseOf(stoneTop) === MAT.STONE, 'position does not change what it is made of')
  // ★ TOP_BIT is POSITION, not identity — the definition lookup must mask it, or an upside-down
  // slab has no hardness and no drops: a block you placed yourself and can never break.
  ok(!!blockDef(stoneTop), 'a top slab has a block definition')
  // ⚠ Guarded for the same reason as the drop assert above: a missing slab row is exactly the
  // regression this line catches, and `!.name` on a missing one throws before the reporter runs.
  ok(!!blockDef(stoneTop) && blockDef(stoneTop)!.name === blockDef(stoneSlab)?.name, 'both halves are the same block')
  ok(dropsFor(stoneTop)[0]?.itemId === dropsFor(stoneSlab)[0]?.itemId, 'and drop the same item')
  // Merging is the placement path's job, but the RESULT must be an ordinary whole block.
  ok(!isHalfMat(baseOf(stoneTop)), 'two halves merge to a full block, not another slab')

  // ★ THE SPAN RULE: a bottom slab beside a top slab covers nothing of it, so BOTH draw their
  // sides. Collapsing coverage back to a boolean punches see-through gaps into slab staircases.
  const sec = new Section(SECTION)
  sec.set(4, 4, 4, stoneSlab)
  sec.set(5, 4, 4, stoneTop)
  const mesh = greedyMesh(sec, () => AIR, undefined, new Map([
    [halfKey(4, 4, 4, SECTION), stoneSlab], [halfKey(5, 4, 4, SECTION), stoneTop],
  ]))
  let lowSide = 0, highSide = 0
  for (let v = 0; v < mesh.positions.length; v += 3) {
    const x = mesh.positions[v], y = mesh.positions[v + 1]
    if (Math.abs(x - 5) > 1e-6) continue          // the shared plane between the two cells
    if (Math.abs(y - 4.5) < 1e-6) { lowSide++; highSide++ }
    else if (y > 4 && y < 4.5) lowSide++
    else if (y > 4.5 && y < 5) highSide++
  }
  ok(mesh.quads >= 8, `two facing slabs both mesh (${mesh.quads} quads)`)
  ok(lowSide > 0 && highSide > 0, '★ neither slab hides the other — the shared plane draws both')
}

console.log(`\nslump: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
