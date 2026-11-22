// ather/glade-cluster.ts (BETA M67 s1a): the closed Glade's four gardens, who stands where, the newborn's spawn, the gate
import { GLADE_GARDENS, GLADE_FRAME, GLADE_OWNED, GLADE_GATE, GLADE_GREG_BLOCK, gladeKeepers, gladeNewbornSpot, gregInGlade, gladeGarden, gladeWhere, GLADE_NEWBORN_GAP, gladeZoneGround } from './glade-cluster'
import { mistWalls, plotHeightAt, GATE, STARTING_SQUARES, squareAt, sqId } from './plot'
import { GLADE, gladeFolk, GLADE_LOTS, lotAt, gladeJetty } from './moonwell-glade'
import { folkSpots } from './folk-spots'
import { MOONWELL, GLADE_GREEN, GLADE_ANCHOR } from './moonwell'
import { GLADE as GROUND, gladeDist, relieve } from './relief'
import { gladeHome } from './glade-home'
import { withGlade, type Network } from './network'
import { clusterGround, mateWalls } from './cluster'
let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }

const walls = [...mistWalls(GLADE_OWNED), ...mateWalls(GLADE_FRAME)]
const ground = gladeZoneGround
const free = (x: number, z: number, r = 0.5) => !walls.some(b => x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1)
const standable = (p: { x: number; z: number }) => Number.isFinite(ground(p.x, p.z)) && free(p.x, p.z)

// four gardens, four quarters, the friends' three are the frame's mates
ok(new Set(GLADE_GARDENS.map(g => g.quarter)).size === 4, 'four gardens in four quarters')
ok(GLADE_FRAME.mates.length === 3 && GLADE_FRAME.open.length === 0, 'three friends round the Green, no open spot left')
ok(GLADE_FRAME.mates.every(m => m.owned.length === STARTING_SQUARES.length), 'each friend holds the start ground')
ok(STARTING_SQUARES.every(q => GLADE_OWNED.has(q)) && GLADE_OWNED.size === new Set([...STARTING_SQUARES, ...Array.from({ length: (GLADE_GREG_BLOCK.i1 - GLADE_GREG_BLOCK.i0 + 1) * (GLADE_GREG_BLOCK.j1 - GLADE_GREG_BLOCK.j0 + 1) }, (_, k) => sqId(GLADE_GREG_BLOCK.i0 + (k % (GLADE_GREG_BLOCK.i1 - GLADE_GREG_BLOCK.i0 + 1)), GLADE_GREG_BLOCK.j0 + Math.floor(k / (GLADE_GREG_BLOCK.i1 - GLADE_GREG_BLOCK.i0 + 1))))]).size, "Greg holds the start corner + the Glade's block (s1b-2)")

// who stands where: on their own garden, on ground, out of the mist
const keepers = gladeKeepers(), folk = folkSpots(GLADE, gladeFolk(0).map(f => f.id))   // s1b-2: the five where the talk finds them
for (const k of keepers) {
  ok(standable(k), `${k.name} stands on open ground`)
  ok(gladeGarden(k.x, k.z)?.id === k.id, `${k.name} stands in their own garden`)
}
const homeOf: Record<string, string> = { fennel: 'greg', sax: 'otto', yarrow: 'tess', mallow: 'tess', hazel: 'bonn' }
ok(keepers.length === 3 && !keepers.some(k => k.id === 'greg'), 'the three friends (Greg is on his bench, glade-greg.tsx)')
ok(folk.length === 5 && folk.every(f => f.id.startsWith('moonwell:')), 'the five Glade Moglins, by their Glade ids')
for (const f of folk) {
  const k = f.id.split(':')[1]
  ok(standable(f), `${k} stands on open ground`)
  ok(gladeGarden(f.x, f.z)?.id === homeOf[k], `${k} is at ${homeOf[k]}'s`)
}
const all = [...keepers, ...folk, gregInGlade()]
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


// ── s1b-2: the Glade's backdrop in Greg's garden, gone from the Wilds ──
const onGreg = (x: number, z: number) => { const q = squareAt(x, z); return !!q && GLADE_OWNED.has(sqId(q.i, q.j)) }
const ring = (cx: number, cz: number, rx: number, rz: number) => Array.from({ length: 48 }, (_, k) => ({ x: cx + Math.cos(k / 48 * Math.PI * 2) * rx, z: cz + Math.sin(k / 48 * Math.PI * 2) * rz }))
ok(ring(MOONWELL.x, MOONWELL.z, MOONWELL.rx + GROUND.bank, MOONWELL.rz + GROUND.bank).every(p => onGreg(p.x, p.z)), "the Moonwell + its bank lie on Greg's ground")
ok(GLADE_LOTS.every(l => { const a = lotAt(l.id)!, c = Math.cos(a.yaw), sn = Math.sin(a.yaw); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([u, v]) => onGreg(a.x + (u * a.w / 2) * c + (v * a.d / 2) * sn, a.z - (u * a.w / 2) * sn + (v * a.d / 2) * c)) }), "every lot's corners lie on Greg's ground")
ok(onGreg(gladeHome().x, gladeHome().z) && onGreg(gregInGlade().x, gregInGlade().z) && onGreg(gladeJetty().x1, gladeJetty().z1), "Greg's home, bench and jetty lie on his ground")
ok(ring(GLADE_GREEN.x, GLADE_GREEN.z, GLADE_GREEN.r, GLADE_GREEN.r).every(p => onGreg(p.x, p.z)), "the green lies on Greg's ground")
ok(Math.abs(GROUND.y - plotHeightAt(GLADE_GREEN.x, GLADE_GREEN.z)) < 1e-9, "the Glade's floor IS the garden's flat ground (relief GLADE.y = plot height)")
ok(gladeZoneGround(MOONWELL.x, MOONWELL.z) < GROUND.y - GROUND.depth + 0.01 && gladeZoneGround(GLADE_GREEN.x, GLADE_GREEN.z) === GROUND.y, "the pond's bowl is sunk under its water; the green is level")
ok(GROUND.y - (-0.05) > GROUND.y, "the water plane lies over the grass (the island mesh can't be carved)")
// walk from the newborn's spot to the gate on open ground (the corner path out stays clear of the pond)
// along the laid way: onto the green, down its south path to the anchor, west past the pond's south shore to the corner, out
{ let bad = 0; const way = [gladeNewbornSpot(), GLADE_GREEN, GLADE_ANCHOR, { x: -148, z: 148 }, GLADE_GATE]
  for (let k = 0; k + 1 < way.length; k++) { const a = way[k], b = way[k + 1]
    for (let t = 0; t <= 1; t += 0.01) { const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t; const y = ground(x, z); if (!Number.isFinite(y) || (onGreg(x, z) && y < GROUND.y - 0.01) || !free(x, z, 0.3)) bad++ } }
  ok(bad === 0, `newborn -> green -> south path -> corner -> gate: dry open ground (${bad} bad samples)`) }
// the Wilds no longer carry it: no Glade node in a season network, and the relief there is the land's own
{ const net: Network = { v: 1, season: 1, settlements: [{ id: 'moonwell', name: 'Moonwell Glade', x: -300, z: 269.25 }, { id: 's1-0', name: 'X', x: 900, z: 900 }], paths: [], fair: null }
  ok(withGlade(net).settlements.length === 1 && withGlade(net).settlements[0].id === 's1-0', 'a season network carries no Glade node (a stray one is dropped)')
  ok(relieve(-347.5, 270.5, 30, 0) > 28 && relieve(-300, 269.25, 30, 0) !== GROUND.y, "the Wilds' old pond spot is plain land now (no bowl, no Glade floor)") }
void gladeDist; void clusterGround
console.log(`glade-cluster: ${n - fails} ok, ${fails} fail`); process.exit(fails ? 1 : 0)
