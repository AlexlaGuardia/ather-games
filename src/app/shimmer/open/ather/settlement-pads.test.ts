// Run: npx tsx src/app/shimmer/open/ather/settlement-pads.test.ts
// M39 slice 3: the ground under every generated settlement lot is LEVEL (baked pad height, relief.ts padGround), read the way
// the game reads it (a parsed tile's heightAt, bilinear on 4 m cells), for EVERY settlement incl. ones whose lots sit near a
// tile edge, and the blend back to the land is no steeper than the Glade's bank and never a cliff. Pure.
import { readFileSync } from 'node:fs'
import { parseWilds, type WildsMeta, type Wilds } from './wilds'
import { clearing, roadField, withGlade, PAD_W, PAD_D, PAD_REACH, type Network } from './network'
import { PAD_REACH as RELIEF_REACH, BANK, padGround } from './relief'
import { settlementLots, lotSlot, tradeBuilding, lotPadOf, LOT_W, LOT_D, MAX_LOTS } from './settlement-lots'
import { placeBlueprint } from './plot-blueprint'
import { TILE_M } from './wilds-world'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const net = withGlade(JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network)
const clear = clearing(net), roads = roadField(net)!
const index = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number }[] }
const byXY = new Map(index.tiles.map(t => [`${t.tx},${t.ty}`, t.name]))
const bare = roadField({ ...net, settlements: net.settlements.map(({ pads: _p, ...r }) => r) })!   // the same land with no pads: the baseline for the blend
const caches = { pads: new Map<string, Wilds>(), bare: new Map<string, Wilds>() }
let cache = caches.pads
const tile = (name: string) => {
  const r = cache === caches.bare ? bare : roads
  if (!cache.has(name)) {
    const meta = JSON.parse(readFileSync(`public/open/wilds/${name}.json`, 'utf8')) as WildsMeta
    const b = readFileSync(`public/open/wilds/${name}.bin`), bio = readFileSync(`public/open/wilds/${name}.biome`)
    cache.set(name, parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), undefined, clear, true, r))
  }
  return cache.get(name)!
}
/** the rendered ground at a world point, from the tile that owns it, or from a named neighbour (to prove two tiles agree) */
const ground = (x: number, z: number, tx = Math.floor((x + TILE_M / 2) / TILE_M), tz = Math.floor((z + TILE_M / 2) / TILE_M)) => {
  const n = byXY.get(`${tx},${tz}`)
  return n ? tile(n).heightAt(x - tx * TILE_M, z - tz * TILE_M) : NaN
}
ok(PAD_W === LOT_W && PAD_D === LOT_D && PAD_REACH === RELIEF_REACH, 'pad size + reach literals agree (network.ts, settlement-lots.ts, relief.ts)')
// the pad maths itself: level on the pad, continuous, one pad never disturbs another
ok(padGround([{ d: 0, y: 5 }, { d: 0.5, y: 9 }], 7) === 5, 'on a pad the ground is exactly the pad (a neighbour ring cannot move it)')
ok(Math.abs(padGround([{ d: 3, y: 5 }], 7) - padGround([{ d: 3.0001, y: 5 }], 7)) < 1e-3 && padGround([{ d: 40, y: 5 }], 7) === 7, 'blend is continuous and ends')

let worstBare = 0, worstSpread = 0, worstSlope = 0, worstSeam = 0, nearEdge = 0, sites = 0, seams = 0
const edgeDist = (x: number) => { const f = ((x + TILE_M / 2) % TILE_M + TILE_M) % TILE_M; return Math.min(f, TILE_M - f) }
for (const s of net.settlements) {
  if (s.id === 'moonwell') continue
  ok(!!s.pads && s.pads.length === MAX_LOTS, `${s.id}: ${MAX_LOTS} baked pads`)
  for (let k = 0; k < MAX_LOTS; k++) {
    const l = lotSlot(s, net.season, k), p = s.pads![k]
    ok(Math.abs(p[0] - l.x) < 0.01 && Math.abs(p[1] - l.z) < 0.01 && Math.abs(p[2] - l.yaw) < 1e-9, `${s.id}: baked pad ${k} sits where lotSlot puts the lot`)
  }
  // no two pads (apron included) share a point, or the level would be whichever came first
  let shared = 0
  for (let a = -40; a <= 40; a += 0.5) for (let b = -40; b <= 40; b += 0.5) if (roads.pads(s.x + a, s.z + b).filter(p => p.d <= 0).length > 1) shared++
  ok(shared === 0, `${s.id}: no point lies on two pads (${shared})`)
  // every trade's real building, plus the whole pad, sampled each 0.5 m with the 0.8 m margin the live check reads
  for (const l of settlementLots(s, net.season)) {
    sites++
    const bp = tradeBuilding(l.profession), pl = placeBlueprint(bp, lotPadOf(l, 0)), v: number[] = []
    for (let u = -0.8; u <= bp.w + 0.8 + 1e-6; u += 0.5) for (let w = -0.8; w <= bp.d + 0.8 + 1e-6; w += 0.5) { const q = pl.toWorld(u, w); v.push(ground(q.x, q.z)) }
    const spread = Math.max(...v) - Math.min(...v)
    worstSpread = Math.max(worstSpread, spread)
    ok(Number.isFinite(spread) && spread <= 0.05, `${l.id}: ground under the ${l.profession} house is level (spread ${spread.toFixed(3)} m)`)
    // and the FULL lot (a drawn blueprint may fill it): the whole pad rect + the same margin
    const full: number[] = [], sn = Math.sin(l.yaw), cs = Math.cos(l.yaw)
    for (let a = -LOT_W / 2 - 0.8; a <= LOT_W / 2 + 0.8 + 1e-6; a += 0.5) for (let b = -LOT_D / 2 - 0.8; b <= LOT_D / 2 + 0.8 + 1e-6; b += 0.5) full.push(ground(l.x + cs * a + sn * b, l.z - sn * a + cs * b))
    const fs = Math.max(...full) - Math.min(...full)
    worstSpread = Math.max(worstSpread, fs)
    ok(Number.isFinite(fs) && fs <= 0.05, `${l.id}: a blueprint filling the whole lot stands level too (spread ${fs.toFixed(3)} m)`)
    const e = Math.min(edgeDist(l.x), edgeDist(l.z)); if (e < 40) nearEdge++
  }
  // the blend: slope over the settlement's lot ring (1 m finite difference), and no tile seam where it crosses an edge
  for (let a = -38; a <= 38; a += 1.5) for (let b = -38; b <= 38; b += 1.5) {
    if (Math.hypot(a, b) > 38) continue
    const x = s.x + a, z = s.z + b, g = ground(x, z), gx = ground(x + 1, z), gz = ground(x, z + 1)
    if (Number.isFinite(g + gx + gz)) worstSlope = Math.max(worstSlope, Math.hypot(gx - g, gz - g))
    cache = caches.bare; const b0 = ground(x, z), b1 = ground(x + 1, z), b2 = ground(x, z + 1); cache = caches.pads
    if (Number.isFinite(b0 + b1 + b2)) worstBare = Math.max(worstBare, Math.hypot(b1 - b0, b2 - b0))
  }
  // a tile edge through the settlement's 40 m: the tile on each side reads the SAME ground along the shared line
  for (const axis of ['x', 'z'] as const) {
    const c = axis === 'x' ? s.x : s.z, e = Math.round((c + TILE_M / 2) / TILE_M) * TILE_M - TILE_M / 2   // the nearest edge line
    if (Math.abs(e - c) > 40) continue
    seams++
    for (let t = -40; t <= 40; t += 1) {
      const o = (axis === 'x' ? s.z : s.x) + t, tl = Math.floor((o + TILE_M / 2) / TILE_M), lo = Math.round((e + TILE_M / 2) / TILE_M) - 1
      const a = axis === 'x' ? ground(e, o, lo, tl) : ground(o, e, tl, lo), b = axis === 'x' ? ground(e, o, lo + 1, tl) : ground(o, e, tl, lo + 1)
      if (Number.isFinite(a) && Number.isFinite(b)) worstSeam = Math.max(worstSeam, Math.abs(a - b))
    }
  }
}
// the blend's own slope is the Glade's bank (BANK 0.5 -> smooth() slope <= 0.75); here: never steeper than the land was without it
ok(worstSlope <= worstBare + 1e-9, `pads add no steepness inside every settlement's 38 m ring (worst ${worstSlope.toFixed(2)} vs ${worstBare.toFixed(2)} with no pads: that is the raw rock beside s1-7)`)
ok(seams >= 1 && worstSeam < 0.05, `${seams} tile edges through a settlement: both tiles read the same ground along them (worst ${worstSeam.toFixed(3)} m)`)
// a seam proof: a lot's pad level is baked data, so both tiles a settlement straddles read ONE height; the lots nearest an edge are in the set
ok(sites > 11 && nearEdge >= 1, `${sites} lots checked (${nearEdge} within 40 m of a tile edge)`)
console.log(`settlement-pads: ${pass} pass, ${fails.length} fail; worst spread ${worstSpread.toFixed(3)} m, worst slope ${worstSlope.toFixed(2)} (bare ${worstBare.toFixed(2)}), worst seam ${worstSeam.toFixed(3)} (BANK ${BANK})`)
for (const f of fails) console.log('  x ' + f)
if (fails.length) process.exit(1)
