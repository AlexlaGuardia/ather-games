// npx tsx src/app/shimmer/open/ather/combat-terrain.test.ts
import { newCombat, spawnHollow, stepCombat, solidTop, type Terrain } from './combat'
import { runCast, stepFields, stepPieces } from './combat-casts'
import { castForMove } from '../../play3d/cast'
import { castsHere } from '../shared/casting'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const T: Terrain = { heightAt: () => 0, walkable: () => true } as unknown as Terrain
const eye = { x: 0, y: 1.6, z: 0 }
const dirTo = (d: number) => { const l = Math.hypot(1.6, d); return { x: 0, y: -1.6 / l, z: -d / l } }
const run = (c: ReturnType<typeof newCombat>, secs: number, feet = { x: 0, y: 0, z: 0 }) => { for (let i = 0; i < secs * 20; i++) { stepPieces(c); stepFields(c, T, feet); stepCombat(c, T, feet, 0.05) } }
const TERRAIN = ['stonewall', 'living-architecture', 'glacial-path', 'cordon', 'pillar-tomb', 'living-fortress', 'monolith']
for (const id of TERRAIN) ok(castsHere(castForMove(id)), `${id} is runnable in the open world`)

// Stonewall between a chasing Hollow and the keeper: the Hollow cannot get through, then can once it expires
{
  const c = newCombat(1); const h = spawnHollow(c, T, 0, -14); h.state = 'chase'
  const hit = runCast(c, T, eye, dirTo(7), castForMove('stonewall'))   // aim is -z: the wall rises ~7 m toward the Hollow
  ok(!!hit && (c.pieces?.length ?? 0) === 1 && c.pieces![0].cells.length >= 5, `wall raised (${JSON.stringify(hit)})`)
  const wz = c.pieces![0].cells[0].z
  ok(solidTop(c, 0, wz) === 2, 'wall cell is 2 m tall')
  run(c, 6)
  ok(h.z < wz - 0.4, `Hollow crossed the wall (z ${h.z}, wall ${wz})`)
  ok(Math.abs(h.x) < 6, `Hollow did not path round (x ${h.x})`)  // spans 11 m centred on 0; it slides along but stays behind
  run(c, 8)
  ok(!c.pieces?.length, 'wall did not expire')
  run(c, 6)
  ok(h.z > wz + 0.4, `Hollow did not pass the expired wall (z ${h.z})`)
}
// spit is stopped by it
{
  const c = newCombat(1); runCast(c, T, eye, dirTo(7), castForMove('stonewall'))
  const wz = c.pieces![0].cells[0].z
  c.spits.push({ x: 0, y: 0.9, z: wz - 3, vx: 0, vz: 11, vy: 0, life: 3 } as never)
  run(c, 1)
  ok(c.spits.length === 0, 'spit crossed the wall')
}
// a ring: Cordon lays disarmed on a Hollow inside; a Hollow outside is not
{
  const c = newCombat(1); const a = spawnHollow(c, T, 0, -7), b = spawnHollow(c, T, 20, -7)
  runCast(c, T, eye, dirTo(7), castForMove('cordon'))
  ok((a.fx?.disarmed ?? 0) > 0 && !(b.fx?.disarmed ?? 0), 'cordon disarms inside only')
}
// pillar tomb entombs the nearest Hollow
{
  const c = newCombat(1); const a = spawnHollow(c, T, 0, -7)
  runCast(c, T, eye, dirTo(7), castForMove('pillar-tomb'))
  ok((a.fx?.rooted ?? 0) > 0 && solidTop(c, a.x, a.z) === 4, 'pillar tomb holds and raises around the foe')
}
console.log(fail ? `FAIL ${fail}` : `terrain ${pass}/0`); process.exit(fail ? 1 : 0)
