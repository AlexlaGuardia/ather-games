// bake-path-profiles.mts — THE WILDS PATHS' OWN HEIGHT (BETA M18, Alex 11-18: "sculpt the terrain around the roads").
//
//   npx tsx scripts/bake-path-profiles.mts [--season 1] [--dry]
//
// Adds a third number to every point of every path in public/open/wilds/network-s<N>.json: the PATH'S height there. The
// profile is the raw ground along the path (the tiles the bake-wilds-network script routed on), resampled at 2 m, smoothed
// over ~30 m (no washboard), then held to MAX_GRADE both ways, and read back at the path's own points. Each end is pinned
// to the raw ground, so a path meets a settlement's flat disc (and Greg's stone) where the ground is.
// The page then CUTS and FILLS the land to meet it (ather/relief.ts sculpt): cuttings through the M16 hills, low banks over
// dips, verges as wide as the height gap needs. Same as the continent's roads (tools/worldmap/export_region.py).
// Idempotent: run it again and the same numbers come out (it reads only x, z). Run after bake-wilds-network.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseWilds, type WildsMeta, type Wilds } from '../src/app/shimmer/open/ather/wilds'
import { TILE_M } from '../src/app/shimmer/open/ather/wilds-world'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../public/open/wilds')
const argv = process.argv.slice(2)
const SEASON = Number(argv[argv.indexOf('--season') + 1]) || 1, DRY = argv.includes('--dry')
// MAX_GRADE = the continent's 'trail' cap (export_region.py). MAX_CUT: a path never cuts or fills more than this; where the land
// is steeper than the cap for longer than that allows (a ridge in the far west climbs 0.42), the path climbs it as it is.
export const STEP = 2, HALF_WINDOW = 15, MAX_GRADE = 0.18, MAX_CUT = 6

const index = JSON.parse(readFileSync(join(DIR, 'tiles.json'), 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }
const byXY = new Map(index.tiles.map(t => [`${t.tx},${t.ty}`, t.name]))
const cache = new Map<string, Wilds | null>()
const tile = (name: string) => {
  if (!cache.has(name)) {
    const meta = JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8')) as WildsMeta
    const b = readFileSync(join(DIR, `${name}.bin`)), bio = readFileSync(join(DIR, `${name}.biome`))
    cache.set(name, parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), undefined, undefined, false))
  }
  return cache.get(name)!
}
/** the RAW ground at a world point (no relief: the profile is what the land was, before any sculpting) */
const rawAt = (x: number, z: number): number => {
  const tx = Math.floor((x + TILE_M / 2) / TILE_M), ty = Math.floor((z + TILE_M / 2) / TILE_M), name = byXY.get(`${tx},${ty}`)
  const W = name ? tile(name) : null
  return W ? W.heightAt(x - tx * TILE_M, z - ty * TILE_M) : NaN
}

const net = JSON.parse(readFileSync(join(DIR, `network-s${SEASON}.json`), 'utf8')) as { paths: { pts: number[][] }[] }
let worst = 0, n = 0, deep = 0, pinned = 0, clamped = 0, total = 0
for (const p of net.paths) {
  const P = p.pts.map(q => [q[0], q[1]])
  // resample at STEP, remembering where each original point falls
  const xs: number[] = [], zs: number[] = [], at: number[] = [0]
  for (let k = 0; k < P.length - 1; k++) {
    const [ax, az] = P[k], [bx, bz] = P[k + 1], L = Math.hypot(bx - ax, bz - az), m = Math.max(1, Math.round(L / STEP))
    for (let s = 0; s < m; s++) { xs.push(ax + ((bx - ax) * s) / m); zs.push(az + ((bz - az) * s) / m) }
    at.push(xs.length)
  }
  xs.push(P[P.length - 1][0]); zs.push(P[P.length - 1][1])
  const raw = xs.map((x, i) => rawAt(x, zs[i]))
  for (let i = 0; i < raw.length; i++) if (!Number.isFinite(raw[i])) raw[i] = raw[i - 1] ?? raw.find(Number.isFinite) ?? 0
  // smooth twice (a box over ±HALF_WINDOW m), ends pinned
  let y = raw.slice()
  const w = Math.round(HALF_WINDOW / STEP)
  for (let pass = 0; pass < 2; pass++) {
    const o = y.slice()
    for (let i = 1; i < y.length - 1; i++) { let s = 0, c = 0; for (let k = Math.max(0, i - w); k <= Math.min(y.length - 1, i + w); k++) { s += y[k]; c++ } o[i] = s / c }
    y = o
  }
  // grade cap: the mean of the LOWER envelope (min over j of y_j + g|i-j|) and the UPPER one (max over j of y_j - g|i-j|).
  // Each envelope is held to the grade by construction (two passes each way), so their mean is too, with no jump anywhere
  // (picking per point between a forward and a backward pass jumped up to 37 m: tried first, refused).
  const g = MAX_GRADE * STEP, lo = y.slice(), hi = y.slice()
  for (let i = 1; i < y.length; i++) { lo[i] = Math.min(lo[i], lo[i - 1] + g); hi[i] = Math.max(hi[i], hi[i - 1] - g) }
  for (let i = y.length - 2; i >= 0; i--) { lo[i] = Math.min(lo[i], lo[i + 1] + g); hi[i] = Math.max(hi[i], hi[i + 1] - g) }
  const fin = y.map((_, i) => Math.max(raw[i] - MAX_CUT, Math.min(raw[i] + MAX_CUT, (lo[i] + hi[i]) / 2)))
  clamped += fin.filter((v, i) => Math.abs(v - raw[i]) >= MAX_CUT - 1e-6).length; total += fin.length
  for (let i = 0; i < fin.length; i++) { const d = Math.abs(fin[i] - raw[i]); if (d > deep) { deep = d; if (process.env.WHERE) console.log('deep', d.toFixed(1), 'at', Math.round(xs[i]), Math.round(zs[i]), 'raw', raw[i].toFixed(1), 'fin', fin[i].toFixed(1), 'nanRaw', raw.filter(v => !Number.isFinite(v)).length, 'raw window', raw.slice(Math.max(0, i - 40), i + 40).filter((_, k) => k % 10 === 0).map(v => v.toFixed(0)).join(',')) } }
  pinned = Math.max(pinned, Math.abs(fin[0] - raw[0]), Math.abs(fin[fin.length - 1] - raw[raw.length - 1]))
  for (let i = 1; i < fin.length; i++) worst = Math.max(worst, Math.abs(fin[i] - fin[i - 1]) / STEP)
  p.pts = P.map((q, k) => [q[0], q[1], Math.round(fin[at[k]] * 100) / 100])
  n += P.length
}
console.log(`profiled ${net.paths.length} paths, ${n} points; steepest 2 m step after the cap: ${worst.toFixed(3)} (cap ${MAX_GRADE}); deepest cut/fill vs raw ${deep.toFixed(2)} m; ends off the ground by at most ${pinned.toFixed(2)} m; held at the ${MAX_CUT} m cut limit ${(100 * clamped / total).toFixed(1)} % of the length`)
if (!DRY) { writeFileSync(join(DIR, `network-s${SEASON}.json`), JSON.stringify(net)); console.log(`wrote public/open/wilds/network-s${SEASON}.json`) }
