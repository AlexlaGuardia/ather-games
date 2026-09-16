// The gate station's STARTER blueprint — today's code-built court, dumped as a structure Alex can
// open on the worktable and finish by hand.
//
// ★ RUN ONCE, THEN THE FILE IS ALEX'S. This writes `data/blueprints/gate_station.json` from the
// arc court at tier 0 (`crossings.ts` — dais, hub, tower, four frames, lamps DARK) and prints the
// local layout `court-blueprint.ts` freezes: where the anchor sits inside the box, the floor row,
// and the four socket cells. Re-running it OVERWRITES whatever Alex built. Do not wire it into
// prebuild; `court-blueprint.test.ts` re-derives the numbers instead.
//
// Run: npx tsx scripts/gen-station-starter.mts [--write]
import { writeFileSync } from 'node:fs'
import {
  courtAnchor, sockets, socketCells, socketMaterial, gateTowerCells, courtHubCells, courtPlatformCells,
  courtLevel, PLATFORM_MAT,
} from '../src/app/shimmer/voxel3d/crossings'
import { plotForTier } from '../src/app/shimmer/voxel/plot'
import { MAT } from '../src/app/shimmer/voxel/depth'
import { normalizeCells, packCells, type BlueprintCell } from '../src/app/shimmer/voxel/blueprints'
import { WORLD_SEED } from '../src/app/shimmer/voxel3d/world-seed'

const cfg = plotForTier(0)
const a = courtAnchor(WORLD_SEED, cfg)
const level = courtLevel(WORLD_SEED, cfg)
if (a.y === null || level === null) throw new Error('the court does not stand at tier 0')
const socks = sockets(WORLD_SEED, cfg)

const cells: BlueprintCell[] = []
for (const c of courtPlatformCells(WORLD_SEED, cfg)) cells.push({ x: c.x, y: c.y, z: c.z, m: PLATFORM_MAT })
for (const c of courtHubCells(WORLD_SEED, cfg)) cells.push({ x: c.x, y: c.y, z: c.z, m: MAT.CUT_STONE })
for (const c of gateTowerCells(WORLD_SEED, cfg)) cells.push({ x: c.x, y: c.y, z: c.z, m: MAT.CUT_STONE })
for (const sk of socks) for (const c of socketCells(sk, level)) {
  const m = socketMaterial(c, false)      // every lamp DARK: the world lights them by reach
  if (m !== MAT.AIR) cells.push({ x: c.x, y: c.y, z: c.z, m })
}
// Later writes win where two shapes overlap (frames over tower over hub over dais), as the world lays them.
const byKey = new Map<string, BlueprintCell>()
for (const c of cells) byKey.set(`${c.x},${c.y},${c.z}`, c)
const raw = [...byKey.values()]
const minX = Math.min(...raw.map(c => c.x)), minY = Math.min(...raw.map(c => c.y)), minZ = Math.min(...raw.map(c => c.z))
const local = normalizeCells(raw.map(c => ({ x: c.x - minX, y: c.y - minY, z: c.z - minZ, m: c.m })))
const w = Math.max(...local.map(c => c.x)) + 1, h = Math.max(...local.map(c => c.y)) + 1, d = Math.max(...local.map(c => c.z)) + 1

const layout = {
  anchor: { x: a.x - minX, z: a.z - minZ },
  floor: level - minY,
  sockets: socks.map(s => ({ index: s.index, kind: s.kind, x: s.x - minX, z: s.z - minZ })),
  lamp: socks.map(s => {
    const lamp = socketCells(s, level).find(c => c.lamp)!
    return { index: s.index, x: lamp.x - minX, y: lamp.y - minY, z: lamp.z - minZ }
  }),
}
console.log(JSON.stringify({ w, h, d, cells: local.length, bearing: a.bearing, layout }, null, 1))

if (process.argv.includes('--write')) {
  const bp = { id: 'gate_station', name: 'Gate Station', w, h, d, cells: packCells(local), station: { anchor: layout.anchor, floor: layout.floor, sockets: layout.sockets, lamps: layout.lamp } }
  writeFileSync('src/app/shimmer/data/blueprints/gate_station.json', JSON.stringify(bp) + '\n')
  console.log(`wrote gate_station.json — ${local.length} blocks, ${w}×${h}×${d}`)
}
