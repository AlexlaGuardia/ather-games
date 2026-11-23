// Run: npx tsx src/app/shimmer/open/ather/void-erase-grows.test.ts
// BETA M104 (Alex 11-23): ground where the owner ERASES a void in the builder grows trees and nodes like any ground of its biome,
// not a bare crossing. On a REAL tile with a generated void strip: parse it three ways with the same zones, path clearing and
// roads (the game's stream() args): no voids at all, the generated voids, and the generated voids with an erase stroke laid
// along the strip. Inside the erase's core the erased tile must stand EXACTLY the trees and crystals of the void-free tile
// (same ids, same spots), and the generated strip must have been bare there (else the test proves nothing).
import { readFileSync } from 'node:fs'
import { parseWilds, type WildsMeta, type Wilds } from './wilds'
import { makeVoids, type IndexLike } from './wilds-voids'
import { paintVoids, voidOverrides } from './void-edits'
import { withGlade, clearing, roadField, type Network } from './network'
import type { Zone } from './forestry'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const DIR = 'public/open/wilds/'
const index = JSON.parse(readFileSync(DIR + 'tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { i: number; j: number; zone?: string }[] }[] } & IndexLike
const net = withGlade(JSON.parse(readFileSync(DIR + 'network-s1.json', 'utf8')) as Network)
const V0 = makeVoids(index, net), clear = clearing(net), roads = roadField(net)

function parse(name: string, voids: ReturnType<typeof makeVoids> | null): Wilds {
  const t = index.tiles.find(x => x.name === name)!, m = new Map<string, Zone>()
  for (const n of t.nodes) if (n.zone) m.set(`${n.i},${n.j}`, n.zone as Zone)
  const meta = JSON.parse(readFileSync(DIR + name + '.json', 'utf8')) as WildsMeta
  const bin = readFileSync(DIR + name + '.bin')
  const dm = new Int16Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength))
  return parseWilds(meta, dm, new Uint8Array(readFileSync(DIR + name + '.biome')), (i, j) => m.get(`${i},${j}`) ?? 'meadows', clear, true, roads, voids)
}

// a tile whose generated strip is wide and bare: the most void-weight-1 samples away from crossings + protected ground
let best: { name: string; tx: number; ty: number; pts: { x: number; z: number }[] } | null = null
for (const t of index.tiles) {
  const pts: { x: number; z: number }[] = []
  for (let z = -460; z <= 460; z += 20) for (let x = -460; x <= 460; x += 20) {
    const X = t.tx * 1000 + x, Z = t.ty * 1000 + z
    if (V0.weight(X, Z) >= 1 && !V0.crossingNear(X, Z, 60)) pts.push({ x: X, z: Z })
  }
  if (pts.length > (best?.pts.length ?? 0)) best = { name: t.name, tx: t.tx, ty: t.ty, pts }
}
ok(!!best && best.pts.length >= 20, `fixture: a tile with a generated void strip (${best?.name}, ${best?.pts.length} strip samples)`)

if (best) {
  // the erase stroke: every strip sample, radius 40 (the void is 24 m + a 10 m lip each side, so this covers it across)
  const ov: Record<string, number> = {}
  for (const p of best.pts) Object.assign(ov, paintVoids(ov, p.x, p.z, 40, -1))
  const VE = makeVoids(index, net, [], ov)
  const ox = best.tx * 1000, oz = best.ty * 1000
  const Wn = parse(best.name, null), W0 = parse(best.name, V0), We = parse(best.name, VE)
  // the erase's core (full-strength erase cells) where the generated field carved
  const E = voidOverrides(ov)!
  const core = (x: number, z: number) => E.erase(x + ox, z + oz) >= 1 && V0.weight(x + ox, z + oz) > 0
  const key = (t: { id: string; x: number; z: number }) => `${t.id}@${t.x.toFixed(3)},${t.z.toFixed(3)}`
  const inCore = <T extends { id: string; x: number; z: number }>(a: T[]) => a.filter(t => core(t.x, t.z)).map(key).sort()

  const tn = inCore(Wn.trees), t0 = inCore(W0.trees), te = inCore(We.trees)
  const cn = inCore(Wn.crystals), c0 = inCore(W0.crystals), ce = inCore(We.crystals)
  ok(tn.length >= 5, `the void-free tile stands trees on the strip's ground (${tn.length})`)
  ok(t0.length === 0 && c0.length === 0, `the generated strip is bare (${t0.length} trees, ${c0.length} crystals)`)
  ok(JSON.stringify(te) === JSON.stringify(tn), `erased ground stands the SAME trees as land with no void (${te.length} vs ${tn.length})`)
  ok(JSON.stringify(ce) === JSON.stringify(cn), `erased ground stands the SAME crystals as land with no void (${ce.length} vs ${cn.length})`)
  // and away from the strip nothing moved: the erased tile = the generated tile outside the core
  const out = <T extends { id: string; x: number; z: number }>(a: T[]) => a.filter(t => VE.weight(t.x + ox, t.z + oz) === V0.weight(t.x + ox, t.z + oz)).map(key).sort()
  ok(JSON.stringify(out(We.trees)) === JSON.stringify(out(W0.trees)), 'outside the erase the trees are the generated tile\'s')
  // erased ground is not void ground: no voided cell in the core, and its height is the void-free land's
  let voidedInCore = 0, hDiff = 0, n = 0
  const cell = We.meta.cell, nx = We.meta.nx, hx = We.meta.sizeX / 2, hz = We.meta.sizeZ / 2
  for (let j = 0; j < We.meta.nz - 1; j += 2) for (let i = 0; i < nx - 1; i += 2) {
    const x = -hx + (i + 0.5) * cell, z = -hz + (j + 0.5) * cell
    if (!core(x, z)) continue
    n++
    if (We.voided?.[j * (nx - 1) + i]) voidedInCore++
    if (Math.abs(We.heightAt(x, z) - Wn.heightAt(x, z)) > 1e-4) hDiff++
  }
  ok(n > 100 && voidedInCore === 0, `no erased cell is drawn as void (${voidedInCore} of ${n})`)
  ok(hDiff === 0, `erased ground stands at the void-free height (${hDiff} of ${n} differ)`)
}

console.log(`void-erase-grows: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
