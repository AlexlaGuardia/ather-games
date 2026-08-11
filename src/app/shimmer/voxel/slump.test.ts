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
import { makeColumn, isHalfCell, meshColumn, SECTION } from './column'
import { MAT } from './depth'
import { AIR } from './section'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const h = (x: number, z: number) => columnHeight(x, z, SEED)

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
  const garden = ZONE_ANCHORS.find(a => a.id === 'garden')!
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
          if (col.get(x, y + 1, z) !== AIR) buried++
        }
      }
    }
  }
  ok(found > 0, `the generated garden really carries half cells (${found})`)
  ok(offSurface === 0, 'a half cell is only ever the generated surface voxel')
  ok(hollow === 0, 'a half cell is never air')
  ok(buried === 0, '★ nothing ever stands ON a half cell — trunks and walls restore full height')
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
  const garden = ZONE_ANCHORS.find(a => a.id === 'garden')!
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

console.log(`\nslump: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
