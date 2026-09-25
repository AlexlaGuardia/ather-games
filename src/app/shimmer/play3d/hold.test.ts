/** The hold — round survival on a setback tower, headless. Run: `npx tsx src/app/shimmer/play3d/hold.test.ts` */
import {
  parseLanding, startHold, stepHold, hitBody, releaseSurge, promptAt, buyGate, buyRack, buyFont, buyCache,
  mendTick, endHold, keeperBlocked, keeperBlockSet, roundBlocked, roundCount, roundHp, kindFor, bodyStats,
  isLoud, heightAt, fieldStrike, HOLD_TUNING as T, HOLD_TILE, LEVEL_H, type HoldState, type FloodBody, type RoomId,
} from './hold'
import { getMaxPool } from '../engine/mana'
import { LEDGE_CLIMB } from './metrics'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const body = (o: Partial<FloodBody> & { id: number; x: number; z: number }): FloodBody =>
  ({ kind: 'drift', y: 0, hp: 100, maxHp: 100, speed: 2, phase: 'inside', win: 0, tearT: 0, strikeT: 1, alive: true, ...o })

// ── the tower parses into what Alex drew: three floors, gardens east and west ──
const map = parseLanding()
const H = (x: number, z: number) => map.heights[z][x]
const count = (room: RoomId) => map.windows.filter(w => w.room === room).length
ok(count('top') === 4 && count('middle') === 5 && count('bottom') === 8 && count('west') === 4 && count('east') === 4, 'windows: crown 4 · middle 5 · bottom 8 · each garden 4')
ok(map.windows.every(w => w.cells.length === 2), 'every window is two cells wide')
ok(map.gates.length === 4 && map.gates.map(g => g.opens).join() === 'middle,bottom,west,east', 'four gates: middle, bottom, then the two gardens')
ok(map.gates[0].cost <= 250 && map.gates[0].cost <= T.gateCost.B && T.gateCost.B < T.gateCost.C, '★ the first stair down is the cheap buy; each floor down costs more')
ok(map.start.h === LEVEL_H.top && map.start.room === 'top', '★ you start on the top floor')
ok(H(36, 17) === LEVEL_H.middle && H(20, 30) === LEVEL_H.bottom && H(8, 30) === LEVEL_H.bottom && H(2, 30) === LEVEL_H.air, 'middle 12 · bottom 6 · gardens at the bottom floor · the air at 0')
ok(LEVEL_H.middle - LEVEL_H.bottom > LEDGE_CLIMB && LEVEL_H.top - LEVEL_H.middle > LEDGE_CLIMB, `★ a floor face is taller than a keeper can climb (${LEDGE_CLIMB.toFixed(2)})`)
ok(map.grid[map.exit.z][map.exit.x] === HOLD_TILE.WARP && map.exit.h === LEVEL_H.top, 'the way out is a warp on the crown')
ok(map.cache.room === 'middle', 'the draught cache waits on the middle floor')
ok(map.solids.some(s => s.kind === 'parapet') && map.solids.some(s => s.kind === 'pillar'), 'parapets ring the floors; pillars stand in the crown and gardens')
for (const w of map.windows) {
  ok(w.spawnH < w.h, `window ${w.id}: the flooded climb UP to it (${w.spawnH} → ${w.h})`)
  ok(H(Math.round(w.inside.x), Math.round(w.inside.z)) === w.h, `window ${w.id}: inside is its room's floor`)
}

// ── a keeper's reach, walked: stairs step one tier, faces stop you, gates hold ──
function reach(s: HoldState): Set<string> {
  const seen = new Set<string>([`${map.start.x},${map.start.z}`]), q = [map.start as { x: number; z: number }]
  while (q.length) {
    const c = q.shift()!
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx, z = c.z + dz, k = `${x},${z}`
      if (seen.has(k) || map.grid[z]?.[x] === undefined || map.grid[z][x] === HOLD_TILE.WALL || keeperBlocked(s, x, z)) continue
      if (H(x, z) - H(c.x, c.z) > 1) continue   // step up one tier at most (drops are free)
      seen.add(k); q.push({ x, z })
    }
  }
  return seen
}
{
  const s = startHold(map)
  const r0 = reach(s)
  ok([...r0].every(k => { const [x, z] = k.split(',').map(Number); return H(x, z) === LEVEL_H.top }), '★ gates shut: the crown is all a keeper can reach (parapets hold, no falling off)')
  for (let g = 0; g < map.gates.length; g++) s.gatesOpen[g] = true
  const r1 = reach(s)
  ok(r1.has('36,17') && r1.has('20,30') && r1.has('8,30') && r1.has('65,30'), '★ all gates open: middle ring, bottom ring and both gardens are reachable by stairs')
  ok(![...r1].some(k => { const [x, z] = k.split(',').map(Number); return H(x, z) === LEVEL_H.air }), 'and never the air outside the tower')
}

// ── ★ THE RINGS ARE LOOPS: you can run a round around the core both ways ──
function loops(h: number, north: [number, number], south: [number, number], xSplit: number, lo: number, hi: number): boolean {
  const side = (keep: (x: number) => boolean) => {
    const seen = new Set<string>([north.join()]), q = [north]
    while (q.length) {
      const [cx, cz] = q.shift()!
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = cx + dx, z = cz + dz, k = `${x},${z}`
        if (seen.has(k) || !keep(x) || x < lo || x > hi || H(x, z) !== h || map.grid[z]?.[x] !== HOLD_TILE.FLOOR) continue
        seen.add(k); q.push([x, z])
      }
    }
    return seen.has(south.join())
  }
  return side(x => x <= xSplit) && side(x => x >= xSplit)
}
ok(loops(LEVEL_H.middle, [36, 17], [36, 43], 36, 25, 48), '★ the middle ring loops around the crown (west way and east way)')
ok(loops(LEVEL_H.bottom, [36, 10], [36, 49], 36, 19, 54), '★ the bottom ring loops around the middle floor')

// ── what is solid to whom ──
const s0 = startHold(map)
const cw = map.windows.find(w => w.room === 'top')!
ok(keeperBlocked(s0, cw.cells[0].x, cw.cells[0].z), 'a keeper cannot climb out a window')
ok(!roundBlocked(s0, cw.cells[0].x, cw.cells[0].z, LEVEL_H.top + 1), '★ rounds pass a window — you shoot out of them')
const gA = map.gates[0]
ok(keeperBlocked(s0, gA.cells[0].x, gA.cells[0].z) && roundBlocked(s0, gA.cells[0].x, gA.cells[0].z), 'a shut gate stops keeper and rounds')
ok(roundBlocked(s0, 36, 30, LEVEL_H.top - 3) && !roundBlocked(s0, 36, 30, LEVEL_H.top + 1), '★ a round under a floor has hit its face; over it, it flies')
ok(keeperBlockSet(s0).size === map.windows.length * 2 + map.gates.length * 2, 'block set = every window cell + every shut gate')

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
    for (const b of s.flood) { if (b.phase === 'tear' && b.y > LEVEL_H.middle + 4) climbed = true; maxY = Math.max(maxY, b.y) }
  }
  ok(s.flood.length > 0 && s.flood.every(b => s.map.windows[b.win].room === 'top'), '★ only the opened floor spawns — the crown\'s windows, nothing below')
  ok(climbed, 'a body climbs the face from the middle ring up to the sill before it tears')
  ok(tore, 'bodies tear planks off the crown windows')
  ok(maxY === LEVEL_H.top, 'through the window, a body stands on the crown')
  ok(struck > 0, 'a keeper who stands still gets struck')
}
{
  const s = startHold(map)
  s.flood.push(body({ id: 1, x: 36, z: 18.6, y: LEVEL_H.middle, strikeT: 0 }))   // on the middle ring, under the crown's north edge
  let struck = 0
  for (let i = 0; i < 60; i++) struck += stepHold(s, 1 / 60, 36, 19.4, LEVEL_H.top).strike
  ok(struck === 0, '★ a body a floor below does not strike a keeper above, however close on the map')
  ok(s.flood[0].y === LEVEL_H.middle, 'and it does not climb the face from inside — only at a window')
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
  ok(buyGate(s, 0) && s.rooms.middle && s.salvage === 250, '★ the stair to the middle floor opens for 250 on starting salvage')
  ok(!keeperBlocked(s, gA.cells[0].x, gA.cells[0].z), 'an open gate is walkable')
  ok(!buyGate(s, 0), 'an open gate cannot be bought twice')
  s.salvage = 800
  ok(buyGate(s, 1) && s.rooms.bottom && s.salvage === 50, 'the next stair opens the bottom floor for 750')
  s.salvage = 2000
  ok(buyRack(s) === 'weapon' && buyRack(s) === 'refill', 'the rack sells the weapon, then refills it')
  ok(s.salvage === 2000 - T.rackCost - T.rackCost / 2, 'refill is half price')
  ok(buyFont(s), 'the font sells mana')
  const h = s.hush
  ok(buyCache(s) && s.hush === h + T.cacheSec, 'the cache buys hush')
  const s2 = startHold(parseLanding()); s2.salvage = 5000
  ok(!buyCache(s2), 'the cache sits on the middle floor — shut stair, no cache')
}

// ── prompts follow where you stand, on your floor ──
{
  const s = startHold(parseLanding())
  const P = (x: number, z: number) => promptAt(s, x, z, heightAt(s, x, z))
  ok(P(map.start.x, map.start.z) === null, 'nothing to do in the middle of the crown')
  ok(P(gA.mid.x, gA.mid.z - 1)?.kind === 'gate', 'by the stair gate → the gate')
  ok(promptAt(s, gA.mid.x, gA.mid.z + 3, LEVEL_H.middle)?.kind !== 'gate', '★ a gate a floor up does not prompt from below')
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
  s.flood.push(body({ id: 901, x: p.x, z: p.z + 1, y: LEVEL_H.middle, hp: 200, maxHp: 200 }))
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
  for (let k = 0; k < 4; k++) s.flood.push(body({ id: 60 + k, x: 36 + k * 0.2, z: 30, y: LEVEL_H.top }))
  s.flood.push(body({ id: 70, x: 36, z: 30.3, y: LEVEL_H.middle }))
  ok(fieldStrike(s, 36, 30, 3, 10) === T.fieldFullTargets, 'a field strikes its cap of bodies')
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
  stepHold(s, 1 / 60, s.drops[0].x, s.drops[0].z, LEVEL_H.middle)
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
