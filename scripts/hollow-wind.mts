// ── Does the shipped Y axis put Hollows where the WIND CANNOT GO? ─────────────────────────────
// Canon 2026-09-07 (THE THIRD PRECONDITION): a Hollow needs a SEED, seeds are wind-borne, and
// "the test is not depth and not light — it is whether the wind could have put a seed there."
// The build gates on drain + dark + standable. It does NOT model wind. So: measure whether any
// cell it would spawn on is actually SEALED (no path through open space to the sky).
// ⚠ If the answer is ~zero, the ruling is satisfied by worldgen rather than by code, and that is
// worth writing down as a PREMISE with a guard — not assumed silently.
import { Column, generateColumn, SECTION } from '../src/app/shimmer/voxel/column'
import { MAT, DEFAULT_DEPTH } from '../src/app/shimmer/voxel/depth'
import { isSolid } from '../src/app/shimmer/voxel/depth'
import { WOOD } from '../src/app/shimmer/voxel/trees'
import { emitOf } from '../src/app/shimmer/voxel/registry'
import { computeLight, spawnDark, type LightBounds } from '../src/app/shimmer/voxel/light'
import { columnHeight } from '../src/app/shimmer/voxel/height'
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
  // ── WIND: flood open space from every sky-open cell in the box, 6-connected. Anything the flood
  // reaches is somewhere the Ather's breath can go, so a seed could have landed there.
  const { x0, y0: by, z0, sx, sy, sz } = bounds
  const idx = (x: number, y: number, z: number) => ((y - by) * sz + (z - z0)) * sx + (x - x0)
  const open = new Uint8Array(sx * sy * sz)          // 1 = wind reaches
  const q: number[] = []
  for (let z = z0; z < z0 + sz; z++) for (let x = x0; x < x0 + sx; x++) {
    const top = by + sy - 1
    for (let y = top; y >= by; y--) {
      if (isSolid(voxel(x, y, z))) break
      if (y > columnHeight(x, z, SEED)) { const i = idx(x, y, z); if (!open[i]) { open[i] = 1; q.push(x, y, z) } }
    }
  }
  for (let h = 0; h < q.length; h += 3) {
    const x = q[h], y = q[h + 1], z = q[h + 2]
    for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
      const nx = x + dx, ny = y + dy, nz = z + dz
      if (nx < x0 || nx >= x0 + sx || ny < by || ny >= by + sy || nz < z0 || nz >= z0 + sz) continue
      const i = idx(nx, ny, nz)
      if (open[i] || isSolid(voxel(nx, ny, nz))) continue
      open[i] = 1; q.push(nx, ny, nz)
    }
  }
  const windReaches = (x: number, y: number, z: number): boolean => {
    if (x < x0 || x >= x0 + sx || y < by || y >= by + sy || z < z0 || z >= z0 + sz) return false
    return open[idx(x, y, z)] === 1
  }
  // ⚠⚠ THE CONTROL THAT MAKES A ZERO MEAN ANYTHING. If this flood marked every open cell as
  // wind-reached, "0 sealed spawns" would be produced by an instrument that CANNOT report sealed —
  // the cheapest wrong answer that satisfies the check. So count the non-solid cells the flood did
  // NOT reach: a non-zero there proves the flood discriminates.
  let openCells = 0, reached = 0
  for (let z = z0; z < z0 + sz; z++) for (let y = by; y < by + sy; y++) for (let x = x0; x < x0 + sx; x++) {
    if (isSolid(voxel(x, y, z))) continue
    openCells++
    if (open[idx(x, y, z)]) reached++
  }
  return { voxel, field, bounds, windReaches, openCells, reached }
}
const footY = (voxel: any, lf: any, wx: number, wz: number, day: number): number => {
  const b = lf.bounds
  return pickSpawnY(Math.max(b.y0 + 1, 1), Math.min(b.y0 + b.sy - 2, H - 2),
    (y) => hollowFoots(y, (fy) => isSolid(voxel(wx, fy, wz)),
                          (cy) => { const m = voxel(wx, cy, wz); return !isSolid(m) && m !== MAT.WATER }),
    (y) => spawnDark(lf.get(wx, y, wz), day, NIGHT_SKY_MAX), Math.random)
}
const APRONS = 24, ANCHORS = 400
for (const [name, wx, wz] of [['deep wilds +x (grey)', 6000, 3000]] as [string, number, number][]) {
  const bcx = Math.floor(wx / SECTION), bcz = Math.floor(wz / SECTION)
  for (const [hour, day] of [['MIDNIGHT', 0], ['NOON', 1]] as [string, number][]) {
    let spawns = 0, sealed = 0, under = 0, underSealed = 0, totOpen = 0, totReached = 0
    for (let a = 0; a < APRONS; a++) {
      const cx = bcx + (a % 6) - 3, cz = bcz + Math.floor(a / 6) - 2
      const { voxel, field, windReaches, openCells, reached } = apron(cx, cz)
      totOpen += openCells; totReached += reached
      for (let i = 0; i < ANCHORS; i++) {
        const ax = cx * SECTION + Math.floor(Math.random() * SECTION)
        const az = cz * SECTION + Math.floor(Math.random() * SECTION)
        const sh = columnHeight(ax, az, SEED)
        const fy = footY(voxel, field, ax, az, day)
        if (fy < 0) continue
        if (!hollowEligible(ax + 0.5, az + 0.5, SEED, field.get(ax, fy, az), day, sh, DEFAULT_DEPTH.seaLevel)) continue
        spawns++
        const windy = windReaches(ax, fy, az)
        if (!windy) sealed++
        if (fy <= sh) { under++; if (!windy) underSealed++ }
      }
    }
    console.log(`${hour}: ${spawns} spawns — ${sealed} in cells the WIND CANNOT REACH (${(100*sealed/Math.max(1,spawns)).toFixed(2)}%)`)
    console.log(`         underground ${under}, of which sealed ${underSealed}`)
    console.log(`   CONTROL: ${totOpen} non-solid cells, ${totReached} wind-reached, `
      + `${totOpen - totReached} SEALED (${(100*(totOpen-totReached)/Math.max(1,totOpen)).toFixed(2)}%) `
      + `— a non-zero here is what proves the flood can report "sealed" at all`)
  }
}
