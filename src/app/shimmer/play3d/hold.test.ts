/** The hold — round survival, headless. Run: `npx tsx src/app/shimmer/play3d/hold.test.ts` */
import {
  parseLanding, startHold, stepHold, hitBody, releaseSurge, promptAt, buyGate, buyRack, buyFont, buyCache,
  mendTick, endHold, keeperBlocked, keeperBlockSet, roundBlocked, roundCount, roundHp, kindFor, bodyStats,
  isLoud, HOLD_TUNING as T, HOLD_TILE, type HoldState,
} from './hold'
import { getMaxPool } from '../engine/mana'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

// ── the landing parses into what the slice promised ──
const map = parseLanding()
ok(map.windows.filter(w => w.room === 'landing').length === 3, 'the landing has three windows')
ok(map.windows.filter(w => w.room === 'gallery').length === 3, 'the gallery has three')
ok(map.windows.filter(w => w.room === 'cistern').length === 3, 'the cistern has three')
ok(map.windows.every(w => w.cells.length === 2), 'every window is two cells wide')
ok(map.gates.length === 2 && map.gates[0].opens === 'gallery' && map.gates[1].opens === 'cistern', 'two gates: gallery then cistern')
ok(map.gates[0].cost < map.gates[1].cost, 'the second gate costs more')
ok(map.grid[map.start.z][map.start.x] === HOLD_TILE.FLOOR, 'you start on floor')
ok(map.grid[map.exit.z][map.exit.x] === HOLD_TILE.WARP, 'the way out is a warp tile')
for (const w of map.windows) {
  ok(map.grid[Math.round(w.spawn.z)]?.[Math.round(w.spawn.x)] === HOLD_TILE.FLOOR, `window ${w.id}: spawn is open yard`)
  ok(map.grid[Math.round(w.inside.z)]?.[Math.round(w.inside.x)] !== HOLD_TILE.WALL, `window ${w.id}: inside is floor`)
}

// ── what is solid to whom ──
const s0 = startHold(map)
const lw = map.windows.find(w => w.room === 'landing')!
ok(keeperBlocked(s0, lw.cells[0].x, lw.cells[0].z), 'a keeper cannot climb out a window')
ok(!roundBlocked(s0, lw.cells[0].x, lw.cells[0].z), '★ rounds pass a window — you shoot out of them')
const g0 = map.gates[0]
ok(keeperBlocked(s0, g0.cells[0].x, g0.cells[0].z) && roundBlocked(s0, g0.cells[0].x, g0.cells[0].z), 'a shut gate stops keeper and rounds')
ok(keeperBlockSet(s0).size === map.windows.length * 2 + 4, 'block set = every window cell + both shut gates')

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

// ── a round runs: they come to the windows, tear, get in, and strike ──
{
  const s = startHold(parseLanding(), 7)
  const p = map.start
  let struck = 0, tore = false
  for (let t = 0; t < 60 * 40; t++) {
    const o = stepHold(s, 1 / 60, p.x, p.z)
    struck += o.strike
    if (s.planks.some(n => n < T.seals)) tore = true
  }
  ok(tore, 'bodies tear planks off the landing windows')
  ok(s.flood.some(b => b.phase === 'inside'), 'bodies get inside once a window is bare')
  ok(struck > 0, 'a keeper who stands still gets struck')
  ok(s.flood.every(b => s.map.windows[b.win].room === 'landing'), '★ only the opened room spawns — no body at a gallery window')
}

// ── a keeper who kills everything clears rounds and the curve climbs ──
function autoplay(seed: number, secs: number, surge = false): HoldState {
  const s = startHold(parseLanding(), seed)
  const p = map.start
  for (let t = 0; t < secs * 60; t++) {
    const o = stepHold(s, 1 / 60, p.x, p.z)
    void o
    // an aimbot sidearm: 10 dmg, one kill-shot per 0.16s on the nearest body inside
    if (t % 10 === 0) {
      const tgt = s.flood.filter(b => b.alive).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]
      if (tgt) hitBody(s, tgt.id, 10, false)
    }
    if (surge && s.surge >= 1) releaseSurge(s, p.x, p.z)
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
  ok(!buyGate(s, 1), '500 salvage cannot open a 1000 gate')
  ok(s.salvage === 500, 'a refused buy spends nothing')
  s.salvage = 800
  ok(buyGate(s, 0) && s.rooms.gallery && s.salvage === 50, 'gate 1 opens the gallery for 750')
  ok(!keeperBlocked(s, g0.cells[0].x, g0.cells[0].z), 'an open gate is walkable')
  ok(!buyGate(s, 0), 'an open gate cannot be bought twice')
  s.salvage = 2000
  ok(buyRack(s) === 'weapon' && buyRack(s) === 'refill', 'the rack sells the weapon, then refills it')
  ok(s.salvage === 2000 - T.rackCost - T.rackCost / 2, 'refill is half price')
  ok(buyFont(s), 'the font sells mana')
  const h = s.hush
  ok(buyCache(s) && s.hush === h + T.cacheSec, 'the cache buys hush')
  const s2 = startHold(parseLanding()); s2.salvage = 5000
  ok(!buyCache(s2), 'the cache sits in the gallery — shut gallery, no cache')
}

// ── prompts follow where you stand ──
{
  const s = startHold(parseLanding())
  ok(promptAt(s, map.start.x, map.start.z) === null, 'nothing to do in the middle of the landing')
  ok(promptAt(s, g0.mid.x, g0.mid.z + 1)?.kind === 'gate', 'by the gate → the gate')
  ok(promptAt(s, map.rack.x, map.rack.z)?.kind === 'rack', 'at the rack → the rack')
  ok(promptAt(s, map.font.x, map.font.z)?.kind === 'font', 'at the font → the font')
  ok(promptAt(s, lw.inside.x, lw.inside.z) === null, 'a full window asks for nothing')
  s.planks[lw.id] = 2
  const pr = promptAt(s, lw.inside.x, lw.inside.z)
  ok(pr?.kind === 'mend' && pr.win === lw.id, 'a torn window asks to be mended')
}

// ── mending pays, up to the round's cap ──
{
  const s = startHold(parseLanding())
  s.planks[lw.id] = 0
  let planks = 0
  for (let i = 0; i < 600; i++) if (mendTick(s, lw.id, 1 / 60)) planks++
  ok(planks === T.seals && s.planks[lw.id] === T.seals, 'holding E mends every plank back')
  ok(s.salvage === 500 + T.salvageMend * T.seals, 'each plank pays')
  s.planks.fill(0)
  for (let i = 0; i < 6000; i++) for (const w of s.map.windows) mendTick(s, w.id, 1 / 60)
  ok(s.mendPaidThisRound === T.mendSalvageCap, '★ mend salvage caps per round — no plank farm')
}

// ── the surge ──
{
  const s = startHold(parseLanding())
  const p = map.start
  s.flood.push({ id: 900, kind: 'drift', x: p.x + 1, z: p.z, hp: 200, maxHp: 200, speed: 2, phase: 'inside', win: 0, tearT: 0, strikeT: 1, alive: true })
  ok(releaseSurge(s, p.x, p.z).hit === 0, 'no surge without a full charge')
  s.surge = 1
  const r = releaseSurge(s, p.x, p.z)
  const b = s.flood.find(f => f.id === 900)!
  ok(r.hit === 1 && b.hp === 200 - T.surgeDamage, 'a full surge strikes what is close')
  ok(b.x > p.x + 1.5, 'and throws it back')
  ok(s.surge === 0, 'and spends the charge')
  for (let k = 0; k < T.surgeKills; k++) {
    s.flood.push({ id: 1000 + k, kind: 'drift', x: 5, z: 5, hp: 1, maxHp: 1, speed: 1, phase: 'inside', win: 0, tearT: 0, strikeT: 1, alive: true })
    hitBody(s, 1000 + k, 5, false)
  }
  ok(s.surge === 1, `${T.surgeKills} kills charge a full surge`)
  const auto = autoplay(11, 300, true)
  ok(auto.round >= autoplay(11, 300, false).round, 'a keeper who surges does no worse')
}

// ── the hush runs out → loud ──
{
  const s = startHold(parseLanding())
  s.hush = 0.05
  let loud = false
  for (let i = 0; i < 10; i++) loud = stepHold(s, 1 / 60, map.start.x, map.start.z).wentLoud || loud
  ok(loud && isLoud(s), 'the draught runs out → the keeper is LOUD')
  const before = s.flood.length
  for (let i = 0; i < 60 * 3; i++) stepHold(s, 1 / 60, map.start.x, map.start.z)
  ok(s.flood.length - before >= 8, '★ loud = they rush (spawns every 0.3s)')
  ok(s.flood.slice(before).every(b => b.kind === 'swift'), 'and every one of them is swift')
}

// ── the end ──
{
  const s = autoplay(5, 60)
  const r = endHold(s)
  ok(!s.running && s.over && r.round === s.round, 'endHold stops the run and returns the record')
  const k = s.flood.length
  stepHold(s, 1, map.start.x, map.start.z)
  ok(s.flood.length === k, 'a finished run does not step')
}

console.log(`hold: ${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
