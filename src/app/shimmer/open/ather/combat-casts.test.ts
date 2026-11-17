// npx tsx src/app/shimmer/open/ather/combat-casts.test.ts
import { newCombat, spawnHollow, stepCombat, fxOn, type Terrain } from './combat'
import { runCast } from './combat-casts'
import { castForMove } from '../../play3d/cast'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  ✗', m) } }
const T: Terrain = { heightAt: () => 0, walkable: () => true } as unknown as Terrain
const eye = { x: 0, y: 1.6, z: 0 }, fwd = { x: 0, y: 0, z: -1 }, down = (() => { const l = Math.hypot(0, -1.6, -6); return { x: 0, y: -1.6 / l, z: -6 / l } })()
const fresh = (z = -6) => { const c = newCombat(1); const h = spawnHollow(c, T, 0, z); h.state = 'wander'; return { c, h } }

// status: Squall slows what stands in its ring, and a slowed Hollow covers less ground
{
  const { c, h } = fresh(-6)
  const hit = runCast(c, T, eye, down, castForMove('squall'))
  ok(!!hit && hit.hit === 1 && fxOn(h, 'slowed'), `squall: did not slow the Hollow at the aim (${JSON.stringify(hit)})`)
  const { c: c2, h: h2 } = fresh(-6)
  h.state = 'chase'; h2.state = 'chase'
  const feet = { x: 0, y: 0, z: 0 }
  for (let i = 0; i < 20; i++) { stepCombat(c, T, feet, 0.05); stepCombat(c2, T, feet, 0.05) }
  ok(Math.abs(h.z) > Math.abs(h2.z) + 0.3, `slowed: covered as much ground (${h.z.toFixed(2)} vs ${h2.z.toFixed(2)})`)
}
// rooted (Shackle) does not move; disarmed does not hurt
{
  const { c, h } = fresh(-4); h.state = 'chase'
  runCast(c, T, eye, down, castForMove('shackle'))
  const z0 = h.z; for (let i = 0; i < 20; i++) stepCombat(c, T, { x: 0, y: 0, z: 0 }, 0.05)
  ok(fxOn(h, 'rooted') ? Math.abs(h.z - z0) < 1e-6 : false, `shackle: rooted Hollow moved or was not rooted (${fxOn(h, 'rooted')})`)
  const hp = c.keeper.hp; for (let i = 0; i < 60; i++) stepCombat(c, T, { x: 0, y: 0, z: -3.5 }, 0.05)
  ok(c.keeper.hp === hp || !fxOn(h, 'disarmed'), 'shackle: a disarmed Hollow still hurt the keeper')
}
// statuses run out
{
  const { c, h } = fresh(-6); runCast(c, T, eye, down, castForMove('squall'))
  for (let i = 0; i < 140; i++) stepCombat(c, T, { x: 50, y: 0, z: 50 }, 0.05)
  ok(!fxOn(h, 'slowed'), 'squall: the slow never wore off')
}
// projectile: Ice Dart strikes the first body on the line and slows it; Forked Bolt chains
{
  const { c, h } = fresh(-6)
  const hp = h.hp, hit = runCast(c, T, eye, { x: 0, y: -0.12, z: -1 }, castForMove('ice-dart'))
  ok(!!hit && hit.hit === 1 && h.hp < hp && fxOn(h, 'slowed'), `ice dart: no hit / no slow (${JSON.stringify(hit)}, hp ${h.hp})`)
  const c2 = newCombat(1); spawnHollow(c2, T, 0, -6); spawnHollow(c2, T, 3, -7); spawnHollow(c2, T, 6, -8)
  const fb = runCast(c2, T, eye, { x: 0, y: -0.12, z: -1 }, castForMove('forked-bolt'))
  ok(!!fb && fb.hit === 3, `forked bolt: chained to ${fb?.hit} (want 3)`)
  const miss = runCast(newCombat(1), T, eye, fwd, castForMove('ice-dart'))
  ok(!!miss && miss.hit === 0, 'a bolt at nothing claimed a hit')
}
// restore heals, infusion arms the gun
{
  const c = newCombat(1); c.keeper.hp = 40
  runCast(c, T, eye, fwd, castForMove('mend')); ok(c.keeper.hp === 40 + castForMove('mend').heal, `mend: hp ${c.keeper.hp}`)
  runCast(c, T, eye, fwd, castForMove('keenshard')); ok((c.keeper.ampUntil ?? 0) > (c.clock ?? 0), 'keenshard: the gun is not amped')
}
// what the open world does not carry yet comes back null (the page says so before paying)
ok(runCast(newCombat(1), T, eye, fwd, castForMove('stonewall')) === null, 'stonewall: a terrain cast did something')
console.log(`combat-casts: ${pass}/${fail}`); process.exit(fail ? 1 : 0)
