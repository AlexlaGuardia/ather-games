// Run: npx tsx src/app/shimmer/open/shared/quest-bang.test.ts
// BETA M212: the tutorial '!' stands over the CURRENT First Steps target in this zone, one at a time, moves with the step, none after.
import { readFileSync } from 'fs'
import { bangSpot, bangScale, BANG_MAX_SCALE } from './quest-bang'
import { firstStepsEntries, type FirstStepsWorld } from '../ather/first-steps'
import { freshTut, legacyTut } from '../ather/glade-tutorial'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }

const W: FirstStepsWorld = { greg: { x: 10, z: 20 }, gate: { x: -30, z: 5 }, stone: { x: 1, z: 2 }, bigone: { x: 50, z: 60 },
  stops: new Proxy({}, { get: () => ({ x: 7, z: 7 }) }) as FirstStepsWorld['stops'] }
const t0 = freshTut()
const e0 = firstStepsEntries(t0, W)
ok(e0.length === 1, 'a fresh keeper has the First Steps line')
ok(JSON.stringify(bangSpot(e0, 'glade')) === JSON.stringify({ x: 10, z: 20 }), 'step 1: the "!" is over Greg in the Glade')
ok(JSON.stringify(bangSpot(e0, 'wilds')) === JSON.stringify({ x: 1, z: 2 }), 'in the Wilds it is over the way back (the stone)')
ok(bangSpot(e0, 'continent') === null, 'no target in a zone the step does not reach: none')
// it MOVES on step complete: Greg heard -> the tour's first stop
const t1 = { ...t0, greg: { ...t0.greg, wilds: true } }
const s1 = bangSpot(firstStepsEntries(t1, W), 'glade')
ok(s1 !== null && JSON.stringify(s1) !== JSON.stringify({ x: 10, z: 20 }), `step 2: the "!" left Greg (now ${JSON.stringify(s1)})`)
// never two at once: one spot per zone, whatever the line points at
ok(!Array.isArray(bangSpot(e0, 'glade')), 'one spot, not a list')
// none after the tutorial (a veteran / done keeper has no First Steps line), and a struck line wears none
ok(bangSpot(firstStepsEntries(legacyTut(), W), 'glade') === null, 'a veteran: none')
ok(bangSpot(e0.map(e => ({ ...e, struck: true })), 'glade') === null, 'a struck line: none')
ok(bangSpot([{ id: 'errand', title: 'x', note: '', where: { zone: 'glade', x: 1, z: 1 }, hand: 'keeper' }], 'glade') === null, 'another quest never wears it')
// size reads far off, bounded both sides
ok(bangScale(0) === 1 && bangScale(10) === 1, 'near: scale 1')
ok(bangScale(28) > 1.9 && bangScale(28) < 2.1, 'mid: grows with distance')
ok(bangScale(1e4) === BANG_MAX_SCALE, 'far: capped')
// it sits WITH the glare + trail: QuestGuide draws it, and keeps its own trail
const qg = readFileSync(new URL('../quest-guide.tsx', import.meta.url), 'utf8')
ok(qg.includes('<QuestBang zone={zone} ground={ground} />') && qg.includes('<instancedMesh ref={dots}'), 'QuestGuide draws the "!" next to the trail')
console.log(`quest-bang: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
