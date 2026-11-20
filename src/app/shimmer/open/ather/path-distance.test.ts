// pathDistance (indexed, M44 part 3) == the full scan, on the real season network. Run: npx tsx src/app/shimmer/open/ather/path-distance.test.ts
import { readFileSync } from 'node:fs'
import { pathDistance, pathDistanceScan, withGlade, type Network } from './network'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const net = withGlade(JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network)
let s = 7; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296
let worst = 0, n = 0
const pts: [number, number][] = []
for (let i = 0; i < 4000; i++) pts.push([-8500 + rnd() * 12500, -5500 + rnd() * 9500])   // the whole Wilds and past its edges
for (const p of net.paths.slice(0, 40)) for (const [x, z] of p.pts.slice(0, 6)) { pts.push([x, z]); pts.push([x + 3, z - 2]); pts.push([x + 70, z + 33]) }   // on, beside, and near paths
for (const [x, z] of pts) { const b = pathDistanceScan(net, x, z); if (b >= 500) continue; const a = pathDistance(net, x, z, 500); worst = Math.max(worst, Math.abs(a - b)); n++ }
ok(worst < 1e-9 && n > 1000, `indexed (cap 500 m, many rings) == full scan on ${n} points within 500 m of a path (worst diff ${worst})`)
ok(pathDistance(net, 1e6, 1e6) === pathDistanceScan(net, 1e6, 1e6), 'far off the map falls back to the scan, same answer')
let t = performance.now(); for (const [x, z] of pts) pathDistanceScan(net, x, z); const slow = performance.now() - t
t = performance.now(); for (const [x, z] of pts) pathDistance(net, x, z); const fast = performance.now() - t
console.log(`  ${n} points: full scan ${slow.toFixed(1)} ms, indexed ${fast.toFixed(1)} ms (${(slow / fast).toFixed(0)}x)`)
ok(pathDistance(net, 10, 20) === pathDistanceScan(net, 10, 20), 'uncapped = the scan itself')
// the void carve's call: capped at 24 m. Below the cap it must be exact; at/after it, anything >= 24 (the ramp is flat there)
let capBad = 0; for (const [x, z] of pts) { const a = pathDistance(net, x, z, 24), b = pathDistanceScan(net, x, z); if (b < 24 ? Math.abs(a - b) > 1e-9 : a < 24) capBad++ }
ok(capBad === 0, `capped at 24 m: exact below the cap, >= 24 past it (${capBad} bad)`)
t = performance.now(); for (const [x, z] of pts) pathDistance(net, x, z, 24); const capped = performance.now() - t
console.log(`  capped at 24 m: ${capped.toFixed(1)} ms (${(slow / capped).toFixed(0)}x the scan)`)
ok(capped * 20 < slow, 'capped is at least 20x faster than the scan')
console.log(`path-distance: ${pass} pass, ${fails.length} fail`); for (const f of fails) console.log('  FAIL', f); if (fails.length) process.exit(1)
