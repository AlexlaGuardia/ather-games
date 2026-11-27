// M150 s4: the new-family models' BUILD DIALS (gun-build.ts). Run: npx tsx src/app/shimmer/open/shared/gun-build.test.ts
import { BUILD_DIALS, BUILD_ZERO, BENCH_KITS, BENCH_ONLY, builtModel, cleanBuild, hasSocket, hasStock, muzzleOf, socketOf, loadBuilds, saveBuild, dimZ, sightFor, GUN_BUILD_KEY, type BenchKitId } from './gun-build'
import { TWINS } from './gun-kit-twins'
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
// M150 s5: THE DIMENSION DIALS on every bench gun, and the two bench-only guns (the Twins pair, the M9 Grinder)
{
  const zs = (m: { parts: { o: number[]; s: number[]; shape?: string; axis?: string; pts?: [number, number][] }[] }) => m.parts.flatMap(p =>
    p.shape === 'poly' && p.axis !== 'z' ? p.pts!.map(q => q[0]) : [p.o[2] - (p.shape !== 'plate' && p.shape !== 'disc' ? p.s[2] / 2 : 0), p.o[2] + (p.shape !== 'plate' && p.shape !== 'disc' ? p.s[2] / 2 : 0)])
  const ext = (m: Parameters<typeof zs>[0]) => { const z = zs(m); return [Math.min(...z), Math.max(...z)] }
  const ALL = Object.keys(BENCH_KITS) as BenchKitId[]
  ok(ALL.length === 8 && BENCH_ONLY.includes('twins') && BENCH_ONLY.includes('grinder'), 'the bench holds 8 guns: the family, the Twins, the Grinder')
  for (const id of ALL) {
    const s = sightFor(id, null), base = builtModel(id, s), [f0, b0] = ext(base)
    const L = builtModel(id, s, { length: 1.2 }), [f1, b1] = ext(L)
    ok(near(f1, f0 * 1.2) && near(b1, b0 * 1.2) && near(L.grip[2], base.grip[2] * 1.2) && near(L.muzzle[1], base.muzzle[1] * 1.2), `${id}: length stretches the whole gun and its anchors`)
    const B = builtModel(id, s, { barrel: 1.5 }), [f2, b2] = ext(B), kz = BENCH_KITS[id].barrelZ
    ok(near(f2, kz + (f0 - kz) * 1.5) && near(b2, b0) && near(B.grip[2], base.grip[2]) && near(B.muzzle[1], kz + (base.muzzle[1] - kz) * 1.5), `${id}: barrel stretches only ahead of the receiver (front ${f0.toFixed(3)} -> ${f2.toFixed(3)}), the grip stays`)
    if (hasStock(id)) { const S = builtModel(id, s, { stock: 1.4 }), [f3, b3] = ext(S), sz = BENCH_KITS[id].stockZ!
      ok(near(f3, f0) && near(b3, sz + (b0 - sz) * 1.4) && near(S.grip[2], base.grip[2]), `${id}: stock stretches only behind the receiver`) }
    const H = builtModel(id, s, { height: 1.25, width: 0.8 })
    ok(near(H.grip[1], base.grip[1] * 1.25) && near(H.top, base.top * 1.25) && H.eye! > base.eye!, `${id}: height lifts the grip, the rail and the sight line`)
    const hy = (m: typeof base) => Math.max(...m.parts.filter(p => p.shape === 'poly' && p.axis !== 'z').flatMap(p => p.pts!.map(q => q[1])))
    ok(near(hy(H), hy(base) * 1.25), `${id}: height scales the outlines (${hy(base).toFixed(3)} -> ${hy(H).toFixed(3)})`)
    const wx = (m: typeof base) => Math.max(...m.parts.map(p => Math.abs(p.o[0])))
    ok(wx(H) < wx(base), `${id}: width narrows the body`)
    const all5 = builtModel(id, s, { length: 1.1, barrel: 1.2, stock: 1.1, height: 1.1, width: 1.1 })
    ok(all5.parts.length === base.parts.length && all5.parts.every(p => [...p.o, ...p.s].every(Number.isFinite)), `${id}: every dial together keeps every part, all finite`)
    const t = trisOf(base); ok(t > 400 && t < 6000, `${id}: cheap (${t} tris)`)
  }
  // the Twins: both guns in one model, the left one TWINS.gap to the left, sightless, both core halves move as one
  const tw = builtModel('twins', null)
  ok(tw.parts.length === TWINS.left.parts.length + TWINS.right.parts.length && sightFor('twins', 'holo') === null, 'Twins: the pair in one model, no sight')
  ok(Math.min(...tw.parts.map(p => p.o[0])) < -TWINS.gap * 0.6, 'Twins: the left gun sits to the left of the grip')
  ok(hasSocket('twins') && !hasStock('twins'), 'Twins: a core (two halves), no stock')
  const tws = builtModel('twins', null, { socketZ: 0.02 }), moved = tws.parts.filter((p, i) => p.o[2] !== tw.parts[i].o[2])
  ok(moved.length === TWINS.left.core.length + TWINS.right.core.length && near(tws.socket![1], tw.socket![1] + 0.02), `Twins: socket moves both core halves (${moved.length} parts)`)
  // the Grinder: family style (iron + bronze + a core), longer than the Backbone, its own muzzle
  const gr = builtModel('grinder', 'iron'), bbm = builtModel('backbone', 'iron')
  ok(ext(gr)[0] < ext(bbm)[0] - 0.04 && gr.parts.some(p => p.c === 'bronze') && hasSocket('grinder') && hasStock('grinder'), 'Grinder: a longer family longbarrel with a core and a stock')
  ok(near(muzzleOf('grinder')[1], ext(gr)[0]) || muzzleOf('grinder')[1] <= ext(gr)[0] + 0.005, 'Grinder: the muzzle is its front')
  ok(near(dimZ({ barrelZ: -0.1, stockZ: 0.1 }, { ...BUILD_ZERO, barrel: 2 }, -0.3), -0.5) && near(dimZ({ barrelZ: -0.1, stockZ: null }, { ...BUILD_ZERO, stock: 2 }, 0.3), 0.3), 'dimZ: barrel region stretches, a stockless gun ignores stock')
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
