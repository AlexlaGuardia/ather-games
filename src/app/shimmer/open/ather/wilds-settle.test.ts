// npx tsx src/app/shimmer/open/ather/wilds-settle.test.ts
// BETA M120 s3c: the strays ring the KEEPER, not the spot they just left. combat-layer's frame runs before the walker's, so in the
// first frame after an arrival the camera (the sim's keeper) still holds the OLD zone's spot; the top-up ran on it (seen on prod
// 11-24: 11 strays 105-130 m out at the first settlement, some culled a moment later). Reproduced here with the scene's own loop.
import { readFileSync } from 'node:fs'
import { newCombat, stepCombat, populate, topUpDue, SETTLE } from './combat'
import { FLAT } from './wilds-sim'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const DT = 1 / 60, OLD = { x: -209.6, z: 211.6 }, HERE = { x: -300, z: 300 }   // out of the Glade gate, to the first settlement
const spread = (c: ReturnType<typeof newCombat>) => c.hollows.map(h => Math.hypot(h.x - HERE.x, h.z - HERE.z))
/** the scene's loop from the arrival: `stale` frames of the old spot, then the keeper; the first ring's distances from the keeper */
function arrival(seed: number, due: (popT: number, settled: number) => boolean, stale = 1) {
  const c = newCombat(seed); let popT = 0, settled = 0, ring: number[] | null = null, at = 0
  for (let k = 0; k < 60 * 6 && !ring; k++) {
    const feet = { ...(k < stale ? OLD : HERE), y: 0 }
    popT -= DT; settled += DT
    if (due(popT, settled)) { popT = 1.5; populate(c, FLAT, feet.x, feet.z, 7) }
    if (c.hollows.length) { ring = spread(c); at = settled }
    stepCombat(c, FLAT, feet, DT)
  }
  return { ring: ring ?? [], at }
}
const seeds = Array.from({ length: 100 }, (_, i) => 3 + i * 7), off = (r: number[]) => r.some(d => d < 45 || d > 112)   // the ring 55-100 + a brood's 10 m
{ // the REPRODUCTION: the rule as it was (no settle), one stale frame
  const bad = seeds.filter(s => off(arrival(s, p => p <= 0).ring)).length
  console.log(`  old rule, one stale frame: ${bad}/100 arrivals ring the old spot`)
  ok(bad > 60, `the old rule rings the spot they left (${bad}/100)`)
}
{ // the fix: every first ring sits round the keeper, up to a whole second of stale camera, still full, and soon
  for (const stale of [1, 10, 60]) {
    const rs = seeds.map(s => arrival(s, topUpDue, stale))
    ok(rs.every(r => r.ring.length === 7 && !off(r.ring)), `stale ${stale}: ${rs.filter(r => off(r.ring)).length} off, sizes ${[...new Set(rs.map(r => r.ring.length))]}`)
    ok(rs.every(r => r.at > SETTLE && r.at < SETTLE + 0.1), `stale ${stale}: the first ring comes at ${rs[0].at.toFixed(2)} s`)
  }
  // same Hollows in the same ring as a keeper who never had a stale frame under the old rule
  const a = arrival(17, topUpDue).ring, b = arrival(17, p => p <= 0, 0).ring
  ok(a.length === b.length && a.every((d, i) => Math.abs(d - b[i]) < 1e-6), 'how many and where they ring is unchanged')
}
{
  const src = readFileSync(new URL('./combat-layer.tsx', import.meta.url), 'utf8'), gate = 'if (topUpDue(popT.current, settled.current)) { popT.current = 1.5; populate('
  ok(src.split('populate(C,').length === 2 && src.includes(gate + 'C,'), 'combat-layer gates its top-up on it (its one populate call)')
  // the ground reading (crawlers pool on it) does NOT wait for the settle: it was null for the first seconds on prod (aad114fd, m120-merge-check)
  const at = src.indexOf('C.drained = infested'), open = src.lastIndexOf('if (!C.remote && popT.current <= 0) {', at)
  ok(at > 0 && open > 0 && at < src.indexOf(gate) && !src.slice(open, at).includes('topUpDue'), 'C.drained is set before the gate')
}
console.log(`wilds-settle: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
