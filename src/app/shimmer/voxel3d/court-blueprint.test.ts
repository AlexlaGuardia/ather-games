// Run: npx tsx src/app/shimmer/voxel3d/court-blueprint.test.ts
//
// The station-as-structure seam: the frozen layout matches the generator it was dumped from, the
// stamp lands the anchor on the anchor at every tier, and the blueprint's sockets stand where the
// arc court's sockets stood (so switching the look did not move a single crossing by more than the
// quarter-turn snap can account for).

import { courtAnchor, sockets, socketCells, courtLevel } from './crossings'
import { STATION_LAYOUT, layoutOf, stationBlueprint, stationStamp, stationSockets, stationLamps, stationCells, stationRot } from './court-blueprint'
import { plotForTier, PLOT_TIERS } from '../voxel/plot'
import { WORLD_SEED } from './world-seed'
import { MAT } from '../voxel/depth'
import { makeBlueprint, blueprintCells, blueprintProblems } from '../voxel/blueprints'

let pass = 0, fail = 0
const check = (l: string, ok: boolean, d = '') => { if (ok) pass++; else { fail++; console.error(`  ✗ ${l}${d ? ` — ${d}` : ''}`) } }

const bp = stationBlueprint()
check('the starter blueprint is on disk', bp !== null)
if (!bp) { console.log(`court-blueprint: ${pass} passed, ${fail} failed`); process.exit(1) }

console.log('the frozen layout is the generator\'s')
{
  const cfg = plotForTier(0)
  const a = courtAnchor(WORLD_SEED, cfg)
  const level = courtLevel(WORLD_SEED, cfg)!
  const socks = sockets(WORLD_SEED, cfg)
  // The generator's min corner: re-derived from the same cells, so the numbers are checked, not trusted.
  const all = socks.flatMap(s => socketCells(s, level))
  const st = stationStamp(bp, a, level)
  check('rot 0 at the shipped bearing', st.rot === 0, `bearing ${a.bearing.toFixed(3)} → rot ${st.rot}`)
  for (const s of socks) {
    const mine = stationSockets(st).find(k => k.index === s.index)!
    check(`socket ${s.index} (${s.kind}) stands on the arc's cell`, mine.x === s.x && mine.z === s.z && mine.kind === s.kind,
      `arc (${s.x},${s.z}) blueprint (${mine.x},${mine.z})`)
    const lamp = all.find(c => c.lamp && Math.hypot(c.x - s.x, c.z - s.z) < 3)!
    const l = stationLamps(st).find(k => k.index === s.index)!
    check(`lamp ${s.index} is the lintel's middle`, l.x === lamp.x && l.y === lamp.y && l.z === lamp.z,
      `arc (${lamp.x},${lamp.y},${lamp.z}) blueprint (${l.x},${l.y},${l.z})`)
    check(`lamp ${s.index} holds a dark material in the blueprint`, l.dark !== 0 && l.dark !== MAT.MANA_LANTERN, `${l.dark}`)
  }
  const cells = stationCells(st)
  check('the stamp lays the arc\'s cell count', cells.length === bp.cells.length / 4, `${cells.length}`)
  // The dais top is the level: some cell sits at level-1 (the platform) under the anchor.
  check('the floor row lands on the court level', st.floorY + layoutOf(bp).floor === level)
}

console.log('every tier')
for (let t = 0; t < PLOT_TIERS.length; t++) {
  const cfg = plotForTier(t)
  const a = courtAnchor(WORLD_SEED, cfg)
  const level = courtLevel(WORLD_SEED, cfg)!
  const st = stationStamp(bp, a, level)
  const r = stationSockets(st)
  // The anchor cell lands on the anchor.
  const lay = layoutOf(bp)
  check(`tier ${t}: rot 0`, st.rot === 0)
  check(`tier ${t}: the anchor lands on the anchor`, st.x + lay.anchor.x === a.x && st.z + lay.anchor.z === a.z)
  // The blueprint's sockets stand within a block or so of where the arc put them at this tier.
  let worst = 0
  for (const s of sockets(WORLD_SEED, cfg)) {
    const mine = r.find(k => k.index === s.index)!
    worst = Math.max(worst, Math.hypot(mine.x - s.x, mine.z - s.z))
  }
  check(`tier ${t}: sockets within 1.5 of the arc's`, worst <= 1.5, `worst ${worst.toFixed(2)}`)
}

console.log('the snap')
{
  check('bearing 0 → 0', stationRot(0) === 0)
  check('bearing π/2 → 1', stationRot(Math.PI / 2) === 1)
  check('bearing π → 2', stationRot(Math.PI) === 2)
  check('bearing -π/2 → 3', stationRot(-Math.PI / 2) === 3)
  check('bearing 0.07 → 0', stationRot(0.07) === 0)
  // A turned stamp still lands its anchor on the anchor.
  const cfg = plotForTier(0)
  const a = { ...courtAnchor(WORLD_SEED, cfg), bearing: Math.PI / 2 }
  const st = stationStamp(bp, a, 98)
  const r = rotatedAnchor(st.rot)
  check('turned: the anchor lands on the anchor', st.x + r.x === a.x && st.z + r.z === a.z)
  function rotatedAnchor(rot: number) {
    const { x, z } = layoutOf(bp!).anchor
    switch (rot) { case 1: return { x: bp!.d - 1 - z, z: x }; case 2: return { x: bp!.w - 1 - x, z: bp!.d - 1 - z }; case 3: return { x: z, z: bp!.w - 1 - x }; default: return { x, z } }
  }
}

console.log('the crossings travel with the file')
{
  // Alex's case: a dais edge trimmed, the editor's frame now starts at (1,0,2). The save re-bases
  // the blocks and must move the layout by the same offset, so the sockets stay on the same blocks.
  const shifted = blueprintCells(bp).filter(c => c.x >= 1 && c.z >= 2)
  const out = makeBlueprint('gate_station', 'Gate Station', shifted, [], bp.station)
  check('the file carries a station', !!out.station)
  check('the layout shifted with the blocks', out.station!.anchor.x === bp.station!.anchor.x - 1 && out.station!.anchor.z === bp.station!.anchor.z - 2
    && out.station!.sockets.every((sk, i) => sk.x === bp.station!.sockets[i].x - 1 && sk.z === bp.station!.sockets[i].z - 2)
    && out.station!.lamps.every((l, i) => l.x === bp.station!.lamps[i].x - 1 && l.y === bp.station!.lamps[i].y && l.z === bp.station!.lamps[i].z - 2))
  check('the re-based file is valid', blueprintProblems(out).length === 0, blueprintProblems(out).join(' · '))
  // A lamp with no block under it is refused by the format itself.
  const bad = { ...out, station: { ...out.station!, lamps: out.station!.lamps.map(l => ({ ...l, y: l.y + 40 })) } }
  check('a lamp cell outside the box is refused', blueprintProblems(bad).some(m => /lamp/.test(m)))
  // The starter on disk is self-describing and valid.
  check('the starter on disk carries its layout', !!bp.station && blueprintProblems(bp).length === 0)
}

console.log(`court-blueprint: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
