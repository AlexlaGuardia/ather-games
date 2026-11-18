// npx tsx src/app/shimmer/open/ather/dynamic-solids.test.ts
import { newCombat, type Terrain } from './combat'
import { runCast, stepPieces } from './combat-casts'
import { withPieces } from './dynamic-solids'
import { terrainWorld, type Shape } from '../terrain-world'
import { createLoco, tickLocomotion } from '../shared/locomotion'
import { castForMove } from '../../play3d/cast'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  x', m) } }
const T: Terrain = { heightAt: () => 0, walkable: () => true } as unknown as Terrain
const flat: Shape = { ground: () => 0, solids: () => [], water: () => [] }
const c = newCombat(1)
const world = terrainWorld(withPieces(flat, () => c))
const eye = { x: 0, y: 1.6, z: 0 }, l = Math.hypot(1.6, 7)
runCast(c, T, eye, { x: 0, y: -1.6 / l, z: -7 / l }, castForMove('stonewall'))   // wall ~7 m toward -z, 2 m tall
const wz = c.pieces![0].cells[0].z
const walk = (secs: number, lc = createLoco(0, 0, 3), grounded?: { minZ: number }) => {
  for (let i = 0; i < secs * 60; i++) {
    tickLocomotion(lc, { mvX: 0, mvZ: -1, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60 }, world)
    if (grounded && lc.py < 0.5) grounded.minZ = Math.min(grounded.minZ, lc.pz)
  }
  return lc
}
// a 2 m wall is a ledge the walker's own mantle can take (the same rule as a 2 m rock): the proof is that it is a SOLID, never walked through at ground level
const g = { minZ: 99 }
const a = walk(2.5, undefined, g)
ok(g.minZ > wz, `at ground level the keeper never gets past the wall (min z ${g.minZ.toFixed(2)}, wall z ${wz})`)
ok(a.py > 1.5 && Math.abs(a.pz - wz) < 1.2, `the keeper mantles onto it and stands on the top (y ${a.py.toFixed(2)}, z ${a.pz.toFixed(2)})`)
// a 4 m piece (Pillar-tomb height): the walker can still climb a tall face like any rock, but never walks THROUGH it
{
  const t = newCombat(1); t.pieces = [{ id: 9, moveId: 'x', until: 50, cells: [-2, -1, 0, 1, 2].map(x => ({ x, z: -6, base: 0, rise: 4 })) }]
  const tw = terrainWorld(withPieces(flat, () => t)), lc = createLoco(0, 0, 3)
  const tick = () => tickLocomotion(lc, { mvX: 0, mvZ: -1, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60 }, tw)
  let minZ = 99, top = 0
  for (let i = 0; i < 360; i++) { tick(); if (top < 0.5) minZ = Math.min(minZ, lc.pz); top = Math.max(top, lc.py) }
  ok(minZ > -5.5 && top > 1, `a 4 m wall is a face, not a doorway: grounded min z ${minZ.toFixed(2)}, climbed to y ${top.toFixed(2)}`)
}
c.clock = 100; stepPieces(c)
ok(!c.pieces?.length, 'wall expired')
const b = walk(3, createLoco(0, 0, 3))
ok(b.pz < wz - 0.5 && b.py < 0.5, `the 2 m wall, once expired, is walked through (z ${b.pz.toFixed(2)})`)
console.log(fail ? `FAIL ${fail}` : `dynamic-solids ${pass}/0`); process.exit(fail ? 1 : 0)
