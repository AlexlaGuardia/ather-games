// ── IS A CLOSED CANOPY FLOOR BLACK AT NOON, AND DOES THE THICKET READ AS TWILIGHT? ─────────────
//
// Run: npx tsx scripts/canopy-floor.mts [zone-id ...]      (default: moonwell-glade twilight-thicket)
//
// ★ WHY THIS EXISTS, AND WHY IT IS NOT A COPY OF canopy-light.mts. That tool asked whether the
// shipped field blacks out a forest floor and answered at ONE place: Moonwell Glade, `forest: 0.35`.
// Its own header states the mechanism it was hunting — leaves are opaque to render-light and light
// dies in 15 steps, so "a forest interior more than fifteen blocks from a canopy edge can only be
// lit from the side". A 0.35 canopy is full of edges. `twilight-thicket` is `forest: 0.97` across
// 800x650 blocks, which is the one place in the world where a keeper can stand a long way from any
// edge — i.e. exactly the case that mechanism predicts, measured nowhere.
//
// ⚠ THE SURFACE WAS THE THING render-light PROMISED NOT TO TOUCH. Sky 15 gives shading exactly 1.0,
// so an unlit column renders as the game did before. A closed canopy is where that promise is
// cashed, and canon named the place TWILIGHT before any of this existed, so "dark" here is a look
// to be judged and not automatically a defect. This reports the distribution and refuses to grade it.
//
// ── THE CONTROL, and it is the strongest one available ─────────────────────────────────────────
// Running the Glade must reproduce canopy-light.mts's published figure (93.5% of standing ground at
// full sky, 5.4% of canopied ground near the floor). A different tool, the same place, the same
// number. If that does not land, every Thicket figure below is a statement about this file.
import { makeColumn, SECTION } from '../src/app/shimmer/voxel/column'
import { isLeafMat } from '../src/app/shimmer/voxel/trees'
import { computeRenderLight, li } from '../src/app/shimmer/voxel/render-light'
import { newLightRing, recenterRing, nextDirtyColumn, incomingFor, publishSpill } from '../src/app/shimmer/voxel/render-light-ring'
import { isSolid } from '../src/app/shimmer/voxel/depth'
import { columnHeight } from '../src/app/shimmer/voxel/height'
import { ZONE_ANCHORS } from '../src/app/shimmer/voxel/zones'

const SEED = 1337
const R = 4                      // ring half-width in columns; sampled 3x3 sits >=48 blocks inside it
const NEAR_FLOOR = 3             // "near the shader floor", canopy-light.mts's own threshold

function measure(id: string) {
  const z = ZONE_ANCHORS.find(a => a.id === id)
  if (!z) { console.log(`no zone '${id}'`); return }
  const CX = Math.floor(z.x / SECTION), CZ = Math.floor(z.z / SECTION)

  const cols = new Map<string, ReturnType<typeof makeColumn>>()
  const colAt = (cx: number, cz: number) => {
    const k = `${cx},${cz}`
    let c = cols.get(k)
    if (!c) { c = makeColumn(cx * SECTION, cz * SECTION, SEED); cols.set(k, c) }
    return c
  }
  const matAt = (x: number, y: number, zz: number): number => {
    if (y < 0 || y >= 256) return 0
    const cx = Math.floor(x / SECTION), cz = Math.floor(zz / SECTION)
    return colAt(cx, cz).get(x - cx * SECTION, y, zz - cz * SECTION)
  }

  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) colAt(CX + dx, CZ + dz)
  const ring = newLightRing()
  recenterRing(ring, CX, CZ)
  const fields = new Map<string, ReturnType<typeof computeRenderLight>>()
  let passes = 0
  for (;;) {
    const c = nextDirtyColumn(ring)
    if (!c || ++passes > 4000) break
    const f = computeRenderLight(c.cx * SECTION, c.cz * SECTION, matAt, incomingFor(ring, c.cx, c.cz))
    publishSpill(ring, c.cx, c.cz, f.spill)
    fields.set(`${c.cx},${c.cz}`, f)
  }

  const hist = new Map<number, number>()
  let open = 0, underCanopy = 0, canopyDark = 0, buriedDark = 0
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const f = fields.get(`${CX + dx},${CZ + dz}`)
    if (!f) continue
    const bx = (CX + dx) * SECTION, bz = (CZ + dz) * SECTION
    for (let lz = 0; lz < SECTION; lz++) for (let lx = 0; lx < SECTION; lx++) {
      // ⚠ THE STANDING CELL IS ONE ABOVE THE GENERATED TERRAIN, NOT ABOVE THE TOP SOLID BLOCK.
      // The first version of this file scanned down from y=255 for the first solid, which under a
      // closed canopy is a LEAF — so it sampled the cell above the treetops, found open sky, and
      // reported 0 canopied cells at a place that is 97% forest. The control caught it.
      const stand = columnHeight(bx + lx, bz + lz, SEED) + 1
      if (stand >= 255) continue
      const sky = f.sky[li(lx, stand, lz)]
      hist.set(sky, (hist.get(sky) ?? 0) + 1)
      // is there leaf overhead?
      let leaf = false
      for (let yy = stand + 1; yy < Math.min(256, stand + 40) && !leaf; yy++) if (isLeafMat(matAt(bx + lx, yy, bz + lz))) leaf = true
      if (leaf) { underCanopy++; if (sky <= NEAR_FLOOR) { canopyDark++; if (isSolid(matAt(bx + lx, stand, bz + lz))) buriedDark++ } } else open++
    }
  }
  const total = open + underCanopy
  const full = hist.get(15) ?? 0
  console.log(`\n── ${id}  (forest ${z.forest}, centre ${z.x},${z.z})  ${passes} passes`)
  console.log(`standing cells: ${total}   under canopy ${underCanopy}   open ${open}`)
  console.log(`at FULL sky (15): ${full}  = ${(100 * full / total).toFixed(1)}% of standing ground`)
  // ⚠ A DARK CELL IS ONLY A DARK FLOOR IF A KEEPER COULD STAND IN IT. columnHeight is the
  // GENERATED terrain, so wherever anything sits on top of it — a trunk, a low leaf, a hold pad —
  // the cell one above the terrain is inside solid matter: correctly sky 0, and nothing anyone sees.
  //
  // ⚠⚠ AND THE INDENTED LINE USED TO PRINT DIRECTLY UNDER THE FULL-SKY LINE WHILE COUNTING THE
  // DARK ONES. At the Glade it read "4" beneath a "2155", which parses as "4 of 2155 full-sky
  // cells are solid" and is wrong by every reading. The hub lane only worked out what it meant by
  // diffing it against their own numbers. A label that has to be decoded is a label that will be
  // miscited: the count now sits under the line it belongs to and names its own denominator.
  console.log(`canopied ground at or below sky ${NEAR_FLOOR}: ${canopyDark}` +
    `  = ${underCanopy ? (100 * canopyDark / underCanopy).toFixed(1) : '0.0'}% of canopied ground`)
  console.log(`  of those ${canopyDark} dark cells, SOLID at standing height (not floor): ${buriedDark}` +
    `   → STANDABLE dark floor: ${canopyDark - buriedDark}`)
  const keys = [...hist.keys()].sort((a, b) => b - a)
  for (const k of keys) console.log(`  sky ${String(k).padStart(2)}  ${String(hist.get(k)).padStart(5)}  ${'#'.repeat(Math.round(56 * hist.get(k)! / total))}`)
}

const ids = process.argv.slice(2)
for (const id of (ids.length ? ids : ['moonwell-glade', 'twilight-thicket'])) measure(id)
console.log(`\n⚠ CONTROL: the moonwell-glade line must match canopy-light.mts (93.5% full sky,`)
console.log(`   5.4% of canopied ground near the floor). If it does not, read no further.`)
