// business/deed-yard-site.ts (M49 s1): Kael's shipyard has a yard beside it, clear of houses + lanes, frame round-trips
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../region'
import { cachedPlan } from '../foot-solids'
import { doorByKey } from './doors'
import { shipyardYard, yardToWorld, yardToLocal, buildingAxes, yardRotY, YARD_GAP, GATE_MID } from './deed-yard-site'
import { DEED_GRID } from './deed-grid'
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }
const G = DEED_GRID.shipyard
const y = shipyardYard(R)!, d = doorByKey(R, 'front:shipyard')!
ok(!!y && !!d, 'the continent has a shipyard and it has a yard')
ok(y.clear, `the yard is clear of every other house, lane, bridge and bore (took ${y.side})`)
ok(Math.abs(Math.hypot(...y.ax) - 1) < 1e-9 && Math.abs(Math.hypot(...y.az) - 1) < 1e-9 && Math.abs(y.ax[0] * y.az[0] + y.ax[1] * y.az[1]) < 1e-9, 'the yard frame is orthonormal')
const p = yardToWorld(y, 2.5, -1.5), q = yardToLocal(y, p.x, p.z)
ok(Math.abs(q.lx - 2.5) < 1e-9 && Math.abs(q.lz + 1.5) < 1e-9, 'local -> world -> local round-trips')
// the near fence stands YARD_GAP off the building's wall: the yard's near edge middle, in the building frame, is just outside it
const { bx, bz } = buildingAxes(d.b), nearMid = yardToWorld(y, 0, -G.d / 2), dx = nearMid.x - d.b.x, dz = nearMid.z - d.b.z
const lx = dx * bx[0] + dz * bx[1], lz = dx * bz[0] + dz * bz[1]
const gapOut = y.side === 'back' ? -lz - d.b.d / 2 : Math.abs(lx) - d.b.w / 2
ok(Math.abs(gapOut - YARD_GAP) < 1e-6, `the near fence stands ${YARD_GAP} m off the wall (got ${gapOut.toFixed(3)})`)
ok(!cachedPlan(R, R.meta.places.findIndex(pl => pl.id === 'rune-hold')).buildings.some(o => o !== d.b && Math.hypot(o.x - y.x, o.z - y.z) < 3), 'no other house stands in the middle of the yard')
// three's rotation.y = yardRotY turns local +x onto ax: (cos r, -sin r)
const r = yardRotY(y)
ok(Math.abs(Math.cos(r) - y.ax[0]) < 1e-9 && Math.abs(-Math.sin(r) - y.ax[1]) < 1e-9, 'yardRotY turns a mesh onto the yard')
const gm = GATE_MID(G, y.gate), gp = yardToWorld(y, gm[0], gm[1])
ok(y.gate !== (0 as number) && ([1, 2, 3] as const).every(k => { const [u, v] = GATE_MID(G, k), o = yardToWorld(y, u, v); return Math.hypot(o.x - d.at.x, o.z - d.at.z) >= Math.hypot(gp.x - d.at.x, gp.z - d.at.z) - 1e-9 }), 'the gate is the edge off the house wall nearest the door')
let lo = Infinity, hi = -Infinity
for (let u = -G.w / 2; u <= G.w / 2; u++) for (let v = -G.d / 2; v <= G.d / 2; v++) { const w = yardToWorld(y, u, v), h = R.heightAt(w.x, w.z); lo = Math.min(lo, h); hi = Math.max(hi, h) }
console.log(`  yard: ${y.side} at ${y.x.toFixed(1)}, ${y.z.toFixed(1)}, gate ${y.gate}, ground ${lo.toFixed(2)}..${hi.toFixed(2)} m (range ${(hi - lo).toFixed(2)})`)
// Rune Hold's outskirts are a hillside (the town buries house backs): the yard is NOT levelled (no terrace, M49 row), so the fall
// is reported, not bounded here. Pieces stand level at the ground under their centre (deed-yard.tsx).
ok(Number.isFinite(hi - lo), 'the yard reads real ground')
console.log(`deed-yard-site: ${n - fails}/${n} pass${fails ? `, ${fails} FAIL` : ''}`)
if (fails) process.exit(1)
