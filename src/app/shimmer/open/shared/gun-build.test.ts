// M150 s4: the new-family models' BUILD DIALS (gun-build.ts). Run: npx tsx src/app/shimmer/open/shared/gun-build.test.ts
import { BUILD_DIALS, BUILD_ZERO, builtModel, cleanBuild, hasSocket, muzzleOf, socketOf, loadBuilds, saveBuild, GUN_BUILD_KEY } from './gun-build'
import { V2_GUNS, v2Model, isCorePart, type V2GunId } from './gun-kit-v2'
import { RANGE_GUNS } from './gunplay'
import { trisOf } from './gun-kit-geo'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, l: string) => { if (c) pass++; else fails.push(l) }
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

// every gun on the range has a new-family model now
for (const g of RANGE_GUNS) ok(g.id in V2_GUNS, `${g.id}: has a new-family model on the bench`)
const IDS = Object.keys(V2_GUNS) as V2GunId[]
for (const id of IDS) {
  const g = V2_GUNS[id]
  for (const s of g.sights) {
    const z = builtModel(id, s)
    ok(z.parts === v2Model(id, s).parts && z.grip === v2Model(id, s).grip, `${id}+${s}: untouched dials = today's new model, part for part`)
    ok(builtModel(id, s, {}) === z && builtModel(id, s, { ...BUILD_ZERO }) === z, `${id}+${s}: one cached object per build`)
    const t = trisOf(z); ok(t > 400 && t < 4500, `${id}+${s}: cheap (${t} tris)`)
  }
  ok(hasSocket(id) === (id !== 'charred-rifle'), `${id}: ${id === 'charred-rifle' ? 'the Prototype has no socket' : 'one sigil core socket'}`)
  ok((socketOf(id) === null) === (id === 'charred-rifle'), `${id}: socket spot matches the core`)
  const [, mz] = muzzleOf(id), front = Math.min(...g.parts.map(p => p.o[2] - (p.shape === 'cyl' && (p.axis ?? 'z') === 'z' ? p.s[2] / 2 : 0)))
  ok(near(mz, front) || mz <= front + 0.005, `${id}: the muzzle is the gun's front (${mz.toFixed(3)} vs ${front.toFixed(3)})`)
}
// each dial moves what it names and nothing else
{
  const id: V2GunId = 'backbone', base = builtModel(id, 'holo')
  const sc = builtModel(id, 'holo', { scale: 1.5 })
  ok(near(sc.grip[1], base.grip[1] * 1.5) && near(sc.eye!, base.eye! * 1.5) && near(sc.muzzle[1], base.muzzle[1] * 1.5), 'scale: grip, sight line and muzzle all scale')
  ok(near(sc.parts[0].pts![0][0], base.parts[0].pts![0][0] * 1.5), 'scale: the outlines scale')
  const gr = builtModel(id, 'holo', { gripY: 0.02, gripZ: -0.01 })
  ok(near(gr.grip[1], base.grip[1] + 0.02) && near(gr.grip[2], base.grip[2] - 0.01) && gr.fore[2] === base.fore[2] && gr.eye === base.eye, 'grip: the grip anchor moves alone')
  const rl = builtModel(id, 'holo', { railY: 0.01, seatZ: 0.04 })
  const dot = (m: typeof base) => m.parts.find(p => p.c === 'dot')!
  ok(near(rl.eye!, base.eye! + 0.01) && near(rl.sightZ, base.sightZ + 0.04) && near(dot(rl).o[1], dot(base).o[1] + 0.01) && near(dot(rl).o[1], rl.eye!), 'rail: the sight rides up with the rail and the mark stays on the sight line')
  const sk = builtModel(id, 'holo', { socketZ: 0.05 }), cores = (m: typeof base) => m.parts.filter((p, i) => isCorePart(V2_GUNS[id].parts[i] ?? p) && i < V2_GUNS[id].parts.length)
  ok(cores(sk).length === 4 && cores(sk).every((p, i) => near(p.o[2], cores(base)[i].o[2] + 0.05)) && near(sk.socket![1], base.socket![1] + 0.05), 'socket: the core moves as one piece, socket spot with it')
  ok(sk.parts.every((p, i) => i >= V2_GUNS[id].parts.length || isCorePart(V2_GUNS[id].parts[i]) || p === base.parts[i]) && sk.grip[2] === base.grip[2] && sk.eye === base.eye, 'socket: nothing else moves')
  const mu = builtModel(id, 'holo', { muzzleZ: -0.02 })
  ok(near(mu.muzzle[1], base.muzzle[1] - 0.02) && mu.parts.length === base.parts.length, 'muzzle: the point moves, the model does not')
  ok(builtModel('charred-rifle', 'ring', { socketZ: 0.05 }).socket === null, 'the Prototype: a socket dial finds no core')
}
// saved dials are cleaned: out of range clamps, junk falls back
{
  const c = cleanBuild({ scale: 9, gripY: 'x', muzzleZ: -0.05 } as never)
  ok(c.scale === BUILD_DIALS.find(d => d.k === 'scale')!.max && c.gripY === 0 && c.muzzleZ === -0.05, 'clean: clamp, fall back, keep')
  const mem = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: k => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 }
  saveBuild('roar', { scale: 1.1, socketZ: 0.02 })
  ok(loadBuilds().roar?.scale === 1.1 && loadBuilds().roar?.socketZ === 0.02 && JSON.parse(mem.get(GUN_BUILD_KEY)!).roar, 'save: a gun\'s dials round-trip through this browser')
  saveBuild('roar', null); ok(!loadBuilds().roar, 'save: reset forgets the gun')
  mem.set(GUN_BUILD_KEY, '{bad'); ok(Object.keys(loadBuilds()).length === 0, 'load: a broken save reads as nothing saved')
}
console.log(`gun-build: ${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('  FAIL', f)
process.exit(fails.length ? 1 : 0)
