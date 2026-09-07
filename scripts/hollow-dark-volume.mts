// ── How much DARK, STANDABLE space does the world actually have, and where is it? ──────────────
//
// The Hollow spawner only ever considers the top of a column, so a spot at light level 0 that is
// not the surface can never body one. Before building the Y axis, measure what the Y axis would
// BUY: build a real light field the way the host does and count the cells that are (a) somewhere a
// body could stand and (b) dark by `spawnDark`'s rule.
//
// ⚠ THIS MEASURES THE GENERATED WORLD, NOT A LIVE ONE. No player edits, no built roofs, no torches
// (nothing emits yet anyway). It answers "what does worldgen provide", which is the question that
// decides whether the feature has anywhere to happen.
// ⚠ AND IT MIRRORS THE HOST'S LIGHT INPUTS RATHER THAN IMPORTING THEM — they are closures inside a
// React component and cannot be reached. The mirror is stated here so a reader can check it:
// opaque = not AIR, not WATER, not leaves; emit = emitOf; openToSky = above the generated surface;
// bounds = min(surface)-10 .. max(surface)+16 over the 3x3 apron. That is `lightBoundsFor` verbatim.
import { Column, generateColumn, SECTION } from '../src/app/shimmer/voxel/column'
import { MAT } from '../src/app/shimmer/voxel/depth'
import { WOOD } from '../src/app/shimmer/voxel/trees'
import { emitOf } from '../src/app/shimmer/voxel/registry'
import { computeLight, spawnDark, type LightBounds } from '../src/app/shimmer/voxel/light'
import { greyness } from '../src/app/shimmer/voxel/biome'
import { columnHeight } from '../src/app/shimmer/voxel/height'

const SEED = 1337
const AIR = 0
const H = 256
const NIGHT_SKY_MAX = 7
const LIGHT_PASSES = new Set<number>([
  WOOD.GOLDWOOD_LEAVES, WOOD.SHIMMEROAK_LEAVES, WOOD.STARWILLOW_LEAVES, WOOD.DAWNWOOD_LEAVES,
])

function apron(cx: number, cz: number) {
  const cols = new Map<string, Column>()
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const c = generateColumn(new Column((cx + dx) * SECTION, (cz + dz) * SECTION), SEED)
    cols.set(`${cx + dx},${cz + dz}`, c)
  }
  const voxel = (x: number, y: number, z: number): number => {
    if (y < 0 || y >= H) return AIR
    const gx = Math.floor(x / SECTION), gz = Math.floor(z / SECTION)
    const c = cols.get(`${gx},${gz}`)
    if (!c) return AIR
    const s = c.sections[(y / SECTION) | 0]
    if (!s) return AIR
    return s.get(((x % SECTION) + SECTION) % SECTION, y % SECTION, ((z % SECTION) + SECTION) % SECTION)
  }
  // lightBoundsFor, verbatim
  const centre = cols.get(`${cx},${cz}`)!
  let lo = H - 1, hi = 0
  for (let i = 0; i < SECTION * SECTION; i++) {
    const s = centre.surface[i]
    if (s < lo) lo = s
    if (s > hi) hi = s
  }
  const y0 = Math.max(0, lo - 10)
  const bounds: LightBounds = {
    x0: cx * SECTION - SECTION, y0, z0: cz * SECTION - SECTION,
    sx: SECTION * 3, sy: Math.min(H, hi + 16) - y0, sz: SECTION * 3,
  }
  const field = computeLight(bounds, {
    opaque: (x, y, z) => { const m = voxel(x, y, z); return m !== AIR && m !== MAT.WATER && !LIGHT_PASSES.has(m) },
    emit: (x, y, z) => emitOf(voxel(x, y, z)),
    openToSky: (x, z, y) => y > columnHeight(x, z, SEED),
  })
  return { voxel, bounds, field }
}

/** Could a body stand with its feet here? MC's rule: solid full top below, two cells of space. */
const standable = (voxel: (x: number, y: number, z: number) => number, x: number, y: number, z: number): boolean => {
  const below = voxel(x, y - 1, z)
  if (below === AIR || below === MAT.WATER) return false
  return voxel(x, y, z) === AIR && voxel(x, y + 1, z) === AIR
}

const places: [string, number, number][] = [
  ['deep wilds +x  (grey 1.0 — the gate is OPEN here)', 6000, 3000],
  ['THE OUTFIELDS  (grey ~0 — gated off today)', 3700, 1000],
  ['moonwell glade (home, tended)', -150, -640],
]
const COLS = 12   // columns sampled per place, spiralling out from the anchor

console.log('Per place: what the spawner can see TODAY vs what a Y axis would add.')
console.log('"today" = the single cell at columnHeight+1, which is the only candidate the sweep rolls.')
console.log('⚠ generated world only: no player edits, no built roofs. n = ' + COLS + ' columns per place.\n')

for (const [name, wx, wz] of places) {
  const bcx = Math.floor(wx / SECTION), bcz = Math.floor(wz / SECTION)
  let today = 0, todayDark = 0
  let stand = 0, standBelow = 0, darkNight = 0, darkNightBelow = 0, darkNoon = 0
  let greySum = 0, caveCols = 0
  for (let n = 0; n < COLS; n++) {
    const cx = bcx + ((n % 4) - 2) * 2, cz = bcz + (Math.floor(n / 4) - 1) * 2
    const { voxel, bounds, field } = apron(cx, cz)
    let caveHere = 0
    for (let z = cz * SECTION; z < cz * SECTION + SECTION; z++)
      for (let x = cx * SECTION; x < cx * SECTION + SECTION; x++) {
        greySum += greyness(x, z, SEED)
        const sh = columnHeight(x, z, SEED)
        // ── exactly what the sweep rolls today ──
        today++
        if (standable(voxel, x, sh + 1, z) && spawnDark(field.get(x, sh + 1, z), 0, NIGHT_SKY_MAX)) todayDark++
        // ── every cell the Y axis could reach, inside the light box the host already builds ──
        for (let y = bounds.y0 + 1; y < bounds.y0 + bounds.sy - 1; y++) {
          if (!standable(voxel, x, y, z)) continue
          const below = y <= sh
          stand++; if (below) { standBelow++; caveHere++ }
          const packed = field.get(x, y, z)
          if (spawnDark(packed, 0, NIGHT_SKY_MAX)) { darkNight++; if (below) darkNightBelow++ }
          if (spawnDark(packed, 1, NIGHT_SKY_MAX)) darkNoon++
        }
      }
    if (caveHere > 0) caveCols++
  }
  console.log(name)
  console.log(`  mean greyness ${(greySum / today).toFixed(3)}   columns with any sub-surface standing room: ${caveCols}/${COLS}`)
  console.log(`  TODAY  the sweep can roll ${today} cells, ${todayDark} of them dark at midnight`)
  console.log(`  Y AXIS reaches ${stand} standable cells (${standBelow} below the surface)`)
  console.log(`         dark at MIDNIGHT ${darkNight}  (${darkNightBelow} of them sub-surface)  = ${(darkNight / Math.max(1, todayDark)).toFixed(2)}x today`)
  console.log(`         dark at NOON     ${darkNoon}  — today the sweep does not run at all by day\n`)
}
