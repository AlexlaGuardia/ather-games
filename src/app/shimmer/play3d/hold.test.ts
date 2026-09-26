/** The hold — round survival on three stacked floors, headless. Run: `npx tsx src/app/shimmer/play3d/hold.test.ts` */
import {
  parseLanding, startHold, stepHold, hitBody, releaseSurge, promptAt, buyGate, buyRack, buyFont, buyCache,
  mendTick, endHold, keeperBlocked, holdSurfaces, roundBlocked, roundCount, roundHp, kindFor, bodyStats,
  isLoud, heightAt, fieldStrike, ownerOpenAll, activeRooms, spawnWindows, rollChests, rollRarity, chestTick, ownerChests, CHEST_LOOT, VESSEL_PARTS_RULED, plantDevice, tuneWeapon, weaponTier, tuneCostFor, TUNE_TIERS, ownerCalm, holdSpots, HOLD_TUNING as T, HOLD_TILE, type HoldState, type FloodBody,
} from './hold'
import { K, STOREY, kindAt } from './hold-building'
import { FLOOR_W, FLOOR_D } from './hold-floors'
import { getMaxPool } from '../engine/mana'
import { LEDGE_CLIMB } from './metrics'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const body = (o: Partial<FloodBody> & { id: number; x: number; z: number }): FloodBody =>
  ({ kind: 'drift', y: 0, hp: 100, maxHp: 100, speed: 2, phase: 'inside', win: 0, tearT: 0, strikeT: 1, alive: true, ...o })

// ── the tower parses into what Alex sized (09-26): three 100 × 120 floors stacked, 60 × 100 gardens off the bottom ──
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
ok(plates.every(p => p.w === FLOOR_W && p.d === FLOOR_D && FLOOR_W === 100 && FLOOR_D === 120), `★ every floor is 100 × 120 (${plates.map(p => `${p.w}×${p.d}`).join(', ')})`)
ok(plates.every(p => p.x0 === plates[0].x0 && p.z0 === plates[0].z0), '★ stacked: the three floors share one footprint')
const gardens = bbox(0, 1)
ok(gardens.d === 100 && gardens.w === 220, `the gardens are 100 deep and flank the bottom floor west and east (220 across with it; ${gardens.w}×${gardens.d})`)
ok(map.start.lv === 2 && map.start.h === TOP, '★ you start on the top floor')
ok(map.exit.lv === 2 && map.grid[map.exit.z][map.exit.x] === HOLD_TILE.WARP, 'the way out is on the top floor')
ok(STOREY > LEDGE_CLIMB - 2, 'a storey is more than a climb reaches from the floor (walls fill it, so no keeper climbs out of a floor)')
ok(map.windows.every(w => w.spawnH < w.h), 'the flooded climb UP the face to every window')
ok(map.windows.every(w => kindAt(B, w.lv, Math.round(w.inside.x), Math.round(w.inside.z)) === K.FLOOR), 'every window opens onto its floor')
ok(map.gates.map(g => `${g.letter}${g.cost}`).join() === 'A250,E750,N750,C1000,D1000,G1000,M1000,B1250,K1500', `nine gates: north roof 250, cubicle farm + plant yard 750, gardens + executive wing + meeting rooms 1000, grand hall 1250, café 1500 (${map.gates.map(g => `${g.letter}${g.cost}`).join()})`)
ok(map.gates.filter(g => g.lv === 0 && 'BK'.includes(g.letter)).length === 2, '★ the lobby floor is three sections: elevator lobby, then B the hall, then K the café')
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
  ok(r1.some(c => c.x < plates[0].x0 && c.y === BOT) && r1.some(c => c.x >= plates[0].x0 + FLOOR_W && c.y === BOT), 'and out into both gardens')
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
  ok(!buyCache(s) && s.hush === h, 'the cache is shut until its room is')
  const gH = map.gates.findIndex(g => g.opens.includes(map.cache.room))
  s.salvage = 2000
  ok(gH >= 0 && map.gates[gH].letter === 'M' && buyGate(s, gH), 'the break room (M) opens onto the cache')
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

// ── where the tide comes in: the keeper's room + the open rooms joined to it (Zombies' active zones) ──
{
  const s = startHold(parseLanding())
  ok(s.here === map.start.room, 'the run starts in the start room')
  ok(spawnWindows(s).length > 0 && spawnWindows(s).every(w => w.room === map.start.room), '★ at the start, bodies come only at the start room\'s windows')
  ownerOpenAll(s)
  // stand inside a bottom-floor window: that room is here, and the roof is two floors away
  const low = map.windows.find(w => w.lv === 0)!
  const ix = Math.round(low.inside.x), iz = Math.round(low.inside.z)
  s.hush = 0
  for (let i = 0; i < 600; i++) stepHold(s, 0.05, ix, iz, low.h)
  ok(s.here === low.room, 'standing in a room makes it here')
  const act = activeRooms(s)
  ok(act.size >= 1 && act.size < map.rooms.length, `every gate open, still only ${act.size} of ${map.rooms.length} rooms active`)
  ok(s.flood.length > 0 && s.flood.every(b => act.has(map.windows[b.win].room)), '★ every body came in at an active room\'s window')
  ok(s.flood.every(b => map.windows[b.win].lv !== 2), '★ nothing climbs in on the roof while the keeper holds the bottom floor')
  // a room with no window of its own falls back to the nearest opened windows, never to none
  const bare = map.rooms.find(r => !map.windows.some(w => w.room === r) && !map.gates.some(g => g.opens.includes(r)))
  if (bare) { s.here = bare; ok(spawnWindows(s).length > 0, 'a windowless, gateless room still draws the nearest windows') }
}

// ── chests (Alex 09-26): every 5th round each EMPTY spot rolls 25%; rarity tilts the loot ──
{
  ok(map.chestSpots.length === 15, `15 chest spots — Alex cut 20 by a quarter (${map.chestSpots.length})`)
  ok([0, 1, 2].every(lv => map.chestSpots.some(c => c.lv === lv)), 'every floor has chest spots')
  ok(map.chestSpots.some(c => c.x < plates[0].x0) && map.chestSpots.some(c => c.x >= plates[0].x0 + FLOOR_W), 'both gardens have one')
  ok(map.chestSpots.every(c => kindAt(B, c.lv, c.x, c.z) === K.FLOOR), 'every chest spot is floor')
  const s = startHold(parseLanding())
  ok(s.chests.every(c => c === null), 'no chest at the start')
  // the round clock: nothing until round 5, then a roll
  s.hush = 99999
  let rolledAt = -1
  for (let r = 1; r <= 5; r++) {
    const before = s.chests.filter(Boolean).length
    s.flood = []; s.toSpawn = 0; s.breakT = 0.01
    stepHold(s, 0.05, map.start.x, map.start.z, map.start.h)
    if (s.chests.filter(Boolean).length > before && rolledAt < 0) rolledAt = s.round
  }
  ok(rolledAt === T.chestEvery, `★ the first chests appear on round ${T.chestEvery}, none before (first at ${rolledAt})`)
  // the odds, by count: many rolls over empty spots land near 25%
  const t = startHold(parseLanding(), 7)
  let hits = 0, tries = 0
  for (let k = 0; k < 200; k++) { t.chests = t.chests.map(() => null); hits += rollChests(t); tries += t.chests.length }
  ok(Math.abs(hits / tries - T.chestChance) < 0.03, `★ an empty spot rolls ~${T.chestChance * 100}% (${(100 * hits / tries).toFixed(1)}%)`)
  // an occupied spot never rolls: fill every spot, roll, nothing is replaced
  ownerChests(t)
  const snap = t.chests.map(c => c!.rarity).join()
  t.chests.forEach(c => { c!.openT = 0.5 })
  ok(rollChests(t, T, 1) === 0 && t.chests.map(c => c!.rarity).join() === snap && t.chests.every(c => c!.openT === 0.5), '★ an occupied spot does not roll (not even at 100%)')
  // rarity: no legendary while vessel parts are unruled
  const rs = { common: 0, rare: 0, legendary: 0 }
  const rng = (() => { let a = 99; return () => ((a = (a * 1103515245 + 12345) >>> 0) / 4294967296) })()
  for (let k = 0; k < 4000; k++) rs[rollRarity(rng)]++
  ok(VESSEL_PARTS_RULED || rs.legendary === 0, `no legendary chest until vessel parts are ruled (${rs.legendary})`)
  ok(rs.common > rs.rare && rs.rare > 0, `common outnumbers rare (${rs.common} / ${rs.rare})`)
  ok(CHEST_LOOT.rare.some(e => e.loot.kind === 'marks' && e.loot.n === 30), 'a rare chest can hold a bag of 30 Marks')
  // opening: hold E for chestOpenSec; the loot lands where it belongs
  const u = startHold(parseLanding(), 3)
  u.chests[0] = { rarity: 'rare', openT: 0 }
  ok(chestTick(u, 0, T.chestOpenSec / 2) === null && u.chests[0] !== null, 'half the hold does not open it')
  const sal = u.salvage
  const got = chestTick(u, 0, T.chestOpenSec)!
  ok(got !== null && u.chests[0] === null, '★ held long enough, it opens and the spot is empty again')
  ok(got.kind === 'marks' ? u.loot.length === 1 && u.salvage === sal : u.salvage === sal + (got.kind === 'salvage' ? got.n : 0), 'Marks go to the page, salvage lands at once')
  u.chests[1] = { rarity: 'common', openT: 0 }
  let glim = false
  for (let k = 0; k < 40 && !glim; k++) { u.chests[1] = { rarity: 'common', openT: 0 }; const l = chestTick(u, 1, 9); glim = l?.kind === 'glimmer' && u.pickups.includes('glimmer') }
  ok(glim, 'a Glimmer from a chest goes to the pickups (the page refills mana)')
  const sp = map.chestSpots[2]
  u.chests[2] = { rarity: 'common', openT: 0 }
  ok(promptAt(u, sp.x, sp.z, sp.h)?.kind === 'chest', 'standing at a chest, E offers it')
}

// ── the device (Alex 09-26, our pack-a-punch): ground zero in the lobby's café, plant once, tune per weapon, in-run only ──
{
  ok(map.zero.lv === 0, '★ ground zero is on the bottom floor')
  const kGate = map.gates.find(g => g.letter === 'K')!
  ok(kGate.opens.includes(map.zero.room), 'it stands in the café, behind K')
  ok(map.windows.some(w => w.room === map.zero.room && w.cells.length >= 7), 'the breach: a wide hole the flooded come through, in the device\'s room')
  const s = startHold(parseLanding())
  s.salvage = 99999
  ok(!plantDevice(s), '★ the device cannot be planted before its room is open')
  ok(tuneWeapon(s, 'spitter') === null, 'nothing tunes before it is planted')
  s.rooms[map.zero.room] = true
  const sal = s.salvage
  ok(plantDevice(s) && s.devicePlanted && s.salvage === sal - T.devicePlant, `planting costs ${T.devicePlant}`)
  ok(!plantDevice(s), 'it is planted once')
  ok(tuneCostFor(s, 'spitter') === T.tuneCost[0] && tuneWeapon(s, 'spitter') === 1 && weaponTier(s, 'spitter') === 1, 'tier 1: tuned')
  ok(weaponTier(s, 'lance') === 0, '★ tiers are PER WEAPON: tuning the SPITTER leaves the LANCE as it was')
  ok(tuneWeapon(s, 'spitter') === 2 && tuneCostFor(s, 'spitter') === null && tuneWeapon(s, 'spitter') === null, 'tier 2: evolved, and that is the top')
  s.salvage = 10
  ok(tuneWeapon(s, 'lance') === null && weaponTier(s, 'lance') === 0 && s.salvage === 10, 'short of salvage: nothing changes')
  ok(TUNE_TIERS[1].dmg > 1 && TUNE_TIERS[2].dmg > TUNE_TIERS[1].dmg && TUNE_TIERS[2].pierce > 1, 'each tier hits harder; the evolved one pierces')
  ok(TUNE_TIERS[2].reloadMana < TUNE_TIERS[1].reloadMana && TUNE_TIERS[1].reloadMana < 1, 'and each is cheaper on mana')
  const fresh = startHold(parseLanding())
  ok(!fresh.devicePlanted && weaponTier(fresh, 'spitter') === 0, '★ IN-RUN ONLY: a new run starts untuned, device unplanted')
  const z = map.zero
  ok(promptAt(s, z.x, z.z, z.h)?.kind === 'device', 'at ground zero, E offers the device')
}

// ── ★ under a stair is SOLID (Alex 09-26: stepping sideways into a high flight dropped him through the floor) ──
{
  const s = startHold(map)
  s.gatesOpen = s.gatesOpen.map(() => true)
  let beside = 0, blocked = 0, lowOk = 0, lows = 0, shotStops = 0
  for (const r of B.ramps) {
    const L = B.levels[r.lv]
    for (const c of r.cells) {
      const i = c.z * B.cols + c.x, sy = L.sy[i]
      const nextToFloor = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => kindAt(B, r.lv, c.x + dx, c.z + dz) === K.FLOOR)
      if (!nextToFloor) continue
      if (sy - L.y > 1.01) { beside++; if (keeperBlocked(s, c.x, c.z, L.y)) blocked++; if (roundBlocked(s, c.x, c.z, L.y + 1)) shotStops++ }
      else { lows++; if (!keeperBlocked(s, c.x, c.z, L.y)) lowOk++ }
    }
  }
  ok(beside > 0 && blocked === beside, `★ every flight cell too high to step onto is solid from the floor beside it (${blocked}/${beside})`)
  ok(shotStops === beside, 'and a round fired under it stops (the base is solid, not just the tread)')
  ok(lows > 0 && lowOk === lows, `the low end still steps on (${lowOk}/${lows})`)
  // walking the whole stair up, cell by cell, is never blocked by its own base
  let climbOk = true
  for (const st of B.stairs) {
    const L = B.levels[st.lv]
    for (const f of st.flights) for (const c of f.cells) if (keeperBlocked(s, c.x, c.z, L.sy[c.z * B.cols + c.x])) climbOk = false
    for (const l of st.landings) for (const c of l.cells) if (keeperBlocked(s, c.x, c.z, l.y)) climbOk = false
  }
  ok(climbOk, 'a keeper ON the stair is never stopped by it')
}

// ── ★ pacing (retune 09-26): a body from the spawn windows reaches a keeper mid-room in ≤ 30s at a round-5 drift ──
// Measured, not guessed: at every stage of the gate order, the keeper stands at the middle of every open room;
// the mean walking distance from the chosen windows, over the drift speed. A layout edit that makes the Hold
// slack (rooms too big for their windows) fails here.
{
  const per = map.cols * map.rows
  const mid: Record<string, { n: number; sx: number; sz: number; lv: number; cells: number[] }> = {}
  for (let n = 0; n < map.regionOf.length; n++) {
    const r = map.regionOf[n]; if (r < 0) continue
    const a = (mid[map.rooms[r]] ??= { n: 0, sx: 0, sz: 0, lv: (n / per) | 0, cells: [] })
    const c = n % per; a.n++; a.sx += c % map.cols; a.sz += (c / map.cols) | 0; a.cells.push(n)
  }
  const centre = (a: typeof mid[string]) => {
    const cx = a.sx / a.n, cz = a.sz / a.n
    let best = a.cells[0], bd = 1e9
    for (const n of a.cells) { const c = n % per, d = (c % map.cols - cx) ** 2 + (((c / map.cols) | 0) - cz) ** 2; if (d < bd) { bd = d; best = n } }
    return { x: (best % per) % map.cols, z: ((best % per) / map.cols) | 0 }
  }
  const speed = bodyStats('drift', 5).speed
  const worst: string[] = []
  let nearest = true
  for (let k = 0; k <= map.gates.length; k++) {
    const s = startHold(map); s.hush = 1e9
    for (let g = 0; g < k; g++) { s.gatesOpen[g] = true; for (const r of map.gates[g].opens) s.rooms[r] = true }
    const ds: number[] = []
    for (const [id, a] of Object.entries(mid)) {
      if (!s.rooms[id] || a.n <= 30) continue
      const c = centre(a)
      stepHold(s, 0.01, c.x, c.z, B.levels[a.lv].y)
      s.here = id
      const chosen = spawnWindows(s)
      const d = (w: typeof chosen[number]) => s.field[w.lv * per + Math.round(w.inside.z) * map.cols + Math.round(w.inside.x)]
      for (const w of chosen) if (d(w) >= 0) ds.push(d(w))
      const act = activeRooms(s), rest = map.windows.filter(w => act.has(w.room) && !chosen.includes(w))
      if (rest.some(w => d(w) >= 0 && chosen.some(c2 => d(c2) > d(w)))) nearest = false
    }
    const sec = ds.reduce((x, y) => x + y, 0) / Math.max(1, ds.length) / speed
    worst.push(`${k ? map.gates[k - 1].letter : 'start'} ${sec.toFixed(0)}s`)
    ok(sec <= 30, `★ pacing: after ${k ? 'gate ' + map.gates[k - 1].letter : 'the start'}, a body reaches a keeper mid-room in ${sec.toFixed(1)}s (≤ 30)`)
  }
  ok(nearest, '★ the chosen windows are the NEARER ones: no unchosen active window is closer than a chosen one')
  ok(bodyStats('drift', 1).speed < 6.5 && bodyStats('swift', 20).speed < 6.5, 'the keeper (6.5) still outruns every body')
  console.log('  pacing:', worst.join(' · '))
}

// ── ★ THE BROKEN FLOOR (Alex 09-26): the office's collapse drops into the elevator lobby; one way, for everyone ──
{
  const per = B.cols * B.rows
  const hole: { x: number; z: number }[] = []
  const P = plates[1]
  for (let z = P.z0 + 1; z < P.z0 + P.d - 1; z++) for (let x = P.x0 + 1; x < P.x0 + P.w - 1; x++) {
    if (kindAt(B, 1, x, z) === K.VOID && kindAt(B, 0, x, z) === K.FLOOR && !B.stairs.some(st => st.lv === 0 && [...st.flights, ...st.landings].some(f => f.cells.some(c => c.x === x && c.z === z)))) hole.push({ x, z })
  }
  ok(hole.length === 21, `a 7 × 3 hole in the office floor over the lobby floor (${hole.length} cells)`)
  const h = hole[10]
  const s0 = startHold(map)
  ok(!keeperBlocked(s0, h.x, h.z, MID), 'a keeper walks straight into it')
  // the walker stands on the highest surface at most a step over its feet (segs-collision › resolveStand); the roof is overhead
  const under = holdSurfaces(map, h.x, h.z).filter(q => q.y <= MID + 1).sort((p, q) => q.y - p.y)[0]
  ok(under?.y === BOT, `★ from the office, the floor there is the lobby's, a storey down: they fall and land (${under?.y})`)
  const upRoom = map.rooms[map.regionOf[1 * per + h.z * B.cols + h.x - 8]], downRoom = map.rooms[map.regionOf[0 * per + h.z * B.cols + h.x]]
  ok(!!upRoom && !!downRoom && upRoom !== downRoom, `the hole does not join the rooms (${upRoom} over ${downRoom})`)
  // falling in wakes the room below; its gate stays shut
  const s = startHold(map)
  const gE = map.gates.findIndex(g => g.letter === 'E'), gG = map.gates.findIndex(g => g.letter === 'G')
  for (const gi of [0, gE]) { s.gatesOpen[gi] = true; for (const r of map.gates[gi].opens) s.rooms[r] = true }
  ok(!s.rooms[downRoom], 'before the fall, the room below is shut')
  s.hush = 1e9
  stepHold(s, 0.05, h.x, h.z, BOT)
  ok(s.rooms[downRoom] && s.fell === downRoom && !s.gatesOpen[gG], '★ landing in it wakes it (its windows spawn, its chests are yours) — the G gate stays shut')
  // the flooded follow you down: a body in the cubicle farm reaches the keeper below
  s.flood = [body({ id: 900, x: h.x - 8, z: h.z, y: MID, speed: 3 })]
  let minY = MID
  for (let t = 0; t < 400; t++) { stepHold(s, 0.05, h.x, h.z + 6, BOT); minY = Math.min(minY, s.flood[0].y) }
  const b0 = s.flood[0]
  ok(Math.abs(b0.y - BOT) < 0.2 && Math.hypot(b0.x - h.x, b0.z - (h.z + 6)) < 2, `★ a body upstairs drops through after the keeper (ended y ${b0.y.toFixed(1)}, ${Math.hypot(b0.x - h.x, b0.z - (h.z + 6)).toFixed(1)} away)`)
  // …and nothing climbs back up it: keeper upstairs, G shut, a body below has no way
  const u = startHold(map)
  for (const gi of [0, gE]) { u.gatesOpen[gi] = true; for (const r of map.gates[gi].opens) u.rooms[r] = true }
  u.rooms[downRoom] = true; u.hush = 1e9
  u.flood = [body({ id: 901, x: h.x, z: h.z + 4, y: BOT, speed: 3 })]
  for (let t = 0; t < 200; t++) stepHold(u, 0.05, h.x - 8, h.z, MID)
  ok(Math.abs(u.flood[0].y - BOT) < 0.2, '★ nothing climbs a broken floor: a body below stays below')
  ok(u.field[0 * per + (h.z + 4) * B.cols + h.x] === -1, 'the field says so too: no path up from the lobby with G shut')
  // no leap from a window into a garden: every window torn, every gate open, keeper in the west garden —
  // no office or roof node reaches the garden except by the building's own way down (the field's first step)
  const g = startHold(map); g.gatesOpen = g.gatesOpen.map(() => true); g.planks = g.planks.map(() => 0); g.hush = 1e9
  for (const r of map.rooms) g.rooms[r] = true
  const wg = map.chestSpots.find(c => c.x < plates[0].x0)!
  stepHold(g, 0.01, wg.x, wg.z, BOT)
  let leaps = 0
  for (const w of map.windows) if (w.lv > 0) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ox = Math.round(w.mid.x) + dx, oz = Math.round(w.mid.z) + dz
    if (kindAt(B, w.lv, ox, oz) !== K.VOID) continue
    const wf = g.field[w.lv * per + Math.round(w.mid.z) * B.cols + Math.round(w.mid.x)]
    const below = g.field[0 * per + oz * B.cols + ox]
    if (wf >= 0 && below >= 0 && wf === below + 1) leaps++
  }
  ok(leaps === 0, `★ a body never leaps out of a window into a garden (${leaps} window-to-garden drops in the field)`)
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
