// Provisional region exits — the walkability pass of the world pivot (Alex blessed
// 2026-08-01: "go ahead with provisional exits, i can move them later").
//
// Every link below is DERIVED from the legacy warp graph: the from-tiles are the exact
// tiles the legacy zones used as exits, and the landings are the exact (toX,toY) tiles the
// legacy warps stored — offset into region space via each region file's `sources` table.
// Routes are collapsed (they died into the regions); where a legacy route was a 3-way hub
// (route-moonwell-garden), one continuation was chosen and the graph left ASYMMETRIC but
// fully reachable — provisional means Alex recarves the real passages in the editor.
//
// Emitted warps carry `provisional: true`; re-running this script first strips previous
// provisional warps (idempotent) and never touches hand-placed ones. The Threshold rect
// has no legacy surface warps and stays unlinked on purpose (Alex carves its approach).
//
// Run: npx tsx scripts/wire-region-exits.mts

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const REGION_DIR = join(__dir, '../src/app/shimmer/world/region-maps')

// zone → { region, ox, oy } from the region files' own sources tables
const files: Record<string, any> = {}
const sourceOf: Record<string, { region: string; ox: number; oy: number }> = {}
for (const id of ['home-plot', 'moonwell-glade', 'spirit-meadow', 'twilight-thicket', 'mana-springs', 'voranyx-caverns', 'the-outfields']) {
  const f = JSON.parse(readFileSync(join(REGION_DIR, `${id}.json`), 'utf-8'))
  files[id] = f
  for (const [zone, s] of Object.entries(f.sources as Record<string, { ox: number; oy: number }>)) {
    sourceOf[zone] = { region: id, ox: s.ox, oy: s.oy }
  }
}

interface Link {
  fromZone: string; fromTiles: [number, number][]
  toZone: string; toTiles: [number, number][]   // legacy landing tiles in the target zone
  dir: string
}

// The legacy graph, routes collapsed. Tile pairs are verbatim from zones.ts warps.
const LINKS: Link[] = [
  // garden west → mycelial (via route-garden-mycelial); mycelial east → garden
  { fromZone: 'garden', fromTiles: [[0, 11], [0, 12]], toZone: 'mycelial-path', toTiles: [[28, 14], [28, 15]], dir: 'left' },
  { fromZone: 'mycelial-path', fromTiles: [[29, 14], [29, 15]], toZone: 'garden', toTiles: [[1, 11], [1, 12]], dir: 'right' },
  // garden east → moonwell (via route-moonwell-garden); moonwell west → garden
  { fromZone: 'garden', fromTiles: [[31, 9], [31, 10]], toZone: 'moonwell-glade', toTiles: [[1, 8], [1, 9]], dir: 'right' },
  { fromZone: 'moonwell-glade', fromTiles: [[0, 8], [0, 9]], toZone: 'garden', toTiles: [[30, 9], [30, 10]], dir: 'left' },
  // mycelial north ↔ spirit-meadow south (direct in legacy)
  { fromZone: 'mycelial-path', fromTiles: [[15, 0], [16, 0]], toZone: 'spirit-meadow', toTiles: [[10, 38], [11, 38]], dir: 'up' },
  { fromZone: 'spirit-meadow', fromTiles: [[10, 39], [11, 39]], toZone: 'mycelial-path', toTiles: [[15, 1], [16, 1]], dir: 'down' },
  // spirit-meadow south (the old 3-way route arm) → moonwell; return goes moonwell→garden (asymmetric, reachable)
  { fromZone: 'spirit-meadow', fromTiles: [[69, 39], [70, 39]], toZone: 'moonwell-glade', toTiles: [[1, 8], [1, 9]], dir: 'down' },
  // mycelial ↔ wooded-trail (intra twilight-thicket region)
  { fromZone: 'mycelial-path', fromTiles: [[0, 7], [0, 8]], toZone: 'wooded-trail', toTiles: [[48, 11], [48, 12]], dir: 'left' },
  { fromZone: 'wooded-trail', fromTiles: [[49, 11], [49, 12]], toZone: 'mycelial-path', toTiles: [[1, 7], [1, 8]], dir: 'right' },
  // twilight-thicket → wooded-trail (legacy had this direction only)
  { fromZone: 'twilight-thicket', fromTiles: [[79, 51], [79, 52]], toZone: 'wooded-trail', toTiles: [[1, 11], [1, 12]], dir: 'right' },
  // mycelial south ↔ spore-hollow (twilight ↔ voranyx caverns)
  { fromZone: 'mycelial-path', fromTiles: [[8, 49], [9, 49]], toZone: 'spore-hollow', toTiles: [[15, 1], [16, 1]], dir: 'down' },
  { fromZone: 'spore-hollow', fromTiles: [[15, 0], [16, 0]], toZone: 'mycelial-path', toTiles: [[8, 48], [9, 48]], dir: 'up' },
  // spore ↔ voranyx-deep (intra caverns, both legacy pairs)
  { fromZone: 'spore-hollow', fromTiles: [[31, 17], [31, 18]], toZone: 'voranyx-deep', toTiles: [[30, 15], [30, 16]], dir: 'left' },
  { fromZone: 'voranyx-deep', fromTiles: [[31, 15], [31, 16]], toZone: 'spore-hollow', toTiles: [[30, 17], [30, 18]], dir: 'left' },
  { fromZone: 'spore-hollow', fromTiles: [[0, 49], [0, 50]], toZone: 'voranyx-deep', toTiles: [[1, 34], [1, 35]], dir: 'right' },
  { fromZone: 'voranyx-deep', fromTiles: [[0, 34], [0, 35]], toZone: 'spore-hollow', toTiles: [[1, 49], [1, 50]], dir: 'right' },
  // spore south → mana-springs (no legacy return tile in mana — reachable via its west chain)
  { fromZone: 'spore-hollow', fromTiles: [[23, 59], [24, 59]], toZone: 'mana-springs', toTiles: [[30, 1], [31, 1]], dir: 'down' },
  // mana-springs ↔ gloview (via route-2; intra mana-springs region)
  { fromZone: 'mana-springs', fromTiles: [[0, 76], [0, 77]], toZone: 'gloview-village', toTiles: [[32, 11], [32, 12]], dir: 'left' },
  { fromZone: 'gloview-village', fromTiles: [[33, 11], [33, 12]], toZone: 'mana-springs', toTiles: [[1, 76], [1, 77]], dir: 'right' },
  // gloview south ↔ outfields (via route-3; mana-springs ↔ the-outfields)
  { fromZone: 'gloview-village', fromTiles: [[2, 21], [3, 21]], toZone: 'the-outfields', toTiles: [[6, 1], [7, 1]], dir: 'down' },
  { fromZone: 'the-outfields', fromTiles: [[6, 0], [7, 0]], toZone: 'gloview-village', toTiles: [[2, 20], [3, 20]], dir: 'up' },
]

// strip old provisional warps, then emit
for (const f of Object.values(files)) f.warps = (f.warps as any[]).filter(w => !w.provisional)

let emitted = 0
for (const l of LINKS) {
  const from = sourceOf[l.fromZone]
  const to = sourceOf[l.toZone]
  if (!from || !to) { console.log(`SKIP ${l.fromZone}→${l.toZone} — unmapped source`); continue }
  const target = files[to.region]
  const fromFile = files[from.region]
  const sameRegion = from.region === to.region
  l.fromTiles.forEach(([fx, fy], i) => {
    const [tx, ty] = l.toTiles[Math.min(i, l.toTiles.length - 1)]
    fromFile.warps.push({
      fromX: fx + from.ox, fromY: fy + from.oy,
      toZone: sameRegion ? 'r-' + to.region : 'r-' + to.region,
      toX: tx + to.ox, toY: ty + to.oy,
      direction: l.dir,
      provisional: true,
    })
    emitted++
  })
  void target
}

for (const [id, f] of Object.entries(files)) {
  f.rev = ((f.rev as number | undefined) ?? 0) + 1
  writeFileSync(join(REGION_DIR, `${id}.json`), JSON.stringify(f), 'utf-8')
  const prov = (f.warps as any[]).filter(w => w.provisional).length
  console.log(`${id}: ${prov} provisional warps (rev ${f.rev})`)
}
console.log(`emitted ${emitted} provisional warps total`)
