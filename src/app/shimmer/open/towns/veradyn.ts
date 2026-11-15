// VERADYN on the continent (Jin play lane, 2026-11-15). ★ PURE.
//
// Canon (Magii + Alex 11-15, world/geography.md › THE TOWNS IN 1672): "the mainland face, islands across the water".
// The drivable Veradyn is the SHORE side (waterfront, grown stone, the Private Port near Shoalhaven); the islands
// (the living maze, the Athenaeum, the Barrier Temple on the height) are SEEN across the water, and a ferry is lawful.
// Veradyn is a NE tropical archipelago of LIVING architecture (locations.md, veradyn-arc.md: buildings grown from the
// Network, fungal structures and stone merged; the Barrier Temple on the height).
//
// The Atlas dot sits at sea in the archipelago with no road near it, so this finds the land itself:
//   · the MAINLAND = land connected to the road network; the shore town stands on its coast nearest the dot
//   · the ISLES = the land masses round the dot that are not mainland; they get the grown city
//   · the BARRIER TEMPLE stands on the highest isle's crown.
import { nearestRoad, type Region, type RegionPlace } from '../region'

export interface Isle { x: number; z: number; r: number; top: number; cells: number }
export interface VeradynSites { shore: { x: number; z: number; y: number; toIsles: number } | null; isles: Isle[]; temple: { x: number; z: number; y: number } | null }

const STEP = 20, REACH = 2600
const cache = new WeakMap<Region, VeradynSites>()

export function veradynSites(R: Region): VeradynSites {
  const hit = cache.get(R); if (hit) return hit
  const v = R.meta.places.find(p => p.id === 'veradyn') as RegionPlace | undefined
  const out: VeradynSites = { shore: null, isles: [], temple: null }
  if (!v) { cache.set(R, out); return out }
  const N = Math.floor(2 * REACH / STEP) + 1, x0 = v.x - REACH, z0 = v.z - REACH
  const land = new Uint8Array(N * N), comp = new Int32Array(N * N).fill(-1)
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const y = R.heightAt(x0 + i * STEP, z0 + j * STEP); land[j * N + i] = Number.isFinite(y) && y >= 1.5 ? 1 : 0 }
  // land masses (8-connected), and which touch a road (the mainland)
  const comps: { cells: number[]; road: boolean }[] = []
  for (let k = 0; k < N * N; k++) {
    if (!land[k] || comp[k] >= 0) continue
    const id = comps.length, cells: number[] = [], stack = [k]
    comp[k] = id
    while (stack.length) {
      const c = stack.pop()!; cells.push(c)
      const ci = c % N, cj = (c - ci) / N
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue
        const n = nj * N + ni; if (land[n] && comp[n] < 0) { comp[n] = id; stack.push(n) }
      }
    }
    let road = false
    for (let s = 0; s < cells.length && !road; s += Math.max(1, Math.floor(cells.length / 60))) {
      const c = cells[s], nr = nearestRoad(R, x0 + (c % N) * STEP, z0 + Math.floor(c / N) * STEP)
      if (nr.d < 60) road = true
    }
    comps.push({ cells, road })
  }
  const at = (c: number) => [x0 + (c % N) * STEP, z0 + Math.floor(c / N) * STEP] as const
  // the shore town: the mainland's coastal cell nearest the dot
  let best = Infinity
  for (const cp of comps) if (cp.road) for (const c of cp.cells) {
    const ci = c % N, cj = (c - ci) / N
    const coast = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => { const ni = ci + di, nj = cj + dj; return ni >= 0 && nj >= 0 && ni < N && nj < N && !land[nj * N + ni] })
    if (!coast) continue
    const [x, z] = at(c), d = Math.hypot(x - v.x, z - v.z)
    if (d < best) { best = d; out.shore = { x, z, y: R.heightAt(x, z), toIsles: Math.atan2(v.z - z, v.x - x) } }
  }
  // the isles round the dot
  for (const cp of comps) {
    if (cp.road || cp.cells.length < 6) continue
    let sx = 0, sz = 0, top = -Infinity, tx = 0, tz = 0
    for (const c of cp.cells) { const [x, z] = at(c); sx += x; sz += z; const y = R.heightAt(x, z); if (y > top) { top = y; tx = x; tz = z } }
    const cx = sx / cp.cells.length, cz = sz / cp.cells.length
    if (Math.hypot(cx - v.x, cz - v.z) > 1500) continue
    out.isles.push({ x: tx, z: tz, r: Math.sqrt(cp.cells.length * STEP * STEP / Math.PI), top, cells: cp.cells.length })
  }
  out.isles.sort((a, b) => b.top - a.top)
  if (out.isles.length) out.temple = { x: out.isles[0].x, z: out.isles[0].z, y: out.isles[0].top }
  cache.set(R, out)
  return out
}

/** The ferry to the isles (canon: "a ferry is lawful"; transportation.md gives short island hops to RINNING boats).
 *  Same shape as the network's Shellback ferries (region.ts RegionFerry), so the page's ferry code takes it as is:
 *  `a` is the waterfront quay at the pier's root, `b` the landing on the Barrier Temple's isle, its coast point nearest
 *  the waterfront. Added to the region at load (continent/page.tsx), never written into the exported map. */
export function veradynFerry(R: Region): { id: string; edge: string; kind: 'trail'; length: number; a: [number, number, number]; b: [number, number, number] } | null {
  const v = veradynSites(R)
  if (!v.shore || !v.isles.length) return null
  const isle = v.isles[0], s = v.shore
  // walk from the isle's crown toward the waterfront until the land runs out: that is the landing
  const dx = s.x - isle.x, dz = s.z - isle.z, L = Math.hypot(dx, dz)
  let bx = isle.x, bz = isle.z
  for (let d = 0; d < L; d += 4) {
    const x = isle.x + dx / L * d, z = isle.z + dz / L * d
    if (R.heightAt(x, z) < 1.5) break
    bx = x; bz = z
  }
  return { id: 'veradyn-rinning', edge: '', kind: 'trail', length: Math.round(Math.hypot(bx - s.x, bz - s.z)), a: [s.x, s.z, R.heightAt(s.x, s.z)], b: [bx, bz, R.heightAt(bx, bz)] }
}
