// Ruin size sweep — how big is a ruin, across a slab of real country?
//
// The `sizeBias` in `voxel/ruins.ts` was tuned HERE and not by eye, the same way sites.ts's
// density was: breadth-first expansion opens three sockets per piece, so intuition about "a coin
// flip per socket" is simply wrong — at sprawl 0.4 through 0.75 the assembly saturated at the
// piece cap on 37% → 98% of sites. Re-run this whenever the piece pool's SIZES change; the shape
// of the distribution is the thing being tuned, not the average.
//
// Run: npx tsx scripts/ruin-sweep.mts
import { siteAt } from '../src/app/shimmer/voxel/sites'
import { ruinPlan, DEFAULT_RUINS } from '../src/app/shimmer/voxel/ruins'
const SEED = 1337
for (const sizeBias of [1, 1.6, 2.2, 3]) {
  const hist = new Map<number, number>(); let reach = 0; let cells = 0; let n = 0
  for (let cz = -60; cz <= 60; cz++) for (let cx = -60; cx <= 60; cx++) {
    const s = siteAt(SEED, cx, cz); if (!s) continue
    const parts = ruinPlan(s, SEED, { ...DEFAULT_RUINS, sizeBias })
    n++; hist.set(parts.length, (hist.get(parts.length) ?? 0) + 1)
    for (const p of parts) {
      reach = Math.max(reach, Math.abs(p.x0 - s.x), Math.abs(p.x1 - s.x), Math.abs(p.z0 - s.z), Math.abs(p.z1 - s.z))
      cells += (p.x1 - p.x0 + 1) * (p.z1 - p.z0 + 1)
    }
  }
  const h = [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${((v / n) * 100) | 0}%`).join(' ')
  console.log(`sizeBias ${sizeBias}  n=${n}  maxreach=${reach}  avgcells=${(cells / n) | 0}  ${h}`)
}
