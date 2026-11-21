// npx tsx src/app/shimmer/open/ather/network.test.ts — the season's network, against the baked file and real tiles
import { readFileSync } from 'node:fs'
import { parseWilds, BIOME } from './wilds'
import { clearing, settlementAt, nearFair, fairDoor, pathDistance, pathsIn, SETTLEMENT_GATHERS, type Network } from './network'
import { OPEN_ITEMS } from '../shared/inventory'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  ✗', m) } }
const D = 'public/open/wilds'
const net = JSON.parse(readFileSync(`${D}/network-s1.json`, 'utf8')) as Network
const tile = (name: string, clear?: (x: number, z: number) => boolean) => {
  const meta = JSON.parse(readFileSync(`${D}/${name}.json`, 'utf8'))
  return parseWilds(meta, new Int16Array(new Uint8Array(readFileSync(`${D}/${name}.bin`)).buffer), new Uint8Array(readFileSync(`${D}/${name}.biome`)), undefined, clear)
}
ok(net.settlements.length >= 8 && net.paths.length >= net.settlements.length && !!net.fair, `network: ${net.settlements.length} settlements, ${net.paths.length} paths, fair ${!!net.fair}`)
// every settlement and Greg's stone is on a path end
const ends = new Set(net.paths.flatMap(p => [p.a, p.b]))
ok(ends.has('greg') && net.settlements.every(s => ends.has(s.id)), 'network: a settlement (or Greg) no path reaches')
// clearing: no tree on a path, ids kept, crystals unmoved
const clear = clearing(net)
const name = 'w0_1', before = tile(name), after = tile(name, clear)
ok(after.trees.length < before.trees.length, `clearing: no tree was cleared on ${name} (${before.trees.length} → ${after.trees.length})`)
const byId = new Map(before.trees.map(t => [t.id, t]))
ok(after.trees.every(t => { const b = byId.get(t.id); return !!b && b.x === t.x && b.z === t.z }), 'clearing: a kept tree changed its id (a saved prune would find the wrong tree)')
// crystals: every one that stays keeps its id and its spot (a saved fracture finds the right node). Since 938eaa8b an OUTCROP
// crystal (id 'o<i>_<j>') needs its outcrop standing, and a path flattens the outcrops it crosses, so those few may go; no rock-cell
// crystal ever does.
const cById = new Map(before.crystals.map(c => [c.id, c])), afterIds = new Set(after.crystals.map(c => c.id))
ok(after.crystals.every(c => { const b = cById.get(c.id); return !!b && b.x === c.x && b.z === c.z }), 'clearing: a kept crystal moved or changed its id')
const gone = before.crystals.filter(c => !afterIds.has(c.id))
ok(gone.every(c => /:o-?\d+_-?\d+$/.test(c.id) && pathDistance(net, c.x + 0, c.z + 1000) < 30), `clearing: only outcrop crystals beside a path may go (${gone.length} gone: ${gone.map(c => c.id).slice(0, 3).join(' ')})`)
const off = { x: 0, z: 1000 }
ok(after.trees.every(t => pathDistance(net, t.x + off.x, t.z + off.z) > 2.5), 'clearing: a tree still stands on the path')
// paths cross dry ground (sampled on the loaded tile)
const pieces = pathsIn(net, -500, 500, 500, 1500, 4)
let wet = 0, n = 0
for (const L of pieces) for (const [x, z] of L) { n++; if (after.biomeAt(x - off.x, z - off.z) === BIOME.water) wet++ }
ok(n > 50 && wet / n < 0.02, `paths: ${wet}/${n} path points on ${name} are in water`)
// lookups
const s0 = net.settlements[0]
ok(settlementAt(net, s0.x + 10, s0.z)?.id === s0.id && settlementAt(net, s0.x + 200, s0.z) === null, 'settlementAt: wrong')
const d = fairDoor(net.fair!)
ok(nearFair(net, net.fair!.x, net.fair!.z) && pathDistance(net, d.x, d.z) < 40, `fair: its door is ${pathDistance(net, d.x, d.z).toFixed(0)} m from a path`)
// Alex 11-17: every biome has at least one settlement, and each biome's trade names real items
for (const b of ['shore', 'meadow', 'woods', 'rock'] as const) {
  ok(net.settlements.some(s => s.biome === b), `no ${b} settlement in the baked network`)
  ok(SETTLEMENT_GATHERS[b].length > 0 && SETTLEMENT_GATHERS[b].every(id => !!OPEN_ITEMS[id]), `${b} gathers an unknown item`)
}
console.log(`network: ${pass}/${fail}`); process.exit(fail ? 1 : 0)
