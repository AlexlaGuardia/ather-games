// Run: npx tsx src/app/shimmer/open/ather/settlement-lots.test.ts
// M39 slice 3: generated settlements stand one plank house per trade present (max 5) on level pads inside the flat disc.
import { readFileSync } from 'node:fs'
import { settlementLots, tradeBuilding, lotDoorSpot, lotPadOf, builtFolkSpots, LOT_W, LOT_D, TRADES, tradeBlueprintId, setTradeBlueprint, type SettlementLot } from './settlement-lots'
import { SETTLEMENT_CLEAR, type Network } from './network'
import { folkOf } from './settlement-folk'
import { folkSpots } from './folk-spots'
import { GLADE } from './moonwell-glade'
import { placeBlueprint } from './plot-blueprint'
import { WALL_MATS } from './plot-walls'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network
const corners = (l: SettlementLot) => {
  const s = Math.sin(l.yaw), c = Math.cos(l.yaw), r = { x: c, z: -s }, f = { x: -s, z: -c }
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: l.x + r.x * a * l.w / 2 + f.x * b * l.d / 2, z: l.z + r.z * a * l.w / 2 + f.z * b * l.d / 2 }))
}
const inObb = (l: SettlementLot, x: number, z: number, m = 0) => {
  const s = Math.sin(l.yaw), c = Math.cos(l.yaw), dx = x - l.x, dz = z - l.z
  return Math.abs(dx * c - dz * s) < l.w / 2 + m && Math.abs(-dx * s - dz * c) < l.d / 2 + m
}
// separating axis for two pads
const obbOverlap = (a: SettlementLot, b: SettlementLot) => {
  for (const l of [a, b]) for (const ax of [{ x: Math.cos(l.yaw), z: -Math.sin(l.yaw) }, { x: -Math.sin(l.yaw), z: -Math.cos(l.yaw) }]) {
    const pa = corners(a).map(p => p.x * ax.x + p.z * ax.z), pb = corners(b).map(p => p.x * ax.x + p.z * ax.z)
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false
  }
  return true
}
ok(settlementLots(GLADE, 1).length === 0, 'the Glade has no generated lots (its own five)')
let total = 0
for (const s of net.settlements) {
  if (s.id === GLADE.id) continue
  const folk = folkOf(s, net.season), lots = settlementLots(s, net.season)
  const present = new Set(folk.map(f => f.profession))
  ok(lots.length === present.size && lots.length <= 5 && lots.length >= 1, `${s.id}: one lot per trade present (${lots.length} of ${present.size})`)
  ok(new Set(lots.map(l => l.profession)).size === lots.length && lots.every(l => present.has(l.profession) && folk.find(f => f.id === l.folkId)?.profession === l.profession), `${s.id}: lots are distinct trades, each owned by a folk of that trade`)
  total += lots.length
  const flat = lots.every(l => corners(l).every(p => Math.hypot(p.x - s.x, p.z - s.z) <= SETTLEMENT_CLEAR))
  ok(flat, `${s.id}: every pad corner inside the flat disc`)
  ok(lots.every((l, i) => lots.every((m, j) => i === j || !obbOverlap(l, m))), `${s.id}: pads do not overlap`)
  const fan = folkSpots(s, folk.map(f => f.id))
  ok(lots.every(l => fan.every(p => !inObb(l, p.x, p.z, 3))), `${s.id}: no pad over the folk fan`)
  // the burrows: the knoll lies behind the settlement (a 14 m radius covers it and its doors), the well + signpost within 12.5 m
  ok(lots.every(l => corners(l).every(p => Math.hypot(p.x - s.x, p.z - s.z) > 14.5)), `${s.id}: no pad on the burrows`)
  for (const l of lots) {
    const fwd = { x: -Math.sin(l.yaw), z: -Math.cos(l.yaw) }, toC = { x: s.x - l.x, z: s.z - l.z }, n = Math.hypot(toC.x, toC.z)
    ok((fwd.x * toC.x + fwd.z * toC.z) / n > 0.9999, `${l.id}: faces the centre`)
    const bp = tradeBuilding(l.profession), sp = lotDoorSpot(l), place = placeBlueprint(bp, lotPadOf(l, 0))
    ok(!place.boxes.some(b => sp.x > b.x0 && sp.x < b.x1 && sp.z > b.z0 && sp.z < b.z1), `${l.id}: the Moglin's spot is outside every wall`)
    ok(!inObb({ ...l, w: bp.w, d: bp.d }, sp.x, sp.z), `${l.id}: the Moglin stands outside the footprint`)
    ok(inObb(l, sp.x, sp.z, 1.5), `${l.id}: the Moglin is on or beside its pad`)
    const door = place.toWorld(bp.w / 2, 0)
    ok(Math.hypot(sp.x - door.x, sp.z - door.z) < 3.5, `${l.id}: the Moglin is by the front door`)
  }
  ok(JSON.stringify(lots) === JSON.stringify(settlementLots(s, net.season)), `${s.id}: deterministic`)
  const built = builtFolkSpots(s, folk, net.season), fanById = new Map(fan.map(p => [p.id, p]))
  ok(built.length === folk.length && lots.every(l => { const b = built.find(p => p.id === l.folkId)!, o = lotDoorSpot(l); return Math.hypot(b.x - o.x, b.z - o.z) < 1e-9 }), `${s.id}: lot Moglins stand at their doors`)
  ok(built.filter(p => !lots.some(l => l.folkId === p.id)).every(p => { const f = fanById.get(p.id)!; return f.x === p.x && f.z === p.z }), `${s.id}: the others keep their green spots`)
}
ok(total > 11, `lots exist across the season (${total})`)
// the blockout: wood from the keeper's own parts, warm, no metal, a door on the front
for (const p of TRADES) {
  const bp = tradeBuilding(p), mats = new Set(Object.values(bp.walls).map(w => w.mat))
  ok(bp.w <= LOT_W && bp.d <= LOT_D && bp.id === tradeBlueprintId(p), `${p}: the blockout fits the pad`)
  ok([...mats].every(m => m in WALL_MATS && m !== 'shimmeroak'), `${p}: blockout wood is warm, from the keeper's planks`)
  ok(Object.values(bp.walls).some(w => w.kind === 'door') && JSON.stringify(bp).search(/iron|hinge|metal|steel/i) < 0, `${p}: a door, no metal fittings`)
}
// a drawn blueprint that overflows the pad is refused; one that fits replaces the blockout
setTradeBlueprint('cook', { ...tradeBuilding('cook'), w: 20, id: 'trade-cook' }); ok(tradeBuilding('cook').w === 8, 'oversize blueprint refused, blockout stays')
console.log(`settlement-lots: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  x ' + f)
if (fails.length) process.exit(1)
