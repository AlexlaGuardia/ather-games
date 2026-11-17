// npx tsx src/app/shimmer/open/ather/network.test.ts — the season's network, against the baked file and real tiles
import { readFileSync } from 'node:fs'
import { parseWilds, BIOME } from './wilds'
import { clearing, settlementAt, nearFair, fairDoor, pathDistance, pathsIn, type Network } from './network'
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
ok(after.crystals.length === before.crystals.length && after.crystals.every((c, k) => c.x === before.crystals[k].x && c.id === before.crystals[k].id), 'clearing: crystals moved')
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
console.log(`network: ${pass}/${fail}`); process.exit(fail ? 1 : 0)
