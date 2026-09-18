// The river flow field. Run: npx tsx src/app/shimmer/voxel/river-flow.test.ts
//
// ── ★ WHAT THIS PROTECTS (2026-09-18) ────────────────────────────────────────────────────────
// `riverFlowAt` turns two things the world already knows — the channel's line (the river field's
// level-set) and which way is down (the water table's fall) — into a per-corner vector the water
// shader scrolls along. Three silent failures: the vector points UPSTREAM (the sign is read off a
// table sample and a sign error is invisible in a unit test that only checks "nonzero"); the
// vector never reaches the live path (the depth field's 08-20 lesson, so §3 meshes the way
// `VoxelWorld` does); and two columns disagree at a shared corner (a seam in the flow at every
// chunk edge — position-purity is asserted, not assumed).
import { riverFlowAt, riverField, riverness, SHORE_RN, waterTableAt, FLOW_REACH, riverCarve } from './height'
import { Column, generateColumn, meshColumn, SECTION } from './column'
import { MAT } from './depth'

const SEED = 1337
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. the pure field, on the river by the meadow ──────────────────────────────────────────────
{
  let wet = 0, flowing = 0, dryNonZero = 0, badMag = 0, upstream = 0, notTangent = 0, kinked = 0
  let worstKink = 0
  for (let z = 2016; z < 2064; z += 2) for (let x = 256; x < 448; x += 2) {
    const rn = riverness(riverField(x, z, SEED))
    const [fx, fz] = riverFlowAt(x, z, SEED)
    const mag = Math.hypot(fx, fz)
    if (rn < SHORE_RN) { if (mag !== 0) dryNonZero++; continue }
    wet++
    if (mag === 0) continue
    flowing++
    if (Math.abs(mag - rn) > 1e-6) badMag++
    // Downstream: the table is lower ahead than behind, along the flow.
    const ux = fx / mag, uz = fz / mag
    const ahead = waterTableAt(x + ux * FLOW_REACH, z + uz * FLOW_REACH, SEED)
    const behind = waterTableAt(x - ux * FLOW_REACH, z - uz * FLOW_REACH, SEED)
    if (!(ahead < behind)) upstream++
    // Tangent to the channel: perpendicular to the field's gradient.
    const gx = riverField(x + 1, z, SEED) - riverField(x - 1, z, SEED)
    const gz = riverField(x, z + 1, SEED) - riverField(x, z - 1, SEED)
    const gl = Math.hypot(gx, gz)
    if (gl > 0 && Math.abs((gx * ux + gz * uz) / gl) > 1e-6) notTangent++
    // Smooth: the neighbour two blocks on flows within a few degrees.
    const [nx, nz] = riverFlowAt(x + 2, z, SEED)
    const nm = Math.hypot(nx, nz)
    if (nm > 0) {
      const cos = Math.min(1, Math.max(-1, (ux * nx + uz * nz) / nm))
      const deg = Math.acos(cos) * 180 / Math.PI
      worstKink = Math.max(worstKink, deg)
      if (deg > 15) kinked++
    }
  }
  ok(wet > 300, `the stretch is a river (${wet} wet samples)`)
  ok(flowing / Math.max(1, wet) > 0.9, `★★ the river FLOWS — ${flowing}/${wet} wet samples carry a vector`)
  ok(dryNonZero === 0, `★ dry land and the bank are still (${dryNonZero} non-zero)`)
  ok(badMag === 0, `magnitude is riverness (${badMag} off)`)
  ok(upstream === 0, `★★★ every vector points DOWNSTREAM — the table falls ahead of it (${upstream} did not)`)
  ok(notTangent === 0, `★ every vector runs ALONG the channel, not across it (${notTangent} off-tangent)`)
  ok(kinked === 0, `★ the field is smooth: neighbours two blocks apart agree within 15° (worst ${worstKink.toFixed(1)}°)`)
}

// ── 2. still water is honest: a hot-spring pool and the sea carry no flow ──────────────────────
{
  ok(riverFlowAt(0, 0, SEED).every(v => v === 0) || riverCarve(0, 0, SEED) > 0, 'a cell off every river is [0, 0]')
  let stillOk = true
  for (let x = -400; x < 400; x += 16) for (let z = -400; z < 400; z += 16) {
    if (riverCarve(x, z, SEED) > 0) continue
    const [fx, fz] = riverFlowAt(x, z, SEED)
    if (fx !== 0 || fz !== 0) stillOk = false
  }
  ok(stillOk, '★ no flow where there is no channel (pools, sea, dry country)')
}

// ── 3. ★★ THE LIVE PATH: the flow reaches the mesh, on the sheet only, and agrees across seams ──
{
  // Columns over the river stretch, meshed with the full 8-neighbourhood as VoxelWorld does.
  const OX = Math.floor(256 / SECTION), OZ = Math.floor(2016 / SECTION), NX = 12, NZ = 3
  const cols = new Map<string, Column>()
  const key = (cx: number, cz: number) => `${cx},${cz}`
  for (let cz = -1; cz <= NZ; cz++) for (let cx = -1; cx <= NX; cx++)
    cols.set(key(cx, cz), generateColumn(new Column((OX + cx) * SECTION, (OZ + cz) * SECTION), SEED))

  const seen = new Map<string, [number, number][]>()
  let sheetVerts = 0, sheetFlowing = 0, rimNonZero = 0, solidNonZero = 0, mismatch = 0
  for (let cz = 0; cz < NZ; cz++) for (let cx = 0; cx < NX; cx++) {
    const n = (dx: number, dz: number) => cols.get(key(cx + dx, cz + dz)) ?? null
    const sections = meshColumn(cols.get(key(cx, cz))!, {
      negX: n(-1, 0), posX: n(1, 0), negZ: n(0, -1), posZ: n(0, 1),
      negXnegZ: n(-1, -1), posXnegZ: n(1, -1), negXposZ: n(-1, 1), posXposZ: n(1, 1),
    })
    for (const sm of sections) {
      const m = sm.mesh
      ok(m.waterFlow.length === m.materials.length * 2, 'two flow floats per vertex, every section')
      for (let v = 0; v < m.materials.length; v++) {
        const fx = m.waterFlow[v * 2], fz = m.waterFlow[v * 2 + 1]
        if (m.materials[v] !== MAT.WATER) { if (fx !== 0 || fz !== 0) solidNonZero++; continue }
        const top = m.normals[v * 3 + 1] > 0.5
        if (!top) { if (fx !== 0 || fz !== 0) rimNonZero++; continue }
        // The flow at a sheet vertex is the pure field at its world xz (a corner), by construction.
        const wx = sm.wx + m.positions[v * 3], wz = sm.wz + m.positions[v * 3 + 2]
        // Only the RIVER's sheet is expected to run: the stretch also holds sea (y ≤ 100) and that
        // is still water by design, so the "reaches the mesh" claim is made over channel corners.
        if (riverCarve(wx, wz, SEED) > 0) { sheetVerts++; if (fx !== 0 || fz !== 0) sheetFlowing++ }
        const [px, pz] = riverFlowAt(wx, wz, SEED)
        if (Math.abs(px - fx) > 1e-6 || Math.abs(pz - fz) > 1e-6) mismatch++
        const k = `${wx},${wz}`
        const arr = seen.get(k) ?? []
        arr.push([fx, fz])
        seen.set(k, arr)
      }
    }
  }
  ok(sheetVerts > 500, `the stretch meshes a real river sheet (${sheetVerts} channel sheet vertices)`)
  ok(sheetFlowing / Math.max(1, sheetVerts) > 0.8, `★★★ the flow REACHES THE MESH — ${sheetFlowing}/${sheetVerts} sheet vertices carry it`)
  ok(mismatch === 0, `★★ a sheet vertex carries exactly the field at its corner (${mismatch} differ)`)
  ok(rimNonZero === 0, `★ rim faces carry no flow (${rimNonZero} did)`)
  ok(solidNonZero === 0, `★ non-water vertices carry no flow (${solidNonZero} did)`)
  let shared = 0, torn = 0
  for (const [, fs] of seen) {
    if (fs.length < 2) continue
    shared++
    for (const [fx, fz] of fs) if (fx !== fs[0][0] || fz !== fs[0][1]) torn++
  }
  ok(shared > 50, `seams are actually straddled (${shared} shared sheet points)`)
  ok(torn === 0, `★★ two columns sharing a corner compute the IDENTICAL flow (${torn} torn)`)
}

console.log(`river flow: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
