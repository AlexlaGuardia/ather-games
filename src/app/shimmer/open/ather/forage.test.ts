// BETA M241: wild Moonberry + Firewort forage, and the Moonberry bush in a Planter Box.
// Run: npx tsx src/app/shimmer/open/ather/forage.test.ts
import { readFileSync } from 'node:fs'
import { wildSpots, placedSpots, pickSpot, isPicked, prunePicks, parsePicks, nearestSpot, FORAGE_GIVES, FORAGE_REGROW_MS, FORAGE_KEY, MOONBERRY_PER_SQUARE, FIREWORT_BAND, type IndexTile } from './forage'
import { plantBox, pickBox, ripe, ripeAt, grownAt, carryBox, settleBox, parseBoxes, saplingsOnPlot, takeSapling, BUSH_BERRIES, BUSH_REGROW_MS, SAPLING_STAGES, STAGE_MS, isPottable } from './planter-box'
import { MOONBERRY } from './cooking'
import { cropId, seedId } from './farming'
import { prunePlan } from './forestry'
import { KEEPER_KEY_SPECS, GARDEN_KEY_SPECS } from '@/lib/keeper-key-specs'
import { newInv, give, countOf, itemDef } from '../shared/inventory'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── canon words (signed): Moonberry + Firewort, where they grow ─────────────────────────────────────────────────────────
const cuisine = readFileSync('/root/athernyx/CANON/world/cuisine.md', 'utf8'), alchemy = readFileSync('/root/athernyx/CANON/game/alchemy.md', 'utf8')
ok(cuisine.includes('Picked from its wild bushes in the open Ather'), 'canon: Moonberry is picked from its wild bushes')
ok(alchemy.includes("wild at the Sadlands' edges"), "canon: Firewort grows wild at the Sadlands' edges")
ok(itemDef(MOONBERRY).name === 'Moonberry' && itemDef(cropId('firewort')).name.includes('Firewort'), 'item names')

// ── the wild spots off a tiny index ─────────────────────────────────────────────────────────────────────────────────────
// tile a (0,0): (0,0) thicket, (1,0) arid next to (2,0) meadows and (1,1) caverns; tile b (1,0): (0,0) arid, its west
// neighbour across the seam is tile a's (4,0) springs
const a: IndexTile = { name: 'a', tx: 0, ty: 0, nodes: [{ i: 0, j: 0, zone: 'thicket' }, { i: 1, j: 0, zone: 'arid' }, { i: 2, j: 0, zone: 'meadows' }, { i: 1, j: 1, zone: 'caverns' }, { i: 4, j: 0, zone: 'springs' }, { i: 3, j: 3, zone: 'arid' }] }
const b: IndexTile = { name: 'b', tx: 1, ty: 0, nodes: [{ i: 0, j: 0, zone: 'arid' }, { i: 0, j: 1, zone: 'trails' }] }
const sp = wildSpots([a, b])
const mb = sp.filter(s => s.kind === 'moonberry'), fw = sp.filter(s => s.kind === 'firewort')
ok(mb.length === 2 * MOONBERRY_PER_SQUARE, `moonberry on the two woodland squares only (${mb.length})`)
ok(mb.every(s => (s.x >= -500 && s.x <= -300 && s.z >= -500 && s.z <= -300) || (s.x >= 500 && s.x <= 700 && s.z >= -300 && s.z <= -100)), 'moonberry inside its square')
// a(1,0) arid meets meadows to the east only (caverns south is not green; arid's west is thicket = green too)
const a10 = fw.filter(s => s.id.startsWith('ff:a:1,0:'))
ok(a10.length === 6, `the Scald square meets green on 2 sides: east meadows + west thicket (${a10.length})`)
ok(a10.filter(s => /:a:1,0:1,0:\d$/.test(s.id)).every(s => s.x >= -100 - FIREWORT_BAND && s.x <= -100), 'east band hugs the east edge, inside the Scald')
ok(a10.filter(s => /:-1,0:\d$/.test(s.id)).every(s => s.x >= -300 && s.x <= -300 + FIREWORT_BAND), 'west band hugs the west edge')
ok(!fw.some(s => s.id.startsWith('ff:a:3,3:')), 'a Scald square with no green neighbour grows none (deep badlands)')
ok(fw.filter(s => s.id.startsWith('ff:b:0,0:')).length === 6, 'across the tile seam (springs west) + trails south')
ok(wildSpots([b], [a, b]).filter(s => s.kind === 'firewort').length === 6 && wildSpots([b], [b]).filter(s => s.kind === 'firewort').length === 3, 'the seam needs the whole index')
ok(JSON.stringify(wildSpots([a, b])) === JSON.stringify(sp), 'deterministic')
ok(new Set(sp.map(s => s.id)).size === sp.length, 'ids unique')
// the real index: both grow somewhere
const idx = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: IndexTile[] }
const real = wildSpots(idx.tiles)
ok(real.some(s => s.kind === 'moonberry') && real.some(s => s.kind === 'firewort'), `the real Wilds grow both (${real.filter(s => s.kind === 'moonberry').length} / ${real.filter(s => s.kind === 'firewort').length})`)

// placed bushes
const ps = placedSpots([{ id: 'p2i', k: 'bush:moonberry-bush', x: 1, z: 2 }, { id: 'p3', k: 'bush:bloom-bush', x: 0, z: 0 }], 'g')
ok(ps.length === 1 && ps[0].id === 'pg:p2i' && ps[0].kind === 'moonberry', 'only the moonberry bush is a spot')
ok(nearestSpot(ps, 1, 3)?.id === 'pg:p2i' && nearestSpot(ps, 10, 10) === null, 'reach')

// ── pick + regrow ──────────────────────────────────────────────────────────────────────────────────────────────────────
const t0 = 1_000_000
const p1 = pickSpot({}, mb[0], t0)!
ok(!!p1 && p1.give[0].id === MOONBERRY && p1.give[0].n === 2, 'a bush gives two Moonberries')
ok(isPicked(p1.picks, mb[0].id, t0 + 1) && pickSpot(p1.picks, mb[0], t0 + 1) === null, 'picked: nothing more until it regrows')
ok(!isPicked(p1.picks, mb[0].id, t0 + FORAGE_REGROW_MS) && !!pickSpot(p1.picks, mb[0], t0 + FORAGE_REGROW_MS), 'grows back after FORAGE_REGROW_MS')
ok(!!pickSpot(p1.picks, mb[1], t0 + 1), 'each bush is its own')
ok(FORAGE_GIVES.firewort.some(g => g.id === cropId('firewort')) && FORAGE_GIVES.firewort.some(g => g.id === seedId('firewort')), 'Firewort + its seed (still plantable)')
ok(Object.keys(prunePicks(p1.picks, t0 + FORAGE_REGROW_MS)).length === 0 && Object.keys(prunePicks(p1.picks, t0 + 5)).length === 1, 'prune drops grown-back picks')
ok(JSON.stringify(parsePicks({ a: 5, b: 'x', c: NaN })) === '{"a":5}' && JSON.stringify(parsePicks([1])) === '{}', 'parse is junk-proof')
ok(KEEPER_KEY_SPECS.some(s => s.base === FORAGE_KEY), 'the forage key is registered per keeper')

// ── the retired stand-in ───────────────────────────────────────────────────────────────────────────────────────────────
ok(!prunePlan('goldwood', () => 0).some(d => d.id.includes('firewort')), 'pruning a Goldwood gives no Firewort')

// ── the Moonberry bush in a Planter Box ───────────────────────────────────────────────────────────────────────────────
ok(isPottable(MOONBERRY) && !isPottable(cropId('firewort')), 'a Moonberry goes in the box, other crops do not')
const inv = give(newInv(), MOONBERRY, 3).inv
ok(saplingsOnPlot(inv, { stacks: [] } as never).some(s => s.id === MOONBERRY && s.bag === 3), 'the box offers the Moonberry')
ok(takeSapling(inv, { stacks: [] } as never, MOONBERRY)?.from === 'bag' && countOf(takeSapling(inv, { stacks: [] } as never, MOONBERRY)!.inv, MOONBERRY) === 2, 'planting takes one berry')
const bx = plantBox({}, 'box1', MOONBERRY, t0)!
ok(!!bx && bx.box1.sapling === MOONBERRY, 'planted')
ok(!ripe(bx.box1, t0) && pickBox(bx, 'box1', t0) === null, 'a young bush bears nothing')
ok(ripeAt(bx.box1, t0) === grownAt(bx.box1) && grownAt(bx.box1) === t0 + (SAPLING_STAGES - 1) * STAGE_MS, 'first berries when grown')
const tg = grownAt(bx.box1)
const pk = pickBox(bx, 'box1', tg)!
ok(!!pk && pk.give.id === MOONBERRY && pk.give.n === BUSH_BERRIES, 'grown: pick berries')
ok(pickBox(pk.boxes, 'box1', tg + 1) === null && ripeAt(pk.boxes.box1, tg + 1) === tg + BUSH_REGROW_MS, 'picked: regrows')
ok(!!pickBox(pk.boxes, 'box1', tg + BUSH_REGROW_MS), 'keeps giving')
ok(pk.boxes.box1.sapling === MOONBERRY, 'the bush stays after a pick')
const sap = plantBox({}, 'b2', 'goldwood_sapling', t0)!
ok(!ripe(sap.b2, t0 + 99 * STAGE_MS) && pickBox(sap, 'b2', t0 + 99 * STAGE_MS) === null, 'a sapling never bears (decor only)')
// lift + set down keeps the bush and its pick time
const carried = carryBox(pk.boxes, 'box1'), back = settleBox(carried, 'box9')
ok(!carried.box1 && JSON.stringify(back.box9) === JSON.stringify(pk.boxes.box1), 'the bush rides the lift, picked time intact')
ok(JSON.stringify(parseBoxes(JSON.parse(JSON.stringify(pk.boxes)))) === JSON.stringify(pk.boxes), 'save round-trip keeps the bush + picked')
ok(KEEPER_KEY_SPECS.some(s => s.base === 'ather.planterBox.v1') || GARDEN_KEY_SPECS.some(s => s.base === 'ather.planterBox.v1'), 'box key still registered')

if (fails.length) { console.log(fails.map(f => 'FAIL ' + f).join('\n')); console.log(`forage.test ${pass} ok, ${fails.length} FAIL`); process.exit(1) }
console.log(`forage.test ${pass} ok`)
