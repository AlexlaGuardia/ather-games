// npx tsx src/app/shimmer/open/ather/play-fit.test.ts
// BETA M239b: every species can play every training piece. The 11-24 resize gave the Vulnyx a 0.42 m body, and the Guard
// Posts' sidestep (sized for 0.3 m bodies) put her sides on the posts. playSize (obstacles.ts) sizes each piece's play from
// her body radius; this drives the REAL trot at one piece per run, for every species' radius and every quarter-turn, and
// asserts she plays it and that her whole body stays clear of that piece's own parts (plotFootprints) while she plays.
import { makeTrot, type Toy } from './spirit-trot'
import { FURNITURE } from './furniture'
import { footBlocked, footDist, plotFootprints, bodyRadius, playSize } from './obstacles'
import { GROWN } from '../../sprites/creature-size'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }

const radii: [string, number][] = [...Object.entries(GROWN).map(([k, v]) => [k, bodyRadius(v as { height: number; length?: number })] as [string, number]),
  ['r0.15', 0.15], ['r0.3', 0.3], ['r0.45', 0.45]]
const items = Object.keys(FURNITURE).filter(k => FURNITURE[k].train)
ok(items.length === 4, `four training pieces (${items.join(',')})`)
ok(radii.some(([k, r]) => k === 'fox' && r > 0.4), 'the Vulnyx (fox) body is the big one the guard broke on')

for (const item of items) for (const q of [0, 1, 2, 3]) for (const [sp, r] of radii) {
  const f = FURNITURE[item], kind = f.play ?? 'leap', P = { x: 0.3, z: 2.6 }
  const size = playSize(item, r)
  ok(size !== null, `${item} fits a ${sp} body (r ${r.toFixed(2)})`)
  if (size === null) continue
  const pcs = [{ id: 'pc', item, x: P.x, z: P.z, q }], feet = plotFootprints(pcs), parts = feet[0].parts
  const a = -q * Math.PI / 2
  const toys: Toy[] = [{ id: 'pc', x: P.x, z: P.z, ax: Math.sin(a), az: Math.cos(a), stat: f.train!, kind, size: size ?? undefined }]
  const t = makeTrot({ home: { x: 0, z: -1 }, rMin: 1, rMax: 1.6, roam: { maxLeg: 4.5, away: 3 }, toys: () => toys, lean: { [f.train!]: 9 },
    blocked: (x, z, toy) => Math.abs(x) > 6 || z < -4 || z > 7 || footBlocked(feet, x, z, r, toy) }, 7 + q)
  let plays = 0, samples = 0, worst = Infinity
  t.near(() => ({ x: 0, z: 0.8, yaw: 0 })); t.onPlayed(() => plays++)
  for (let i = 0; i < 30 * 400; i++) {
    t.step(1 / 30)
    const p = t.pose(); if (p.mode !== 'play') continue
    samples++; worst = Math.min(worst, ...parts.map(b => footDist(b, p.x, p.z)))
  }
  ok(plays > 0, `${sp} (r ${r.toFixed(2)}) plays ${item} q${q} (plays ${plays})`)
  ok(samples > 0 && worst >= r - 1e-6, `${sp} (r ${r.toFixed(2)}) body clear of ${item} q${q}'s own parts while playing (closest ${worst.toFixed(3)})`)
}
// the measure grows smaller for a bigger body (the posts do not move), and never past the old one for small bodies
ok((playSize('guard_posts', 0.42) as number) < (playSize('guard_posts', 0.3) as number), 'a bigger body takes a shorter sidestep')
ok(radii.every(([, r]) => (playSize('guard_posts', r) as number) <= FURNITURE.guard_posts.w / 2 - 0.3), 'never a longer sidestep than the old one')
ok(playSize('guard_posts', 0.6) === null, 'a body wider than the gap does not fit the posts')

console.log(`play-fit: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
