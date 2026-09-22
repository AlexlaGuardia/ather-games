// Bake a picaso `.glb` into a SYNCHRONOUS geometry module the game can import under node.
//
// ── ★ WHY A BAKE AND NOT A FETCH ───────────────────────────────────────────────────────────────
// `/bushtest sculpt` loads the glb at runtime through GLTFLoader, and that is right for a showcase:
// one command, one look, nothing downstream. The WILD pool cannot work that way, and the reason is
// not performance — it is that three consumers of a plant's shape do not run in a browser:
//
//   · `floraBounds` measures the real vertices to draw the reticle's box (`flora-bounds.test.ts`)
//   · `mesh-icon.ts` rasterises the shipped geometry into the bag icon, in a software z-buffer,
//     explicitly so "a headless script and a test render exactly what the bag renders"
//   · every sweep/check script that imports either of those
//
// An async geometry is invisible to all three. They would each silently keep measuring the CARD
// while the world drew the sculpt — the outline loose, the icon wrong, and every guard green,
// because a guard that cannot see its subject reports on nothing. (INSTRUMENTS.md, verbatim.)
//
// So the glb becomes a module: quantised positions + uvs, base64, dequantised by a factory that
// looks exactly like `floraPuffGeo()` and is used exactly the same way. The `.glb` stays in
// `public/` untouched — it is still what `/bushtest sculpt` loads and still what picaso re-renders,
// so the iteration loop is `blender … && npm run bake:flora` and nothing else moves.
//
// ⚠ NORMALS ARE NOT BAKED, ON PURPOSE. The world draws these flatShaded and the icon shades per
// triangle, so both derive normals from the positions anyway; baking them would ship 13k floats
// that exist only to be overwritten, and they would be the copy that goes stale first.
//
//   npx tsx scripts/bake-flora-model.mts public/models/flora/sunfruit-bush.glb \
//     --out src/app/shimmer/voxel3d/models/sunfruit-bush.ts --name sunfruitBush
//
// Quantisation: int16 over the model's own measured box, so the step is (extent / 65535) — about
// 2e-5 blocks on a 1.2-block bush, four orders under a texel. The box itself ships as floats.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, basename } from 'node:path'

interface Accessor { bufferView: number; componentType: number; count: number; type: string; byteOffset?: number }
interface View { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }

/** Pull one accessor out of a glb's binary chunk as a flat Float32Array (or index array). */
function readAccessor(json: any, bin: Buffer, index: number): Float32Array | Uint32Array {
  const acc: Accessor = json.accessors[index]
  const view: View = json.bufferViews[acc.bufferView]
  const n = COMPONENTS[acc.type]
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const count = acc.count * n
  // 5126 = FLOAT, 5123 = UNSIGNED_SHORT, 5125 = UNSIGNED_INT. A stride is legal glTF and this
  // reader does not honour it — so it refuses rather than returning plausible garbage.
  if (view.byteStride && view.byteStride !== n * (acc.componentType === 5126 ? 4 : acc.componentType === 5125 ? 4 : 2)) {
    throw new Error(`interleaved bufferView (stride ${view.byteStride}) — this baker reads tight buffers only`)
  }
  if (acc.componentType === 5126) {
    const out = new Float32Array(count)
    for (let i = 0; i < count; i++) out[i] = bin.readFloatLE(base + i * 4)
    return out
  }
  if (acc.componentType === 5123) {
    const out = new Uint32Array(count)
    for (let i = 0; i < count; i++) out[i] = bin.readUInt16LE(base + i * 2)
    return out
  }
  if (acc.componentType === 5125) {
    const out = new Uint32Array(count)
    for (let i = 0; i < count; i++) out[i] = bin.readUInt32LE(base + i * 4)
    return out
  }
  throw new Error(`unhandled componentType ${acc.componentType}`)
}

function parseGlb(path: string): { json: any; bin: Buffer } {
  const d = readFileSync(path)
  if (d.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path} is not a .glb`)
  const jsonLen = d.readUInt32LE(12)
  const json = JSON.parse(d.subarray(20, 20 + jsonLen).toString('utf8'))
  // The BIN chunk follows the JSON chunk, both 4-byte aligned, each with an 8-byte header.
  const binStart = 20 + jsonLen + 8
  return { json, bin: d.subarray(binStart) }
}

/** A node's own translation/scale, applied — picaso parents the fruit cluster at an offset. */
function nodeXform(node: any): { t: [number, number, number]; s: [number, number, number] } {
  return { t: (node.translation ?? [0, 0, 0]) as [number, number, number], s: (node.scale ?? [1, 1, 1]) as [number, number, number] }
}

interface Part { name: string; pos: Float32Array; uv: Float32Array | null }

/** Flatten a node's mesh to NON-INDEXED world-of-the-model vertices (the form three draws flat). */
function bakeNode(json: any, bin: Buffer, node: any): Part {
  const mesh = json.meshes[node.mesh]
  const { t, s } = nodeXform(node)
  const pos: number[] = [], uv: number[] = []
  let sawUv = true
  for (const prim of mesh.primitives) {
    const p = readAccessor(json, bin, prim.attributes.POSITION) as Float32Array
    const u = prim.attributes.TEXCOORD_0 !== undefined
      ? readAccessor(json, bin, prim.attributes.TEXCOORD_0) as Float32Array : null
    if (!u) sawUv = false
    const idx = prim.indices !== undefined ? readAccessor(json, bin, prim.indices) as Uint32Array : null
    const count = idx ? idx.length : p.length / 3
    for (let i = 0; i < count; i++) {
      const v = idx ? idx[i] : i
      pos.push(p[v * 3] * s[0] + t[0], p[v * 3 + 1] * s[1] + t[1], p[v * 3 + 2] * s[2] + t[2])
      if (u) uv.push(u[v * 2], u[v * 2 + 1])
    }
  }
  return { name: node.name, pos: new Float32Array(pos), uv: sawUv && uv.length ? new Float32Array(uv) : null }
}

/** int16 over [min, max] per axis; the box ships beside it so the factory can undo this exactly. */
function quantise(src: Float32Array, stride: number): { b64: string; min: number[]; max: number[] } {
  const min = new Array(stride).fill(Infinity), max = new Array(stride).fill(-Infinity)
  for (let i = 0; i < src.length; i += stride) {
    for (let k = 0; k < stride; k++) {
      if (src[i + k] < min[k]) min[k] = src[i + k]
      if (src[i + k] > max[k]) max[k] = src[i + k]
    }
  }
  const out = new Int16Array(src.length)
  for (let i = 0; i < src.length; i += stride) {
    for (let k = 0; k < stride; k++) {
      const span = max[k] - min[k]
      // A degenerate axis (a flat model, a constant uv row) would divide by zero and ship NaN.
      const f = span > 1e-9 ? (src[i + k] - min[k]) / span : 0
      out[i + k] = Math.round(f * 65535) - 32768
    }
  }
  return { b64: Buffer.from(out.buffer, out.byteOffset, out.byteLength).toString('base64'), min, max }
}

const args = process.argv.slice(2)
const src = args[0]
if (!src) { console.error('usage: bake-flora-model.mts <in.glb> [--out <file.ts>] [--name <camelCase>] [--via <regen command>]'); process.exit(1) }
const outPath = args.includes('--out') ? args[args.indexOf('--out') + 1]
  : `src/app/shimmer/voxel3d/models/${basename(src, '.glb')}.ts`
const stem = args.includes('--name') ? args[args.indexOf('--name') + 1]
  : basename(src, '.glb').replace(/-(\w)/g, (_, c) => c.toUpperCase())

const { json, bin } = parseGlb(src)
const nodes = (json.nodes ?? []).filter((n: any) => n.mesh !== undefined)
if (!nodes.length) throw new Error('no mesh nodes in the glb')

const parts = nodes.map((n: any) => bakeNode(json, bin, n))
const fn = (name: string) => stem + name.replace(/^./, c => c.toUpperCase()) + 'Geo'

const lines: string[] = []
// ⚠ THE HEADER MUST NAME THE COMMAND THAT ACTUALLY REGENERATES *THIS* MODULE. It used to
// hard-code `npm run bake:flora`, which is a lie the moment anything but a bush is baked through
// here — and a generated file's header is the ONE instruction its reader gets. `--via` lets each
// recipe name itself; the default is the raw invocation, which is always true if verbose.
// (Caught by the `assets` lane baking a cauldron through this script, 2026-09-22.)
const via = args.includes('--via') ? args[args.indexOf('--via') + 1]
  : `npx tsx scripts/bake-flora-model.mts ${src} --out ${outPath} --name ${stem}`
lines.push(`// GENERATED by \`${via}\` from ${src} — DO NOT EDIT BY HAND.`)
lines.push(`//`)
lines.push(`// ★ The sculpt as a SYNCHRONOUS factory, because three of its consumers do not run in a`)
lines.push(`// browser: \`floraBounds\` (the reticle's box), \`mesh-icon\` (the bag icon's software`)
lines.push(`// raster) and the node checks that read both. See \`scripts/bake-flora-model.mts\` for the`)
lines.push(`// argument in full. Re-bake after every picaso pass; the \`.glb\` remains the source.`)
lines.push(`//`)
lines.push(`// Positions are int16 over the model's own measured box (step ~2e-5 blocks). Normals are`)
lines.push(`// NOT baked — every consumer shades these flat and derives them from the positions.`)
lines.push(``)
lines.push(`import * as THREE from 'three'`)
lines.push(``)
lines.push(`const decode = (b64: string, stride: number, min: number[], max: number[]): Float32Array => {`)
lines.push(`  const raw = typeof atob === 'function'`)
lines.push(`    ? Uint8Array.from(atob(b64), c => c.charCodeAt(0))`)
lines.push(`    : Uint8Array.from(Buffer.from(b64, 'base64'))`)
lines.push(`  const q = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2)`)
lines.push(`  const out = new Float32Array(q.length)`)
lines.push(`  for (let i = 0; i < q.length; i += stride) {`)
lines.push(`    for (let k = 0; k < stride; k++) out[i + k] = min[k] + ((q[i + k] + 32768) / 65535) * (max[k] - min[k])`)
lines.push(`  }`)
lines.push(`  return out`)
lines.push(`}`)
lines.push(``)

for (const p of parts) {
  const qp = quantise(p.pos, 3)
  const qu = p.uv ? quantise(p.uv, 2) : null
  const f = fn(p.name)
  lines.push(`const ${f}_P = '${qp.b64}'`)
  if (qu) lines.push(`const ${f}_U = '${qu.b64}'`)
  lines.push(`/** \`${p.name}\` — ${p.pos.length / 9} triangles. Base at the model's own origin, blocks as units. */`)
  lines.push(`export const ${f} = (): THREE.BufferGeometry => {`)
  lines.push(`  const g = new THREE.BufferGeometry()`)
  lines.push(`  g.setAttribute('position', new THREE.Float32BufferAttribute(`)
  lines.push(`    decode(${f}_P, 3, [${qp.min.map(v => v.toFixed(6)).join(', ')}], [${qp.max.map(v => v.toFixed(6)).join(', ')}]), 3))`)
  if (qu) {
    lines.push(`  g.setAttribute('uv', new THREE.Float32BufferAttribute(`)
    lines.push(`    decode(${f}_U, 2, [${qu.min.map(v => v.toFixed(6)).join(', ')}], [${qu.max.map(v => v.toFixed(6)).join(', ')}]), 2))`)
  }
  lines.push(`  g.computeVertexNormals()`)
  lines.push(`  return g`)
  lines.push(`}`)
  lines.push(``)
}

// The whole model's box, so a consumer can normalise the sculpt onto the card's footprint without
// restating a dimension. Measured over EVERY part together — fitting parts separately is the
// mushroom bug (`mesh-icon.ts`): it rebuilds the object at the wrong proportions.
const all = parts.flatMap((p: Part) => Array.from(p.pos))
const bx = [0, 1, 2].map(k => {
  let lo = Infinity, hi = -Infinity
  for (let i = k; i < all.length; i += 3) { if (all[i] < lo) lo = all[i]; if (all[i] > hi) hi = all[i] }
  return [lo, hi]
})
lines.push(`/** The model's own box across every part, measured at bake. Normalise through this. */`)
lines.push(`export const ${stem}Box = {`)
lines.push(`  min: [${bx.map(b => b[0].toFixed(5)).join(', ')}] as const,`)
lines.push(`  max: [${bx.map(b => b[1].toFixed(5)).join(', ')}] as const,`)
lines.push(`}`)
lines.push(``)

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, lines.join('\n'))
console.log(`baked ${parts.map((p: Part) => `${p.name} (${p.pos.length / 9} tris)`).join(' + ')} -> ${outPath}`)
console.log(`  box x ${bx[0].map(v => v.toFixed(3)).join('..')}  y ${bx[1].map(v => v.toFixed(3)).join('..')}  z ${bx[2].map(v => v.toFixed(3)).join('..')}`)
