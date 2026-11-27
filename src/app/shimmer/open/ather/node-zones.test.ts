// BETA M86 (World Builder p4): NODE ZONES. node-zones.ts (the layer + brush), wilds.ts (the population reads it), builder.ts (the
// draft / publish carries it). Run: npx tsx src/app/shimmer/open/ather/node-zones.test.ts
import { readFileSync, existsSync } from 'fs'
import { createHash } from 'crypto'
import { parseWilds, BIOME, type WildsMeta, type Wilds } from './wilds'
import { treeFor, isPruned, type Zone } from './forestry'
import { crystalFor, isMined, regrowIn, mineCommit, _resetProspecting } from './prospecting'
import { cleanNodeZones, paintNodeZones, foldNodeZones, zoneCode, zoneOf, nzCell, nzKey, NZ_CELL, NZ_NONE, FOREST_PER_CELL, CRYSTAL_PER_CELL, slotLive, type NodeZones } from './node-zones'
import { cleanLayer, sameLayer, layerSize, planPublish, emptyIndex, EMPTY_LAYER } from '../../world/builder'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const D = 'public/open/wilds/'
type T = { name: string; tx: number; ty: number; nodes: { i: number; j: number; zone?: Zone }[] }
const index = JSON.parse(readFileSync(D + 'tiles.json', 'utf8')) as { tiles: T[] }
const tiles = index.tiles.filter(t => existsSync(D + t.name + '.bin'))
const files = new Map<string, { meta: WildsMeta; dm: Int16Array; bio: Uint8Array; zoneAt: (i: number, j: number) => Zone }>()
const load = (t: T) => {
  let f = files.get(t.name)
  if (!f) {
    const meta = JSON.parse(readFileSync(D + t.name + '.json', 'utf8')) as WildsMeta
    const b = readFileSync(D + t.name + '.bin'), bio = readFileSync(D + t.name + '.biome')
    const zm = new Map(t.nodes.map(n => [`${n.i},${n.j}`, n.zone ?? 'meadows']))
    f = { meta, dm: new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), bio: new Uint8Array(bio), zoneAt: (i, j) => (zm.get(`${i},${j}`) ?? 'meadows') as Zone }
    files.set(t.name, f)
  }
  return f
}
const parse = (t: T, nz?: NodeZones | null): Wilds => { const f = load(t); return parseWilds(f.meta, f.dm, f.bio, f.zoneAt, undefined, true, null, null, null, null, null, nz) }

// ── 1. NO ZONES = TODAY'S WORLD EXACTLY ─────────────────────────────────────────────────────────────────────────
// The digest of every tile's trees + crystals (ids, spots, kinds, sizes) as HEAD built them before M86 (7736af58, 2026-11-27, 67 tiles,
// 80413 trees, 10352 crystals). ⚠ It moves only if someone retunes forestry / prospecting / relief: then re-take it from that
// commit WITHOUT any zone code involved, never from this file's own output.
const GOLDEN = '576697f3de794b8dabeb2c297a490ddaec3faf9acbbbd944b4b3f2fa4f5e9df5'
for (const nz of [undefined, {}] as (NodeZones | null | undefined)[]) {
  const h = createHash('sha256'); let nt = 0, nc = 0
  for (const t of tiles) { const W = parse(t, nz); h.update(JSON.stringify([W.trees, W.crystals])); nt += W.trees.length; nc += W.crystals.length }
  ok(h.digest('hex') === GOLDEN && nt === 80413 && nc === 10352, `no zones (${JSON.stringify(nz)}): ${nt} trees ${nc} crystals, digest moved off HEAD's`)
}

// ── 2. the layer: clean / paint / fold ─────────────────────────────────────────────────────────────────────────
ok(JSON.stringify(cleanNodeZones({ nodes: { '1_2': 1, '-3_4': 13, '5_5': 24, x: 1, '6_6': 2, '7_7': 15, '8_8': 20, '9_9': '1', '10_10': 11.5 } })) === JSON.stringify({ '1_2': 1, '-3_4': 13, '5_5': 24 }), 'cleanNodeZones keeps junk')
ok(JSON.stringify(cleanNodeZones(null)) === '{}' && JSON.stringify(cleanNodeZones({ nodes: [1] })) === '{}', 'cleanNodeZones on junk')
ok(zoneCode('none') === NZ_NONE && zoneCode('forest', 3) === 13 && zoneCode('crystal', 9) === 24 && zoneCode('crystal', 0) === 21, 'zoneCode')
ok(zoneOf(13)?.type === 'forest' && zoneOf(13)?.perCell === FOREST_PER_CELL[2] && zoneOf(22)?.perCell === CRYSTAL_PER_CELL[1] && zoneOf(1)?.type === 'none' && zoneOf(5) === null && zoneOf(undefined) === null, 'zoneOf')
{ const d = paintNodeZones(100, 100, 12, 13), ks = Object.keys(d)
  ok(ks.length > 4 && ks.every(k => d[k] === 13), 'paint sets the code')
  ok(ks.every(k => { const [i, j] = k.split('_').map(Number); return Math.hypot((i + 0.5) * NZ_CELL - 100, (j + 0.5) * NZ_CELL - 100) <= 12 }), 'paint stays in its disc')
  const m = foldNodeZones({}, d), e = foldNodeZones(m, paintNodeZones(100, 100, 12, null))
  ok(Object.keys(m).length === ks.length && Object.keys(e).length === 0, 'erase (null -> 0) folds the cells away') }
// slots: a thicker paint keeps every slot of a thinner one
{ let bad = 0; for (let r = 0; r < 1; r += 0.013) for (let k = 0; k < 3; k++) for (let a = 0; a < 4; a++) for (let b = a; b < 4; b++) if (slotLive(k, FOREST_PER_CELL[a], r) && !slotLive(k, FOREST_PER_CELL[b], r)) bad++
  ok(bad === 0, `thicker paint lost ${bad} slots of a thinner one`) }

// ── 3. NO-NODE path across a treed tile ───────────────────────────────────────────────────────────────────────
const cellOfNode = (t: T, x: number, z: number) => nzKey(nzCell(x + t.tx * 1000), nzCell(z + t.ty * 1000))
const base = new Map<string, Wilds>()
const baseOf = (t: T) => { let W = base.get(t.name); if (!W) { W = parse(t); base.set(t.name, W) } return W }
const treed = [...tiles].sort((a, b) => baseOf(b).trees.length - baseOf(a).trees.length)[0]
const rocky = [...tiles].sort((a, b) => baseOf(b).crystals.length - baseOf(a).crystals.length)[0]
const sig = (n: object) => JSON.stringify(n)
{
  const t = treed, W0 = baseOf(t), ox = t.tx * 1000, oz = t.ty * 1000
  let Z: NodeZones = {}
  for (let x = -480; x <= 480; x += 4) Z = foldNodeZones(Z, paintNodeZones(ox + x, oz + 20, 10, NZ_NONE))   // a 20 m path, west to east
  const W = parse(t, Z), inZ = (x: number, z: number) => Z[cellOfNode(t, x, z)] === NZ_NONE
  const gone = W0.trees.filter(n => inZ(n.x, n.z)), ids = new Set(W.trees.map(n => n.id))
  ok(gone.length > 30, `the path crossed only ${gone.length} trees on ${t.name} (pick a busier path)`)
  ok(gone.every(n => !ids.has(n.id)), 'a tree on the no-node path still stands')
  ok(W.trees.every(n => !inZ(n.x, n.z)) && W.crystals.every(n => !inZ(n.x, n.z)), 'a node stands inside the no-node path')
  const after = new Map([...W.trees, ...W.crystals].map(n => [n.id, sig(n)]))
  const outside = [...W0.trees, ...W0.crystals].filter(n => !inZ(n.x, n.z))
  ok(outside.every(n => after.get(n.id) === sig(n)), 'a node OUTSIDE the path moved, changed or lost its id')
  ok(after.size === outside.length, `no-node added ${after.size - outside.length} nodes`)
  ok(W.trees.length === W0.trees.length - gone.length, 'tree count off')
  // the walker: no trunk box stands on the path any more
  ok(gone.every(n => !W.shape.solids(n.x - 0.2, -1e3, n.z - 0.2, n.x + 0.2, 1e3, n.z + 0.2).some(b => b.x0 <= n.x && b.x1 >= n.x && b.z0 <= n.z && b.z1 >= n.z && b.y1 < 300)), 'a removed tree still bumps the walker')
}

// ── 4. DENSE patches: new ids, set density, the zone's kind mix ───────────────────────────────────────────────────
function dense(t: T, type: 'forest' | 'crystal', d: number, cx: number, cz: number, r: number) {
  const ox = t.tx * 1000, oz = t.ty * 1000, code = zoneCode(type, d)
  const Z = foldNodeZones({}, paintNodeZones(ox + cx, oz + cz, r, code))
  return { Z, W: parse(t, Z), cells: Object.keys(Z).length }
}
for (const [t, type] of [[treed, 'forest'], [rocky, 'crystal'], [treed, 'crystal']] as [T, 'forest' | 'crystal'][]) {
  const W0 = baseOf(t), f = load(t)
  // a dry, gentle patch: the centre of the tile's land (the biggest run of non-water cells near the middle)
  let best = { x: 0, z: 0, n: -1 }
  for (let z = -300; z <= 300; z += 100) for (let x = -300; x <= 300; x += 100) {
    let n = 0; for (let a = -40; a <= 40; a += 8) for (let b = -40; b <= 40; b += 8) { const X = x + a, Y = z + b; if (W0.biomeAt(X, Y) !== BIOME.water && W0.heightAt(X, Y) > f.meta.waterY + 2 && Math.hypot(W0.heightAt(X + 1, Y) - W0.heightAt(X - 1, Y), W0.heightAt(X, Y + 1) - W0.heightAt(X, Y - 1)) / 2 < 0.5) n++ }
    if (n > best.n) best = { x, z, n }
  }
  const { Z, W, cells } = dense(t, type, 3, best.x, best.z, 40)
  const list = type === 'forest' ? W.trees : W.crystals, re = type === 'forest' ? /:zt-?\d+_-?\d+_[0-2]$/ : /:zc-?\d+_-?\d+_[0-2]$/
  const old = new Set([...W0.trees, ...W0.crystals].map(n => n.id))
  const added = list.filter(n => !old.has(n.id))
  ok(added.every(n => re.test(n.id) && n.id.startsWith(t.name + ':')), `${t.name} ${type}: new ids not in their own namespace (${added.slice(0, 2).map(n => n.id)})`)
  ok(added.every(n => zoneOf(Z[cellOfNode(t, n.x, n.z)])?.type === type), `${t.name} ${type}: a dense node outside its patch`)
  const zoneAt = (x: number, z: number) => f.zoneAt(Math.min(4, Math.max(0, Math.floor((x + 500) / 200))), Math.min(4, Math.max(0, Math.floor((z + 500) / 200))))
  const mix = (z: Zone) => { const s = new Set<string>(); for (let r = 0; r < 1; r += 0.002) { const k = type === 'forest' ? treeFor(z, BIOME.woods, 1, r)?.kind : crystalFor(z, BIOME.rock, r)?.kind; if (k) s.add(k) } return s }
  // the patch's cells whose zone grows this kind at all (the Thicket is stoneless, the Scald treeless: as today)
  const grows = Object.keys(Z).filter(k => { const [i, j] = k.split('_').map(Number); return mix(zoneAt((i + 0.5) * NZ_CELL - t.tx * 1000, (j + 0.5) * NZ_CELL - t.ty * 1000)).size > 0 }).length
  const want = grows * (type === 'forest' ? FOREST_PER_CELL : CRYSTAL_PER_CELL)[2]
  ok(cells > 0 && (want === 0 || added.length > 0), `${t.name} ${type}: empty patch or nothing added`)
  ok(added.length >= want * 0.55 && added.length <= want * 1.25, `${t.name} ${type}: ${added.length} new nodes for ~${want} (density)`)
  // kinds: the zone's own mix (forestry treeFor on woods / prospecting crystalFor on rock), nothing else
  ok(added.every(n => mix(zoneAt(n.x, n.z)).has((n as { kind: string }).kind)), `${t.name} ${type}: a kind outside the zone's mix`)
  // every old node still stands, unchanged (dense ADDS); the ids are unique
  const after = new Map([...W.trees, ...W.crystals].map(n => [n.id, sig(n)]))
  ok([...W0.trees, ...W0.crystals].every(n => after.get(n.id) === sig(n)), `${t.name} ${type}: dense moved or dropped an old node`)
  ok(after.size === W.trees.length + W.crystals.length, `${t.name} ${type}: duplicate ids`)
  // deterministic, and a thinner paint is a subset of the thicker one
  ok(sig(parse(t, Z).trees) === sig(W.trees) && sig(parse(t, Z).crystals) === sig(W.crystals), `${t.name} ${type}: not deterministic`)
  const thin = dense(t, type, 1, best.x, best.z, 40), thinAdded = (type === 'forest' ? thin.W.trees : thin.W.crystals).filter(n => !old.has(n.id))
  ok(thinAdded.length < added.length && thinAdded.every(n => after.get(n.id) === sig(n)), `${t.name} ${type}: thickness 1 not a subset of 3 (${thinAdded.length} vs ${added.length})`)
  // a dense tree is a trunk the walker bumps
  if (type === 'forest') ok(added.every(n => W.shape.solids(n.x - 0.1, -1e3, n.z - 0.1, n.x + 0.1, 1e3, n.z + 0.1).some(b => b.x0 <= n.x && b.x1 >= n.x && b.y1 < 300)), 'a dense tree has no trunk box')
}
// a forest repainted as a crystal bed never reuses a tree id for a crystal
{ const a = dense(treed, 'forest', 4, 0, 0, 30), b = dense(treed, 'crystal', 4, 0, 0, 30)
  const tids = new Set(a.W.trees.map(n => n.id)); ok(!b.W.crystals.some(n => tids.has(n.id)), 'a crystal took a tree id') }

// ── 5. save / publish round trip (builder.ts) ─────────────────────────────────────────────────────────────────
{
  const nodes = foldNodeZones(foldNodeZones({}, paintNodeZones(10, 10, 16, NZ_NONE)), paintNodeZones(200, 40, 20, zoneCode('crystal', 2)))
  const draft = cleanLayer(JSON.parse(JSON.stringify({ v: 1, tiles: {}, water: {}, falls: {}, nodes: { ...nodes, junk: 1, '3_3': 99 } })))
  ok(JSON.stringify(draft.nodes) === JSON.stringify(nodes), 'cleanLayer did not keep the node zones (or kept junk)')
  ok(cleanLayer({ v: 1, tiles: {}, water: {}, falls: {} }).nodes === undefined && cleanLayer({ nodes: {} }).nodes === undefined, 'an empty layer grew a nodes key (the old file shape must stay byte-identical)')
  ok(layerSize(draft).nodes === Object.keys(nodes).length && layerSize(EMPTY_LAYER).nodes === undefined, 'layerSize nodes')
  ok(!sameLayer(draft, EMPTY_LAYER) && sameLayer(draft, cleanLayer(JSON.parse(JSON.stringify(draft)))) && sameLayer(EMPTY_LAYER, cleanLayer(JSON.parse(JSON.stringify(EMPTY_LAYER)))), 'sameLayer does not see node zones')
  const plan = planPublish(emptyIndex('wilds'), draft, EMPTY_LAYER, '2026-11-27T00:00:00Z', 'm86')
  const live = plan.writes.find(w => w.kind === 'live')
  ok(!!live && live.kind === 'live' && JSON.stringify(cleanNodeZones(JSON.parse(JSON.stringify(live.layer)))) === JSON.stringify(nodes), 'publish did not carry the node zones to live')
}

// ── 6. a removed node's saved work loads harmlessly ───────────────────────────────────────────────────────────
{
  _resetProspecting()
  const t = rocky, W0 = baseOf(t), c = W0.crystals[0], now = Date.now()
  mineCommit(c.kind, c.id, now)
  ok(isMined(c.id, now + 1), 'setup: the crystal did not save as mined')
  const Z = foldNodeZones({}, paintNodeZones(c.x + t.tx * 1000, c.z + t.ty * 1000, 6, NZ_NONE))
  let threw = false, W: Wilds | null = null
  try { W = parse(t, Z); for (const n of W.crystals) regrowIn(n.id, now + 1); for (const n of W.trees) isPruned(n.id, now + 1) } catch { threw = true }
  ok(!threw && !!W && !W.crystals.some(n => n.id === c.id), 'a removed node crashed the load or still stands')
  ok(isMined(c.id, now + 1), 'the saved record of a removed node was lost (it must lie unused, not vanish)')
  // the zone erased: the node is back with its record still spent (no double pay)
  const back = parse(t, foldNodeZones(Z, paintNodeZones(c.x + t.tx * 1000, c.z + t.ty * 1000, 6, null)))
  ok(back.crystals.some(n => n.id === c.id && sig(n) === sig(c)) && isMined(c.id, now + 1), 'an erased zone did not bring the node back spent')
  _resetProspecting()
}

console.log(`node-zones: ${pass} pass, ${fails.length} fail${fails.length ? '\n  ' + fails.join('\n  ') : ''}  (treed ${treed.name}, rocky ${rocky.name})`)
process.exit(fails.length ? 1 : 0)
