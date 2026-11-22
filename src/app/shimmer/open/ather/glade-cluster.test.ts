// ather/glade-cluster.ts (BETA M67 s1a): the closed Glade's four gardens, who stands where, the newborn's spawn, the gate
import { GLADE_GARDENS, GLADE_FRAME, GLADE_OWNED, GLADE_GATE, gladeKeepers, gladeClusterFolk, gladeNewbornSpot, gregInGlade, gladeGarden, gladeWhere, GLADE_NEWBORN_GAP } from './glade-cluster'
import { mistWalls, plotHeightAt, GATE } from './plot'
import { clusterGround, mateWalls } from './cluster'
let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }

const walls = [...mistWalls(GLADE_OWNED), ...mateWalls(GLADE_FRAME)]
const ground = (x: number, z: number) => Math.max(plotHeightAt(x, z), clusterGround(GLADE_FRAME, x, z))
const free = (x: number, z: number, r = 0.5) => !walls.some(b => x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1)
const standable = (p: { x: number; z: number }) => Number.isFinite(ground(p.x, p.z)) && free(p.x, p.z)

// four gardens, four quarters, the friends' three are the frame's mates
ok(new Set(GLADE_GARDENS.map(g => g.quarter)).size === 4, 'four gardens in four quarters')
ok(GLADE_FRAME.mates.length === 3 && GLADE_FRAME.open.length === 0, 'three friends round the Green, no open spot left')
ok(GLADE_FRAME.mates.every(m => m.owned.length === GLADE_OWNED.size), 'each friend holds the start ground')

// who stands where: on their own garden, on ground, out of the mist
const keepers = gladeKeepers(), folk = gladeClusterFolk()
for (const k of keepers) {
  ok(standable(k), `${k.name} stands on open ground`)
  ok(gladeGarden(k.x, k.z)?.id === k.id, `${k.name} stands in their own garden`)
}
const homeOf: Record<string, string> = { fennel: 'greg', sax: 'otto', yarrow: 'tess', mallow: 'tess', hazel: 'bonn' }
ok(folk.length === 5 && folk.every(f => f.id.startsWith('moonwell:')), 'the five Glade Moglins, by their Glade ids')
for (const f of folk) {
  const k = f.id.split(':')[1]
  ok(standable(f), `${k} stands on open ground`)
  ok(gladeGarden(f.x, f.z)?.id === homeOf[k], `${k} is at ${homeOf[k]}'s`)
}
const all = [...keepers, ...folk]
ok(all.every((p, i) => all.every((q, j) => i === j || Math.hypot(p.x - q.x, p.z - q.z) > 1.5)), 'nobody stands in anybody')

// the newborn: in Greg's garden, GAP m in front of him, facing him
const nb = gladeNewbornSpot(), g = gregInGlade()
ok(standable(nb), 'the newborn spawns on open ground')
ok(gladeGarden(nb.x, nb.z)?.id === 'greg', "the newborn spawns in Greg's garden")
ok(Math.abs(Math.hypot(nb.x - g.x, nb.z - g.z) - GLADE_NEWBORN_GAP) < 1e-6, `the newborn is ${GLADE_NEWBORN_GAP} m from Greg`)
const fwd = { x: -Math.sin(nb.yaw), z: -Math.cos(nb.yaw) }, to = { x: (g.x - nb.x) / GLADE_NEWBORN_GAP, z: (g.z - nb.z) / GLADE_NEWBORN_GAP }
ok(fwd.x * to.x + fwd.z * to.z > 0.999, 'the newborn faces Greg (walker forward)')
const gf = { x: Math.sin(g.yaw), z: Math.cos(g.yaw) }
ok(gf.x * -to.x + gf.z * -to.z > 0.999, 'Greg faces the newborn (figure forward)')

// the gate: the Green's centre, on the Green's ground; and the walk to it from the spawn is ground all the way (sampled
// along Greg's path corner -> the Green: the spawn, the corner, the Green)
ok(GLADE_GATE.x === GATE.x && GLADE_GATE.z === GATE.z, 'the gate is the cluster gate at the Green')
ok(Number.isFinite(ground(GLADE_GATE.x + 3, GLADE_GATE.z + 3)), 'there is ground beside the gate')
ok(gladeWhere(GLADE_GATE.x + 3, GLADE_GATE.z + 3) === 'the Green', 'beside the gate is the Green')
ok(gladeWhere(nb.x, nb.z) === "Greg's garden", "the spawn reads Greg's garden")
const tess = keepers.find(k => k.id === 'tess')!
ok(gladeWhere(tess.x, tess.z) === "Tess's garden", "Tess's reads Tess's garden")
// no exit but the gate: far past the gardens there is no ground (the edge = the fall)
ok(!Number.isFinite(ground(600, -600)) && !Number.isFinite(ground(-900, 900)), 'past the cluster there is nothing to stand on')

console.log(`glade-cluster: ${n - fails} ok, ${fails} fail`); process.exit(fails ? 1 : 0)
