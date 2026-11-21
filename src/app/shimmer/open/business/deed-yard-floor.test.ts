// business/deed-yard-floor.ts (M49 s2): the yard comes BUILT with one level floor; the walker walks in by the gate ramp, the
// rim fence holds everywhere else, a placed solid piece blocks, a stool does not. Drives the REAL walker (on-foot.ts) on the
// real continent with the yard registered in foot-extras.ts, the same path the page takes.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../region'
import { footWorld, tickFoot } from '../on-foot'
import { createLoco, type LocoState } from '../shared/locomotion'
import { setFootExtra } from '../foot-extras'
import { FURNITURE } from '../ather/furniture'
import { DEED_GRID, emptyDeed, place, type Footprint } from './deed-grid'
import { yardToWorld, yardToLocal } from './deed-yard-site'
import { shipyardYard } from './shipyards'
import { yardFloorY, yardGround, rampOf, rimBoxes, pieceBoxes, GATE_W, RAMP_RISE, DECK_LIFT } from './deed-yard-floor'
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }
const G = DEED_GRID.shipyard, y = shipyardYard(R)!, floor = yardFloorY(R, y), ramp = rampOf(R, y, floor), ground = yardGround(R, y, floor, ramp)

// 1 · ONE floor: every cell centre and every corner reads the same height, and it clears the ground under it
const ys = new Set<number>(); let under = Infinity
for (let cx = 0; cx < G.w; cx++) for (let cz = 0; cz < G.d; cz++) { const p = yardToWorld(y, cx + 0.5 - G.w / 2, cz + 0.5 - G.d / 2); ys.add(ground(p.x, p.z)); under = Math.min(under, floor - R.heightAt(p.x, p.z)) }
for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = yardToWorld(y, u * G.w / 2, v * G.d / 2); ys.add(ground(p.x, p.z)) }
ok(ys.size === 1 && ys.has(floor), `every cell and corner is at the one floor (${[...ys].map(v => v.toFixed(2)).join(',')})`)
ok(under >= DECK_LIFT - 1e-9, `the floor clears the ground under every cell (min ${under.toFixed(2)} m)`)
let hi = -Infinity; for (let u = -G.w / 2; u <= G.w / 2; u += 0.5) for (let v = -G.d / 2; v <= G.d / 2; v += 0.5) { const p = yardToWorld(y, u, v); hi = Math.max(hi, R.heightAt(p.x, p.z)) }
ok(Math.abs(floor - (hi + DECK_LIFT)) < 1e-9, 'the floor is the highest ground plus the deck lift (no higher)')
// 2 · the ramp: meets the floor at the gate, the ground at its foot, and falls at RAMP_RISE
const atGate = (s: number) => { const p = yardToWorld(y, ramp.mu + ramp.out[0] * s, ramp.mv + ramp.out[1] * s); return { p, g: ground(p.x, p.z), t: R.heightAt(p.x, p.z) } }
ok(Math.abs(atGate(0.01).g - floor) < 0.01, 'the ramp starts at the floor')
ok(ramp.L === 0 || atGate(ramp.L).g <= atGate(ramp.L).t + RAMP_RISE * 0.1 + 1e-6, `the ramp reaches the ground (L ${ramp.L.toFixed(1)} m)`)
ok(ground(atGate(ramp.L + 0.3).p.x, atGate(ramp.L + 0.3).p.z) === -Infinity, 'past the ramp the yard adds nothing')
console.log(`  floor ${floor.toFixed(2)} m, ramp ${ramp.L.toFixed(1)} m at gate ${y.gate}, deepest post ${(floor - Math.min(...[...Array(G.w + 1)].flatMap((_, i) => [...Array(G.d + 1)].map((_, j) => { const p = yardToWorld(y, i - G.w / 2, j - G.d / 2); return R.heightAt(p.x, p.z) })))).toFixed(2)} m`)

// 3 · the walker, the real one, with the yard registered as the page does it
const fw = footWorld(R)
let deed = emptyDeed()
const fpOf = (id: string): Footprint | null => (FURNITURE[id] ? { w: FURNITURE[id].w, d: FURNITURE[id].d } : null)
const defOf = (id: string) => FURNITURE[id] ?? null
let boxes = [...rimBoxes(y, floor)]
setFootExtra('deed-yard', { ground, boxes: () => boxes })
const walk = (s: LocoState, tx: number, tz: number, secs: number) => {
  for (let t = 0; t < secs; t += 1 / 60) {
    const dx = tx - s.px, dz = tz - s.pz, L = Math.hypot(dx, dz); if (L < 0.2) return
    const mx = dx / L, mz = dz / L
    tickFoot(fw, R, s, { mvX: mx, mvZ: mz, fwdX: mx, fwdZ: mz, rightX: -mz, rightZ: mx, jumpKey: false, crouchKey: false, dt: 1 / 60 })
  }
}
const local = (s: LocoState) => yardToLocal(y, s.px, s.pz)
const inYard = (s: LocoState) => { const l = local(s); return Math.abs(l.lx) < G.w / 2 && Math.abs(l.lz) < G.d / 2 }
// in through the gate: from the ramp's foot (plus 1.5 m) to the yard's centre
const foot = yardToWorld(y, ramp.mu + ramp.out[0] * (ramp.L + 1.5), ramp.mv + ramp.out[1] * (ramp.L + 1.5)), mid = yardToWorld(y, 0, 0)
const a = createLoco(foot.x, R.groundAt(foot.x, foot.z) + 0.05, foot.z)
walk(a, mid.x, mid.z, 12)
ok(inYard(a) && Math.hypot(a.px - mid.x, a.pz - mid.z) < 0.6, `the walker walks in through the gate to the middle (ended ${local(a).lx.toFixed(1)}, ${local(a).lz.toFixed(1)})`)
ok(Math.abs(a.py - floor) < 0.05, `and stands on the floor (feet ${a.py.toFixed(2)}, floor ${floor.toFixed(2)})`)
// the rim holds: from the middle, walk straight at the far (non-gate) edge and out past it
const side = y.gate === 2 ? 3 : 2, beyond = yardToWorld(y, (side === 2 ? -1 : 1) * (G.w / 2 + 4), 0)
walk(a, beyond.x, beyond.z, 6)
ok(inYard(a), `the rim fence holds (side ${side}): the walker is still inside at ${local(a).lx.toFixed(2)}`)
// from outside, the low side: the fence + deck edge keep a walker off the deck
const low = yardToWorld(y, 0, -G.d / 2 - 0.9), b = createLoco(low.x, R.groundAt(low.x, low.z) + 0.05, low.z)
walk(b, mid.x, mid.z, 6)
ok(!inYard(b), 'a walker outside the near edge cannot get onto the deck except by the gate')
// 4 · a placed SOLID piece blocks; a non-solid stool does not
const table = Object.keys(FURNITURE).find(id => FURNITURE[id].solid && FURNITURE[id].w >= 1 && FURNITURE[id].h >= 0.6 && !FURNITURE[id].alc)!
deed = place(deed, 'shipyard', fpOf, table, G.w / 2 - 1, 3, 0)   // a cell in the middle row, ahead of the walker's path
ok(deed.items.length === 1, `the test placed a ${table}`)
boxes = [...rimBoxes(y, floor), ...pieceBoxes(y, floor, deed, defOf)]
const pb = pieceBoxes(y, floor, deed, defOf)[0], st = createLoco(mid.x, floor + 0.05, mid.z)
const startL = yardToLocal(y, st.px, st.pz), tgt = yardToWorld(y, startL.lx + 2 * (yardToLocal(y, pb.cx, pb.cz).lx - startL.lx), startL.lz + 2 * (yardToLocal(y, pb.cx, pb.cz).lz - startL.lz))
walk(st, tgt.x, tgt.z, 6)
const pl = yardToLocal(y, pb.cx, pb.cz), sl = local(st)
const passed = Math.sign(sl.lx - pl.lx) !== Math.sign(startL.lx - pl.lx) && Math.abs(sl.lz - pl.lz) < pb.hv
ok(!passed, `the ${table} blocks the walker (stopped at ${sl.lx.toFixed(2)}, ${sl.lz.toFixed(2)}; piece at ${pl.lx.toFixed(2)}, ${pl.lz.toFixed(2)})`)
const stool = 'goldwood_stool'
ok(!FURNITURE[stool].solid && pieceBoxes(y, floor, place(emptyDeed(), 'shipyard', fpOf, stool, 0, 0, 0), defOf).length === 0, 'a stool (not solid) adds no box')
const turned = pieceBoxes(y, floor, place(emptyDeed(), 'shipyard', fpOf, table, 0, 0, 1), defOf)[0]
ok(Math.abs(turned.hu - FURNITURE[table].d / 2) < 1e-9 && Math.abs(turned.hv - FURNITURE[table].w / 2) < 1e-9, 'a turned piece swaps its box')
ok(rimBoxes(y, floor).length === 5 && GATE_W > 2 * 0.3, 'the rim is four edges with the gate edge split in two')
setFootExtra('deed-yard', null)
console.log(`deed-yard-floor: ${n - fails}/${n} pass${fails ? `, ${fails} FAIL` : ''}`)
if (fails) process.exit(1)
