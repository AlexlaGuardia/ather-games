// BETA M233 v2d: the ring's camera table + the tree's marks after each bout. Run: npx tsx src/app/shimmer/open/ather/clash-ceremony.test.ts
import { newBracket, newField, recordBout, nextBout, YOU } from './clash-bracket'
import { CLASH_CAM, camPose, ceremonyMs, CEREMONY, FLOOR_MS, treeMarks, camLine, formName } from './clash-ceremony'
import { RING_R } from './clash-bout'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── the camera: the whole ring in frame at desk + phone aspects, fixed on the centre by default ──
const inFrame = (aspect: number, px: number, pz: number, py = 0) => {
  const p = camPose(CLASH_CAM, aspect), cam = [p.x, p.y, p.z]
  const f = [-cam[0], -cam[1], -cam[2]], fl = Math.hypot(f[0], f[1], f[2]); f.forEach((v, i) => (f[i] = v / fl))
  const r = [f[2], 0, -f[0]], rl = Math.hypot(r[0], r[2]); r[0] /= -rl; r[2] /= -rl   // right = up x forward... sign-free use below
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]
  const d = [px - cam[0], py - cam[1], pz - cam[2]]
  const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2], x = d[0] * r[0] + d[1] * r[1] + d[2] * r[2], y = d[0] * u[0] + d[1] * u[1] + d[2] * u[2]
  const tv = Math.tan((p.fov * Math.PI) / 360)
  return z > 0 && Math.abs(x / z) <= tv * aspect && Math.abs(y / z) <= tv
}
for (const [name, aspect] of [['desk 960x800', 1.2], ['phone 390x520', 0.75], ['wide 1440x800', 1.8]] as const) {
  let all = true
  for (let a = 0; a < 16; a++) for (const y of [0, 1.4]) { const th = (a / 16) * Math.PI * 2; if (!inFrame(aspect, Math.sin(th) * (RING_R - 0.5), Math.cos(th) * (RING_R - 0.5), y)) all = false }
  ok(all, `${name}: every spot a spirit can stand (and her head) is in frame`)
}
ok(CLASH_CAM.follow === 0, 'default camera is fixed on the centre (no trailing)')
ok(camPose(CLASH_CAM, 0.75).scale > camPose(CLASH_CAM, 1.2).scale, 'a narrow screen pulls the camera back')
ok(camPose({ ...CLASH_CAM, fit: 0 }, 0.75).scale === 1, 'fit 0 = the table as is')
ok(Math.hypot(camPose(CLASH_CAM, 1.2).y, camPose(CLASH_CAM, 1.2).z) > 14, 'pulled back from v2a (was ~7-12 m off at desk)')
ok(camLine(CLASH_CAM).startsWith('{ height: 14,'), 'copy line names every value')
// ── the ceremony's beat lengths ──
ok(ceremonyMs('intro') === CEREMONY.intro && ceremonyMs('tree', 100) === FLOOR_MS && ceremonyMs('intro', 2) === CEREMONY.intro / 2, 'beats shorten with speed, never under the floor')
ok(formName('base') === 'Base form' && formName('fire') === 'Fire form', 'form names')

// ── the tree after each bout (solo: 3 line-up + her = 4 seats; bouts 0 (1v2), 1 (3vYOU), 2 final) ──
let b = newBracket(3)
let m = treeMarks(b, null)
ok(m[0].next && !m[1].next && m.every(x => x.crossed === null && !x.moved), 'start: bout 0 highlighted, nothing crossed')
b = recordBout(b, 0, 2); m = treeMarks(b, 0)
ok(m[0].crossed === 1, 'bout 0: the loser (seat 1) is crossed')
ok(m[2].moved && (b.bouts[2].a === 2), 'bout 0: the winner moved up into the final')
ok(m[1].next && !m[2].next, 'bout 0: the next two (bout 1) highlighted')
b = recordBout(b, 1, YOU); m = treeMarks(b, 1)
ok(m[1].crossed === 3 && m[0].crossed === 1, 'bout 1: its loser crossed, the earlier one stays crossed')
ok(m[2].moved && m[2].next && b.bouts[2].b === YOU, 'bout 1: she moved up and the final is next')
b = recordBout(b, 2, 2); m = treeMarks(b, 2)
ok(m[2].crossed === YOU && m.every(x => !x.next) && m.every(x => !x.moved), 'final: loser crossed, nothing next, no seat above')
// a field of 8 runs to its champion; every round's winner moves up exactly once
let f = newField(8), moves = 0, steps = 0
for (let i = nextBout(f, true); i !== null; i = nextBout(f, true)) { const bt = f.bouts[i]; f = recordBout(f, i, bt.a! % 3 === 0 ? bt.a! : bt.b!); const mk = treeMarks(f, i, true); moves += mk.filter(x => x.moved).length; steps++
  ok(mk.filter(x => x.next).length === (nextBout(f, true) === null ? 0 : 1), `field step ${steps}: exactly one bout highlighted`) }
ok(steps === 7 && moves === 6, `field of 8: 7 bouts, 6 moves up (${steps}/${moves})`)

console.log(`clash-ceremony.test: ${pass} passed, ${fails.length} failed`)
for (const x of fails) console.log('  FAIL', x)
if (fails.length) process.exit(1)
