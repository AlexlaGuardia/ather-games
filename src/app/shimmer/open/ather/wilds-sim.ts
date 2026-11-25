// BETA M120: an OFFLINE fight sim for the 09-24 KEEPER rule (a newcomer with the default gun keeps pace). A scripted
// "newcomer" keeper on flat open ground: hip-fires the Repeater at a human tap rate with a little aim error, backs off a
// shambler that gets close, strafes otherwise, and steps out of a champion's tell. No React, no three: it drives
// combat.ts / champion.ts exactly as the scene does. Numbers, not a pass/fail: wilds-teeth.test.ts asserts on them.
import { newCombat, spawnHollow, stepCombat, fire, stepTrigger, heldGun, M151, BODY_Y, CRAWLER, crawlerScale, type Combat, type Terrain, type HollowKind } from './combat'
import { newSpiritFight, stepSpirits, noteKeeper, healthOf, type SpiritFight } from '../shared/spirit-fight'
import { RANGE_GUNS } from '../shared/gunplay'
import { wakeChampion, champVulnerable, tellOf, CHAMP } from './champion'

export const FLAT: Terrain = { heightAt: () => 0, walkable: () => true }
export interface FightResult { cleared: boolean; died: boolean; secs: number; taken: number; shots: number }

const DT = 1 / 60, WALK = 4.2
/** a newcomer's trigger finger and aim: ~4 taps/s, ~1.2 deg of their own error on top of the gun's hip cone */
export const BOT = { tap: 0.25, aimErr: 0.021, strafe: 2.6, flip: 1.6, backOff: 5, timeout: 240 }

function botStep(c: Combat, feet: { x: number; y: number; z: number }, t: number, jit: () => number) {
  const ch = c.champ
  let near: { x: number; y: number; z: number; d: number; shambler: boolean } | null = null
  for (const h of c.hollows) {
    const d = Math.hypot(h.x - feet.x, h.z - feet.z)
    if (!near || d < near.d) near = { x: h.x, y: h.kind === 'floater' ? h.y : h.kind === 'crawler' ? h.y + CRAWLER.bodyY * crawlerScale(h.mass) : h.y + BODY_Y, z: h.z, d, shambler: h.kind !== 'floater' }
  }
  // what to shoot: adds that are close first, else the champion when it can be hurt, else the nearest Hollow
  let aimAt: { x: number; y: number; z: number } | null = near
  if (ch && champVulnerable(ch) && (!near || near.d > 9)) aimAt = { x: ch.x, y: ch.y + CHAMP.bodyY, z: ch.z }
  const held = heldGun(c.gun), charge = (c.gun as { charge?: number }).charge ?? 0
  // M151: a held gun is asked every frame (its trigger released when there is nothing to shoot); the rest, a tap when the finger is ready
  if (held ? aimAt || (c.keeper.burstLeft ?? 0) > 0 : aimAt && c.keeper.sinceShot >= Math.max(M151.hold.includes(c.gun.id) ? 0 : BOT.tap, charge ? c.gun.fireCd + charge : 0)) {
    const at = aimAt ?? { x: feet.x, y: 1.62, z: feet.z - 1 }
    const eye = { x: feet.x, y: feet.y + 1.62, z: feet.z }
    let ax = at.x - eye.x, ay = at.y - eye.y, az = at.z - eye.z
    const l = Math.hypot(ax, ay, az) || 1; ax = ax / l + jit() * BOT.aimErr; ay = ay / l + jit() * BOT.aimErr; az = az / l + jit() * BOT.aimErr
    const l2 = Math.hypot(ax, ay, az), dir = { x: ax / l2, y: ay / l2, z: az / l2 }
    if (held) stepTrigger(c, eye, dir, false, !!aimAt, DT); else fire(c, eye, dir)
  } else if (held) stepTrigger(c, feet, { x: 0, y: 0, z: -1 }, false, false, DT)
  // where to go
  let mx = 0, mz = 0, sp = 0
  const tell = tellOf(ch)
  if (tell && ch && Math.hypot(ch.x - feet.x, ch.z - feet.z) < 12) {
    // out of the tell: away from the champion and off its line
    const ox = feet.x - ch.x, oz = feet.z - ch.z; mx = ox - tell.az * 3; mz = oz + tell.ax * 3; sp = WALK
  } else if (near && near.shambler && near.d < BOT.backOff) { mx = feet.x - near.x; mz = feet.z - near.z; sp = WALK * 0.88 }
  else if (aimAt) { const side = Math.floor(t / BOT.flip) % 2 ? 1 : -1; mx = -(aimAt.z - feet.z) * side; mz = (aimAt.x - feet.x) * side; sp = BOT.strafe }
  // stay in the arena (a real keeper does not run off forever)
  if (Math.hypot(feet.x, feet.z) > 26) { mx = -feet.x; mz = -feet.z; sp = WALK }
  const ml = Math.hypot(mx, mz)
  if (ml > 0 && sp > 0) { feet.x += (mx / ml) * sp * DT; feet.z += (mz / ml) * sp * DT }
}

/** M127: walk each sim fight with a trio of following spirits (the fight brain as the scene drives it); off = the newcomer alone.
 *  `ran` = the trio's totals of every fight walked since it was last cleared. */
export const SIM: { trio: boolean; gun?: string; ran: { keeper: number; spirits: number; fights: number; worst: number; hit: number; mend: number; slow: number; nothing: number; chases: number; chaseSecs: number; chaseMin: number } } =
  { trio: false, ran: { keeper: 0, spirits: 0, fights: 0, worst: 0, hit: 0, mend: 0, slow: 0, nothing: 0, chases: 0, chaseSecs: 0, chaseMin: Infinity } }
const simCombat = (seed: number) => { const c = newCombat(seed); if (SIM.gun) { const g = RANGE_GUNS.find(r => r.id === SIM.gun)!; c.gun = g; c.keeper.ammo = g.clip } return c }
function makeTrio(seed: number) {
  const F = newSpiritFight(seed), at = ['a', 'b', 'c'].map(id => ({ id, x: 0, z: 2 })); let keeper = 0, spirits = 0, lastN = 0, lk = 0, ls = 0
  const tick = (c: Combat, feet: { x: number; y: number; z: number }, step: () => void) => {
    const before = healthOf(c), eye = { x: feet.x, y: feet.y + 1.62, z: feet.z }
    at.forEach((s, i) => { const t = F.slots.get(s.id) ?? { x: feet.x + (i - 1) * 1.6, z: feet.z + 2.3 }, d = Math.hypot(t.x - s.x, t.z - s.z), m = Math.min(d, 6 * DT); if (d > 0) { s.x += (t.x - s.x) / d * m; s.z += (t.z - s.z) / d * m } })
    stepSpirits(F, c, feet, eye, { x: 0, y: 0, z: -1 }, at, DT); step(); noteKeeper(F, c, before)
    if (F.n !== lastN) { lastN = F.n; keeper += lk; spirits += ls }
    lk = F.keeperDealt; ls = F.spiritDealt
  }
  const end = () => { const R = SIM.ran, k = keeper + lk, s = spirits + ls; R.keeper += k; R.spirits += s; R.fights++; R.worst = Math.max(R.worst, k > 0 ? s / k : 0)
    R.hit += F.seen.hit; R.chases += F.seen.chases; R.chaseSecs += F.seen.chaseSecs; R.chaseMin = Math.min(R.chaseMin, F.seen.chaseMin); R.mend += F.seen.mend; R.slow += F.seen.slow; R.nothing += F.seen.nothing }
  return { tick, end, F: F as SpiritFight }
}

function run(c: Combat, feet: { x: number; y: number; z: number }, done: () => boolean, seed: number): FightResult {
  const trio = SIM.trio ? makeTrio(seed) : null
  const r = runFight(c, feet, done, seed, trio?.tick); trio?.end(); return r
}
function runFight(c: Combat, feet: { x: number; y: number; z: number }, done: () => boolean, seed: number, around?: (c: Combat, feet: { x: number; y: number; z: number }, step: () => void) => void): FightResult {
  let s = seed * 2654435761 >>> 0
  const jit = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 4294967296) * 2 - 1 }
  let t = 0, taken = 0, shots = 0
  while (t < BOT.timeout) {
    const hp0 = c.keeper.hp
    botStep(c, feet, t, jit)
    if (around) around(c, feet, () => stepCombat(c, FLAT, feet, DT)); else stepCombat(c, FLAT, feet, DT)
    t += DT
    for (const e of c.events) if (e.kind === 'fired') shots++
    taken += Math.max(0, hp0 - c.keeper.hp)
    if (c.keeper.hp <= 0) return { cleared: false, died: true, secs: t, taken, shots }
    if (done()) return { cleared: true, died: false, secs: t, taken, shots }
  }
  return { cleared: false, died: false, secs: t, taken, shots }
}

/** A pack fight: `kinds` spawned in a loose clump ~22 m out, all already on the keeper. `group` (M120) ties them into
 *  one pack when the build has packs; null = the old loose strays. */
export function packFight(seed: number, kinds: HollowKind[], group?: (c: Combat, ids: number[]) => void, drained = false): FightResult {
  const c = simCombat(seed), feet = { x: 0, y: 0, z: 0 }
  if (drained) c.drained = () => true   // M120 s2: all of it drained ground, so crawlers pool (the worst case)
  const ids: number[] = []
  kinds.forEach((k, i) => {
    const a = 0.3 + i * 0.5, h = spawnHollow(c, FLAT, Math.cos(a) * 2 + 22, Math.sin(a) * 2, k)
    h.state = 'chase'; ids.push(h.id)
  })
  group?.(c, ids)
  return run(c, feet, () => c.hollows.length === 0, seed)
}

/** The first-settlement champion (Lamps Out's node fight): three bars, two waves, the adds included. */
export function championFight(seed: number, crawlers = 0): FightResult {
  const c = simCombat(seed), feet = { x: 0, y: 0, z: 16 }
  wakeChampion(c, FLAT, { id: 'sim:0', tile: 't', biome: 0, x: 0, z: 0, i: 0, j: 0 } as Parameters<typeof wakeChampion>[2])
  // M120 s2: a brood of crawlers already on the node's drained ground when it wakes: they pool and join the fight
  if (crawlers) { c.drained = () => true; for (let i = 0; i < crawlers; i++) { const h = spawnHollow(c, FLAT, -10 + i * 1.2, -6, 'crawler'); h.state = 'chase' } }
  return run(c, feet, () => !c.champ && c.hollows.length === 0, seed)
}

export interface Summary { n: number; cleared: number; died: number; secs: number; taken: number }
export function summarise(rs: FightResult[]): Summary {
  const won = rs.filter(r => r.cleared)
  const avg = (f: (r: FightResult) => number, xs: FightResult[]) => xs.length ? Math.round(xs.reduce((a, r) => a + f(r), 0) / xs.length * 10) / 10 : 0
  return { n: rs.length, cleared: won.length, died: rs.filter(r => r.died).length, secs: avg(r => r.secs, won), taken: avg(r => r.taken, rs) }
}
