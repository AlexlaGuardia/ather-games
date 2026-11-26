// green-landing.ts (BETA M208 s2). Run: npx tsx src/app/shimmer/open/ather/green-landing.test.ts
import { quarterLanding, QUARTER_SPOTS, FREE_SPOTS, guestLanding, freeLanding, cleanSeat, type Seat } from './green-landing'
import { clusterFrame, type Quarter } from './cluster'
import { GATE, HOME_LANDING, CHORDSTONE, GATE_TRUNKS, GATE_TRUNK_R, GREEN_LAMPS } from './plot'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const Q: Quarter[] = ['ne', 'nw', 'sw', 'se']
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
const yawToGate = (s: { x: number; z: number; yaw: number }) => { const f = { x: -Math.sin(s.yaw), z: -Math.cos(s.yaw) }, g = { x: GATE.x - s.x, z: GATE.z - s.z }, n = Math.hypot(g.x, g.z); return (f.x * g.x + f.z * g.z) / n }

// a solo keeper / any keeper at home: exactly slice 1's HOME_LANDING
ok(dist(quarterLanding('ne'), HOME_LANDING) < 1e-9 && quarterLanding('ne').yaw === HOME_LANDING.yaw, 'ne = HOME_LANDING (home, solo or in a cluster)')

// the four spots and the four free spots: all apart, all clear of the stone, the trunks, the lamps, all facing the gate
const all = [...Q.map(q => ({ n: q, s: QUARTER_SPOTS[q] })), ...FREE_SPOTS.map((s, k) => ({ n: `free${k}`, s }))]
for (let i = 0; i < all.length; i++) {
  const { n, s } = all[i]
  ok(yawToGate(s) > 0.999, `${n} faces the gate`)
  ok(dist(s, GATE) > 3.5 && dist(s, GATE) < 9, `${n} is on the gate's ground (${dist(s, GATE).toFixed(2)} m)`)
  ok(dist(s, CHORDSTONE) > 1.5, `${n} clear of the Chordstone (${dist(s, CHORDSTONE).toFixed(2)})`)
  for (const t of GATE_TRUNKS) ok(dist(s, t) > GATE_TRUNK_R + 1, `${n} clear of a trunk`)
  for (const l of GREEN_LAMPS) ok(dist(s, l) > 1.2, `${n} clear of a lamp (${dist(s, l).toFixed(2)})`)
  for (let j = i + 1; j < all.length; j++) ok(dist(s, all[j].s) >= 2, `${n} and ${all[j].n} >= 2 m apart (${dist(s, all[j].s).toFixed(2)})`)
}
// the Chordstone is not between the nw spot and the gate (its line of sight)
{ const s = QUARTER_SPOTS.nw, d = { x: GATE.x - s.x, z: GATE.z - s.z }, L = Math.hypot(d.x, d.z), t = ((CHORDSTONE.x - s.x) * d.x + (CHORDSTONE.z - s.z) * d.z) / (L * L)
  const p = { x: s.x + d.x * t, z: s.z + d.z * t }; ok(dist(p, CHORDSTONE) > 0.9, `nw: the Chordstone is off its line to the gate (${dist(p, CHORDSTONE).toFixed(2)})`) }

// ★ every cluster of four, every host: each member lands on the side of the gate facing THEIR plot, and none share a spot
for (const host of Q) {
  const members = Q.map(q => ({ quarter: q, name: q, owned: [] as string[] }))
  const frame = clusterFrame(host, members)   // the host's view (host = ne)
  const spots = Q.map(me => ({ me, s: me === host ? quarterLanding('ne') : guestLanding({ cluster: 'c1', quarter: host } satisfies Seat, { cluster: 'c1', quarter: me }, `id-${me}`) }))
  for (const { me, s } of spots) {
    const plot = me === host ? { x: 0, z: 0 } : frame.mates.find(m => m.quarter === me)!
    const toPlot = { x: plot.x - GATE.x, z: plot.z - GATE.z }, toSpot = { x: s.x - GATE.x, z: s.z - GATE.z }
    const cos = (toPlot.x * toSpot.x + toPlot.z * toSpot.z) / (Math.hypot(toPlot.x, toPlot.z) * Math.hypot(toSpot.x, toSpot.z))
    ok(cos > 0.9, `host ${host}: ${me} lands on its own plot's side (cos ${cos.toFixed(2)})`)
  }
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) ok(dist(spots[i].s, spots[j].s) >= 2, `host ${host}: ${spots[i].me} / ${spots[j].me} apart`)
}

// strangers: another cluster, no seat yet, junk seats -> a free spot (never a member's)
const free = (s: { x: number; z: number }) => FREE_SPOTS.some(f => dist(f, s) < 1e-9)
ok(free(guestLanding({ cluster: 'c2', quarter: 'nw' }, { cluster: 'c1', quarter: 'sw' }, 'p_x')), 'another cluster -> free spot')
ok(free(guestLanding(undefined, { cluster: 'c1', quarter: 'sw' }, 'p_x')), 'no host seat yet -> free spot')
ok(free(guestLanding({ cluster: 'c1', quarter: 'nw' }, null, 'p_x')), 'guest in no cluster -> free spot')
ok(free(guestLanding({ cluster: 'c1', quarter: 'nw' }, { cluster: 'c1', quarter: 'nw' }, 'p_x')), 'same seat as host (bad data) -> free spot')
for (const junk of [null, 1, 'ne', {}, { cluster: 'c1' }, { cluster: 'c1', quarter: 'up' }, { cluster: '', quarter: 'ne' }, { cluster: 'x'.repeat(81), quarter: 'ne' }]) ok(cleanSeat(junk) === null, `junk seat refused: ${JSON.stringify(junk)?.slice(0, 30)}`)
ok(dist(freeLanding('p_abc'), freeLanding('p_abc')) === 0, 'a free spot is stable for one id')
ok(new Set(['p_a', 'p_b', 'p_c', 'p_d', 'p_e', 'p_f', 'p_g', 'p_h'].map(id => FREE_SPOTS.indexOf(FREE_SPOTS.find(f => dist(f, freeLanding(id)) < 1e-9)!))).size >= 3, 'ids spread over the free spots')

console.log(`green-landing: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗', f)
process.exit(fails.length ? 1 : 0)
