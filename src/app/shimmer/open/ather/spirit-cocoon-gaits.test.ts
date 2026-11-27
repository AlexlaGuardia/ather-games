// BETA M215 (Alex 11-26, watching the Dewbear line walk in the gallery): the two LEGLESS cocoon gaits, read off the shipped glbs.
// Run: npx tsx src/app/shimmer/open/ather/spirit-cocoon-gaits.test.ts
//  - Voltbear: no legs (no vertex weighted to a leg bone) and she HOVERS in every clip: her root is lifted in every key of every
//    clip, highest standing, lowest lying down (settled low, still off the ground), her body's lowest bind vertex at y 0.
//  - Tidebear: no legs either, a SLUG: her sole (every vertex near the ground) rides the root alone, and no clip lifts the root,
//    so she never floats; her walk is a wave (the spine joints turn out of step).
//  - Lumebear (and Cragbear, untouched) still walk on legs.
import * as fs from 'fs'
import { formLook } from './spirit-models'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
type J = { nodes: { name: string }[]; accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }[]; bufferViews: { byteOffset?: number; byteStride?: number }[]
  meshes: { name: string; primitives: { attributes: Record<string, number> }[] }[]; skins: { joints: number[] }[]; animations: { name: string; channels: { sampler: number; target: { node: number; path: string } }[]; samplers: { output: number }[] }[] }
function load(name: string) {
  const b = fs.readFileSync(`public/open/spirits/${name}-rigged.glb`), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString()) as J, bin = b.subarray(20 + jl + 8)
  const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
  const read = (i: number): number[][] => {
    const a = j.accessors[i], v = j.bufferViews[a.bufferView], n = SIZE[a.type], bytes = ({ 5121: 1, 5123: 2, 5126: 4 } as Record<number, number>)[a.componentType]
    const stride = v.byteStride ?? n * bytes, o = (v.byteOffset ?? 0) + (a.byteOffset ?? 0), out: number[][] = []
    for (let k = 0; k < a.count; k++) { const r: number[] = []
      for (let c = 0; c < n; c++) { const p = o + k * stride + c * bytes; r.push(bytes === 4 ? bin.readFloatLE(p) : bytes === 2 ? bin.readUInt16LE(p) / (a.normalized ? 65535 : 1) : bin.readUInt8(p) / (a.normalized ? 255 : 1)) }
      out.push(r) }
    return out
  }
  const body = j.meshes.find(m => m.name === 'body')!.primitives[0].attributes, joints = j.skins[0].joints.map(n => j.nodes[n].name)
  return { j, read, pos: read(body.POSITION), J: read(body.JOINTS_0), W: read(body.WEIGHTS_0), joints }
}
const LEGS = ['fl', 'fr', 'hl', 'hr'].flatMap(g => ['up', 'lo', 'paw'].map(p => `b_${g}_${p}`))
const legWeight = (g: ReturnType<typeof load>) => { let s = 0; g.J.forEach((js, i) => js.forEach((jn, k) => { if (LEGS.includes(g.joints[jn])) s += g.W[i][k] })); return s }
/** every key of the root's translation track in a clip (y), or [] when the clip does not move the root */
const rootY = (g: ReturnType<typeof load>, clip: string) => {
  const a = g.j.animations.find(x => x.name === clip)!, ch = a.channels.find(c => g.j.nodes[c.target.node].name === 'b_root' && c.target.path === 'translation')
  return ch ? g.read(a.samplers[ch.sampler].output).map(r => r[1]) : []
}
const CLIPS = ['idle', 'walk', 'run', 'sit', 'lie']
ok(formLook('water-bear', 'storm')?.url === '/open/spirits/voltbear-rigged.glb' && formLook('water-bear', 'water')?.url === '/open/spirits/tidebear-rigged.glb', 'the storm / water Dewbear forms are these glbs')

{ const g = load('voltbear'), lo = Math.min(...g.pos.map(p => p[1]))
  ok(legWeight(g) === 0, `voltbear: no legs (leg-bone weight ${legWeight(g).toFixed(2)})`)
  ok(Math.abs(lo) < 0.005, `voltbear: her body's lowest bind vertex sits at 0 (${lo.toFixed(3)}), so her lift is all hover`)
  const min: Record<string, number> = {}
  for (const c of CLIPS) { const ys = rootY(g, c); min[c] = ys.length ? Math.min(...ys) : 0 }
  ok(['idle', 'walk', 'run'].every(c => min[c] > 0.10), `voltbear: hovers standing and gliding (root min ${['idle', 'walk', 'run'].map(c => min[c].toFixed(3))} glb)`)
  ok(min.sit > 0.03 && min.lie > 0.01 && min.lie < min.sit && min.sit < min.idle, `voltbear: settles low to sit / lie, never down (sit ${min.sit.toFixed(3)}, lie ${min.lie.toFixed(3)})`)
  const idle = rootY(g, 'idle'); ok(Math.max(...idle) - Math.min(...idle) > 0.02, 'voltbear: her idle bobs') }

{ const g = load('tidebear'), root = g.joints.indexOf('b_root')
  ok(legWeight(g) === 0, `tidebear: no legs (leg-bone weight ${legWeight(g).toFixed(2)})`)
  let sole = 0, onRoot = 0
  g.pos.forEach((p, i) => { if (p[1] < 0.02) { sole++; const k = g.J[i].indexOf(root); if (k >= 0 && g.W[i][k] > 0.98) onRoot++ } })
  ok(sole > 50 && onRoot === sole, `tidebear: her sole rides the root (${onRoot}/${sole} ground vertices)`)
  ok(CLIPS.every(c => rootY(g, c).every(y => Math.abs(y) < 1e-4)), 'tidebear: no clip lifts her root (a slug never floats)')
  // the wave: in her walk the pelvis and chest turn out of step (a ripple up her, not a rocking block)
  const a = g.j.animations.find(x => x.name === 'walk')!, rot = (b: string) => { const ch = a.channels.find(c => g.j.nodes[c.target.node].name === b && c.target.path === 'rotation')!; return g.read(a.samplers[ch.sampler].output).map(q => q[0]) }
  const pv = rot('b_pelvis'), cs = rot('b_chest'), peak = (x: number[]) => x.indexOf(Math.max(...x))
  ok(peak(pv) !== peak(cs) && Math.max(...pv) - Math.min(...pv) > 0.02, `tidebear: her walk is a wave (pelvis peaks at key ${peak(pv)}, chest at ${peak(cs)})`) }

{ const g = load('lumebear'); ok(legWeight(g) > 100, 'lumebear: still walks on her legs') }

console.log(`spirit-cocoon-gaits: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL ' + f)
if (fails.length) process.exit(1)
