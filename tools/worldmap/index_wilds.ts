// Places every Wilds tile's infected nodes into public/open/wilds/tiles.json (run after export_wilds_all.py).
// The spread (open/ather/spread.ts) must know EVERY node on the continent, not only the tiles a keeper has loaded,
// or a tile's cleared nodes would be forgotten the moment it streamed out. Placement is the game's own placeNodes,
// so the index and a live tile can never disagree (ather.test re-checks one tile against it).
//   npx tsx tools/worldmap/index_wilds.ts
import { readFileSync, writeFileSync } from 'fs'
import { parseWilds, type WildsMeta } from '../../src/app/shimmer/open/ather/wilds'
import { placeNodes } from '../../src/app/shimmer/open/ather/nodes'
import { GREG_WAYMARK } from '../../src/app/shimmer/open/ather/waymarks'

const DIR = new URL('../../public/open/wilds/', import.meta.url).pathname
const idx = JSON.parse(readFileSync(DIR + 'tiles.json', 'utf8'))
let total = 0
for (const t of idx.tiles) {
  const meta = JSON.parse(readFileSync(DIR + t.name + '.json', 'utf8')) as WildsMeta
  const b = readFileSync(DIR + t.name + '.bin'), bio = readFileSync(DIR + t.name + '.biome')
  const W = parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio))
  // Greg's waymark keeps its stray-free ring on its own tile; elsewhere nothing is held back
  const safe = t.name === GREG_WAYMARK.tile ? GREG_WAYMARK : { x: 1e9, z: 1e9 }
  t.nodes = placeNodes(W, t.name, safe).map(n => ({ id: n.id, biome: n.biome, x: n.x, z: n.z, i: n.i, j: n.j }))
  total += t.nodes.length
}
writeFileSync(DIR + 'tiles.json', JSON.stringify(idx))
console.log(`${idx.tiles.length} tiles, ${total} nodes`)
