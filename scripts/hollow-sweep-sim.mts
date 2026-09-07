// ── Does the shipped Y roll actually find ground in the REAL world? ───────────────────────────
// The unit guards are pure and source-text. This runs the SHIPPED functions (`pickSpawnY`,
// `hollowFoots`, `hollowEligible`) against generated terrain and a real light field, and counts
// anchor attempts that succeed — before (column top only) vs after (the whole line).
// ⚠ Generated world, no player edits. It answers "does worldgen give this feature anywhere to
// happen", which is the question the unit tests structurally cannot.
import { Column, generateColumn, SECTION } from '../src/app/shimmer/voxel/column'
import { MAT } from '../src/app/shimmer/voxel/depth'
import { WOOD } from '../src/app/shimmer/voxel/trees'
import { emitOf } from '../src/app/shimmer/voxel/registry'
import { computeLight, spawnDark, type LightBounds, type LightField } from '../src/app/shimmer/voxel/light'
import { columnHeight } from '../src/app/shimmer/voxel/height'
import { DEFAULT_DEPTH } from '../src/app/shimmer/voxel/depth'
import { pickSpawnY, hollowFoots, hollowEligible, NIGHT_SKY_MAX } from '../src/app/shimmer/voxel3d/hollows'

const SEED = 1337, AIR = 0, H = 256
const LIGHT_PASSES = new Set<number>([
  WOOD.GOLDWOOD_LEAVES, WOOD.SHIMMEROAK_LEAVES, WOOD.STARWILLOW_LEAVES, WOOD.DAWNWOOD_LEAVES,
])
function apron(cx: number, cz: number) {
  const cols = new Map<string, Column>()
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
    cols.set(`${cx + dx},${cz + dz}`, generateColumn(new Column((cx + dx) * SECTION, (cz + dz) * SECTION), SEED))
  const voxel = (x: number, y: number, z: number): number => {
    if (y < 0 || y >= H) return AIR
    const gx = Math.floor(x / SECTION), gz = Math.floor(z / SECTION)
    const c = cols.get(`${gx},${gz}`); if (!c) return AIR
    const s = c.sections[(y / SECTION) | 0]; if (!s) return AIR
    return s.get(((x % SECTION) + SECTION) % SECTION, y % SECTION, ((z % SECTION) + SECTION) % SECTION)
  }
  const centre = cols.get(`${cx},${cz}`)!
  let lo = H - 1, hi = 0
  for (let i = 0; i < SECTION * SECTION; i++) { const s = centre.surface[i]; if (s < lo) lo = s; if (s > hi) hi = s }
  const y0 = Math.max(0, lo - 10)
  const bounds: LightBounds = { x0: cx * SECTION - SECTION, y0, z0: cz * SECTION - SECTION,
                                sx: SECTION * 3, sy: Math.min(H, hi + 16) - y0, sz: SECTION * 3 }
  const field = computeLight(bounds, {
    opaque: (x, y, z) => { const m = voxel(x, y, z); return m !== AIR && m !== MAT.WATER && !LIGHT_PASSES.has(m) },
    emit: (x, y, z) => emitOf(voxel(x, y, z)),
    openToSky: (x, z, y) => y > columnHeight(x, z, SEED),
  })
  return { voxel, field }
}
// the SHIPPED roll, exactly as VoxelWorld's `spawnFootY` builds it
const footY = (voxel: (x: number, y: number, z: number) => number, lf: LightField,
               wx: number, wz: number, day: number): number => {
  const b = lf.bounds
  return pickSpawnY(Math.max(b.y0 + 1, 1), Math.min(b.y0 + b.sy - 2, H - 2),
    (y) => hollowFoots(y,
      (fy) => { const m = voxel(wx, fy, wz); return m !== AIR && m !== MAT.WATER },
      (cy) => voxel(wx, cy, wz) === AIR),
    (y) => spawnDark(lf.get(wx, y, wz), day, NIGHT_SKY_MAX),
    Math.random)
}
const APRONS = 24, ANCHORS_PER = 400
for (const [name, wx, wz] of [['deep wilds +x (grey)', 6000, 3000],
                              ['THE OUTFIELDS', 3700, 1000]] as [string, number, number][]) {
  const bcx = Math.floor(wx / SECTION), bcz = Math.floor(wz / SECTION)
  const stats = new Map<string, { old: number; nw: number; below: number; n: number }>()
  for (let a = 0; a < APRONS; a++) {
    const cx = bcx + (a % 6) - 3, cz = bcz + Math.floor(a / 6) - 2
    const { voxel, field } = apron(cx, cz)
    for (const [hour, day] of [['MIDNIGHT', 0], ['NOON', 1]] as [string, number][]) {
      const k = hour
      const st = stats.get(k) ?? { old: 0, nw: 0, below: 0, n: 0 }
      for (let i = 0; i < ANCHORS_PER; i++) {
        const ax = cx * SECTION + Math.floor(Math.random() * SECTION)
        const az = cz * SECTION + Math.floor(Math.random() * SECTION)
        const sh = columnHeight(ax, az, SEED)
        st.n++
        if (15 * day <= NIGHT_SKY_MAX
            && spawnDark(field.get(ax, sh + 1, az), day, NIGHT_SKY_MAX)
            && hollowEligible(ax + 0.5, az + 0.5, SEED, field.get(ax, sh + 1, az), day, sh, DEFAULT_DEPTH.seaLevel)) st.old++
        const fy = footY(voxel, field, ax, az, day)
        if (fy >= 0 && hollowEligible(ax + 0.5, az + 0.5, SEED, field.get(ax, fy, az), day, sh, DEFAULT_DEPTH.seaLevel)) {
          st.nw++; if (fy <= sh) st.below++
        }
      }
      stats.set(k, st)
    }
  }
  for (const [hour, st] of stats) {
    const pct = (v: number) => `${(100 * v / st.n).toFixed(2)}%`
    console.log(`${name} @ ${hour} (n=${st.n} anchors over ${APRONS} columns)`)
    console.log(`   before ${pct(st.old)}   after ${pct(st.nw)}   underground ${pct(st.below)}`)
  }
}
