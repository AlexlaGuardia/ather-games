// Where the edge clouds stand (edge-clouds.ts + shared/cloud-layout.ts, BETA M24). Run: npx tsx src/app/shimmer/open/ather/edge-clouds.test.ts
import { islandRim, plotEdgePuffs, plotFarPuffs, PLOT_SEA_Y, wildsReefPuffs, deckSquares, SEA_LAND } from './edge-clouds'
import { pillowsAlong, hash } from '../shared/cloud-layout'
import { plotHeightAt, PLOT_R, FALL_Y } from './plot'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const rim = islandRim()
ok(rim.length > 80, `rim: too few points round the island (${rim.length})`)
ok(rim.every(p => Math.abs(Math.hypot(p.nx, p.nz) - 1) < 1e-6), 'rim: a normal is not unit length')
ok(rim.every(p => (p.x * p.nx + p.z * p.nz) > 0), 'rim: a normal points back into the island')
ok(rim.every(p => Math.hypot(p.x, p.z) > PLOT_R * 0.7 && Math.hypot(p.x, p.z) < PLOT_R * 1.4), 'rim: a point is not near the island edge (it is a rounded square: corners reach ~1.32 R)')
// every quarter of the island has rim (no side left bare)
const quarters = new Set(rim.map(p => (p.x > 0 ? 1 : 0) + (p.z > 0 ? 2 : 0)))
ok(quarters.size === 4, `rim: a side of the island has no clouds (${quarters.size}/4 quarters)`)

// ★ THE FALL IS KEPT (Alex 11-18): no pillow may be something a keeper stands on. Every puff's TOP sits below the land
// under it (or there is no land under it at all): nothing banks ON the island
const edge = plotEdgePuffs()
const onLand = edge.filter(u => { const g = plotHeightAt(u.x, u.z); return Number.isFinite(g) && u.y + u.s * (u.sy ?? 0.62) > g - 0.3 })
ok(onLand.length === 0, `fall: ${onLand.length} puffs rise through the island's ground (first at ${onLand[0] ? `${onLand[0].x.toFixed(1)},${onLand[0].z.toFixed(1)}` : '-'})`)
ok(edge.every(u => u.y > FALL_Y), 'fall: a puff hangs below where the fold catches you (it would never be seen)')
ok(edge.length > 200 && edge.length < 700, `budget: ${edge.length} edge puffs (want 200..700: soft, but one phone draw)`)
const far = plotFarPuffs()
ok(far.every(u => Math.hypot(u.x, u.z) > PLOT_R + 20 && u.y > PLOT_SEA_Y), 'far: a void puff sits on the island or under the sea')
ok(JSON.stringify(plotEdgePuffs()) === JSON.stringify(edge), 'determinism: the pillows moved between two builds (every device must see the same)')
// helper basics
ok(hash(1, 2) === hash(1, 2) && hash(1, 2) >= 0 && hash(1, 2) < 1, 'hash: not a stable 0..1')
const one = pillowsAlong([{ x: 0, z: 0, nx: 1, nz: 0, y: 0 }], 4, 2)
ok(one.length === 3 && one.every(u => u.x > 0), 'pillowsAlong: pillows not pushed out along the normal')

// ── the Wilds: reefs ride the SEA only, thicken away from land, nearest first; the deck covers only squares past the map
const landAt = (tx: number, ty: number) => (tx <= 0 ? 0.9 : tx === 1 ? 0.05 : 0)   // land west of x=500, a sea tile, then past the map
const reefs = wildsReefPuffs(500, 0, landAt)
ok(reefs.length > 0 && reefs.every(u => u.x >= 500 - 1), `reefs: a reef stands on a land tile (${reefs.filter(u => u.x < 499).length})`)
const wide = wildsReefPuffs(900, 0, landAt), nearShore = wide.filter(u => u.x >= 500 && u.x < 700).length, farOut = wide.filter(u => u.x >= 1100 && u.x < 1300).length
ok(farOut > nearShore, `reefs: they do not thicken away from the shore (near ${nearShore}, far ${farOut})`)
ok(reefs.every((u, i) => i === 0 || Math.hypot(u.x - 500, u.z) >= Math.hypot(reefs[i - 1].x - 500, reefs[i - 1].z) - 1e-9), 'reefs: not nearest first (a full buffer would drop near ones)')
ok(reefs.every(u => Math.abs(u.y) < u.s * 0.2 + 0.01), 'reefs: a reef does not ride the water line')
ok(wildsReefPuffs(-3000, 0, landAt).length === 0, 'reefs: reefs in the middle of the land')
ok(SEA_LAND > 0 && SEA_LAND < 0.5, 'reefs: the sea threshold is off')
const deck = deckSquares(1200, 0, (tx) => tx <= 1)
ok(deck.length > 0 && deck.every(q => q.x >= 2000), `deck: a deck square over the map (${deck.map(q => q.x).join(',')})`)
ok(deckSquares(-3000, 0, () => true).length === 0, 'deck: a deck inside the map')

if (fails.length) { console.error(`edge-clouds: ${pass} pass, ${fails.length} FAIL\n  ` + fails.join('\n  ')); process.exit(1) }
console.log(`edge-clouds: ${pass} pass, 0 fail`)
