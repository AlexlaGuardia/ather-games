// BETA M223 s1 (Alex 11-27; RULED athernyx e3c310e): VENIUM + EURLEEN are the Ather's MANA-GROWN metals, found, not bought. The
// World Builder's Nodes brush gets a SPAWN ZONE per node kind (node-zones.ts NZ_KIND: Venium seam, Eurleen seam, the four gems);
// a painted seam spawns that node in the Wilds (wilds.ts), the Starwillow spike works it (gather-dials METAL_DIAL), it pays the
// bag metal the Smithy's edge takes (edges.ts), and the Ather Trading Co. supplier no longer sells either.
// Run: npx tsx src/app/shimmer/open/ather/m223-seams.test.ts
import { readFileSync, existsSync } from 'fs'
import { parseWilds, BIOME, type WildsMeta, type Wilds } from './wilds'
import type { Zone } from './forestry'
import { minePlan, mine, isMined, crystalDial, crystalFor, CRYSTAL_ITEM, CRYSTAL_NAME, CRYSTAL_KINDS, TIER, METAL_KINDS, METAL_YIELD, BLANKSTONE, _resetProspecting, type CrystalKind } from './prospecting'
import { manaNeed, cycleBudget } from './gather-dials'
import { cleanNodeZones, paintNodeZones, foldNodeZones, zoneCode, zoneOf, isZoneCode, nzCell, nzKey, NZ_KIND, NODE_KIND_ZONES, NODE_ZONE_TYPES, KIND_PER_CELL, NZ_CELL, type NodeZones, type NodeKindZone } from './node-zones'
import { cleanLayer, sameLayer, planPublish, emptyIndex, EMPTY_LAYER } from '../../world/builder'
import { SUPPLIER_KINDS, buyLot } from '../business/suppliers'
import { OPEN_ITEMS, newInv } from '../shared/inventory'
import { NEW_LEDGER } from '../trade'
import { EDGE_METALS } from './edges'
import { NODE_CRYSTALS } from './glade-nodes'
import { TOOL_DEFS } from '../../engine/tools'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. the brush offers a zone per kind; the codes are their own and junk-proof ──────────────────────────────────
ok(['venium', 'eurleen'].every(k => (NODE_ZONE_TYPES as string[]).includes(k)), 'the Nodes brush has no Venium / Eurleen seam')
ok(NODE_KIND_ZONES.every(k => (CRYSTAL_KINDS as string[]).includes(k)), 'a kind zone names no real node kind (wilds.ts places the type as the kind)')
const codes = new Set<number>()
for (const k of NODE_KIND_ZONES) for (const d of [1, 2, 3, 4]) {
  const c = zoneCode(k, d); codes.add(c)
  const z = zoneOf(c)
  ok(isZoneCode(c) && z?.type === k && z.d === d && z.perCell === KIND_PER_CELL[d - 1], `${k} d${d}: code ${c} does not round-trip (${JSON.stringify(z)})`)
}
ok(codes.size === NODE_KIND_ZONES.length * 4 && [...codes].every(c => c > 24), 'kind codes collide with each other or with none / forest / crystal')
ok(![30, 35, 40, 45, 90, 91, 29, 25].some(isZoneCode), 'a junk code near the kind bases passes isZoneCode')
ok(JSON.stringify(cleanNodeZones({ nodes: { '1_1': 31, '2_2': 44, '3_3': 35, '4_4': 30, '5_5': 13 } })) === JSON.stringify({ '1_1': 31, '2_2': 44, '5_5': 13 }), 'cleanNodeZones: kind codes not kept (or junk kept)')
// the editor source: a button per kind, and map colours distinct from the existing three (grey / green / violet)
{ const src = readFileSync(new URL('../../dev/editors/TerrainEditor.tsx', import.meta.url), 'utf8')
  ok(src.includes('NODE_KIND_ZONES.map(t =>') && src.includes('data-testid={`nodes-${t}`}'), 'TerrainEditor: no button per kind zone')
  const rgb = [...src.matchAll(/rgb: '(\d+,\d+,\d+)'/g)].map(m => m[1])
  ok(rgb.length === NODE_KIND_ZONES.length && new Set([...rgb, '20,20,24', '40,200,90', '190,110,255']).size === rgb.length + 3, `TerrainEditor: kind colours not distinct (${rgb})`)
  ok(/venium:\s*\{ label: 'Venium seam'/.test(src) && /eurleen:\s*\{ label: 'Eurleen seam'/.test(src), 'TerrainEditor: the seam labels') }

// ── 2. a painted zone round-trips through the draft and Publish (builder.ts) ─────────────────────────────────────
{
  const nodes = foldNodeZones(foldNodeZones({}, paintNodeZones(120, -40, 10, zoneCode('venium', 3))), paintNodeZones(900, 900, 6, zoneCode('eurleen', 4)))
  ok(Object.values(nodes).some(v => v === 33) && Object.values(nodes).some(v => v === 44), 'setup: the paint did not set both seams')
  const draft = cleanLayer(JSON.parse(JSON.stringify({ v: 1, tiles: {}, water: {}, falls: {}, nodes })))
  ok(JSON.stringify(draft.nodes) === JSON.stringify(nodes), 'draft: cleanLayer dropped a seam cell')
  ok(sameLayer(draft, cleanLayer(JSON.parse(JSON.stringify(draft)))) && !sameLayer(draft, EMPTY_LAYER), 'draft: reload does not read the same layer')
  const plan = planPublish(emptyIndex('wilds'), draft, EMPTY_LAYER, '2026-11-27T00:00:00Z', 'm223')
  const live = plan.writes.find(w => w.kind === 'live')
  ok(!!live && live.kind === 'live' && JSON.stringify(cleanNodeZones(JSON.parse(JSON.stringify(live.layer)))) === JSON.stringify(nodes), 'publish: the seams did not reach the live layer')
}

// ── 3. a seam spawns its node in the Wilds (scratch zones on a real tile) ─────────────────────────────────────────
const D = 'public/open/wilds/'
type T = { name: string; tx: number; ty: number; nodes: { i: number; j: number; zone?: Zone }[] }
const tiles = (JSON.parse(readFileSync(D + 'tiles.json', 'utf8')) as { tiles: T[] }).tiles.filter(t => existsSync(D + t.name + '.bin'))
const files = new Map<string, { meta: WildsMeta; dm: Int16Array; bio: Uint8Array; zoneAt: (i: number, j: number) => Zone }>()
const parse = (t: T, nz?: NodeZones | null): Wilds => {
  let f = files.get(t.name)
  if (!f) {
    const meta = JSON.parse(readFileSync(D + t.name + '.json', 'utf8')) as WildsMeta, b = readFileSync(D + t.name + '.bin')
    const zm = new Map(t.nodes.map(n => [`${n.i},${n.j}`, n.zone ?? 'meadows']))
    f = { meta, dm: new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), bio: new Uint8Array(readFileSync(D + t.name + '.biome')), zoneAt: (i, j) => (zm.get(`${i},${j}`) ?? 'meadows') as Zone }
    files.set(t.name, f)
  }
  return parseWilds(f.meta, f.dm, f.bio, f.zoneAt, undefined, true, null, null, null, null, null, nz)
}
const metal = (W: Wilds) => W.crystals.filter(c => (METAL_KINDS as readonly string[]).includes(c.kind))
let checked = 0
for (const t of tiles) {
  const W0 = parse(t), meta = files.get(t.name)!.meta
  ok(metal(W0).length === 0, `${t.name}: a metal node stands with no seam painted (only the owner's zones place them)`)
  // a dry, gentle 30 m patch near the middle
  let best = { x: 0, z: 0, n: -1 }
  for (let z = -300; z <= 300; z += 100) for (let x = -300; x <= 300; x += 100) {
    let n = 0
    for (let a = -24; a <= 24; a += 8) for (let b = -24; b <= 24; b += 8) { const X = x + a, Y = z + b; if (W0.biomeAt(X, Y) !== BIOME.water && W0.heightAt(X, Y) > meta.waterY + 2) n++ }
    if (n > best.n) best = { x, z, n }
  }
  if (best.n < 40) continue
  checked++
  const ox = t.tx * 1000, oz = t.ty * 1000
  for (const kind of ['venium', 'eurleen'] as NodeKindZone[]) {
    const Z = foldNodeZones({}, paintNodeZones(ox + best.x, oz + best.z, 24, zoneCode(kind, 4)))
    const W = parse(t, Z), old = new Set([...W0.trees, ...W0.crystals].map(n => n.id))
    const added = W.crystals.filter(c => !old.has(c.id)), inZ = (x: number, z: number) => Z[nzKey(nzCell(x + ox), nzCell(z + oz))] === NZ_KIND[kind] + 4
    ok(added.length >= Object.keys(Z).length * 0.5, `${t.name} ${kind}: only ${added.length} nodes in ${Object.keys(Z).length} cells at thickness 4`)
    ok(added.every(c => c.kind === kind), `${t.name} ${kind}: the seam grew another kind (${[...new Set(added.map(c => c.kind))]})`)
    ok(added.every(c => inZ(c.x, c.z)), `${t.name} ${kind}: a seam node outside its zone`)
    ok(added.every(c => new RegExp(`^${t.name}:zk${kind}_-?\\d+_-?\\d+_[01]$`).test(c.id)), `${t.name} ${kind}: ids not in their own namespace (${added[0]?.id})`)
    ok([...W0.trees, ...W0.crystals].every(n => W.trees.some(o => o.id === n.id) || W.crystals.some(o => o.id === n.id)), `${t.name} ${kind}: a seam dropped an old node`)
    ok(JSON.stringify(parse(t, Z).crystals) === JSON.stringify(W.crystals), `${t.name} ${kind}: not deterministic`)
  }
  // a crystal bed never rolls a metal (crystalFor knows none), so only the seam brush makes one
  let rolled = 0; for (const z of ['meadows', 'springs', 'arid', 'caverns', 'trails', 'thicket'] as Zone[]) for (let r = 0; r < 1; r += 0.001) if ((METAL_KINDS as readonly string[]).includes(crystalFor(z, BIOME.rock, r)?.kind ?? '')) rolled++
  ok(rolled === 0, 'crystalFor rolled a metal')
  break
}
ok(checked === 1, 'no tile with a dry patch to paint on')

// ── 4. mining a seam: the top spike tier, the bag metal the Smithy's edge takes ──────────────────────────────────
ok(METAL_KINDS.join() === [...EDGE_METALS].join() && METAL_KINDS.every(k => CRYSTAL_ITEM[k] === k && !!OPEN_ITEMS[k]), 'a seam does not pay the edge metal bag item')
ok(METAL_KINDS.every(k => CRYSTAL_NAME[k] === OPEN_ITEMS[k].name && TIER[k] === 4), 'seam name / grade off')
const starwillow = 4, shimmeroak = 3
for (const k of METAL_KINDS) {
  const d = crystalDial(k)
  ok(d.need === starwillow && manaNeed(d, starwillow) === d.mana && manaNeed(d, shimmeroak) > d.mana * 4 && manaNeed(d, shimmeroak) <= cycleBudget(d), `${k}: not the Starwillow spike's node (need ${d.need}; one rung low must be slow but doable)`)
  ok(manaNeed(d, starwillow - 2) > cycleBudget(d), `${k}: two rungs low is not TOO WEAK`)
  for (const r of [0, 0.4, 0.999]) {
    const p = minePlan(k, () => r), got = p.drops.find(x => x.id === k)?.n ?? 0
    ok(got >= METAL_YIELD[0] && got <= METAL_YIELD[1] && p.drops.some(x => x.id === BLANKSTONE), `${k} roll ${r}: pays ${got} ${k}`)
  }
  ok(minePlan(k, () => 0).drops.find(x => x.id === k)!.n === METAL_YIELD[0] && minePlan(k, () => 0.999).drops.find(x => x.id === k)!.n === METAL_YIELD[1], `${k}: yield range`)
  _resetProspecting()
  const v = mine(k, `wilds:zk${k}_1_1_0`, () => 0.5, 1e12)
  ok(v.ok && v.drops.some(x => x.id === k) && isMined(`wilds:zk${k}_1_1_0`, 1e12 + 1), `${k}: mine() did not pay + spend the node`)
}
ok(!!TOOL_DEFS.starwillow_spike, 'the Starwillow spike does not exist')
_resetProspecting()
// a metal node is never a hand-placed glade node (only a painted seam makes one)
ok(!NODE_CRYSTALS.some(k => (METAL_KINDS as readonly string[]).includes(k as CrystalKind)), 'a metal is a placeable node')

// ── 5. the Co. supplier no longer sells them ─────────────────────────────────────────────────────────────────────
const co = SUPPLIER_KINDS['trade-co']
ok(!co.lots.some(l => l.id === 'venium' || l.id === 'eurleen'), `the Co. panel still lists ${co.lots.map(l => l.id)}`)
for (const k of METAL_KINDS) { const b = buyLot({ ...NEW_LEDGER, marks: 1e6 }, newInv(12), 'trade-co', k); ok(!b.ok, `${k} can still be bought from the Co.`) }

// ── 6. canon: the blurbs say what the glossary says ─────────────────────────────────────────────────────────────
const G = '/root/athernyx/CANON/glossary.md'
if (existsSync(G)) {
  const g = readFileSync(G, 'utf8')
  for (const [k, col] of [['venium', 'purple'], ['eurleen', 'gold']] as const) {
    ok(new RegExp(`\\| \\*\\*${OPEN_ITEMS[k].name}\\*\\* \\|[^|]*A \\*\\*mana-grown metal\\*\\*, ${col}`).test(g), `canon: glossary no longer calls ${k} a mana-grown metal, ${col}`)
    ok(OPEN_ITEMS[k].blurb.startsWith(`A mana-grown metal, ${col}.`) && !/continent|Nyx|Spine|Valkara/.test(OPEN_ITEMS[k].blurb), `${k} blurb drifted from canon (${OPEN_ITEMS[k].blurb})`)
  }
}

console.log(`m223-seams: ${pass} pass, ${fails.length} fail${fails.length ? '\n  ' + fails.join('\n  ') : ''}`)
process.exit(fails.length ? 1 : 0)
