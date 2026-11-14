// The Ather side: the home plot and its garden grid, the Wilds tile, waymarks. Run: npx tsx src/app/shimmer/open/ather/ather.test.ts

import { readFileSync } from 'fs'
import { createLoco, tickLocomotion, type LocoInput } from '../shared/locomotion'
import { terrainWorld } from '../terrain-world'
import { parseWilds, tileCentreWorld, walkableIn, BIOME, type WildsMeta } from './wilds'
import {
  plotShape, PLOT_N, PLOT_CELL, PLOT_HALF, THRESHOLD, FALL_Y, GATE, GREG, REACH, GRID, SQ, GRID_HALF,
  STARTING_SQUARES, RING_PAGES, RING_COST, GRIMOIRE_SIZE, plotHeightAt, plotVertexHeight, plotCellIsLand,
  squareAt, squareCentre, ringOf, sqId, canBuy, mistWalls,
} from './plot'
import { newCombat, stepCombat, spawnHollow, fire, populate, KEEPER_HP, SHAMBLER, BODY_Y } from './combat'
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
ok(STARTING_SQUARES.length === 9 && STARTING_SQUARES.every(id => { const [i, j] = id.split(',').map(Number); return ringOf(i, j) === 0 }), 'grid: the start is not the middle 3×3')
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
  const [ci, cj] = [4, 4]
  ok(!canBuy(START, ci, cj - 2, 9, 999).ok, 'buy: ring 1 sold before 10 pages')
  const v = canBuy(START, ci, cj - 2, 10, 999)
  ok(v.ok && v.cost === RING_COST[1], 'buy: ring 1 refused at 10 pages')
  ok(!canBuy(START, ci, cj - 2, 10, RING_COST[1] - 1).ok, 'buy: sold without enough grey matter')
  ok(!canBuy(START, ci, cj - 3, 99, 999).ok, 'buy: sold a square touching nothing you hold')
  const more = new Set([...START, sqId(ci, cj - 2)])
  ok(!canBuy(more, ci, cj - 3, 14, 999).ok, 'buy: ring 2 sold before 15 pages')
  ok(canBuy(more, ci, cj - 3, 15, 999).ok, 'buy: ring 2 refused at 15 pages')
  ok(RING_PAGES.join() === '0,10,15,25', 'buy: the grimoire tiers moved')
  ok(GRIMOIRE_SIZE(0) === 10 && GRIMOIRE_SIZE(10) === 15 && GRIMOIRE_SIZE(15) === 25 && GRIMOIRE_SIZE(30) === 25, 'grimoire: capacity 10 → 15 → 25')
}
// mist is a wall: from the threshold, walking north past the starting ground stops at the mist
{
  const world = terrainWorld(plotShape(START))
  const lc = createLoco(THRESHOLD.x + 4, plotHeightAt(THRESHOLD.x + 4, THRESHOLD.z), THRESHOLD.z)
  for (let t = 0; t < 60 * 12; t++) tickLocomotion(lc, input({ mvX: 0, mvZ: -1, fwdX: 0, fwdZ: -1 }), world)
  const edge = -1.5 * SQ
  ok(lc.pz > edge - 0.5 && lc.pz < edge + 2, `mist: walker ended at z ${lc.pz.toFixed(1)} (mist at ${edge})`)
  ok(mistWalls(START).length === 12, `mist: ${mistWalls(START).length} wall segments round the 3×3 (want 12)`)
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

if (fails.length) { console.error(`ather: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`ather: ${pass}/0`)
