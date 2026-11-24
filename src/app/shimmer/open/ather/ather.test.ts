// The Ather side: the home plot and its garden grid, the Wilds tile, waymarks. Run: npx tsx src/app/shimmer/open/ather/ather.test.ts

import { readFileSync } from 'fs'
import { createLoco, tickLocomotion, type LocoInput } from '../shared/locomotion'
import { terrainWorld } from '../terrain-world'
import { parseWilds, tileCentreWorld, walkableIn, BIOME, type WildsMeta } from './wilds'
import {
  plotShape, PLOT_N, PLOT_CELL, PLOT_HALF, THRESHOLD, FALL_Y, GATE, GREG, REACH, GRID, SQ, GRID_HALF,
  STARTING_SQUARES, RING_PAGES, RING_COST, GRIMOIRE_SIZE, plotHeightAt, plotVertexHeight, plotCellIsLand,
  squareAt, squareCentre, ringOf, sqId, canBuy, mistWalls, migrateLegacy, PLOT_R, PATH_START,
} from './plot'
import { newCombat, stepCombat, spawnHollow, fire, populate, KEEPER_HP, SHAMBLER, BODY_Y } from './combat'
import { wakeChampion, champVulnerable, planCombo, windupOf, tellOf, CHAMP, WAVES, PANIC_MIN_WINDUP } from './champion'
import { placeNodes, nodeAdjacency, ownerOf, nodeRegions, polyArea, NODE_CLEAR_OF, GAME_DAY_MS, SUB } from './nodes'
import { clearAt, freshSpread, infectedIds } from './spread'
import { readGarden, gardenText } from './garden-snapshot'
import { treeFor, prune, forestryLevel, _resetForestry, SAPLING_CHANCE, MAST_CHANCE, PRUNE_RANGE, type Zone } from './forestry'
import { clusterFrame, clusterGround, mateWalls, mateAt, inMiddle, onPath, onMeadow, D, MIDDLE_HALF, type Quarter } from './cluster'
import { pathDist, PATH_W, meadowHeightAt } from './meadow'
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
  ok(counts.join() === '9,40,72,104', `grid: ring sizes ${counts}`)
}
// Greg and the threshold stand on the starting ground (the gate moved to the Green's centre, BETA M52: tested with the cluster)
for (const [n, p] of [['greg', GREG], ['threshold', THRESHOLD]] as const) {
  const s = squareAt(p.x, p.z)
  ok(!!s && START.has(sqId(s.i, s.j)), `plot: the ${n} is not on the starting ground`)
  ok(Math.abs(plotHeightAt(p.x, p.z) - 2) < 0.05, `plot: the ${n}'s pad is not level`)
}
// the building grid is one flat floor (Alex 11-16), corner to corner, every 2 m
{
  let worst = 0
  for (let z = -GRID_HALF; z <= GRID_HALF; z += 2) for (let x = -GRID_HALF; x <= GRID_HALF; x += 2) {
    const h = plotHeightAt(x, z); if (Number.isFinite(h)) worst = Math.max(worst, Math.abs(h - 2))
  }
  ok(worst < 1e-6, `plot: the building grid is not flat (off by ${worst.toFixed(3)} m)`)
}
// buying ground: the grimoire seals rings, adjacency, cost
{
  // the bands run out from the start corner, four squares deep: (3..6, 14) ring 1, (7, 14) ring 2, the far corner ring 3
  const B = GRID - 1
  ok(ringOf(3, B) === 1 && ringOf(6, B) === 1 && ringOf(7, B) === 2 && ringOf(10, B) === 2 && ringOf(11, B) === 3 && ringOf(B, 0) === 3, 'grid: the bands are not counted from the corner')
  ok(!canBuy(START, 3, B, 9, 999).ok, 'buy: ring 1 sold before 10 pages')
  const v = canBuy(START, 3, B, 10, 999)
  ok(v.ok && v.cost === RING_COST[1], 'buy: ring 1 refused at 10 pages')
  ok(!canBuy(START, 3, B, 10, RING_COST[1] - 1).ok, 'buy: sold without enough grey matter')
  ok(!canBuy(START, 4, B, 99, 999).ok, 'buy: sold a square touching nothing you hold')
  const more = new Set([...START, sqId(3, B), sqId(4, B), sqId(5, B), sqId(6, B)])
  ok(!canBuy(more, 7, B, 14, 999).ok, 'buy: ring 2 sold before 15 pages')
  ok(canBuy(more, 7, B, 15, 999).ok, 'buy: ring 2 refused at 15 pages')
  ok(GRID * SQ === 300, 'grid: the plot is not 300 m across (RULED 11-15)')
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
  // the corner 3×3 is walled on its two inner sides (6) and every unbought rim square on its outer side (60 − 6)
  ok(mistWalls(START).length === 60, `mist: ${mistWalls(START).length} wall segments (want 6 inner + 54 rim)`)
}
// the shore band is open from the start corner, but it does not lead round into the unbought squares
{
  const world = terrainWorld(plotShape(START))
  const lc = createLoco(-GRID_HALF - 6, plotHeightAt(-GRID_HALF - 6, 0), 0)
  for (let t = 0; t < 60 * 8; t++) tickLocomotion(lc, input({ mvX: 1, mvZ: 0, fwdX: 1, fwdZ: 0 }), world)
  ok(lc.px < -GRID_HALF + 0.5, `mist: walked off the shore band into an unbought square (x ${lc.px.toFixed(1)})`)
}
// owning the whole grid, walking off the edge is a FALL below FALL_Y (the fold takes you home)
{
  const all = new Set<string>(); for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) all.add(sqId(i, j))
  ok(mistWalls(all).length === 0, 'mist: walls left when the whole grid is held')
  const world = terrainWorld(plotShape(all))
  const c = squareCentre(7, GRID - 1)
  const lc = createLoco(c.x, plotHeightAt(c.x, c.z), c.z)
  let fell = false
  for (let t = 0; t < 60 * 15 && !fell; t++) { tickLocomotion(lc, input({ mvX: 0, mvZ: 1, fwdX: 0, fwdZ: 1 }), world); if (lc.py < FALL_Y) fell = true }
  ok(fell, `plot: walking south off the full garden never fell (z ${lc.pz.toFixed(1)}, y ${lc.py.toFixed(1)})`)
}
// the gate and Greg are in reach from the threshold
{
  const world = terrainWorld(plotShape(START))
  for (const [n, p, r] of [['greg', GREG, REACH]] as const) {
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
  // every plant below stands in its own settlement unless a test says otherwise (the settlement rule is tested on its own)
  const at = (x: number, z: number, biome: number, o: Partial<{ grounded: boolean; swimming: boolean; tile: string; settlement: string | null }> = {}) =>
    ({ tile: 'first-wilds', x, z, biome: biome as 0, grounded: true, swimming: false, settlement: `s-${o.tile ?? 'first-wilds'}-${x}-${z}`, ...o })
  let list: Waymark[] = []
  // ★ Alex 11-18: only inside a settlement, one per settlement
  ok(!canPlant(list, at(0, 0, BIOME.woods, { settlement: null })).ok, 'waymark: planted outside any settlement')
  ok(!canPlant(plant(list, { tile: 'first-wilds', x: 500, y: 1, z: 500, biome: BIOME.woods, settlement: 's1-3' }), at(0, 0, BIOME.meadow, { settlement: 's1-3' })).ok, 'waymark: a second one in the same settlement')
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
  // THE SPREAD'S LEDGER (M121: which sections turn again = spread-map.test.ts)
  {
    const s0 = freshSpread(1000)
    ok(infectedIds(s0, nodes).length === nodes.length, 'spread: the Wilds do not start fully infested')
    let all = s0; for (const n of nodes) all = clearAt(all, n.id, 1001)
    ok(infectedIds(all, nodes).length === 0, 'spread: clearing every node left one infected')
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
  const mine = squareCentre(1, GRID - 2), mist = squareCentre(GRID - 1, 0), voidPt = [pp.extent - 2, pp.extent - 2]
  const lum = (c: number[]) => c[0] + c[1] + c[2]
  ok(at(mine.x + 3, mine.z + 3)[1] > at(mine.x + 3, mine.z + 3)[2] + 20, 'plot plate: a held square is not green')
  const sat = (c: number[]) => Math.max(...c) - Math.min(...c)   // the mist is PALE (washed out), held ground is vivid; brightness alone depends on the slope's light
  ok(sat(at(mist.x + 3, mist.z + 3)) < sat(at(mine.x + 3, mine.z + 3)) * 0.5, 'plot plate: an unbought square is not under the pale mist')
  ok(lum(at(voidPt[0], voidPt[1])) < 120, 'plot plate: the corner past the island is not the void')
  const more = plotPlatePixels(new Set([...owned, sqId(3, GRID - 1)]))
  ok(more.px.some((v, k) => v !== pp.px[k]), 'plot plate: buying a square does not change the map')
}

// ── garden clusters (Alex 11-15: "the clouds hide the expansion; once a friend joins, the communal space opens";
//    the layout is his sketch: a square in the middle, a # of streets, every garden's gate corner on a crossroads) ──
{
  const own = new Set(STARTING_SQUARES)
  // BETA M52 (Alex 11-20): the Green is always there. Alone = the square, my path, three OPEN SPOTS (level mown ground, no
  // stand-in gardens), and the one gate in the square's centre
  for (const alone of [clusterFrame('ne', [{ quarter: 'ne', name: 'me', owned: [...own] }]), clusterFrame(null, [])]) {
    ok(alone.linked && !!alone.middle && !!alone.meadow && alone.mates.length === 0 && alone.open.length === 3, `cluster: alone, the Green is not drawn with three open spots (${alone.open.length})`)
    ok(Math.abs(clusterGround(alone, -D, D) - 2) < 0.01, 'cluster: alone, the square is not level ground')
    for (const sp of alone.open) {
      ok(Math.abs(clusterGround(alone, sp.x, sp.z) - 2) < 0.01 && Math.abs(clusterGround(alone, sp.x + 40, sp.z - 30) - 2) < 0.01, `cluster: the open spot ${sp.where} is not level ground`)
      ok(alone.meadow!.kind[Math.floor((sp.z - alone.meadow!.z0) / 4) * (alone.meadow!.n - 1) + Math.floor((sp.x - alone.meadow!.x0) / 4)] === 3, `cluster: the open spot ${sp.where} is not marked as one`)
    }
    ok(alone.paths.length === 4, 'cluster: alone, a path is missing (mine + one per open spot)')
  }
  // the one gate: the Green's centre, where every path meets, the same spot in every keeper's frame
  ok(GATE.x === -D && GATE.z === D, `cluster: the gate is not in the Green's centre (${GATE.x}, ${GATE.z})`)
  const f = clusterFrame('ne', [{ quarter: 'ne', name: 'me', owned: [...own] }, { quarter: 'sw', name: 'pal', owned: [...own] }])
  ok(f.linked && !!f.middle && !!f.meadow && f.mates.length === 1 && f.open.length === 2 && f.paths.length === 4, 'cluster: a friend joined and the frame did not link')
  ok(f.middle!.x === -D && f.middle!.z === D, 'cluster: the square is not south-west of me')
  ok(MIDDLE_HALF * 2 > 40, 'cluster: the square is too small to be a place')
  const pal = f.mates[0]
  ok(pal.x === -2 * D && pal.z === 2 * D, 'cluster: the opposite mate is not across the square')
  ok(Math.abs(clusterGround(f, f.middle!.x, f.middle!.z) - 2) < 0.01, 'cluster: the square is not level ground once linked')
  ok(Number.isFinite(clusterGround(f, pal.x, pal.z)) && mateAt(f, pal.x, pal.z) === pal, "cluster: no ground on the mate's island")
  ok(Math.abs(clusterGround(f, -2 * D, 0) - 2) < 0.01 && !mateAt(f, -2 * D, 0), 'cluster: an empty quarter is not a level open spot (M52)')
  // every view, every mate: everyone sees themselves north-east, every start corner faces the square
  const QS: Quarter[] = ['ne', 'nw', 'sw', 'se']
  const full = (mine: Quarter) => clusterFrame(mine, QS.map(q => ({ quarter: q, name: q, owned: [...own] })))
  for (const mine of QS) {
    const ff = full(mine)
    ok(ff.mates.length === 3 && new Set(ff.mates.map(m => m.where)).size === 3 && !ff.mates.some(m => m.where === 'ne'), `cluster: from ${mine}, the mates do not fill the other three corners`)
    for (const m of ff.mates) {
      const c = Math.cos(m.rot), sn = Math.sin(m.rot), gx = m.x + c * PATH_START.x + sn * PATH_START.z, gz = m.z - sn * PATH_START.x + c * PATH_START.z
      const dG = Math.hypot(gx - ff.middle!.x, gz - ff.middle!.z), dC = Math.hypot(m.x - ff.middle!.x, m.z - ff.middle!.z)
      ok(dG < dC - 150, `cluster: from ${mine}, ${m.quarter}'s start corner does not face the square (${dG.toFixed(0)} vs ${dC.toFixed(0)})`)
    }
  }
  // two views agree: if I see you one quarter-turn anticlockwise, you see me one quarter-turn clockwise
  {
    const a = clusterFrame('ne', [{ quarter: 'ne', name: 'a', owned: [] }, { quarter: 'nw', name: 'b', owned: [] }]).mates[0].where
    const b = clusterFrame('nw', [{ quarter: 'ne', name: 'a', owned: [] }, { quarter: 'nw', name: 'b', owned: [] }]).mates[0].where
    ok(a === 'nw' && b === 'se', `cluster: the two views disagree (${a} / ${b})`)
  }
  // ── the meadow (Alex 11-15: "filled in the space inbetween the gardens.. hills dividing them") ──
  {
    const ff = full('ne'), m = ff.meadow!
    const hAt = (x: number, z: number) => Math.max(plotHeightAt(x, z), clusterGround(ff, x, z))
    // every shore meets the meadow with no hole and no step: walk out of every garden in 72 directions
    let holes = 0, worstStep = 0
    for (const g of [{ x: 0, z: 0 }, ...ff.mates]) for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a)
      let prev = NaN
      for (let r = PLOT_R - 30; r <= PLOT_R + 14; r += 0.25) {
        const h = hAt(g.x + ux * r, g.z + uz * r)
        if (!Number.isFinite(h)) { holes++; break }
        if (Number.isFinite(prev)) worstStep = Math.max(worstStep, Math.abs(h - prev))
        prev = h
      }
    }
    ok(holes === 0, `meadow: ${holes} shore crossings fall into a hole (four gardens: every shore should meet the meadow)`)
    ok(worstStep < 0.2, `meadow: a ${worstStep.toFixed(2)} m step across a shore (the seam cracked)`)
    // hills divide neighbours: the ground between me and the garden to my west rises well above the paths
    const divide = meadowHeightAt(m, -D, 0)
    ok(divide > 9, `meadow: the divide between neighbours is only ${divide.toFixed(1)} m (want hills)`)
    // ... but nothing a walker meets is a wall: the open meadow's grades stay climbable almost everywhere
    let n = 0, steep = 0
    for (let z = m.z0 + 3; z < m.z0 + (m.n - 2) * 2; z += 3) for (let x = m.x0 + 3; x < m.x0 + (m.n - 2) * 2; x += 3) {
      const h0 = meadowHeightAt(m, x, z), h1 = meadowHeightAt(m, x + 1, z), h2 = meadowHeightAt(m, x, z + 1)
      if (!Number.isFinite(h0) || !Number.isFinite(h1) || !Number.isFinite(h2)) continue
      n++; if (Math.hypot(h1 - h0, h2 - h0) > 0.6) steep++
    }
    ok(steep / n < 0.03, `meadow: ${(100 * steep / n).toFixed(1)}% of the meadow is steeper than the walker climbs`)
    ok(m.trees.length > 40 && m.trees.every(t => ff.paths.every(p => pathDist(p, t.x, t.z) > PATH_W)), `meadow: ${m.trees.length} trees, or one stands on a path`)
    ok(m.trees.every(t => !inMiddle(ff, t.x, t.z)), 'meadow: a tree stands in the square')
  }
  // the paths: every one leaves its own garden's corner and they all meet in the middle of the square
  {
    const ff = full('ne')
    ok(ff.paths.length === 4 && ff.paths.every(p => Math.hypot(p.pts[p.pts.length - 1][0] - ff.middle!.x, p.pts[p.pts.length - 1][1] - ff.middle!.z) < 0.01), 'paths: they do not all meet in the middle of the square')
    // the gate stands where every path meets, in the square's centre (BETA M52), on level ground
    ok(ff.paths.every(p => Math.hypot(p.pts[p.pts.length - 1][0] - GATE.x, p.pts[p.pts.length - 1][1] - GATE.z) < 0.01), 'paths: they do not meet at the gate')
    ok(Math.abs(clusterGround(ff, GATE.x, GATE.z) - 2) < 0.01, "paths: the gate's ground is not level")
  }
  // walkable end to end: my threshold → my path → the square → their path → their threshold, no hole, no stall
  const path: [number, number][] = []
  const seg = (ax: number, az: number, bx: number, bz: number) => { for (let t = 0; t <= 1; t += 0.02) path.push([ax + (bx - ax) * t, az + (bz - az) * t]) }
  const poly = (pts: [number, number][]) => { for (let k = 1; k < pts.length; k++) seg(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]) }
  const [p0, p1] = f.paths, c = Math.cos(pal.rot), sn = Math.sin(pal.rot)
  const palHome = { x: pal.x + c * THRESHOLD.x + sn * THRESHOLD.z, z: pal.z - sn * THRESHOLD.x + c * THRESHOLD.z }
  seg(THRESHOLD.x, THRESHOLD.z, p0.pts[0][0], p0.pts[0][1]); poly(p0.pts); poly([...p1.pts].reverse()); seg(p1.pts[0][0], p1.pts[0][1], palHome.x, palHome.z)
  const hAt = (x: number, z: number) => Math.max(plotHeightAt(x, z), clusterGround(f, x, z))
  const holes = path.filter(([x, z]) => !Number.isFinite(hAt(x, z)))
  ok(holes.length === 0, `cluster: ${holes.length} holes on the walk from my plot to my friend's (first ${holes[0]?.map(v => v.toFixed(1))})`)
  let steep = 0, worst = 0
  for (let k = 1; k < path.length; k++) {
    const run = Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]) || 1, g = Math.abs(hAt(...path[k]) - hAt(...path[k - 1])) / run
    worst = Math.max(worst, g); if (g > 0.6) steep++
  }
  ok(steep === 0, `cluster: ${steep} spots on the walk steeper than 0.6 (worst ${worst.toFixed(2)}; the walker would stall)`)
  ok(onPath(f, p0.pts[12][0], p0.pts[12][1]) && onMeadow(f, p0.pts[12][0], p0.pts[12][1]) && inMiddle(f, f.middle!.x + 10, f.middle!.z - 10), 'cluster: the path, the meadow or the square do not say where they are')
  // my own way out: no mist between my threshold and my path
  const walls = mistWalls(own), blocks = (x: number, z: number) => walls.some(w => x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1)
  const outPts = path.filter(([x, z]) => Number.isFinite(plotHeightAt(x, z)))
  ok(outPts.length > 10 && outPts.every(([x, z]) => !blocks(x, z)), 'cluster: mist stands between my threshold and my path')
  // visiting: a mate's unbought squares are fenced off, turned with their island; their way in is open
  const mw = mateWalls(f)
  const mblocks = (x: number, z: number) => mw.some(w => x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1)
  ok(mw.length === 60, `cluster: a friend's corner start has ${mw.length} mist walls (want 60)`)
  ok(path.slice(-150).every(([x, z]) => !mblocks(x, z)), "cluster: mist stands between a friend's path and their threshold")
  ok(mw.every(w => mateAt(f, (w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2) === pal || Number.isFinite(clusterGround(f, (w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2))), "cluster: a friend's mist stands off their island")
  // a mate's garden is somebody else's data: only well-formed square ids get through
  ok(readGarden(gardenText(['4,4', '3,3']))?.owned.join() === '3,3,4,4', 'garden: a good snapshot did not round-trip')
  ok(readGarden('{"v":1,"owned":["9,9"]}') === null && readGarden('{"v":1,"owned":["4,4","<b>"]}') === null, 'garden: a bad square id got through')
  ok(readGarden('nope') === null && readGarden(JSON.stringify({ v: 1, owned: Array(82).fill('1,1') })) === null, 'garden: junk or an oversized garden got through')
  // a snapshot from the centred layout reads in the corner frame (the old middle 3×3 lands on the start corner)
  ok(readGarden('{"v":1,"owned":["3,3","4,4","5,5","2,4"]}')?.owned.join(' ') === '0,12 1,13 2,14', 'garden: a v1 snapshot did not shift to the corner')
  ok(readGarden('{"v":2,"owned":["0,8","2,6","3,8"]}')?.owned.join(' ') === '0,14 2,12 3,14', 'garden: a v2 (9×9 corner) snapshot did not re-anchor on the 15×15 corner')
  ok(readGarden(gardenText(['14,0', '0,14']))?.owned.join(' ') === '0,14 14,0', 'garden: a v3 snapshot with the far squares did not round-trip')
  ok(readGarden('{"v":3,"owned":["15,0"]}') === null, 'garden: a square past the 15×15 got through')
  // a local save from the centred layout: same shift, and a square pushed off the grid is refunded at its old price
  const OLD_START = ['3,3', '4,3', '5,3', '3,4', '4,4', '5,4', '3,5', '4,5', '5,5']
  const mig = migrateLegacy([...OLD_START, '4,2', '2,4'], 5)
  ok(STARTING_SQUARES.every(id => mig.owned.includes(id)) && mig.owned.includes('1,11') && mig.owned.length === 10, `garden: the old start did not land on the corner (${mig.owned})`)
  ok(mig.grey === 5 + 20, `garden: the square pushed off the grid was not refunded at its old price (grey ${mig.grey})`)
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
  // every node on the continent, in world coords
  const all = index.tiles.flatMap(t => t.nodes.map(n => ({ ...n, tile: t.name, x: n.x + t.tx * TILE_M, z: n.z + t.ty * TILE_M, gi: t.tx * SUB + n.i, gj: t.ty * SUB + n.j })))
  // the grey crosses tile seams: some neighbours sit in another tile, and every neighbour is one subsection away
  const gadj = nodeAdjacency(all), byId = new Map(all.map(n => [n.id, n]))
  const across = [...gadj.entries()].flatMap(([id, ns]) => ns.map(m => [byId.get(id)!, byId.get(m)!])).filter(([a, b]) => a.tile !== b.tile)
  ok(across.length > 50, `world: only ${across.length} neighbour links cross a tile seam`)
  ok([...gadj.entries()].every(([id, ns]) => ns.every(m => { const a = byId.get(id)!, b = byId.get(m)!; return a.biome === b.biome && Math.abs(a.gi! - b.gi!) + Math.abs(a.gj! - b.gj!) === 1 })), 'world: a continent neighbour is across a biome or more than one subsection away')
  ok(across.every(([a, b]) => Math.hypot(a.x - b.x, a.z - b.z) < 450), 'world: a seam neighbour is not actually next door')
})()

// ── forestry: the zones, the four trees, pruning (Alex 11-15: "tree nodes ... match them per biome", his zones) ────────
{
  const index = JSON.parse(readFileSync(DIR + 'tiles.json', 'utf8')) as TileIndex
  const nodes = index.tiles.flatMap(t => t.nodes)
  const ZS = ['meadows', 'thicket', 'springs', 'trails', 'arid', 'caverns']
  ok(nodes.every(n => ZS.includes((n as { zone?: string }).zone ?? '')), 'zones: a node has no zone (re-run tools/worldmap/zone_wilds.py)')
  const zc = Object.fromEntries(ZS.map(z => [z, nodes.filter(n => (n as { zone?: string }).zone === z).length]))
  ok(ZS.every(z => zc[z] > 20), `zones: a zone is (nearly) missing: ${JSON.stringify(zc)}`)
  // the rules: what grows where
  ok(treeFor('arid', 3, 1, 0) === null && treeFor('caverns', 2, 0, 0) === null, 'forestry: a tree grows in the badlands or the caverns')
  ok(treeFor('springs', 1, 0, 0)?.kind === 'starwillow' && treeFor('trails', 2, 0, 0)?.kind === 'dawnwood', 'forestry: springs are not willows or the trails not dawnwood')
  ok(treeFor('thicket', 3, 0.8, 0)?.kind === 'shimmeroak' && treeFor('thicket', 3, 0.3, 0)?.kind === 'goldwood' && treeFor('meadows', 2, 0, 0)?.kind === 'goldwood', 'forestry: the thicket or the meadows grow the wrong tree')
  // on real tiles: the start tile (the Deep Woods) carries shimmeroak; an all-badlands tile carries nothing
  const zfor = (name: string) => { const m = new Map(index.tiles.find(t => t.name === name)!.nodes.map(n => [`${n.i},${n.j}`, (n as { zone?: Zone }).zone ?? 'meadows'])); return (i: number, j: number) => m.get(`${i},${j}`) ?? 'meadows' }
  const tileOf = (name: string) => {
    const m = JSON.parse(readFileSync(DIR + name + '.json', 'utf8')) as WildsMeta
    const b = readFileSync(DIR + name + '.bin'), bio = readFileSync(DIR + name + '.biome')
    return parseWilds(m, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), zfor(name))
  }
  const start = tileOf('first-wilds'), kinds = new Set(start.trees.map(t => t.kind))
  ok(kinds.has('shimmeroak') && kinds.has('goldwood'), `forestry: the start tile's woods grow ${[...kinds]}`)
  ok(new Set(start.trees.map(t => t.id)).size === start.trees.length, 'forestry: two trees share an id (a prune would land on both)')
  const aridTile = index.tiles.find(t => t.nodes.length >= 20 && t.nodes.every(n => (n as { zone?: string }).zone === 'arid'))
  if (aridTile) ok(tileOf(aridTile.name).trees.length === 0, `forestry: trees in the badlands tile ${aridTile.name}`)
  const trailsTile = index.tiles.map(t => ({ t, n: t.nodes.filter(n => (n as { zone?: string }).zone === 'trails').length })).sort((a, b) => b.n - a.n)[0].t
  ok(tileOf(trailsTile.name).trees.some(t => t.kind === 'dawnwood'), `forestry: no dawnwood on the foothills tile ${trailsTile.name}`)
  // pruning: the node table pays, no level gate (M136), a pruned tree waits out its regrow
  _resetForestry(1)
  const now = 1_000_000
  const g = prune('goldwood', 'test:g0', () => 0, now)
  ok(g.ok && g.drops.some(d => d.id === 'goldwood_log' && d.n === 2) && g.xp === 20, 'prune: a goldwood did not pay its logs + 20 xp')
  // Alex 11-15: "a few logs and a small chance for a sapling": 2–4 logs, a sapling only under the (small) chance
  ok(g.ok && g.drops.some(d => d.id === 'goldwood_sapling'), 'prune: a roll of 0 is under the sapling chance and paid none')
  const hi = prune('goldwood', 'test:hi', () => 0.99, now)
  ok(hi.ok && hi.drops.length === 1 && hi.drops[0].id === 'goldwood_log' && hi.drops[0].n === 4, 'prune: a high roll paid a sapling or not 4 logs')
  ok(Object.values(SAPLING_CHANCE).every(c => c > 0 && c <= 0.1), 'prune: a sapling chance is not SMALL (a pruned tree regrows in minutes)')
  // BETA M6e: mast is bait's floor (a keeper out of bait with nothing landed): a roll of 0 pays one, a high roll none
  ok(g.ok && g.drops.some(d => d.id === 'mast' && d.n === 1) && hi.ok && !hi.drops.some(d => d.id === 'mast'), 'prune: mast did not drop under its chance (or dropped over it)')
  ok(MAST_CHANCE >= 0.2 && MAST_CHANCE <= 0.5, 'prune: mast is too rare to be a floor or common enough to farm')
  ok(PRUNE_RANGE === 10, 'prune: the reach is not 10 m')   // M136: what it costs is channel.test's table
  ok(!prune('goldwood', 'test:g0', () => 0, now + 1000).ok, 'prune: a pruned goldwood pruned again before it regrew')
  ok(prune('goldwood', 'test:g0', () => 0, now + 3 * 60_000).ok, 'prune: a goldwood never regrew')
  const s0 = prune('shimmeroak', 'test:s0', () => 0, now)
  ok(s0.ok, 'prune: a shimmeroak refused Forestry 1 (M136: no level gate)')
  for (let k = 1; k < 13; k++) prune('goldwood', `test:g${k}`, () => 0, now)   // + test:g0 twice + test:hi = 14 prunes
  ok(forestryLevel() === 4 && !prune('shimmeroak', 'test:s0', () => 0, now).ok, `prune: the XP of 14 goldwoods + a shimmeroak is not Forestry 4 (${forestryLevel()}), or the spent shimmeroak gave again`)
  _resetForestry(1)
}

worldDone.then(() => {
  if (fails.length) { console.error(`ather: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
  console.log(`ather: ${pass}/0`)
})
