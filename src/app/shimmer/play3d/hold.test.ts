/** The hold — round survival on three stacked floors, headless. Run: `npx tsx src/app/shimmer/play3d/hold.test.ts` */
import {
  parseLanding, startHold, stepHold, hitBody, releaseSurge, promptAt, buyGate, buyRack, buyFont, buyCache,
  mendTick, endHold, keeperBlocked, holdSurfaces, roundBlocked, roundCount, roundHp, kindFor, bodyStats,
  isLoud, heightAt, fieldStrike, ownerOpenAll, ownerCalm, holdSpots, HOLD_TUNING as T, HOLD_TILE, type HoldState, type FloodBody,
} from './hold'
import { K, STOREY, kindAt } from './hold-building'
import { getMaxPool } from '../engine/mana'
import { LEDGE_CLIMB } from './metrics'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const body = (o: Partial<FloodBody> & { id: number; x: number; z: number }): FloodBody =>
  ({ kind: 'drift', y: 0, hp: 100, maxHp: 100, speed: 2, phase: 'inside', win: 0, tearT: 0, strikeT: 1, alive: true, ...o })

// ── the tower parses into what Alex sized: three 50 × 80 floors stacked, 50 × 50 gardens off the bottom ──
const map = parseLanding()
const B = map.building
const [BOT, MID, TOP] = B.levels.map(l => l.y)
ok(B.levels.length === 3 && MID - BOT === STOREY && TOP - MID === STOREY, `three floors, a storey (${STOREY}) apart`)
const bbox = (lv: number, tone: number) => {
  let x0 = 1e9, x1 = -1, z0 = 1e9, z1 = -1
  const L = B.levels[lv]
  for (let i = 0; i < L.kind.length; i++) if (L.kind[i] !== K.VOID && L.tone[i] === tone) {
    const x = i % B.cols, z = (i / B.cols) | 0
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z)
  }
  return { x0, z0, w: x1 - x0 + 1, d: z1 - z0 + 1 }
}
const plates = [0, 1, 2].map(lv => bbox(lv, 0))
ok(plates.every(p => p.w === 50 && p.d === 80), `★ every floor is 50 × 80 (${plates.map(p => `${p.w}×${p.d}`).join(', ')})`)
ok(plates.every(p => p.x0 === plates[0].x0 && p.z0 === plates[0].z0), '★ stacked: the three floors share one footprint')
const gardens = bbox(0, 1)
ok(gardens.d === 50 && gardens.w === 150, 'the gardens are 50 deep and flank the bottom floor west and east (150 across with it)')
ok(map.start.lv === 2 && map.start.h === TOP, '★ you start on the top floor')
ok(map.exit.lv === 2 && map.grid[map.exit.z][map.exit.x] === HOLD_TILE.WARP, 'the way out is on the top floor')
ok(STOREY > LEDGE_CLIMB - 2, 'a storey is more than a climb reaches from the floor (walls fill it, so no keeper climbs out of a floor)')
ok(map.windows.every(w => w.spawnH < w.h), 'the flooded climb UP the face to every window')
ok(map.windows.every(w => kindAt(B, w.lv, Math.round(w.inside.x), Math.round(w.inside.z)) === K.FLOOR), 'every window opens onto its floor')
ok(map.gates.map(g => g.cost).join() === '250,750,1000,1000,1000', 'five gates: the stair housing 250, the cubicle farm 750, the executive wing and the gardens 1000')
ok(B.stairs.every(st => st.flights.length === 2 && st.landings.length === 1), '★ both stairs turn a corner')
ok(map.cache.room !== map.start.room, 'the draught cache is behind a gate')
ok(B.stairs.length === 2 && B.stairs.every(st => st.y1 - st.y0 === STOREY), 'two stairs, each climbing one storey')
const roofStair = B.stairs.find(st => st.lv === 1)!
ok(roofStair.flights.length === 2 && roofStair.landings.length === 1, '★ the stair to the roof turns a corner: flight, landing, flight')
ok(roofStair.flights.every(f => f.y1 > f.y0) && Math.abs(roofStair.flights[0].y1 - roofStair.landings[0].y) < 1e-6 && Math.abs(roofStair.landings[0].y - roofStair.flights[1].y0) < 1e-6, 'the landing sits exactly where one flight ends and the next begins')
ok(B.levels[2].open && !B.levels[1].open, '★ the top floor is a rooftop: open to the sky')

// ── a keeper's reach, walked by the walker's own rules: step up one, drop any, walls per floor ──
function reach(s: HoldState): { x: number; z: number; y: number }[] {
  const key = (x: number, z: number, y: number) => `${x},${z},${y}`
  const start = { x: map.start.x, z: map.start.z, y: map.start.h }
  const seen = new Set([key(start.x, start.z, start.y)]), q = [start], out = [start]
  while (q.length) {
    const c = q.shift()!
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx, z = c.z + dz
      if (keeperBlocked(s, x, z, c.y)) continue
      let best: number | null = null
      for (const su of holdSurfaces(map, x, z)) if (su.y <= c.y + 1 && (best === null || su.y > best)) best = su.y
      if (best === null || c.y - best > 1.01) continue   // no walking off a floor into the air (it is VOID below)
      const k = key(x, z, best)
      if (seen.has(k)) continue
      seen.add(k); const n = { x, z, y: best }; q.push(n); out.push(n)
    }
  }
  return out
}
{
  const s = startHold(map)
  const r0 = reach(s)
  ok(r0.every(c => c.y === TOP), '★ gates shut: the start room on the top floor is all a keeper can reach')
  for (let g = 0; g < map.gates.length; g++) s.gatesOpen[g] = true
  const r1 = reach(s)
  ok(r1.some(c => c.y === MID) && r1.some(c => c.y === BOT), '★ all gates open: the ramps walk down to the middle and bottom floors')
  ok(r1.some(c => c.x < plates[0].x0 && c.y === BOT) && r1.some(c => c.x >= plates[0].x0 + 50 && c.y === BOT), 'and out into both gardens')
}

// ── ★ walls are per floor: a wall upstairs is open floor downstairs ──
{
  let found = false
  const s = startHold(map)
  for (let i = 0; i < B.cols * B.rows && !found; i++) {
    if (B.levels[2].kind[i] === K.WALL && B.levels[1].kind[i] === K.FLOOR) {
      const x = i % B.cols, z = (i / B.cols) | 0
      found = true
      ok(keeperBlocked(s, x, z, TOP) && !keeperBlocked(s, x, z, MID), '★ the same cell: a wall on the top floor, walkable on the middle')
    }
  }
  ok(found, 'the plans have a cell that is wall above and floor below')
}

// ── what is solid to whom ──
const s0 = startHold(map)
const cw = map.windows.find(w => w.room === map.start.room)!
ok(keeperBlocked(s0, cw.cells[0].x, cw.cells[0].z, TOP), 'a keeper cannot climb out a window')
ok(!roundBlocked(s0, cw.cells[0].x, cw.cells[0].z, TOP + 1), '★ rounds pass a window — you shoot out of them')
const gA = map.gates[0]
ok(keeperBlocked(s0, gA.cells[0].x, gA.cells[0].z, gA.h) && roundBlocked(s0, gA.cells[0].x, gA.cells[0].z, gA.h + 1), 'a shut gate stops keeper and rounds')
ok(roundBlocked(s0, map.start.x, map.start.z, TOP - 0.1) && !roundBlocked(s0, map.start.x, map.start.z, TOP + 1), '★ a round into a floor slab stops; over it, it flies')
ok(!roundBlocked(s0, map.start.x, map.start.z, TOP + STOREY + 0.1), 'nothing over the rooftop — a round fired up flies')

// ── the hold's mana pool is a NEW keeper's pool — the mana skill buys nothing in here ──
ok(T.manaPool === getMaxPool(1), `the hold pool (${T.manaPool}) is a level-1 keeper's pool (${getMaxPool(1)})`)
ok(T.manaPool < getMaxPool(10), 'and below what a trained keeper carries outside')

// ── the curve ──
ok(roundCount(1) >= 5 && roundCount(1) <= 8, 'round 1 is a handful')
ok(roundCount(10) > roundCount(5) * 1.5, 'the count climbs')
ok(roundHp(1) === 14 && roundHp(2) === 21, 'round 1 = two sidearm rounds, round 2 = three')
ok(roundHp(12) > roundHp(9) * 1.3, 'past 9 hp compounds')
ok([...Array(roundCount(2))].every((_, n) => kindFor(2, n) === 'drift'), 'no swift before round 3')
ok([...Array(roundCount(8))].some((_, n) => kindFor(8, n) === 'swift'), 'swifts by round 8')
ok([...Array(roundCount(5))].some((_, n) => kindFor(5, n) === 'bulk'), 'a bulk by round 5')
ok(bodyStats('swift', 5).speed > bodyStats('drift', 5).speed && bodyStats('bulk', 5).hp > bodyStats('drift', 5).hp, 'swift is fast, bulk is heavy')

// ── a round runs: they come from the floor below, CLIMB the face, tear, get in, and strike ──
{
  const s = startHold(parseLanding(), 7)
  const p = map.start
  let struck = 0, tore = false, climbed = false, maxY = 0
  for (let t = 0; t < 60 * 40; t++) {
    const o = stepHold(s, 1 / 60, p.x, p.z, p.h)
    struck += o.strike
    if (s.planks.some(n => n < T.seals)) tore = true
    for (const b of s.flood) { if (b.phase === 'tear' && b.y > TOP - STOREY + 1) climbed = true; maxY = Math.max(maxY, b.y) }
  }
  ok(s.flood.length > 0 && s.flood.every(b => s.map.windows[b.win].room === map.start.room), '★ only the open room spawns — its windows, nothing below')
  ok(climbed, 'a body climbs the outside face up to the sill before it tears')
  ok(tore, 'bodies tear planks off the start room\'s windows')
  ok(Math.abs(maxY - TOP) < 1e-6, 'through the window, a body stands on the top floor')
  ok(struck > 0, 'a keeper who stands still gets struck')
}
{
  const s = startHold(map)
  const p = map.start
  s.flood.push(body({ id: 1, x: p.x, z: p.z + 0.4, y: MID, strikeT: 0 }))   // on the middle floor, right under the keeper
  let struck = 0
  for (let i = 0; i < 60; i++) struck += stepHold(s, 1 / 60, p.x, p.z, TOP).strike
  ok(struck === 0, '★ a body a floor below does not strike a keeper above, however close on the map')
  ok(Math.abs(s.flood[0].y - MID) < 1e-6, 'and it stays on its floor — through the ceiling is not a way up')
}

// ── a keeper who kills everything clears rounds and the curve climbs ──
function autoplay(seed: number, secs: number, surge = false): HoldState {
  const s = startHold(parseLanding(), seed)
  const p = map.start
  for (let t = 0; t < secs * 60; t++) {
    stepHold(s, 1 / 60, p.x, p.z, p.h)
    if (t % 10 === 0) {
      const tgt = s.flood.filter(b => b.alive).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]
      if (tgt) hitBody(s, tgt.id, 10, false)
    }
    if (surge && s.surge >= 1) releaseSurge(s, p.x, p.z, p.h)
  }
  return s
}
{
  const s = autoplay(3, 240)
  ok(s.round >= 4, `a sharp keeper reaches round 4+ in 4 minutes (got ${s.round})`)
  ok(s.salvage > 500 + s.kills * T.salvageKill * 0.9, 'kills pay salvage')
  const again = autoplay(3, 240)
  ok(again.round === s.round && again.kills === s.kills && again.salvage === s.salvage, '★ deterministic: same seed, same run')
  const trace = (h: HoldState) => h.flood.map(b => `${b.win}:${b.x.toFixed(3)}`).join('|')
  ok(trace(again) === trace(s) && trace(s).length > 0, '★ deterministic down to which window each body came from')
  ok(trace(autoplay(4, 240)) !== trace(s), 'a different seed is a different run')
}

// ── salvage buys ──
{
  const s = startHold(parseLanding())
  ok(!buyGate(s, 2), '500 salvage cannot open a garden gate')
  ok(s.salvage === 500, 'a refused buy spends nothing')
  ok(buyGate(s, 0) && gA.opens.every(r => s.rooms[r]) && s.salvage === 250, '★ the first gate opens both its rooms for 250 on starting salvage')
  ok(!keeperBlocked(s, gA.cells[0].x, gA.cells[0].z, gA.h), 'an open gate is walkable')
  ok(!buyGate(s, 0), 'an open gate cannot be bought twice')
  ok(!buyGate(s, 1), '250 left cannot open the 750 gate')
  s.salvage = 1000
  ok(buyGate(s, 1) && s.salvage === 250, 'the next gate opens for 750')
  s.salvage = 2000
  ok(buyRack(s) === 'weapon' && buyRack(s) === 'refill', 'the rack sells the weapon, then refills it')
  ok(s.salvage === 2000 - T.rackCost - T.rackCost / 2, 'refill is half price')
  ok(buyFont(s), 'the font sells mana')
  const h = s.hush
  ok(buyCache(s) && s.hush === h + T.cacheSec, 'the cache buys hush')
  const s2 = startHold(parseLanding()); s2.salvage = 5000
  ok(!buyCache(s2), 'the cache sits behind a gate — shut gate, no cache')
}

// ── prompts follow where you stand, on your floor ──
{
  const s = startHold(parseLanding())
  const P = (x: number, z: number) => promptAt(s, x, z, heightAt(s, x, z))
  ok(P(map.start.x, map.start.z) === null, 'nothing to do where you start')
  ok(P(gA.mid.x, gA.mid.z + 1)?.kind === 'gate', 'by the first gate → the gate')
  const below = promptAt(s, gA.mid.x, gA.mid.z + 1, gA.h - STOREY)
  ok(!(below?.kind === 'gate' && below.gate === gA.id), '★ a gate a floor up does not prompt from below (the floor below may have its own)')
  ok(P(map.rack.x, map.rack.z)?.kind === 'rack', 'at the rack → the rack')
  ok(P(map.font.x, map.font.z)?.kind === 'font', 'at the font → the font')
  ok(P(cw.inside.x, cw.inside.z) === null, 'a full window asks for nothing')
  s.planks[cw.id] = 2
  const pr = P(cw.inside.x, cw.inside.z)
  ok(pr?.kind === 'mend' && pr.win === cw.id, 'a torn window asks to be mended')
}

// ── mending pays, up to the round's cap ──
{
  const s = startHold(parseLanding())
  s.planks[cw.id] = 0
  let planks = 0
  for (let i = 0; i < 600; i++) if (mendTick(s, cw.id, 1 / 60)) planks++
  ok(planks === T.seals && s.planks[cw.id] === T.seals, 'holding E mends every plank back')
  ok(s.salvage === 500 + T.salvageMend * T.seals, 'each plank pays')
  s.planks.fill(0)
  for (let i = 0; i < 6000; i++) for (const w of s.map.windows) mendTick(s, w.id, 1 / 60)
  ok(s.mendPaidThisRound === T.mendSalvageCap, '★ mend salvage caps per round — no plank farm')
}

// ── the surge ──
{
  const s = startHold(parseLanding())
  const p = map.start
  s.flood.push(body({ id: 900, x: p.x + 1, z: p.z, y: p.h, hp: 200, maxHp: 200 }))
  s.flood.push(body({ id: 901, x: p.x, z: p.z + 1, y: MID, hp: 200, maxHp: 200 }))
  ok(releaseSurge(s, p.x, p.z, p.h).hit === 0, 'no surge without a full charge')
  s.surge = 1
  const r = releaseSurge(s, p.x, p.z, p.h)
  const b = s.flood.find(f => f.id === 900)!
  ok(r.hit === 1 && b.hp === 200 - T.surgeDamage, 'a full surge strikes what is close — on your floor only')
  ok(b.x > p.x + 1.5, 'and throws it back')
  ok(s.surge === 0, 'and spends the charge')
  for (let k = 0; k < T.surgeKills; k++) {
    s.flood.push(body({ id: 1000 + k, x: 5, z: 5, hp: 1, maxHp: 1 }))
    hitBody(s, 1000 + k, 5, false)
  }
  ok(s.surge === 1, `${T.surgeKills} kills charge a full surge`)
  const auto = autoplay(11, 300, true)
  ok(auto.round >= autoplay(11, 300, false).round, 'a keeper who surges does no worse')
}

// ── fields: the nearest few, on the field's floor ──
{
  const s = startHold(parseLanding())
  const p = map.start
  for (let k = 0; k < 4; k++) s.flood.push(body({ id: 60 + k, x: p.x + k * 0.2, z: p.z, y: TOP }))
  s.flood.push(body({ id: 70, x: p.x, z: p.z + 0.3, y: MID }))
  ok(fieldStrike(s, p.x, p.z, 3, 10, TOP) === T.fieldFullTargets, 'a field strikes its cap of bodies')
  ok(s.flood.find(b => b.id === 70)!.hp === 100, 'and never one a floor below')
}

// ── boosters: the glimmer of hope ──
{
  const s = startHold(parseLanding(), 21)
  const p = map.start
  let n = 0
  for (let k = 0; k < 400; k++) {
    s.flood.push(body({ id: 5000 + k, x: p.x + 3, z: p.z, y: p.h, hp: 1, maxHp: 1 }))
    hitBody(s, 5000 + k, 5, false)
    n = s.drops.length
  }
  ok(n === T.dropCap && s.dropsThisRound === T.dropCap, `★ boosters cap per round (${n} of ${T.dropCap})`)
  ok(s.drops.every(d => d.kind === 'glimmer' && d.y === p.h), 'the booster is the Glimmer of Hope, on the floor it fell on')
  s.drops[1].x -= 5
  stepHold(s, 1 / 60, s.drops[0].x, s.drops[0].z, p.h)
  ok(s.pickups.length === 1 && s.pickups[0] === 'glimmer', 'walking over it takes it — queued for the host')
  ok(s.drops.length === T.dropCap - 1, 'and it is gone from the floor')
  stepHold(s, 1 / 60, s.drops[0].x, s.drops[0].z, MID)
  ok(s.drops.length === T.dropCap - 1, 'a keeper a floor away does not take it')
  for (let i = 0; i < 60 * (T.dropTtl + 1); i++) stepHold(s, 1 / 60, p.x, p.z, p.h)
  ok(s.drops.length === 0, 'an untaken booster fades')
  const s2 = startHold(parseLanding(), 22)
  s2.rng = () => 0
  const w = s2.map.windows[0]
  s2.flood.push(body({ id: 7000, x: w.spawn.x, z: w.spawn.z, y: w.spawnH, hp: 1, maxHp: 1, phase: 'tear', win: w.id }))
  hitBody(s2, 7000, 5, false)
  ok(s2.drops[0]?.x === w.inside.x && s2.drops[0]?.z === w.inside.z && s2.drops[0]?.y === w.h, '★ a kill on the face drops just inside its window, on the sill\'s floor')
}

// ── the hush runs out → loud ──
{
  const s = startHold(parseLanding())
  s.hush = 0.05
  let loud = false
  for (let i = 0; i < 10; i++) loud = stepHold(s, 1 / 60, map.start.x, map.start.z, map.start.h).wentLoud || loud
  ok(loud && isLoud(s), 'the draught runs out → the keeper is LOUD')
  const before = s.flood.length
  for (let i = 0; i < 60 * 3; i++) stepHold(s, 1 / 60, map.start.x, map.start.z, map.start.h)
  ok(s.flood.length - before >= 8, '★ loud = they rush (spawns every 0.3s)')
  ok(s.flood.slice(before).every(b => b.kind === 'swift'), 'and every one of them is swift')
}

// ── the owner's layout-walk shortcuts ──
{
  const s = startHold(parseLanding(), 9)
  for (let i = 0; i < 60 * 20; i++) stepHold(s, 1 / 60, map.start.x, map.start.z, map.start.h)
  ownerOpenAll(s)
  ok(s.gatesOpen.every(Boolean) && map.rooms.every(r => s.rooms[r]), 'open-all: every gate open, every room awake')
  ok(reach(s).some(c => c.y === BOT), 'open-all: the bottom floor is walkable from the roof')
  ownerCalm(s)
  for (let i = 0; i < 60 * 30; i++) stepHold(s, 1 / 60, map.start.x, map.start.z, map.start.h)
  ok(s.flood.length === 0 && !isLoud(s), 'calm: nothing comes, and the keeper never goes loud')
  const spots = holdSpots(map)
  ok(spots.length === 5 && new Set(spots.map(p => p.y)).size === 3, 'five jump spots across the three floors')
  ok(spots.every(p => holdSurfaces(map, p.x, p.z).some(su => su.y === p.y)), 'every jump spot stands on a floor')
}

// ── the end ──
{
  const s = autoplay(5, 60)
  const r = endHold(s)
  ok(!s.running && s.over && r.round === s.round, 'endHold stops the run and returns the record')
  const k = s.flood.length
  stepHold(s, 1, map.start.x, map.start.z, map.start.h)
  ok(s.flood.length === k, 'a finished run does not step')
}

console.log(`hold: ${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
