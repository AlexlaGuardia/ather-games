// Throwaway probe: how much ground clears `hollowEligible`'s greyness >= 0.5 gate, by place.
// Answers "why has nothing spawned" from the WORLD side, before touching the light side.
import { greyness } from '../src/app/shimmer/voxel/biome'
import { ZONE_ANCHORS } from '../src/app/shimmer/voxel/zones'
const SEED = 1337
const R = 96          // the load edge — the ground a standing keeper can actually spawn on
const STEP = 4
type Row = { name: string; x: number; z: number; pass: number; total: number; max: number; mean: number }
const rows: Row[] = []
const sample = (name: string, cx: number, cz: number) => {
  let pass = 0, total = 0, max = 0, sum = 0
  for (let dz = -R; dz <= R; dz += STEP) for (let dx = -R; dx <= R; dx += STEP) {
    if (Math.hypot(dx, dz) > R) continue
    const g = greyness(cx + dx, cz + dz, SEED)
    total++; sum += g; if (g > max) max = g
    if (g >= 0.5) pass++
  }
  rows.push({ name, x: cx, z: cz, pass, total, max, mean: sum / total })
}
for (const z of ZONE_ANCHORS) sample(z.id, z.x, z.z)
sample('outfields NE rim', 4400, 1600)
sample('deep wilds +x', 6000, 3000)
sample('deep wilds -x', -6000, -3000)
sample('far frayed edge', 12000, 9000)
rows.sort((a, b) => b.pass / b.total - a.pass / a.total)
console.log('greyness >= 0.5 within r=96 of each anchor (the whole spawnable disc)')
for (const r of rows) {
  console.log(
    `${(100 * r.pass / r.total).toFixed(1).padStart(6)}%  max=${r.max.toFixed(3)}  mean=${r.mean.toFixed(3)}  ${r.name} (${r.x},${r.z})`,
  )
}

// ── The number that actually matters: standing HERE, is there any eligible ground in reach? ──
// A keeper's spawn disc is PLAYER_EXCLUSION(24)..despawn(96). Sample stands across a region and
// ask what fraction of them have ANY column clearing greyness>=0.5 inside that annulus.
const standCheck = (name: string, cx: number, cz: number, rx: number, rz: number) => {
  let any = 0, stands = 0, sumFrac = 0
  for (let i = 0; i < 400; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random())
    const px = cx + Math.cos(a) * rx * r, pz = cz + Math.sin(a) * rz * r
    stands++
    let hit = 0, n = 0
    for (let dz = -96; dz <= 96; dz += 6) for (let dx = -96; dx <= 96; dx += 6) {
      const d = Math.hypot(dx, dz)
      if (d < 24 || d > 96) continue
      n++
      if (greyness(px + dx, pz + dz, SEED) >= 0.5) hit++
    }
    sumFrac += hit / n
    if (hit > 0) any++
  }
  console.log(`${name}: ${(100 * any / stands).toFixed(1)}% of stands have ANY eligible ground in the 24..96 annulus; mean eligible fraction ${(100 * sumFrac / stands).toFixed(2)}%`)
}
console.log('')
standCheck('THE OUTFIELDS', 3700, 1000, 900, 750)
standCheck('deep wilds +x', 6000, 3000, 900, 750)
standCheck('garden (home)', 0, 0, 380, 340)
