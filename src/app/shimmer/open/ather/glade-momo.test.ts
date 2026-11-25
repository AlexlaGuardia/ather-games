// BETA M155 s2: Momo (the figure, his spot). npx tsx src/app/shimmer/open/ather/glade-momo.test.ts
import { EYE, MOMO_CALLS, MOMO_HEIGHT, PX, momoFigure } from '../shared/momo-figure'
import { momoSpot, MOMO_STEP } from './glade-momo'
import { gladeKeepers, gladeZoneGround } from './glade-cluster'
import { setGladePeople } from './glade-people'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.error('✗ ' + m) } }
const f = momoFigure(), tris = [f.toon, f.ink, f.paint].reduce((n, g) => n + g.index!.count / 3, 0)
ok(MOMO_CALLS === 3 && Object.keys(f).length === MOMO_CALLS && momoFigure() === f, 'three meshes, built once')
ok(tris < 5500, `phone-safe (${tris} triangles)`)
f.toon.computeBoundingBox(); const b = f.toon.boundingBox!
ok(b.min.y > 0 && b.min.y < 0.02 && Math.abs(b.max.y - MOMO_HEIGHT) < 0.02 && MOMO_HEIGHT < 0.45, `feet on the ground, cat-sized (${b.min.y} .. ${b.max.y})`)
ok(Math.abs(b.max.x + b.min.x) < 1e-6, 'the same both sides')
{ // the eyes sit ON the orb, on the front, and nothing painted is inside it
  const P = f.paint.attributes.position, n = P.count; let inside = 0, front = 0, left = 0, right = 0
  for (let i = 0; i < n; i++) { const x = P.getX(i) / PX / 250, y = (P.getY(i) / PX - 274) / 235, z = P.getZ(i) / PX / 250; if (Math.hypot(x, y, z) < 1.002) inside++; if (z > 0.6 && Math.abs(y) < 0.35) { front++; if (x > 0) left++; else right++ } }
  ok(inside === 0, `painted on the skin, never under it (${inside})`); ok(front > 200 && left === right, `two eyes, level (${left} ${right})`) }
ok(EYE.a > 0.3 && EYE.a < 0.6, 'the eyes face forward')
const flat = () => 1, at = (g = flat as (x: number, z: number) => number, bl?: (x: number, z: number) => boolean, bonn?: { x: number; z: number; yaw: number }) => momoSpot(g, bl, bonn)!
const B = { x: 10, z: 20, yaw: 0 }, p = at(flat, undefined, B)
ok(Math.abs(p.x - 10.46) < 1e-9 && Math.abs(p.z - 20.14) < 1e-9 && p.y === 1 && p.yaw === 0, 'her left boot, a touch ahead')
{ const q = at(flat, undefined, { ...B, yaw: Math.PI / 2 }); ok(Math.abs(q.x - 10.14) < 1e-9 && Math.abs(q.z - 19.54) < 1e-9, 'it turns with her') }
ok(at(flat, x => x > 10.4, B).x < 10, 'a wall on her left: her right'); ok(at(x => x > 10.4 ? 1 + MOMO_STEP + 0.01 : 1, undefined, B).x < 10, 'a step on her left: her right')
ok(at(x => x > 10.2 ? -Infinity : 1, undefined, B).x < 10, 'the void on her left: her right'); ok(at(x => x === 10 ? 1 : -Infinity, undefined, B).y === 1, 'nowhere at all: at her height, never in the void')
const bonn = () => gladeKeepers().find(k => k.id === 'bonn')!
{ const s = momoSpot(gladeZoneGround)!, k = bonn(); ok(Math.hypot(s.x - k.x, s.z - k.z) < 0.7 && s.y === gladeZoneGround(s.x, s.z), 'by Bonn in the real Glade') 
  setGladePeople([{ id: 'p1', k: 'who:bonn', x: k.x + 6, z: k.z - 4, q: 1, s: 1 } as never]); const m = momoSpot(gladeZoneGround)!, nk = bonn()
  ok(nk.x === k.x + 6 && Math.hypot(m.x - nk.x, m.z - nk.z) < 0.7 && m.yaw === nk.yaw, 'Bonn moved in Place mode: he goes with her'); setGladePeople([]) }
console.log(`glade-momo: ${pass} pass, ${fail} fail`); if (fail) process.exit(1)
