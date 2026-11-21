// M49 s4: the shipyard plots (business/shipyard-plots.ts) on the REAL continent, walked by the REAL walker. npx tsx this file.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../region'
import { townRadius } from '../towns/plan'
import { footWorld, tickFoot, WATER_Y } from '../on-foot'
import { createLoco, type LocoState } from '../shared/locomotion'
import { setFootExtra } from '../foot-extras'
import { SHIPYARD_PLOTS, SHIPYARD_TIERS, plotLayout, plotToWorld, plotToLocal, plotGround, plotBoxes, blockedCells, PLOT, PLOT_GATE_W, LANDING_D, RAMP_RISE, type PlotLayout } from './shipyard-plots'
import { bodyHits } from '../foot-solids'
import { DEED_GRID } from './deed-grid'

const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }
const H = PLOT / 2
const towns = meta.places.filter(p => townRadius(p) > 0)
const segs: { ax: number; az: number; bx: number; bz: number; hw: number }[] = []
for (const e of meta.network?.edges ?? []) for (let k = 1; k < e.pts.length; k++) segs.push({ ax: e.pts[k - 1][0], az: e.pts[k - 1][1], bx: e.pts[k][0], bz: e.pts[k][1], hw: e.width / 2 })
const sd = (px: number, pz: number, s: typeof segs[0]) => { const vx = s.bx - s.ax, vz = s.bz - s.az, L = vx * vx + vz * vz, t = L ? Math.max(0, Math.min(1, ((px - s.ax) * vx + (pz - s.az) * vz) / L)) : 0; return Math.hypot(px - s.ax - vx * t, pz - s.az - vz * t) }

ok(DEED_GRID.plot.w === PLOT && DEED_GRID.plot.d === PLOT, 'the deed grid of a plot covers the plot (1 m cells)')
ok(SHIPYARD_PLOTS.length === 4 && SHIPYARD_PLOTS.every(s => !!SHIPYARD_TIERS[s.key]), 'four plots, each with a tier')
const fw = footWorld(R)
const walk = (s: LocoState, tx: number, tz: number, secs: number) => {
  for (let t = 0; t < secs; t += 1 / 30) {
    const dx = tx - s.px, dz = tz - s.pz, L = Math.hypot(dx, dz); if (L < 0.3) return
    // a swimming player holds Space to swim up (locomotion.ts: swim ticks have no step-up; at the surface they tread and walk out)
    tickFoot(fw, R, s, { mvX: dx / L, mvZ: dz / L, fwdX: dx / L, fwdZ: dz / L, rightX: -dz / L, rightZ: dx / L, jumpKey: s.swimming, crouchKey: false, dt: 1 / 30 })
  }
}
const layouts: PlotLayout[] = []
for (const site of SHIPYARD_PLOTS) {
  const L = plotLayout(R, site), f = L.frame, t = site.key.split(':')[2] ?? 'kael'
  layouts.push(L)
  // 1 · the ground: every sample is clear of every town, road, bridge and bore
  let blocked = 0
  for (let u = -H; u <= H; u += 2.5) for (let v = -H; v <= H; v += 2.5) {
    const p = plotToWorld(f, u, v)
    if (towns.some(q => Math.hypot(p.x - q.x, p.z - q.z) < townRadius(q) + 15) || segs.some(s => sd(p.x, p.z, s) < s.hw + 3) || R.tunnelAt(p.x, p.z) || R.deckAt(p.x, p.z)) blocked++
  }
  ok(blocked === 0, `${t}: the plot stands clear of towns, roads, bridges, bores (${blocked} samples hit)`)
  ok(L.floor >= R.heightAt(f.x, f.z) && L.floor - L.base < 12, `${t}: one floor over its ground (floor ${L.floor.toFixed(1)}, lowest ground ${L.base.toFixed(1)})`)
  // 2 · the gate faces the road (road plots): the gate's outside is nearer the road than the back
  if (site.road) {
    const e = meta.network!.edges.find(q => q.id === site.road)!, dTo = (lz: number) => { const p = plotToWorld(f, 0, lz); let d = Infinity; for (let k = 1; k < e.pts.length; k++) d = Math.min(d, sd(p.x, p.z, { ax: e.pts[k - 1][0], az: e.pts[k - 1][1], bx: e.pts[k][0], bz: e.pts[k][1], hw: 0 })); return d }
    ok(dTo(-H) < 20 && dTo(-H) < dTo(H), `${t}: the gate faces road ${site.road} (gate ${dTo(-H).toFixed(1)} m from it)`)
  }
  // 3 · the tier: every piece present, inside the fence, the solid ones not overlapping
  const tier = SHIPYARD_TIERS[site.key], kinds = (k: string) => L.pieces.filter(p => p.kind === k)
  ok(kinds('home').length === 1 && kinds('garage').length === 1 && kinds('pad').length === 1 && kinds('board').length === 1, `${t}: a home, a garage block, a pad, a look board`)
  ok(kinds('bay').length === tier.garage, `${t}: ${tier.garage} garage bays (has ${kinds('bay').length})`)
  ok(tier.dock === 'tie-down' ? kinds('mast').length === 1 && kinds('post').length === 4 && !L.slip : !!L.slip && kinds('bollard').length > 3, `${t}: the dock is a ${tier.dock}`)
  ok(L.pieces.every(p => Math.abs(p.lx) + p.w / 2 <= H && Math.abs(p.lz) + p.d / 2 <= H), `${t}: every piece inside the fence`)
  const solids = L.pieces.filter(p => p.solid || p.kind === 'pad')
  let overlap = ''
  for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++) { const a = solids[i], b = solids[j]; if (Math.abs(a.lx - b.lx) < (a.w + b.w) / 2 && Math.abs(a.lz - b.lz) < (a.d + b.d) / 2) overlap = `${a.kind}/${b.kind}` }
  ok(!overlap, `${t}: no two built pieces overlap ${overlap}`)
  // 4 · the deed ground: most of the plot is placeable, built ground is not
  const blockedAt = blockedCells(L)
  let free = 0; for (let cx = 0; cx < PLOT; cx++) for (let cz = 0; cz < PLOT; cz++) if (!blockedAt(cx, cz)) free++
  const home = kinds('home')[0]
  ok(free > PLOT * PLOT * 0.6, `${t}: ${free} free deed cells (> 60% of the plot)`)
  ok(blockedAt(Math.floor(home.lx + H), Math.floor(home.lz + H)) && blockedAt(PLOT / 2, 1), `${t}: the home's cells and the gate way are not deed ground`)
  // 5 · the walker: in through the gate from the ground outside, and back out (no trap)
  setFootExtra('plot', { ground: plotGround(L), boxes: () => plotBoxes(L) })
  // from the ground past the ramp's foot: along the landing (up the ramp) to the gate, then in
  const out = plotToWorld(f, PLOT_GATE_W / 2 + L.ramp.L + 2, -H - LANDING_D / 2), land = plotToWorld(f, 0, -H - LANDING_D / 2), mid = plotToWorld(f, 0, -H + 12)
  const a = createLoco(out.x, R.groundAt(out.x, out.z) + 0.05, out.z)
  walk(a, land.x, land.z, 60); walk(a, mid.x, mid.z, 30)
  const la = plotToLocal(f, a.px, a.pz)
  ok(Math.abs(la.lx) < 1 && Math.abs(la.lz - (-H + 12)) < 1 && Math.abs(a.py - L.floor) < 0.05, `${t}: walks in through the gate onto the floor (ended ${la.lx.toFixed(1)}, ${la.lz.toFixed(1)}, feet ${a.py.toFixed(2)} / ${L.floor.toFixed(2)}; ramp ${L.ramp.L.toFixed(1)} m)`)
  walk(a, land.x, land.z, 30); walk(a, out.x, out.z, 60)
  const lb = plotToLocal(f, a.px, a.pz)
  ok(lb.lz < -H && lb.lx > PLOT_GATE_W / 2 + L.ramp.L && Math.abs(a.py - R.groundAt(a.px, a.pz)) < 0.3, `${t}: and back out the gate, down the ramp to the ground (ended ${lb.lx.toFixed(1)}, ${lb.lz.toFixed(1)})`)
  // the ramp's foot meets the ground flush, and the landing never reaches the road (road plots)
  const foot = plotToWorld(f, PLOT_GATE_W / 2 + L.ramp.L, -H - LANDING_D / 2)
  ok(L.floor - L.ramp.L * RAMP_RISE <= R.heightAt(foot.x, foot.z) + 0.3, `${t}: the ramp's foot meets the ground (ramp ${L.ramp.L.toFixed(1)} m)`)
  if (site.road) { let near = Infinity; for (let u = -PLOT_GATE_W / 2; u <= PLOT_GATE_W / 2 + L.ramp.L; u += 1) { const p = plotToWorld(f, u, -H - LANDING_D); near = Math.min(near, ...segs.map(s => sd(p.x, p.z, s) - s.hw)) } ok(near > 0.5, `${t}: the landing + ramp stay off the carriageway (${near.toFixed(1)} m clear)`) }
  // shut (not held): the gate is closed
  const gp = plotToWorld(f, 0, -H)
  ok(!plotBoxes(L).some(b => bodyHits(b, gp.x, gp.z, L.floor)) && plotBoxes(L, true).some(b => bodyHits(b, gp.x, gp.z, L.floor)), `${t}: the gate is open when held, closed when not`)
  // the fence holds: from inside, walking at the -x side fence does not get out
  const side = plotToWorld(f, -H - 6, 0), c = createLoco(plotToWorld(f, -H + 5, 0).x, L.floor + 0.05, plotToWorld(f, -H + 5, 0).z)
  walk(c, side.x, side.z, 20)
  ok(plotToLocal(f, c.px, c.pz).lx > -H, `${t}: the side fence holds (lx ${plotToLocal(f, c.px, c.pz).lx.toFixed(1)})`)
  // 6 · berth plots: a keeper in the water comes up the slipway into the yard, and goes back down it (Veradyn: by water)
  if (L.slip) {
    const sea = plotToWorld(f, L.slip.lx, H + L.slip.L + 3)
    ok(R.heightAt(sea.x, sea.z) < WATER_Y, `${t}: the slipway ends in the water (bed ${R.heightAt(sea.x, sea.z).toFixed(1)})`)
    const sw = createLoco(sea.x, WATER_Y - 0.6, sea.z), deep = plotToWorld(f, L.slip.lx, H - 10)
    walk(sw, deep.x, deep.z, 90)
    const ls = plotToLocal(f, sw.px, sw.pz)
    ok(Math.abs(ls.lz - (H - 10)) < 1.2 && Math.abs(sw.py - L.floor) < 0.05, `${t}: up out of the water by the slipway, into the yard (ended lz ${ls.lz.toFixed(1)}, feet ${sw.py.toFixed(2)})`)
    walk(sw, sea.x, sea.z, 90)
    ok(plotToLocal(f, sw.px, sw.pz).lz > H + L.slip.L, `${t}: and back down into the water (lz ${plotToLocal(f, sw.px, sw.pz).lz.toFixed(1)})`)
    // shut: a swimmer cannot come up the slipway into a yard that is not theirs
    setFootExtra('plot', { ground: plotGround(L), boxes: () => plotBoxes(L, true) })
    const sw2 = createLoco(sea.x, WATER_Y - 0.6, sea.z); walk(sw2, deep.x, deep.z, 90)
    ok(plotToLocal(f, sw2.px, sw2.pz).lz > H, `${t}: shut, the slipway does not let a swimmer in (lz ${plotToLocal(f, sw2.px, sw2.pz).lz.toFixed(1)})`)
  }
  setFootExtra('plot', null)
  console.log(`  ${t}: floor ${L.floor.toFixed(1)} (fall ${(L.floor - L.base).toFixed(1)} m), ramp ${L.ramp.L.toFixed(1)} m, wet ${(L.wet * 100).toFixed(0)}%, ${tier.garage} bays, ${tier.dock}${L.slip ? ` (slip ${L.slip.L.toFixed(1)} m)` : ''}, ${free} deed cells`)
}
// the plots are far apart (no two overlap)
for (let i = 0; i < layouts.length; i++) for (let j = i + 1; j < layouts.length; j++) ok(Math.hypot(layouts[i].frame.x - layouts[j].frame.x, layouts[i].frame.z - layouts[j].frame.z) > PLOT * 1.5, 'plots stand apart')
ok(PLOT_GATE_W >= 5, 'a courser fits the gate')

console.log(`shipyard-plots: ${n - fails}/${n} pass`)
if (fails) process.exit(1)
