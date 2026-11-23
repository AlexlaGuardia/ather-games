// Run: npx tsx src/app/shimmer/dev/editors/builder-pois.test.ts
// BETA M105: the builder overlay reads the game's own data. On the REAL season-1 network, tile index (voids) and continent export:
// every settlement / the fair / the arrival / every crossing / every place is a marker at exactly the source's position, every
// path / edge / ferry is a line, the Glade's markers are the Glade modules' own spots; a map with no data shows none of it.
import { readFileSync } from 'node:fs'
import { wildsOverlay, gladeOverlay, nyxOverlay, poisIn, roadsIn, resample } from './builder-pois'
import { withGlade, FAIR_NAME, type Network } from '../../open/ather/network'
import { makeVoids, type IndexLike } from '../../open/ather/wilds-voids'
import { GREG_WAYMARK } from '../../open/ather/waymarks'
import { MOONWELL } from '../../open/ather/moonwell'
import { GLADE_GATE, GLADE_FRAME } from '../../open/ather/glade-cluster'
import { lotAt } from '../../open/ather/moonwell-glade'
import type { RegionMeta } from '../../open/region'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: { x: number; z: number } | undefined, x: number, z: number) => !!a && Math.abs(a.x - x) < 1e-9 && Math.abs(a.z - z) < 1e-9

// 1. the Wilds
const index = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as IndexLike
const net = withGlade(JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network)
const V = makeVoids(index, net)
const W = wildsOverlay(net, V.crossings)
const sets = W.pois.filter(p => p.kind === 'settlement')
ok(sets.length === net.settlements.length && net.settlements.length > 3, `a marker per settlement (${sets.length}/${net.settlements.length})`)
for (const s of net.settlements) ok(near(sets.find(p => p.name === s.name), s.x, s.z), `settlement ${s.name} at its network spot`)
const fair = W.pois.find(p => p.kind === 'fair')
ok(!!net.fair && near(fair, net.fair.x, net.fair.z) && fair!.name === FAIR_NAME, 'the fair at its pitch, by its name')
ok(near(W.pois.find(p => p.kind === 'arrival'), GREG_WAYMARK.x, GREG_WAYMARK.z), "the arrival = Greg's waymark (first-wilds local = world)")
const cr = W.pois.filter(p => p.kind === 'neck' || p.kind === 'crossing')
ok(cr.length === V.crossings.length && cr.length > 0, `a marker per crossing (${cr.length}/${V.crossings.length})`)
ok(V.crossings.every((c, k) => near(cr[k], c.x, c.z) && cr[k].kind === (c.kind === 'neck' ? 'neck' : 'crossing')), 'crossings at the void field\'s spots, necks named as necks')
ok(W.roads.length === net.paths.length && W.roads.every((r, k) => r.pts.length === net.paths[k].pts.length && r.pts[0][0] === net.paths[k].pts[0][0] && r.pts[0][1] === net.paths[k].pts[0][1]), 'a line per path, the path\'s own points')
// no network baked: no settlements, fair, paths
const W0 = wildsOverlay(null, null)
ok(W0.roads.length === 0 && W0.pois.every(p => p.kind === 'arrival'), 'no network = no settlements, fair or paths (the arrival is a constant)')
// clipping: the first-wilds tile (0,0) holds the arrival
ok(poisIn(W, -500, -500, 500, 500).some(p => p.kind === 'arrival'), 'first-wilds holds the arrival')
ok(roadsIn(W, -1e6, -1e6, 1e6, 1e6).length === W.roads.length, 'roadsIn over everything = every road')

// 2. the Glade
const G = gladeOverlay()
ok(near(G.pois.find(p => p.kind === 'moonwell'), MOONWELL.x, MOONWELL.z), 'the Moonwell at moonwell.ts MOONWELL')
ok(near(G.pois.find(p => p.kind === 'gate'), GLADE_GATE.x, GLADE_GATE.z), 'the gate at plot.ts GATE')
ok(G.pois.filter(p => p.kind === 'garden').length === 4, 'four gardens')
const fen = lotAt('fennel')!; ok(near(G.pois.find(p => p.name === "fennel's lot"), fen.x, fen.z), "fennel's lot at lotAt")
ok(G.roads.length === GLADE_FRAME.paths.length && G.roads.length > 0, `the cluster's paths (${G.roads.length})`)
ok(G.pois.every(p => Number.isFinite(p.x) && Number.isFinite(p.z)), 'every Glade marker is a real spot')

// 3. the Nyx continent
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const N = nyxOverlay(meta)
ok(N.pois.length === meta.places.length, `a marker per place (${N.pois.length})`)
const ver = meta.places.find(p => p.id === 'veradyn')!
ok(near(N.pois.find(p => p.name === 'Veradyn'), ver.x, ver.z) && N.pois.find(p => p.name === 'Veradyn')!.kind === 'stop', 'Veradyn (a city) is a stop at its place')
ok(N.pois.some(p => p.name === 'Rune Hold' && p.kind === 'stop') || !meta.places.some(p => p.id === 'rune-hold'), 'Rune Hold is a stop')
const edges = meta.network?.edges ?? meta.roads
ok(N.roads.filter(r => r.kind !== 'ferry').length === edges.length, 'a line per drivable edge')
const e0 = edges[0]; ok(N.roads[0].pts[0][0] === e0.pts[0][0] && N.roads[0].pts[0][1] === e0.pts[0][1], 'a road point is [x, z] of the export\'s [x, z, y]')
ok(N.roads.filter(r => r.kind === 'ferry').length === (meta.network?.ferries?.length ?? 0), 'a line per ferry')
// the region's height grid holds the roads: every road point inside the region
const hx = meta.sizeX / 2, hz = meta.sizeZ / 2
ok(N.roads.every(r => r.pts.every(([x, z]) => Math.abs(x) <= hx && Math.abs(z) <= hz)), 'every road point inside the region (frame check)')
const N2 = nyxOverlay(meta, id => id === 'veradyn' ? [{ name: 'Test door', at: { x: 1, z: 2 } }] : [])
ok(near(N2.pois.find(p => p.kind === 'shop'), 1, 2), 'shop doors come from doors()')

// 4. resample keeps the ends and the step
const R = resample([[0, 0], [10, 0]], 3)
ok(R.length === 5 && R[4][0] === 10 && R[0][0] === 0, `resample (${R.length})`)

console.log(`builder-pois: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
