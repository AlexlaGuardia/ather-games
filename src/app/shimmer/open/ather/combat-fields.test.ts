// npx tsx src/app/shimmer/open/ather/combat-fields.test.ts
import { newCombat, spawnHollow, stepCombat, fxOn, type Terrain } from './combat'
import { runCast, stepFields } from './combat-casts'
import { castForMove } from '../../play3d/cast'
import { castsHere } from '../shared/casting'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const T: Terrain = { heightAt: () => 0, walkable: () => true } as unknown as Terrain
const eye = { x: 0, y: 1.6, z: 0 }, down = (() => { const l = Math.hypot(1.6, 6); return { x: 0, y: -1.6 / l, z: -6 / l } })()
const run = (c: ReturnType<typeof newCombat>, secs: number, feet = { x: 50, y: 0, z: 50 }) => { for (let i = 0; i < secs * 20; i++) { stepFields(c, T, feet); stepCombat(c, T, feet, 0.05) } }
ok(castsHere(castForMove('cyclone-cage')), 'field is in the open world\'s runnable set')

// Cyclone Cage holds a Hollow inside it for as long as it lasts, then lets go
{
  const c = newCombat(1); const h = spawnHollow(c, T, 0, -6); h.state = 'chase'
  const hit = runCast(c, T, eye, down, castForMove('cyclone-cage'))
  ok(!!hit && c.fields?.length === 1 && hit.hit === 1, `cage: placed over the Hollow (${JSON.stringify(hit)})`)
  const z0 = h.z; run(c, 3)
  ok(fxOn(h, 'rooted') && Math.abs(h.z - z0) < 1e-6, `cage: Hollow inside not held (z ${z0} -> ${h.z})`)
  run(c, 4)   // past its 5 s
  ok(c.fields?.length === 0, 'cage: field did not expire')
  run(c, 2)
  ok(!fxOn(h, 'rooted'), 'cage: Hollow still held after it expired')
}
// a Hollow outside the ring is not held
{
  const c = newCombat(1); const h = spawnHollow(c, T, 20, -6); h.state = 'wander'
  runCast(c, T, eye, down, castForMove('cyclone-cage')); run(c, 3)
  ok(!fxOn(h, 'rooted'), 'cage: held a Hollow outside it')
}
// Healing Grove heals the keeper standing inside, over time, and not one standing outside (the keeper's own regen is the baseline)
{
  const aim = { x: 0, y: -1.6 / Math.hypot(1.6, 3), z: -3 / Math.hypot(1.6, 3) }
  const inC = newCombat(1); inC.keeper.hp = 40; runCast(inC, T, eye, aim, castForMove('healing-grove'))
  const outC = newCombat(1); outC.keeper.hp = 40; runCast(outC, T, eye, aim, castForMove('healing-grove'))
  const f = inC.fields![0]
  run(inC, 3, { x: f.x, y: 0, z: f.z }); run(outC, 3, { x: 40, y: 0, z: 40 })
  const gain = inC.keeper.hp - outC.keeper.hp
  ok(gain >= 2 * 8 && gain <= 4 * 8 + 1, `grove: heals over time inside (${gain} hp beyond regen in 3 s)`)
}
// Threshold eats spit that crosses it
{
  const c = newCombat(1); runCast(c, T, eye, down, castForMove('threshold')); const f = c.fields![0]
  c.spits.push({ x: f.x, y: 1, z: f.z, vx: 0, vy: 0, vz: 0, life: 9 }); stepFields(c, T, { x: 50, z: 50 })
  ok(c.spits.length === 0, 'threshold: spit inside survived')
}
console.log(fail ? `FAIL ${fail}` : `PASS ${pass}`); process.exit(fail ? 1 : 0)
