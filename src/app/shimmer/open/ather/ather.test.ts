// The Ather side: the home plot, the station, the Wilds tile, waymarks. Run: npx tsx src/app/shimmer/open/ather/ather.test.ts

import { readFileSync } from 'fs'
import { createLoco, tickLocomotion, type LocoInput } from '../../voxel3d/locomotion'
import { terrainWorld } from '../terrain-world'
import { parseWilds, BIOME, type WildsMeta } from './wilds'
import {
  PLOT_SHAPE, PLOT_N, PLOT_CELL, PLOT_HALF, THRESHOLD, FALL_Y, STATION, SOCKET_REACH, SOCKET_ARC_R, WILDS_SOCKETS,
  plotHeightAt, plotVertexHeight, plotCellIsLand, stationSockets, edgeR,
} from './plot'
import { canPlant, plant, lift, reachedBiomes, waymarkForSocket, GREG_WAYMARK, PER_BIOME, MIN_SPACING, MAX_WAYMARKS, type Waymark } from './waymarks'

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
{
  let worst = 0, land = 0
  for (let j = 0; j < PLOT_N; j++) for (let i = 0; i < PLOT_N; i++) {
    if (!plotCellIsLand(i, j)) continue
    land++
    const x = i * PLOT_CELL - PLOT_HALF, z = j * PLOT_CELL - PLOT_HALF
    worst = Math.max(worst, Math.abs(plotHeightAt(x + 1e-4, z + 1e-4) - plotVertexHeight(i, j)))
  }
  ok(worst < 0.01, `plot: heightAt off a vertex by ${worst.toFixed(4)}`)
  const area = land * PLOT_CELL * PLOT_CELL
  ok(area > 2200 && area < 3600, `plot: ${area.toFixed(0)} m² of land (want ~2800, a 30 m island)`)
}
ok(plotHeightAt(0, 0) > 0 && plotHeightAt(THRESHOLD.x, THRESHOLD.z) > 0, 'plot: no land at the centre or the threshold')
ok(plotHeightAt(0, -(edgeR(-Math.PI / 2) + 2)) === -Infinity, 'plot: land past the north shore')
// the edge is a FALL, and the fall goes below FALL_Y (where the page returns you home)
{
  const world = terrainWorld(PLOT_SHAPE)
  const lc = createLoco(THRESHOLD.x, plotHeightAt(THRESHOLD.x, THRESHOLD.z), THRESHOLD.z)
  let fell = false
  for (let t = 0; t < 60 * 12 && !fell; t++) {
    tickLocomotion(lc, input({ mvX: 0, mvZ: 1, fwdX: 0, fwdZ: 1 }), world)
    if (lc.py < FALL_Y) fell = true
  }
  ok(fell, `plot: walking south off the threshold never fell (at z ${lc.pz.toFixed(1)}, y ${lc.py.toFixed(1)})`)
}
// the station: a half-circle facing the threshold, one gate in the centre, sockets reachable on foot
{
  const s = stationSockets()
  const gates = s.filter(x => x.cls === 'gate')
  ok(gates.length === 1, `station: ${gates.length} gates (canon: exactly one)`)
  ok(s.filter(x => x.cls === 'wilds').length === WILDS_SOCKETS, 'station: wrong number of Wilds sockets')
  ok(s.every(x => x.z <= gates[0].z + 0.01 || x.cls !== 'gate') && s.every(x => x.z >= STATION.z - SOCKET_ARC_R - 0.01 && Math.hypot(x.x - STATION.x, x.z - STATION.z) < SOCKET_ARC_R + 0.01), 'station: sockets off the arc')
  // every socket is closer to the threshold-facing side than the station's back: the arc OPENS toward the threshold
  ok(s.every(x => x.cls === 'gate' || x.z > gates[0].z), 'station: arc opens away from the threshold')
  // left arc (Wilds) is −x as seen from the threshold, right arc +x
  ok(s.filter(x => x.cls === 'wilds').every(x => x.x < 0), 'station: a Wilds passage on the right arc')
  ok(s.filter(x => x.cls === 'chord' || x.cls === 'landing').every(x => x.x > 0), 'station: a chord/landing on the left arc')
  // no two sockets so close that standing at one reaches another
  let minD = Infinity
  for (const a of s) for (const b of s) if (a !== b) minD = Math.min(minD, Math.hypot(a.x - b.x, a.z - b.z))
  ok(minD > SOCKET_REACH, `station: two sockets ${minD.toFixed(2)} m apart (reach ${SOCKET_REACH})`)
  // each socket sits on land, and a walker can reach it from the threshold (walk straight at it)
  const world = terrainWorld(PLOT_SHAPE)
  for (const k of s) {
    ok(plotHeightAt(k.x, k.z) > -1, `station: socket ${k.id} off the island`)
    const lc = createLoco(THRESHOLD.x, plotHeightAt(THRESHOLD.x, THRESHOLD.z), THRESHOLD.z)
    let best = Infinity
    for (let t = 0; t < 60 * 10; t++) {
      const dx = k.x - lc.px, dz = k.z - lc.pz, d = Math.hypot(dx, dz)
      best = Math.min(best, d)
      if (d < 0.6) break
      tickLocomotion(lc, input({ mvX: dx / d, mvZ: dz / d, fwdX: dx / d, fwdZ: dz / d }), world)
    }
    ok(best < SOCKET_REACH, `station: walker could not reach socket ${k.id} (closest ${best.toFixed(2)} m)`)
  }
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
  ok(!canPlant(list, at(0, 0, BIOME.rock, { tile: 'zzz' })).ok, 'waymark: station limit not enforced')
  ok(waymarkForSocket(list, 0) === GREG_WAYMARK && waymarkForSocket(list, 1) === list[0], 'waymark: socket order')
  ok(waymarkForSocket(list, WILDS_SOCKETS) === null, 'waymark: a socket past the arc')
  ok(lift(list, list[0].id).length === list.length - 1, 'waymark: lift')
}

if (fails.length) { console.error(`ather: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`ather: ${pass}/0`)
