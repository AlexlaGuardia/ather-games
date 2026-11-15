// The Ather side: the home plot and its garden grid, the Wilds tile, waymarks. Run: npx tsx src/app/shimmer/open/ather/ather.test.ts

import { readFileSync } from 'fs'
import { createLoco, tickLocomotion, type LocoInput } from '../shared/locomotion'
import { terrainWorld } from '../terrain-world'
import { parseWilds, tileCentreWorld, walkableIn, BIOME, type WildsMeta } from './wilds'
import {
  plotShape, PLOT_N, PLOT_CELL, PLOT_HALF, THRESHOLD, FALL_Y, GATE, GREG, REACH, GRID, SQ, GRID_HALF,
  STARTING_SQUARES, RING_PAGES, RING_COST, GRIMOIRE_SIZE, plotHeightAt, plotVertexHeight, plotCellIsLand,
  squareAt, squareCentre, ringOf, sqId, canBuy, mistWalls, migrateLegacy,
} from './plot'
import { newCombat, stepCombat, spawnHollow, fire, populate, KEEPER_HP, SHAMBLER, BODY_Y } from './combat'
import { wakeChampion, champVulnerable, planCombo, windupOf, tellOf, CHAMP, WAVES, PANIC_MIN_WINDUP } from './champion'
import { placeNodes, nodeAdjacency, ownerOf, nodeRegions, polyArea, NODE_CLEAR_OF, GAME_DAY_MS, SUB } from './nodes'
import { advance, clearAt, freshSpread, infectedIds, SPREAD } from './spread'
import { readGarden, gardenText } from './garden-snapshot'
import { clusterFrame, clusterGround, mateWalls, mateAt, inMiddle, onRoad, QV, D, MIDDLE_HALF, type Quarter } from './cluster'
import { makeWorld, stream, tileOf, TILE_M, SEA_FLOOR, type TileIndex } from './wilds-world'
import { atherPlatePixels, ATHER_HUE, plotPlatePixels, PLOT_MPP } from './plate'
import { reveal, newFog, isRevealed, REVEAL_R } from './explored'
import { canPlant, plant, lift, reachedBiomes, waymarksInWorld, TILE_CENTRE, GREG_WAYMARK, PER_BIOME, MIN_SPACING, MAX_WAYMARKS, type Waymark } from './waymarks'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const input = (o: Partial<LocoInput> = {}): LocoInput => ({
  mvX: 0, mvZ: 0, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60, ...o,
})

// ── the Wilds tile ────────────────────────────────────────────────────────────────────────────────────────────
const DIR = new URL('../../../../../public/open/wilds/', import.meta.url).pathname
const meta = JSON.parse(readFileSync(DIR + 'first-wilds.json', 'utf8')) as WildsMeta
const binBuf = readFileSync(DIR + 'first-wilds.bin'), bioBuf = readFileSync(DIR + 'first-wilds.biome')
const dm = new Int16Array(binBuf.buffer.slice(binBuf.byteOffset, binBuf.byteOffset + binBuf.byteLength))
const W = parseWilds(meta, dm, new Uint8Array(bioBuf))
const hx = meta.sizeX / 2, hz = meta.sizeZ / 2

// ★ what you see is what you stand on: heightAt at every vertex is that vertex
{
  let worst = 0
  for (let k = 0; k < 3000; k++) {
    const i = (k * 37) % (meta.nx - 1), j = (k * 91) % (meta.nz - 1)
    worst = Math.max(worst, Math.abs(W.heightAt(i * meta.cell - hx, j * meta.cell - hz) - W.h[j * meta.nx + i]))
  }
  ok(worst < 1e-3, `wilds: heightAt off a vertex by ${worst.toFixed(4)} m`)
}
// the tile is THREE kinds of country, not one (it was 99% meadow before the woods mask was measured)
{
  const n = W.biomes.length, frac = (b: number) => W.biomes.filter(x => x === b).length / n
  ok(frac(BIOME.woods) > 0.2, `wilds: woods ${(frac(BIOME.woods) * 100).toFixed(1)}% (want > 20%)`)
  ok(frac(BIOME.meadow) > 0.2, `wilds: meadow ${(frac(BIOME.meadow) * 100).toFixed(1)}% (want > 20%)`)
  ok(frac(BIOME.water) > 0.01, `wilds: water ${(frac(BIOME.water) * 100).toFixed(1)}% (want > 1%)`)
  // water cells really are under the water line, and land cells above it
  let wrong = 0
  for (let k = 0; k < 4000; k++) {
    const x = -hx + 2 + ((k * 7919) % 9960) / 10, z = -hz + 2 + ((k * 104729) % 9960) / 10
    const b = W.biomeAt(x, z), y = W.heightAt(x, z)
    if (b === BIOME.meadow && y < meta.waterY) wrong++
  }
  ok(wrong < 40, `wilds: ${wrong}/4000 meadow samples sit under the water line`)
  ok(W.trees.length > 2000, `wilds: only ${W.trees.length} trees`)
  ok(W.trees.every(t => t.y > meta.waterY), 'wilds: a tree stands in the water')
}
// Greg's waymark lands on dry meadow, inside the tile, clear of trunks
{
  const g = GREG_WAYMARK
  ok(Math.abs(g.x) < hx - 20 && Math.abs(g.z) < hz - 20, 'greg: waymark outside the tile')
  ok(W.biomeAt(g.x, g.z) === BIOME.meadow, `greg: waymark biome ${W.biomeAt(g.x, g.z)} (want meadow)`)
  ok(W.heightAt(g.x, g.z) > meta.waterY + 0.5, 'greg: waymark is wet')
}
// a walker set down at Greg's waymark stands, and walks 60 m across the meadow without getting stuck
{
  const world = terrainWorld(W.shape)
  const g = GREG_WAYMARK
  const lc = createLoco(g.x, W.heightAt(g.x, g.z), g.z)
  for (let t = 0; t < 60; t++) tickLocomotion(lc, input(), world)
  ok(!lc.airborne && Math.abs(lc.py - W.heightAt(lc.px, lc.pz)) < 0.3, `wilds: walker does not settle at Greg's waymark (py ${lc.py.toFixed(2)} vs ${W.heightAt(lc.px, lc.pz).toFixed(2)})`)
  // walk east-ish for 14 s; meadow trees are sparse, so it should cover real ground
  const x0 = lc.px, z0 = lc.pz
  for (let t = 0; t < 60 * 14; t++) tickLocomotion(lc, input({ mvX: 0.8, mvZ: -0.6, fwdX: 0.8, fwdZ: -0.6 }), world)
  const d = Math.hypot(lc.px - x0, lc.pz - z0)
  ok(d > 40, `wilds: walker covered only ${d.toFixed(1)} m in 14 s from Greg's waymark`)
}
// the tile's edge is a wall, not a fall
{
  const world = terrainWorld(W.shape)
  const lc = createLoco(hx - 6, W.heightAt(hx - 6, 0), 0)
  for (let t = 0; t < 60 * 6; t++) tickLocomotion(lc, input({ mvX: 1, mvZ: 0, fwdX: 1, fwdZ: 0 }), world)
  ok(lc.px < hx && lc.py > W.heightAt(lc.px, lc.pz) - 1, `wilds: walked off the tile edge (x ${lc.px.toFixed(1)}, y ${lc.py.toFixed(1)})`)
}

// ── the plot ──────────────────────────────────────────────────────────────────────────────────────────────────
const START = new Set<string>(STARTING_SQUARES)
{
  let worst = 0
  for (let j = 0; j < PLOT_N; j++) for (let i = 0; i < PLOT_N; i++) {
    if (!plotCellIsLand(i, j)) continue
    const x = i * PLOT_CELL - PLOT_HALF, z = j * PLOT_CELL - PLOT_HALF
    worst = Math.max(worst, Math.abs(plotHeightAt(x + 1e-4, z + 1e-4) - plotVertexHeight(i, j)))
  }
  ok(worst < 0.01, `plot: heightAt off a vertex by ${worst.toFixed(4)}`)
}
// every garden square is whole land (the island reaches past the outer ring), and land ends not far past it
{
  let holes = 0
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++)
    for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) {
      const x = i * SQ - GRID_HALF + a * (SQ / 4) * 0.999 + 0.01, z = j * SQ - GRID_HALF + b * (SQ / 4) * 0.999 + 0.01
      if (!Number.isFinite(plotHeightAt(x, z))) holes++
    }
  ok(holes === 0, `plot: ${holes} points of the garden grid are not land`)
  ok(plotHeightAt(0, -(GRID_HALF + 30)) === -Infinity && plotHeightAt(GRID_HALF + 30, 0) === -Infinity, 'plot: land runs far past the grid')
}
ok(STARTING_SQUARES.length === 9 && STARTING_SQUARES.every(id => { const [i, j] = id.split(',').map(Number); return ringOf(i, j) === 0 && i <= 2 && j >= GRID - 3 }), 'grid: the start is not the south-west corner 3×3 (Alex 11-15 sketch)')
{
  const counts = [0, 0, 0, 0]
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) counts[ringOf(i, j)]++
  ok(counts.join() === '9,16,24,32', `grid: ring sizes ${counts}`)
}
// the gate, Greg and the threshold all stand on the starting ground
for (const [n, p] of [['gate', GATE], ['greg', GREG], ['threshold', THRESHOLD]] as const) {
  const s = squareAt(p.x, p.z)
  ok(!!s && START.has(sqId(s.i, s.j)), `plot: the ${n} is not on the starting ground`)
  ok(Math.abs(plotHeightAt(p.x, p.z) - 2) < 0.05, `plot: the ${n}'s pad is not level`)
}
// buying ground: the grimoire seals rings, adjacency, cost
{
  // the bands run out from the start corner: (3,8) is ring 1, (4,8) still ring 1, (5,8) ring 2
  ok(ringOf(3, 8) === 1 && ringOf(4, 8) === 1 && ringOf(5, 8) === 2 && ringOf(8, 0) === 3, 'grid: the bands are not counted from the corner')
  ok(!canBuy(START, 3, 8, 9, 999).ok, 'buy: ring 1 sold before 10 pages')
  const v = canBuy(START, 3, 8, 10, 999)
  ok(v.ok && v.cost === RING_COST[1], 'buy: ring 1 refused at 10 pages')
  ok(!canBuy(START, 3, 8, 10, RING_COST[1] - 1).ok, 'buy: sold without enough grey matter')
  ok(!canBuy(START, 4, 8, 99, 999).ok, 'buy: sold a square touching nothing you hold')
  const more = new Set([...START, sqId(3, 8), sqId(4, 8)])
  ok(!canBuy(more, 5, 8, 14, 999).ok, 'buy: ring 2 sold before 15 pages')
  ok(canBuy(more, 5, 8, 15, 999).ok, 'buy: ring 2 refused at 15 pages')
  ok(RING_PAGES.join() === '0,10,15,25', 'buy: the grimoire tiers moved')
  ok(GRIMOIRE_SIZE(0) === 10 && GRIMOIRE_SIZE(10) === 15 && GRIMOIRE_SIZE(15) === 25 && GRIMOIRE_SIZE(30) === 25, 'grimoire: capacity 10 → 15 → 25')
}
// mist is a wall: from the threshold, walking north past the starting ground stops at the mist
{
  const world = terrainWorld(plotShape(START))
  const lc = createLoco(THRESHOLD.x + 4, plotHeightAt(THRESHOLD.x + 4, THRESHOLD.z), THRESHOLD.z)
  for (let t = 0; t < 60 * 12; t++) tickLocomotion(lc, input({ mvX: 0, mvZ: -1, fwdX: 0, fwdZ: -1 }), world)
  const edge = GRID_HALF - 3 * SQ
  ok(lc.pz > edge - 0.5 && lc.pz < edge + 2, `mist: walker ended at z ${lc.pz.toFixed(1)} (mist at ${edge})`)
  // the corner 3×3 is walled only on its two inner sides; its outer sides open onto the island's shore
  ok(mistWalls(START).length === 6, `mist: ${mistWalls(START).length} wall segments round the corner 3×3 (want 6)`)
}
// owning the whole grid, walking off the edge is a FALL below FALL_Y (the fold takes you home)
{
  const all = new Set<string>(); for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) all.add(sqId(i, j))
  ok(mistWalls(all).length === 0, 'mist: walls left when the whole grid is held')
  const world = terrainWorld(plotShape(all))
  const c = squareCentre(4, 8)
  const lc = createLoco(c.x, plotHeightAt(c.x, c.z), c.z)
  let fell = false
  for (let t = 0; t < 60 * 15 && !fell; t++) { tickLocomotion(lc, input({ mvX: 0, mvZ: 1, fwdX: 0, fwdZ: 1 }), world); if (lc.py < FALL_Y) fell = true }
  ok(fell, `plot: walking south off the full garden never fell (z ${lc.pz.toFixed(1)}, y ${lc.py.toFixed(1)})`)
}
// the gate and Greg are in reach from the threshold
{
  const world = terrainWorld(plotShape(START))
  for (const [n, p, r] of [['gate', GATE, REACH + 1.2], ['greg', GREG, REACH]] as const) {
    const lc = createLoco(THRESHOLD.x, plotHeightAt(THRESHOLD.x, THRESHOLD.z), THRESHOLD.z)
    let best = Infinity
    for (let t = 0; t < 60 * 10; t++) {
      const dx = p.x - lc.px, dz = p.z - lc.pz, d = Math.hypot(dx, dz); best = Math.min(best, d)
      if (d < 0.6) break
      tickLocomotion(lc, input({ mvX: dx / d, mvZ: dz / d, fwdX: dx / d, fwdZ: dz / d }), world)
    }
    ok(best < r, `plot: walker could not reach the ${n} (closest ${best.toFixed(2)} m)`)
  }
}
// the fog: walking reveals a disc, not the tile
{
  const f = newFog()
  ok(f.cw === 730 && f.ch === 490, `fog: grid ${f.cw}x${f.ch} (hub's continent map expects 730x490 at 16 m)`)
  ok(reveal(f, 100, -40) && !reveal(f, 100, -40) && f.rev === 1, 'fog: reveal reports change once')
  ok(isRevealed(f, 100, -40) && isRevealed(f, 100 + REVEAL_R - 20, -40) && !isRevealed(f, 100 + REVEAL_R + 30, -40), 'fog: reveal radius wrong')
  ok(!isRevealed(f, -100, 40), 'fog: reveal leaked')
  const c = tileCentreWorld(meta)
  ok(Math.abs(c.x - (820 * 10 - 5835)) < 1e-6 && Math.abs(c.z - (470 * 10 - 3915)) < 1e-6, `fog: tile centre ${c.x},${c.z}`)
}

// ── waymarks ──────────────────────────────────────────────────────────────────────────────────────────────────
{
  const at = (x: number, z: number, biome: number, o: Partial<{ grounded: boolean; swimming: boolean; tile: string }> = {}) =>
    ({ tile: 'first-wilds', x, z, biome: biome as 0, grounded: true, swimming: false, ...o })
  let list: Waymark[] = []
  ok(canPlant(list, at(0, 0, BIOME.woods)).ok, 'waymark: refused a plain plant')
  ok(!canPlant(list, at(0, 0, BIOME.woods, { grounded: false })).ok, 'waymark: planted mid-air')
  ok(!canPlant(list, at(0, 0, BIOME.woods, { swimming: true })).ok, 'waymark: planted while swimming')
  ok(!canPlant(list, at(0, 0, BIOME.water)).ok, 'waymark: planted in water')
  ok(!canPlant(list, at(GREG_WAYMARK.x + 10, GREG_WAYMARK.z, BIOME.meadow)).ok, "waymark: planted on top of Greg's")
  list = plant(list, { tile: 'first-wilds', x: 0, y: 1, z: 0, biome: BIOME.woods })
  ok(!canPlant(list, at(MIN_SPACING - 1, 0, BIOME.meadow)).ok, 'waymark: spacing not enforced')
  ok(canPlant(list, at(MIN_SPACING + 1, 0, BIOME.meadow)).ok, 'waymark: spacing too strict')
  ok(canPlant(list, at(0, 0, BIOME.meadow, { tile: 'other' })).ok, 'waymark: spacing leaks across tiles')
  for (let k = 1; k < PER_BIOME; k++) list = plant(list, { tile: 'first-wilds', x: k * 100, y: 1, z: 200, biome: BIOME.woods })
  ok(!canPlant(list, at(-400, -400, BIOME.woods)).ok, 'waymark: per-biome cap not enforced')
  ok(canPlant(list, at(-400, -400, BIOME.shore)).ok, 'waymark: cap leaked into another biome')
  ok(reachedBiomes(list).join() === String(BIOME.woods), `waymark: reached ${reachedBiomes(list)}`)
  // fill to the station's limit with distinct biomes/tiles
  let t = 0
  while (list.length < MAX_WAYMARKS) list = plant(list, { tile: `t${t}`, x: 0, y: 1, z: 0, biome: [BIOME.meadow, BIOME.shore, BIOME.rock][t++ % 3] })
  ok(!canPlant(list, at(0, 0, BIOME.rock, { tile: 'zzz' })).ok, 'waymark: total cap not enforced')
  ok(lift(list, list[0].id).length === list.length - 1, 'waymark: lift')
  const tc = tileCentreWorld(meta), table = TILE_CENTRE['first-wilds']
  ok(table.x === tc.x && table.z === tc.z, `waymark: TILE_CENTRE drifted from tileCentreWorld (${table.x},${table.z} vs ${tc.x},${tc.z})`)
  const ww = waymarksInWorld([{ id: 'a', tile: 'first-wilds', x: 10, y: 0, z: -20, biome: BIOME.woods, made: 0 }, { id: 'b', tile: 'nowhere', x: 0, y: 0, z: 0, biome: BIOME.woods, made: 0 }])
  ok(ww.length === 2 && ww[0].greg && ww[1].x === tc.x + 10 && ww[1].z === tc.z - 20, 'waymark: world coords wrong or unknown tile not dropped')
}

// ── combat ────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const T = {
    heightAt: W.heightAt,
    walkable: (x: number, z: number) => walkableIn(W, x, z),
  }
  const g = GREG_WAYMARK, feet = { x: g.x, y: W.heightAt(g.x, g.z), z: g.z }
  // a shambler 12 m off notices, closes and lands a lunge inside ~15 s; standing still costs health
  const c = newCombat(7)
  spawnHollow(c, T, g.x + 12, g.z)
  let hurt = 0, t = 0
  for (; t < 15 && !hurt; t += 1 / 60) { stepCombat(c, T, feet, 1 / 60); hurt += c.events.filter(e => e.kind === 'hurt').length }
  ok(hurt > 0, 'combat: a shambler never reached a keeper standing still')
  ok(t > 4, `combat: a shambler reached you in ${t.toFixed(1)} s from 12 m (too fast for a shambler)`)
  ok(c.keeper.hp === KEEPER_HP - SHAMBLER.damage, `combat: keeper hp ${c.keeper.hp}`)
  // three Repeater body shots put one down, and it drops grey matter that walks into your pocket
  const d = newCombat(3)
  const h = spawnHollow(d, T, g.x, g.z - 8)
  let kills = 0, shots = 0
  for (let k = 0; k < 600 && !kills; k++) {
    const hb = d.hollows[0]
    if (hb && k % 14 === 0) {
      const eye = { x: feet.x, y: feet.y + 1.62, z: feet.z }, tgt = { x: hb.x, y: hb.y + BODY_Y, z: hb.z }
      const dx = tgt.x - eye.x, dy = tgt.y - eye.y, dz = tgt.z - eye.z, l = Math.hypot(dx, dy, dz)
      if (fire(d, eye, { x: dx / l, y: dy / l, z: dz / l })) shots++
    }
    stepCombat(d, T, feet, 1 / 60)
    kills += d.events.filter(e => e.kind === 'hit' && e.killed).length
  }
  ok(kills === 1 && h.hp <= 0, 'combat: a Repeater could not put a shambler down')
  ok(shots >= 2 && shots <= 6, `combat: ${shots} shots to kill (want ~3 body)`)
  ok(d.drops.length === 1 && d.drops[0].amount >= 1, 'combat: no grey matter dropped')
  let got = 0
  for (let k = 0; k < 600 && !got; k++) {
    const p = d.drops[0]; if (!p) break
    const f2 = { x: p.x + 0.5, y: p.y, z: p.z }
    stepCombat(d, T, f2, 1 / 60); got += d.events.filter(e => e.kind === 'pickup').reduce((a, e) => a + (e.kind === 'pickup' ? e.amount : 0), 0)
  }
  ok(got >= 1 && d.drops.length === 0, 'combat: grey matter could not be picked up')
  // a floater keeps its distance and spits; standing still, a spit lands within ~10 s
  const f = newCombat(5)
  spawnHollow(f, T, g.x + 14, g.z, 'floater')
  let spit = 0, minD = Infinity
  for (let t2 = 0; t2 < 10 && !spit; t2 += 1 / 60) {
    stepCombat(f, T, feet, 1 / 60); spit += f.events.filter(e2 => e2.kind === 'hurt').length
    const fl = f.hollows[0]; minD = Math.min(minD, Math.hypot(fl.x - feet.x, fl.z - feet.z))
  }
  ok(spit > 0, 'combat: a floater never landed a spit on a keeper standing still')
  ok(minD > 6, `combat: a floater came to ${minD.toFixed(1)} m (it should keep its distance)`)
  ok(f.hollows[0].y > W.heightAt(f.hollows[0].x, f.hollows[0].z) + 1.2, 'combat: the floater is not floating')
  // populate keeps strays out of the safe ring and out of the water
  const e = newCombat(11)
  populate(e, T, g.x, g.z, 7, { x: g.x, z: g.z, r: 30 })
  ok(e.hollows.length >= 5, `combat: populate made ${e.hollows.length} strays`)
  ok(e.hollows.every(h2 => Math.hypot(h2.x - g.x, h2.z - g.z) >= 30 && W.biomeAt(h2.x, h2.z) !== BIOME.water), 'combat: a stray spawned in the safe ring or the water')
}

// ── infected nodes + the champion ─────────────────────────────────────────────────────────────────────────────
{
  const g = GREG_WAYMARK
  const nodes = placeNodes(W, 'first-wilds', g)
  // THE NODE MAP: one node per land subsection of a SUB×SUB grid
  ok(nodes.length >= 12 && nodes.length <= SUB * SUB, `nodes: ${nodes.length} placed (want most of the ${SUB * SUB} subsections)`)
  ok(new Set(nodes.map(n => `${n.i},${n.j}`)).size === nodes.length, 'nodes: two nodes in one subsection')
  ok(new Set(nodes.map(n => n.biome)).size >= 2, 'nodes: every node is one biome (the map has three countries)')
  const cw = meta.sizeX / SUB
  ok(nodes.every(n => n.x >= -meta.sizeX / 2 + n.i * cw && n.x < -meta.sizeX / 2 + (n.i + 1) * cw), 'nodes: a node sits outside its subsection')
  const adj = nodeAdjacency(nodes)
  ok([...adj.entries()].every(([id, ns]) => ns.every(m => { const a = nodes.find(n => n.id === id)!, b = nodes.find(n => n.id === m)!; return a.biome === b.biome && Math.abs(a.i - b.i) + Math.abs(a.j - b.j) === 1 })), 'nodes: a neighbour across a biome or more than one step away')
  ok([...adj.values()].some(ns => ns.length > 0), 'nodes: no node has a neighbour (spread could never move)')
  ok(nodes.every(n => W.biomeAt(n.x, n.z) === n.biome && walkableIn(W, n.x, n.z, 1.2)), 'nodes: a node off its biome or on unwalkable ground')
  ok(nodes.every(n => Math.hypot(n.x - g.x, n.z - g.z) >= NODE_CLEAR_OF), 'nodes: a node inside the safe distance of Greg\'s waymark')
  ok(JSON.stringify(placeNodes(W, 'first-wilds', g)) === JSON.stringify(nodes), 'nodes: placement is not deterministic')
  // THE SPREAD (Alex's raw numbers, no brakes)
  {
    const t0 = 1_000_000_000_000, D = GAME_DAY_MS
    const s0 = freshSpread(t0)
    ok(infectedIds(s0, nodes).length === nodes.length, 'spread: the Wilds do not start fully infested')
    // clear everything, wait: nothing spreads from nothing; wells come back at ~3% per 5 days
    let all = s0; for (const n of nodes) all = clearAt(all, nodes, n.id, t0 + 1).s
    ok(infectedIds(all, nodes).length === 0, 'spread: clearing every node left one infected')
    const year = advance(all, nodes, t0 + 365 * D)
    const wells = year.events.filter(e => e.kind === 'well').length
    ok(wells > 0, 'spread: a clean world never welled up in a year')
    // clear one node in the middle of its biome: within a week (2 spread ticks) it is at risk only from its neighbours
    const mid = nodes.find(n => (adj.get(n.id) ?? []).length >= 2)!
    const one = clearAt(s0, nodes, mid.id, t0 + 1).s
    ok(advance(one, nodes, t0 + SPREAD.everyDays * D - 1).s.clean.includes(mid.id), 'spread: it spread before the first tick')
    // over many seeds of time, a cleared node gets re-infected only by a neighbour in its biome
    const ev = advance(one, nodes, t0 + 120 * D).events.filter(e => e.kind === 'spread')
    ok(ev.every(e => (adj.get(e.from!) ?? []).includes(e.id)), 'spread: grey jumped to a non-neighbour')
    ok(ev.some(e => e.id === mid.id), 'spread: in 120 game days the grey never crept back into the cleared node')
    // replay is exact: one long advance == many short ones
    let step = one; for (let d = 1; d <= 60; d++) step = advance(step, nodes, t0 + d * D).s
    ok(JSON.stringify(step.clean) === JSON.stringify(advance(one, nodes, t0 + 60 * D).s.clean), 'spread: stepping day by day differs from one jump (the offline replay would disagree)')
    // the dial: chance 0 means it never spreads
    const keep = SPREAD.chance; SPREAD.chance = 0
    ok(advance(one, nodes, t0 + 120 * D).events.every(e => e.kind !== 'spread'), 'spread: spread with the chance dial at 0')
    SPREAD.chance = keep
  }

  // ★ Alex 11-15: "the hollows still kept spawning after I defeated the meadow champion". Cleared ground stays quiet.
  {
    const meadow = nodes.find(n => n.biome === BIOME.meadow)!
    ok(!!meadow, 'nodes: no meadow node on first-wilds')
    ok(ownerOf(nodes, meadow.x + 10, meadow.z)?.id === meadow.id, 'nodes: ground beside the meadow node is not its own')
    const cleared = new Set([meadow.id])
    const infested = (x: number, z: number) => !cleared.has(ownerOf(nodes, x, z)!.id)
    const q = newCombat(31), T2 = { heightAt: W.heightAt, walkable: (x: number, z: number) => walkableIn(W, x, z) }
    for (let k = 0; k < 40; k++) populate(q, T2, meadow.x, meadow.z, 7, undefined, infested)
    // ANY ground near it, woods pockets included (the 11-15 strays were in woods 90 m off the meadow node)
    ok(q.hollows.every(h => ownerOf(nodes, h.x, h.z)!.id !== meadow.id), `nodes: ${q.hollows.filter(h => ownerOf(nodes, h.x, h.z)!.id === meadow.id).length} strays welled up on the cleared node's ground`)
    const q2 = newCombat(31)
    for (let k = 0; k < 40; k++) populate(q2, T2, meadow.x, meadow.z, 7)
    ok(q2.hollows.some(h => ownerOf(nodes, h.x, h.z)!.id === meadow.id), 'nodes: the cleared-ground check is vacuous (no strays on its ground even while infected)')
  }

  // the map's borders (Alex 11-15: "show where it starts"): the regions tile the square and agree with ownerOf
  {
    const three = [...nodes, { id: 'x', tile: 't', biome: BIOME.rock, x: 333, z: 251, i: 9, j: 9 }]
    for (const set of [nodes, three]) {
      const R = nodeRegions(set, meta.sizeX, meta.sizeZ)
      const total = R.reduce((a, r) => a + polyArea(r.poly), 0)
      ok(Math.abs(total - meta.sizeX * meta.sizeZ) < 1, `regions: cover ${total.toFixed(0)} m², want ${meta.sizeX * meta.sizeZ}`)
      let bad = 0
      for (let k = 0; k < 400; k++) {
        const x = ((k * 37) % 97) / 97 * meta.sizeX - hx, z = ((k * 61) % 89) / 89 * meta.sizeZ - hz
        const own = ownerOf(set, x, z)!.id, r = R.find(r => r.id === own)!.poly
        let inside = false   // even-odd
        for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i].z > z) !== (r[j].z > z) && x < (r[j].x - r[i].x) * (z - r[i].z) / (r[j].z - r[i].z) + r[i].x) inside = !inside
        if (!inside) bad++
      }
      ok(bad === 0, `regions: ${bad}/400 points outside their owner's region`)
    }
  }

  // the fight, on flat open ground so only the rules are under test
  const F: { heightAt: (x: number, z: number) => number; walkable: (x: number, z: number) => boolean } = { heightAt: () => 0, walkable: () => true }
  const node = { id: 't:2', tile: 't', biome: BIOME.meadow, x: 0, z: 0, i: 0, j: 0 }
  const step = (c: ReturnType<typeof newCombat>, feet: { x: number; y: number; z: number }, secs: number, stop?: () => boolean) => {
    const evs: string[] = []
    for (let t = 0; t < secs; t += 1 / 60) { stepCombat(c, F, feet, 1 / 60); for (const e of c.events) evs.push(e.kind); if (stop?.()) break }
    return evs
  }
  const shoot = (c: ReturnType<typeof newCombat>, eye: { x: number; y: number; z: number }) => {
    const ch = c.champ!; const tx = ch.x - eye.x, ty = ch.y + CHAMP.bodyY - eye.y, tz = ch.z - eye.z, l = Math.hypot(tx, ty, tz)
    c.keeper.sinceShot = 99; c.keeper.ammo = 12; c.keeper.reloading = 0; c.keeper.bloom = 0
    fire(c, eye, { x: tx / l, y: ty / l, z: tz / l })
  }
  const c = newCombat(21)
  const ch = wakeChampion(c, F, node)
  ok(ch.state === 'rise' && !champVulnerable(ch), 'champ: it should rise invulnerable')
  // shots while it rises do nothing
  const far = { x: 0, y: 0, z: 14 }, eye = { x: 0, y: 1.62, z: 14 }
  shoot(c, eye); step(c, far, 0.5)
  ok(ch.hp === CHAMP.barHp, 'champ: a round hurt it while it was rising')
  step(c, far, CHAMP.rise)
  ok(champVulnerable(ch), 'champ: never finished rising')
  // the tell comes BEFORE the hit: a lunge at a keeper who never moves
  const lc = newCombat(3); wakeChampion(lc, F, node); lc.champ!.state = 'idle'; lc.champ!.t = 0
  const at = { x: 0, y: 0, z: 9 }
  let toldFirst = false, hurtAt = -1, tellSeen = false
  for (let t = 0; t < 4 && hurtAt < 0; t += 1 / 60) {
    stepCombat(lc, F, at, 1 / 60)
    if (tellOf(lc.champ)) tellSeen = true
    if (lc.events.some(e => e.kind === 'hurt')) { hurtAt = t; toldFirst = tellSeen }
  }
  ok(hurtAt > 0 && toldFirst, 'champ: it hit a keeper without a tell first')
  // a slam misses a keeper outside its ring
  const sc = newCombat(4); wakeChampion(sc, F, node); Object.assign(sc.champ!, { state: 'windup', attack: 'slam', t: 0.01, sink: 0 })
  const out = { x: 0, y: 0, z: 6.5 }   // literal: a constant-relative distance moves with the constant
  ok(!step(sc, out, 0.2).includes('hurt'), 'champ: a slam hit a keeper standing outside the ring')
  const sc2 = newCombat(4); wakeChampion(sc2, F, node); Object.assign(sc2.champ!, { state: 'windup', attack: 'slam', t: 0.01, sink: 0 })
  ok(step(sc2, { x: 0, y: 0, z: 2 }, 0.2).includes('hurt'), 'champ: a slam missed a keeper inside the ring')
  // combos by bar
  const pc = newCombat(9); const p0 = wakeChampion(pc, F, node)
  ok(planCombo(pc, p0, 10).length === 1, 'champ: bar 1 should be one attack at a time')
  p0.bar = 1; ok([...Array(20)].every(() => planCombo(pc, p0, 10).length === 2), 'champ: bar 2 should be two-attack combos')
  p0.bar = 2
  const panic = [...Array(60)].map(() => planCombo(pc, p0, 10))
  ok(new Set(panic.map(q => q.join())).size >= 6, 'champ: panic is not random enough')
  ok((['slam', 'lunge', 'volley'] as const).every(a => windupOf(p0, a) >= PANIC_MIN_WINDUP && windupOf(p0, a) < CHAMP[a].windup), 'champ: a panic windup is untelegraphed or not faster')
  // three bars, a wave per break, a chunk at the end (the keeper is out of reach so it cannot fight back; a test of the bars)
  const bc = newCombat(13); const b = wakeChampion(bc, F, node); b.state = 'idle'; b.sink = 0
  const evs: string[] = []
  let guard = 0
  while (bc.champ && guard++ < 4000) {
    const cur = bc.champ
    if (!champVulnerable(cur)) { evs.push(...step(bc, far, 0.25)); bc.hollows = []; continue }
    cur.state = 'recover'; cur.t = 9; cur.x = 0; cur.z = 0
    shoot(bc, eye); evs.push(...step(bc, far, 0.5)); bc.hollows = bc.hollows.filter(h => h.state === 'wander' && false)
  }
  ok(evs.filter(e => e === 'champ-break').length === 2, `champ: ${evs.filter(e => e === 'champ-break').length} breaks (want 2)`)
  ok(evs.includes('champ-down') && !bc.champ, 'champ: three bars never put it down')
  ok(bc.drops.some(d => d.amount === CHAMP.chunk), 'champ: no grey-matter chunk on the kill')
  const shots = guard
  ok(shots > 30 && shots < 200, `champ: ${shots} loop steps to kill (sanity)`)
  // a break summons the wave it promises
  const wc = newCombat(17); const wv = wakeChampion(wc, F, node); wv.state = 'recover'; wv.t = 9; wv.sink = 0; wv.hp = 1
  shoot(wc, eye); step(wc, far, 0.6)
  ok(wc.hollows.length >= 3 && wc.hollows.length === WAVES[0][0] + WAVES[0][1] && wc.champ!.bar === 1 && wc.champ!.state === 'submerge', 'champ: the first break did not summon its wave and sink')
  // leash: walk away and it goes home, healing the bar it is on
  const hc = newCombat(19); const hh = wakeChampion(hc, F, node); hh.state = 'idle'; hh.sink = 0; hh.hp = 40; hh.bar = 1; hh.x = 8   // off its node, so it is still walking home when we look
  step(hc, { x: 0, y: 0, z: CHAMP.leash + 20 }, 1.5)
  ok(hc.champ!.state === 'home' && hc.champ!.hp > 40 && hc.champ!.bar === 1, 'champ: the leash did not send it home or heal its bar')
  // home with nobody near: it goes back under (prod 11-15: one stuck at home blocked every other node), remembering its bar
  const dc = newCombat(23); const dh = wakeChampion(dc, F, node); dh.state = 'idle'; dh.sink = 0; dh.bar = 1; dh.x = 3; dh.z = 0
  step(dc, { x: 0, y: 0, z: CHAMP.leash + 30 }, 12)
  ok(!dc.champ && dc.dormant?.[node.id] === 1, 'champ: a champion home with nobody near never went back under (or forgot its bar)')
  ok(wakeChampion(dc, F, node).bar === 1, 'champ: woken again, it did not resume on the bar it had reached')
}

// ── the Ather's map plate (Alex 11-15: the Nyx map's look, for the Ather) ────────────────────────────────────────
{
  const pl = atherPlatePixels(W)
  ok(pl.w === meta.sizeX / 2 && pl.h === meta.sizeZ / 2 && pl.px.length === pl.w * pl.h * 4, 'plate: wrong size')
  let opaque = true; for (let k = 3; k < pl.px.length; k += 4) if (pl.px[k] !== 255) { opaque = false; break }
  ok(opaque, 'plate: a transparent pixel')
  // water reads blue, meadow reads green-gold, woods reads greener than meadow (the Atlas hues by biome)
  const avg = (b: number) => { let r = 0, g = 0, bl = 0, n = 0; for (let j = 0; j < pl.h; j += 3) for (let i = 0; i < pl.w; i += 3) if (W.biomeAt(-meta.sizeX / 2 + (i + 0.5) * 2, -meta.sizeZ / 2 + (j + 0.5) * 2) === b) { const o = (j * pl.w + i) * 4; r += pl.px[o]; g += pl.px[o + 1]; bl += pl.px[o + 2]; n++ } return [r / n, g / n, bl / n] }
  const wa = avg(BIOME.water), me = avg(BIOME.meadow), wo = avg(BIOME.woods)
  ok(wa[2] > wa[0] && wa[2] > wa[1], 'plate: water is not blue')
  ok(me[1] > me[2] && wo[1] - wo[0] > me[1] - me[0], 'plate: meadow and woods do not read as two greens (woods the cooler one)')
  ok(JSON.stringify(ATHER_HUE[2]) === '[170,206,120]', 'plate: meadow drifted off the Atlas hue (continent/map.tsx ATHER_BANDS)')
  ok(atherPlatePixels(W).px.every((v, k) => v === pl.px[k]), 'plate: not deterministic')
}

// the home plot's plate: your squares in colour, the rest under mist, the void outside the island
{
  const owned = new Set(STARTING_SQUARES)
  const pp = plotPlatePixels(owned)
  const at = (x: number, z: number) => { const i = Math.floor((x + pp.extent) / PLOT_MPP), j = Math.floor((z + pp.extent) / PLOT_MPP), o = (j * pp.w + i) * 4; return [pp.px[o], pp.px[o + 1], pp.px[o + 2]] }
  const mine = squareCentre(1, 7), mist = squareCentre(8, 0), voidPt = [pp.extent - 2, pp.extent - 2]
  const lum = (c: number[]) => c[0] + c[1] + c[2]
  ok(at(mine.x + 3, mine.z + 3)[1] > at(mine.x + 3, mine.z + 3)[2] + 20, 'plot plate: a held square is not green')
  const sat = (c: number[]) => Math.max(...c) - Math.min(...c)   // the mist is PALE (washed out), held ground is vivid; brightness alone depends on the slope's light
  ok(sat(at(mist.x + 3, mist.z + 3)) < sat(at(mine.x + 3, mine.z + 3)) * 0.5, 'plot plate: an unbought square is not under the pale mist')
  ok(lum(at(voidPt[0], voidPt[1])) < 120, 'plot plate: the corner past the island is not the void')
  const more = plotPlatePixels(new Set([...owned, sqId(3, 8)]))
  ok(more.px.some((v, k) => v !== pp.px[k]), 'plot plate: buying a square does not change the map')
}

// ── garden clusters (Alex 11-15: "the clouds hide the expansion; once a friend joins, the communal space opens";
//    the layout is his sketch: a square in the middle, a # of streets, every garden's gate corner on a crossroads) ──
{
  const own = new Set(STARTING_SQUARES)
  const alone = clusterFrame('ne', [{ quarter: 'ne', name: 'me', owned: [...own] }])
  ok(!alone.linked && !alone.middle && alone.ramps.length === 0 && alone.streets.length === 0, 'cluster: alone, something opened (the clouds should hide it all)')
  ok(clusterGround(alone, -D, D) === -Infinity, 'cluster: alone, there is ground where the middle would be')
  const f = clusterFrame('ne', [{ quarter: 'ne', name: 'me', owned: [...own] }, { quarter: 'sw', name: 'pal', owned: [...own] }])
  ok(f.linked && !!f.middle && f.mates.length === 1 && f.ramps.length === 2 && f.streets.length === 4, 'cluster: a friend joined and the frame did not link')
  ok(f.middle!.x === -D && f.middle!.z === D, 'cluster: the square is not south-west of me')
  ok(MIDDLE_HALF * 2 > 40, 'cluster: the square is too small to be a place')
  const pal = f.mates[0]
  ok(pal.x === -2 * D && pal.z === 2 * D, 'cluster: the opposite mate is not across the square')
  ok(clusterGround(f, f.middle!.x, f.middle!.z) > 0, 'cluster: no ground in the middle once linked')
  ok(Number.isFinite(clusterGround(f, pal.x, pal.z)) && mateAt(f, pal.x, pal.z) === pal, "cluster: no ground on the mate's island")
  // every view, every mate: everyone sees themselves north-east, and every mate's gate corner faces the square
  const QS: Quarter[] = ['ne', 'nw', 'sw', 'se']
  for (const mine of QS) {
    const ff = clusterFrame(mine, QS.map(q => ({ quarter: q, name: q, owned: [...own] })))
    ok(ff.mates.length === 3 && new Set(ff.mates.map(m => m.where)).size === 3 && !ff.mates.some(m => m.where === 'ne'), `cluster: from ${mine}, the mates do not fill the other three corners`)
    for (const m of ff.mates) {
      const c = Math.cos(m.rot), sn = Math.sin(m.rot), gx = m.x + c * GATE.x + sn * GATE.z, gz = m.z - sn * GATE.x + c * GATE.z
      const dG = Math.hypot(gx - ff.middle!.x, gz - ff.middle!.z), dC = Math.hypot(m.x - ff.middle!.x, m.z - ff.middle!.z)
      ok(dG < dC - 80, `cluster: from ${mine}, ${m.quarter}'s gate does not face the square (${dG.toFixed(0)} vs ${dC.toFixed(0)})`)
    }
    // the streets keep their gap: no shore, mine or a mate's, runs under a street
    let under = 0
    for (const r of ff.streets) for (let x = r.x0; x <= r.x1; x += 1.5) for (let z = r.z0; z <= r.z1; z += 1.5)
      if (Number.isFinite(plotHeightAt(x, z)) || mateAt(ff, x, z)) under++
    ok(under === 0, `cluster: from ${mine}, ${under} points of street over an island`)
  }
  // two views agree: if I see you one quarter-turn anticlockwise, you see me one quarter-turn clockwise
  {
    const a = clusterFrame('ne', [{ quarter: 'ne', name: 'a', owned: [] }, { quarter: 'nw', name: 'b', owned: [] }]).mates[0].where
    const b = clusterFrame('nw', [{ quarter: 'ne', name: 'a', owned: [] }, { quarter: 'nw', name: 'b', owned: [] }]).mates[0].where
    ok(a === 'nw' && b === 'se', `cluster: the two views disagree (${a} / ${b})`)
  }
  // walkable end to end: my threshold → my gate's ramp → the crossroads → across the square → their crossroads →
  // their ramp → their start ground, with no hole and nothing the walker would stall on
  const path: [number, number][] = []
  const seg = (ax: number, az: number, bx: number, bz: number) => { for (let t = 0; t <= 1; t += 0.01) path.push([ax + (bx - ax) * t, az + (bz - az) * t]) }
  const [r0, r1] = f.ramps, c = Math.cos(pal.rot), sn = Math.sin(pal.rot)
  const palHome = { x: pal.x + c * THRESHOLD.x + sn * THRESHOLD.z, z: pal.z - sn * THRESHOLD.x + c * THRESHOLD.z }
  seg(THRESHOLD.x, THRESHOLD.z, r0.ax, r0.az); seg(r0.ax, r0.az, r0.bx, r0.bz); seg(r0.bx, r0.bz, r1.bx, r1.bz); seg(r1.bx, r1.bz, r1.ax, r1.az); seg(r1.ax, r1.az, palHome.x, palHome.z)
  const hAt = (x: number, z: number) => Math.max(plotHeightAt(x, z), clusterGround(f, x, z))
  const holes = path.filter(([x, z]) => !Number.isFinite(hAt(x, z)))
  ok(holes.length === 0, `cluster: ${holes.length} holes on the walk from my plot to my friend's (first ${holes[0]?.map(v => v.toFixed(1))})`)
  let steep = 0, worst = 0
  for (let k = 1; k < path.length; k++) {
    const run = Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]) || 1, g = Math.abs(hAt(...path[k]) - hAt(...path[k - 1])) / run
    worst = Math.max(worst, g); if (g > 0.6) steep++
  }
  ok(steep === 0, `cluster: ${steep} spots on the walk steeper than 0.6 (worst ${worst.toFixed(2)}; the walker would stall)`)
  ok(onRoad(f, r0.bx, r0.bz) && inMiddle(f, f.middle!.x + 10, f.middle!.z - 10), 'cluster: the crossroads or the square do not say where they are')
  // my own way out needs no lane: the start corner's outer sides are open, only the two inner sides are mist
  const walls = mistWalls(own), blocks = (x: number, z: number) => walls.some(w => x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1)
  ok(path.slice(0, 200).every(([x, z]) => !blocks(x, z)), 'cluster: mist stands between my threshold and my ramp')
  // visiting: a mate's unbought squares are fenced off, turned with their island; their start ground is open
  const mw = mateWalls(f)
  const mblocks = (x: number, z: number) => mw.some(w => x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1)
  ok(mw.length === 6, `cluster: a friend's corner start has ${mw.length} mist walls (want 6)`)
  ok(path.slice(-200).every(([x, z]) => !mblocks(x, z)), "cluster: mist stands between a friend's ramp and their threshold")
  ok(mw.every(w => mateAt(f, (w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2) === pal), "cluster: a friend's mist stands off their island")
  // a mate's garden is somebody else's data: only well-formed square ids get through
  ok(readGarden(gardenText(['4,4', '3,3']))?.owned.join() === '3,3,4,4', 'garden: a good snapshot did not round-trip')
  ok(readGarden('{"v":1,"owned":["9,9"]}') === null && readGarden('{"v":1,"owned":["4,4","<b>"]}') === null, 'garden: a bad square id got through')
  ok(readGarden('nope') === null && readGarden(JSON.stringify({ v: 1, owned: Array(82).fill('1,1') })) === null, 'garden: junk or an oversized garden got through')
  // a snapshot from the centred layout reads in the corner frame (the old middle 3×3 lands on the start corner)
  ok(readGarden('{"v":1,"owned":["3,3","4,4","5,5","2,4"]}')?.owned.join(' ') === '0,6 1,7 2,8', 'garden: a v1 snapshot did not shift to the corner')
  // a local save from the centred layout: same shift, and a square pushed off the grid is refunded at its old price
  const OLD_START = ['3,3', '4,3', '5,3', '3,4', '4,4', '5,4', '3,5', '4,5', '5,5']
  const mig = migrateLegacy([...OLD_START, '4,2', '2,4'], 5)
  ok(STARTING_SQUARES.every(id => mig.owned.includes(id)) && mig.owned.includes('1,5') && mig.owned.length === 10, `garden: the old start did not land on the corner (${mig.owned})`)
  ok(mig.grey === 5 + RING_COST[1], `garden: the square pushed off the grid was not refunded (grey ${mig.grey})`)
}

// ── the Wilds, streamed (Alex 11-15) ───────────────────────────────────────────────────────────────────────────
const worldDone = (async () => {
  const index = JSON.parse(readFileSync(DIR + 'tiles.json', 'utf8')) as TileIndex
  const loadFs = async (name: string) => {
    const m = JSON.parse(readFileSync(DIR + name + '.json', 'utf8')) as WildsMeta
    const b = readFileSync(DIR + name + '.bin'), bio = readFileSync(DIR + name + '.biome')
    return parseWilds(m, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio))
  }
  ok(index.tiles.length > 40 && index.tiles.some(t => t.name === 'first-wilds' && t.tx === 0 && t.ty === 0), 'world: the index lost the anchor tile or most of the continent')
  // the index's nodes for the anchor tile are exactly what placeNodes says on the live tile
  const anchor = index.tiles.find(t => t.name === 'first-wilds')!
  ok(JSON.stringify(anchor.nodes.map(n => n.id)) === JSON.stringify(placeNodes(W, 'first-wilds', GREG_WAYMARK).map(n => n.id)), 'world: the node index disagrees with placeNodes on the anchor tile')
  const w = makeWorld(index)
  // pick a pair of neighbouring land tiles to walk across
  const pair = index.tiles.find(t => index.tiles.some(u => u.tx === t.tx + 1 && u.ty === t.ty) && t.land > 0.5)!
  const cx = pair.tx * TILE_M + TILE_M / 2, cz = pair.ty * TILE_M   // on the seam between pair and its east neighbour
  // before streaming: in the index but not loaded = fenced, never a hole you can step into
  ok(w.heightAt(cx - 5, cz) === -Infinity && w.shape.solids(cx - 6, -1, cz - 1, cx - 4, 1, cz + 1).length > 0, 'world: an unloaded tile is not fenced')
  ok(w.heightAt(1e6, 1e6) === SEA_FLOOR, 'world: off the index is not sea')
  await stream(w, cx, cz, loadFs)
  ok(w.loaded.size >= 2 && w.rev > 0, 'world: streaming loaded nothing')
  // across the seam the ground is continuous (the tiles share their edge vertices)
  let jump = 0
  for (let d = -30; d <= 30; d++) { const z = cz + d * 9; jump = Math.max(jump, Math.abs(w.heightAt(cx - 0.01, z) - w.heightAt(cx + 0.01, z))) }
  ok(jump < 0.05, `world: the ground steps ${jump.toFixed(2)} m at a tile seam`)
  // no tile-edge wall stands on an interior seam
  const seamWalls = w.shape.solids(cx - 1, -10, cz - 50, cx + 1, 50, cz + 50).filter(b => b.y1 - b.y0 > 700)
  ok(seamWalls.length === 0, 'world: a tile border wall stands on an interior seam')
  // streaming away drops far tiles and keeps memory bounded
  await stream(w, cx + 5 * TILE_M, cz, loadFs)
  ok(w.loaded.size <= 9 && ![...w.loaded.keys()].includes(pair.name), 'world: far tiles were not dropped')
  ok(tileOf(499, -499).tx === 0 && tileOf(501, 0).tx === 1, 'world: tileOf misplaces a tile edge')
  // the spread over the whole continent's nodes stays quick (it replays on every load)
  const all = index.tiles.flatMap(t => t.nodes.map(n => ({ ...n, tile: t.name, x: n.x + t.tx * TILE_M, z: n.z + t.ty * TILE_M, gi: t.tx * SUB + n.i, gj: t.ty * SUB + n.j })))
  // the grey crosses tile seams: some neighbours sit in another tile, and every neighbour is one subsection away
  const gadj = nodeAdjacency(all), byId = new Map(all.map(n => [n.id, n]))
  const across = [...gadj.entries()].flatMap(([id, ns]) => ns.map(m => [byId.get(id)!, byId.get(m)!])).filter(([a, b]) => a.tile !== b.tile)
  ok(across.length > 50, `world: only ${across.length} neighbour links cross a tile seam`)
  ok([...gadj.entries()].every(([id, ns]) => ns.every(m => { const a = byId.get(id)!, b = byId.get(m)!; return a.biome === b.biome && Math.abs(a.gi! - b.gi!) + Math.abs(a.gj! - b.gj!) === 1 })), 'world: a continent neighbour is across a biome or more than one subsection away')
  ok(across.every(([a, b]) => Math.hypot(a.x - b.x, a.z - b.z) < 450), 'world: a seam neighbour is not actually next door')
  const t0 = Date.now(); advance(freshSpread(0), all, 60 * GAME_DAY_MS); const ms = Date.now() - t0
  ok(ms < 1500, `world: 60 game days over ${all.length} nodes took ${ms} ms`)
})()

worldDone.then(() => {
  if (fails.length) { console.error(`ather: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
  console.log(`ather: ${pass}/0`)
})
