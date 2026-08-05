// Build the region canvases — the 2026-07-31 world pivot. Re-runnable: reads the CURRENT
// legacy zone sources and stamps them into fresh cloud canvases per PLACEMENTS below, then
// writes src/app/shimmer/world/region-maps/<id>.json. Running it again regenerates every
// canvas from source truth (it will CLOBBER hand-edits made to the JSONs after transplant —
// once Alex starts sculpting a region, stop re-running it for that region, or move its
// sources entry; the guard below refuses to overwrite a file whose `sculpted` flag is set).
//
// Absorption table (Alex, 2026-07-31): routes DIE (folded into regions, minimap labels
// later) · Gloview -> Mana Springs · threshold -> Outfields · mycelial + wooded-trail ->
// Twilight Thicket · spore-hollow + voranyx-deep = Voranyx Caverns.
//
// Run: npx tsx scripts/build-region-canvases.mts

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ZONES } from '../src/app/shimmer/world/zones'
import { ZONE_NODES } from '../src/app/shimmer/world/node-placements'
import { ZONE_SPAWNERS } from '../src/app/shimmer/world/spawn-placements'
import { encodeRows, type RegionFile } from '../src/app/shimmer/world/region-codec'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dir, '../src/app/shimmer/world/region-maps')

const CLOUD = 34 // Cloud 1 — solid, carvable; the canvas is authored by subtraction

// Interiors that survive as their own zones — warps into them are kept (offset applied).
// Everything else a source zone warps to is a surface/route sibling and is dropped: region
// exits are Phase B (the loading-screen transition), not stamped legacy doors.
const KEPT_INTERIORS = new Set([
  'moonwell-glade-gregory-s-home', 'rune-hold', 'crucible', 'sorrel-hold', 'brack-hold',
])

interface Placement { zone: string; ox: number; oy: number }
interface RegionSpec {
  id: string; display: string; cols: number; rows: number
  primary: string               // playerStart + element/realm come from this zone
  places: Placement[]
}

const REGIONS: RegionSpec[] = [
  {
    id: 'home-plot', display: 'Home Plot', cols: 150, rows: 150, primary: 'garden',
    places: [{ zone: 'garden', ox: 59, oy: 59 }],
  },
  {
    id: 'moonwell-glade', display: 'Moonwell Glade', cols: 150, rows: 150, primary: 'moonwell-glade',
    places: [{ zone: 'moonwell-glade', ox: 55, oy: 50 }],
  },
  {
    id: 'spirit-meadow', display: 'Spirit Meadows', cols: 400, rows: 400, primary: 'spirit-meadow',
    places: [{ zone: 'spirit-meadow', ox: 160, oy: 180 }],
  },
  {
    id: 'twilight-thicket', display: 'Twilight Thicket', cols: 400, rows: 400, primary: 'twilight-thicket',
    places: [
      { zone: 'twilight-thicket', ox: 160, oy: 150 },
      { zone: 'mycelial-path', ox: 100, oy: 175 },   // west of the thicket
      { zone: 'wooded-trail', ox: 260, oy: 185 },    // east of it
    ],
  },
  {
    id: 'mana-springs', display: 'Mana Springs', cols: 400, rows: 400, primary: 'mana-springs',
    places: [
      { zone: 'mana-springs', ox: 150, oy: 160 },
      { zone: 'gloview-village', ox: 183, oy: 110 }, // north of the springs (Alex: Gloview lives here)
    ],
  },
  {
    id: 'voranyx-caverns', display: 'Voranyx Caverns', cols: 400, rows: 400, primary: 'spore-hollow',
    places: [
      { zone: 'spore-hollow', ox: 120, oy: 170 },    // 1st floor, west
      { zone: 'voranyx-deep', ox: 250, oy: 170 },    // the deep, east
    ],
  },
  {
    id: 'the-outfields', display: 'The Outfields', cols: 400, rows: 400, primary: 'the-outfields',
    places: [
      { zone: 'the-outfields', ox: 183, oy: 175 },
      { zone: 'the-threshold', ox: 190, oy: 230 },   // the sealed gate, south of the fields
    ],
  },
]

mkdirSync(OUT_DIR, { recursive: true })

for (const spec of REGIONS) {
  const outPath = join(OUT_DIR, `${spec.id}.json`)
  if (existsSync(outPath)) {
    const prev = JSON.parse(readFileSync(outPath, 'utf-8')) as RegionFile & { sculpted?: boolean }
    if (prev.sculpted) {
      console.log(`SKIP ${spec.id} — marked sculpted (hand-edits would be clobbered)`)
      continue
    }
  }

  const grid: number[][] = Array.from({ length: spec.rows }, () => new Array<number>(spec.cols).fill(CLOUD))
  const nodes: RegionFile['nodes'] = []
  const spawners: RegionFile['spawners'] = []
  const warps: RegionFile['warps'] = []
  const sources: RegionFile['sources'] = {}

  for (const p of spec.places) {
    const z = ZONES.find(zz => zz.id === p.zone)
    if (!z) throw new Error(`unknown source zone ${p.zone}`)
    const rows = z.grid.length, cols = z.grid[0]?.length ?? 0
    sources[p.zone] = { ox: p.ox, oy: p.oy, cols, rows }
    // Stamp non-void cells only: a source zone's own -1 margin must not punch holes in the
    // cloud — the canvas stays solid cloud wherever the zone had nothing.
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const v = z.grid[y][x]
      if (v !== -1) grid[p.oy + y][p.ox + x] = v
    }
    for (const n of ZONE_NODES[p.zone] ?? []) nodes.push({ type: n.type, tileX: n.tileX + p.ox, tileY: n.tileY + p.oy })
    for (const s of ZONE_SPAWNERS[p.zone] ?? []) spawners.push({ kind: 'moglin', gate: s.gate, tileX: s.tileX + p.ox, tileY: s.tileY + p.oy })
    for (const w of z.warps) {
      if (!KEPT_INTERIORS.has(w.toZone)) continue
      warps.push({ fromX: w.fromX + p.ox, fromY: w.fromY + p.oy, toZone: w.toZone, toX: w.toX, toY: w.toY, direction: w.direction, requiredFlag: w.requiredFlag })
    }
  }

  const primary = ZONES.find(z => z.id === spec.primary)!
  const start = primary.playerStart ?? { tileX: 5, tileY: 5 }
  const pOff = sources[spec.primary]

  const file: RegionFile = {
    id: spec.id,
    display: spec.display,
    cols: spec.cols,
    rows: spec.rows,
    fill: CLOUD,
    element: primary.element as string | undefined,
    realm: primary.realm,
    playerStart: { tileX: start.tileX + (pOff?.ox ?? 0), tileY: start.tileY + (pOff?.oy ?? 0) },
    rle: encodeRows(grid),
    nodes, spawners, warps,
    spawn: {},
    sources,
  }
  writeFileSync(outPath, JSON.stringify(file), 'utf-8')
  const kb = (JSON.stringify(file).length / 1024).toFixed(1)
  console.log(`wrote ${spec.id}.json — ${spec.cols}x${spec.rows}, ${nodes.length} nodes, ${spawners.length} burrows, ${warps.length} warps, ${kb}KB`)
}
console.log('done')
