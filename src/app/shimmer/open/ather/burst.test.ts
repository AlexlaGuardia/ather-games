// BETA M148: the Backbone's burst rhythm in the Ather (combat.ts stepTrigger) and on the range (gunplay stepGun).
// Run: npx tsx src/app/shimmer/open/ather/burst.test.ts
import { newCombat, stepCombat, stepTrigger, dropBurst, fire, reload, type Combat, type Terrain } from './combat'
import { RANGE_GUNS, RHYTHM_DIALS, burstCycle, withRhythm, holdGun, stepGun, type RangeGun, type Round } from '../shared/gunplay'
import { weaponDef } from '../../engine/weapons'
import { dialedGun, setRhythm, setGunTune, selectGunTune, resetGunTune, defaultsFor, settleAt, SETTLE_S } from '../shared/fp-gun'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const FLAT: Terrain = { heightAt: () => -50, walkable: () => true }
const bb = RANGE_GUNS.find(g => g.id === 'backbone')!, eye = { x: 0, y: 0, z: 0 }, aim = { x: 0, y: 0, z: -1 }
const mk = (gun: RangeGun = bb): Combat => { const c = newCombat(3); c.gun = gun; c.keeper.ammo = gun.clip; c.mana = { cur: 1000 }; return c }
/** the frame loop as the layer drives it; returns when each round left */
const drive = (c: Combat, secs: number, dt: number, down: (t: number) => boolean) => {
  const at: number[] = []
  for (let i = 0; i < Math.round(secs / dt); i++) { const t = i * dt, n = stepTrigger(c, eye, aim, false, down(t), dt); for (let k = 0; k < n; k++) at.push(t); stepCombat(c, FLAT, eye, dt) }
  return at
}
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e

// the numbers
ok(bb.burst === 3 && bb.burstGap === 0.09 && bb.fireCd === 0.45 && near(burstCycle(bb), 0.63), 'gap 0.09, delay 0.45, cycle 0.63')
const DPS = 3 * bb.damage / 0.63
const rep = { ...RANGE_GUNS.find(g => g.id === 'repeater')!, fireCd: weaponDef('repeater')!.fireCd }   // M148's ceiling: the Repeater as it was (0.16 s); M151 slowed the held one
/** held damage a second, and over clip + reload (perfect taps on the Repeater) */
const rates = (g: RangeGun, d: number) => { const last = Math.ceil(g.clip / g.burst) - 1, cyc = g.burst > 1 ? burstCycle(g) : g.fireCd; return { hold: g.burst * d / cyc, sus: g.clip * d / (last * cyc + (g.burst - 1) * g.burstGap + g.reloadTime) } }
for (const k of ['damage', 'crit'] as const) { const b = rates(bb, bb[k]), r = rates(rep, rep[k]); console.log(`${k}: Backbone ${b.hold.toFixed(1)} held / ${b.sus.toFixed(1)} with reloads; Repeater ${r.hold.toFixed(1)} / ${r.sus.toFixed(1)}`); ok(b.hold <= r.hold && b.sus <= r.sus, `${k}: the Backbone beats the Repeater`) }
ok(near(bb.crit / bb.damage, 19 / 12, 0.01), 'the head shot scales with it')
ok(bb.clip === 30 && bb.reloadTime === 1.6, 'clip and reload as they were')

// hold 3 s = 5 bursts = 15 rounds at every frame rate, steady
for (const fps of [20, 30, 60, 144]) {
  const at = drive(mk(), 3, 1 / fps, () => true)
  ok(at.length === 15, `${fps} fps: hold 3 s fires ${at.length}, not 15`)
  const starts = at.filter((_, i) => i % 3 === 0), worst = Math.max(...starts.map((t, i) => Math.abs(t - i * 0.63)))
  ok(worst <= 1 / fps + 1e-6, `${fps} fps: burst starts drift (${worst.toFixed(4)} s)`)
  if (fps >= 60) ok(at.every((t, i) => i % 3 === 0 || Math.abs(t - at[i - 1] - 0.09) <= 1 / fps + 1e-6), `${fps} fps: rounds 0.09 apart`)
}
// 20 s held: never drifts above the perfect rhythm, across reloads
{ const at = drive(mk(), 6.2, 1 / 60, () => true); ok(at.length === 30, `one clip = ${at.length} rounds, then the reload`) }
{ const c = mk(), at = drive(c, 12, 1 / 60, () => true); const r = at[30] - at[29]; ok(at.length > 30 && r >= bb.reloadTime && r < bb.reloadTime + 0.1 && c.mana!.cur < 1000, `holds through the reload (${r?.toFixed(2)} s) and it is paid`); ok(at.slice(30).length % 3 === 0 || c.keeper.burstLeft! > 0, 'whole bursts after it') }
// a tap = one burst, released or not
ok(drive(mk(), 1.5, 1 / 60, t => t === 0).length === 3, 'a tap is one burst')
// release mid-burst finishes it, and no more
ok(drive(mk(), 3, 1 / 60, t => t < 0.7).length === 6, 'released in the 2nd burst: it finishes, no 3rd')
// never above a perfect tapper, and a spammer never above the hold
const held = drive(mk(), 5, 1 / 60, () => true).length
for (const period of [2, 3, 5, 9, 38]) { const n = drive(mk(), 5, 1 / 60, t => Math.round(t * 60) % period === 0).length; ok(n <= held, `tapping every ${period} frames (${n}) beats holding (${held})`) }
{ // the perfect tapper: presses the frame it is ready
  const c = mk(); let n = 0; for (let i = 0; i < 300; i++) { n += stepTrigger(c, eye, aim, false, !c.keeper.burstLeft && c.keeper.sinceShot >= c.gun.fireCd - 1e-6, 1 / 60); stepCombat(c, FLAT, eye, 1 / 60) }
  ok(n === held, `holding (${held}) = a perfect tapper (${n})`) }
// a part clip: the burst ends with the clip
{ const c = mk(); c.keeper.ammo = 2; const at = drive(c, 0.5, 1 / 60, () => true); ok(at.length === 2 && c.keeper.reloading > 0 && !c.keeper.burstLeft, 'two rounds left = two rounds, then the reload') }
// dry: holding asks once, a fresh pull asks again
{ const c = mk(); c.keeper.ammo = 3; c.mana = { cur: 0 }; let dry = 0
  const run = (down: (i: number) => boolean) => { for (let i = 0; i < 90; i++) { stepTrigger(c, eye, aim, false, down(i), 1 / 60); dry += c.events.filter(e => e.kind === 'reload-dry').length; stepCombat(c, FLAT, eye, 1 / 60) } }
  run(() => true); ok(dry === 1, `held on an empty gun without mana asks once (${dry})`); run(i => i >= 10); ok(dry === 2, `a fresh pull asks again (${dry})`) }
// R mid-burst and a dropped burst stop it
{ const c = mk(); drive(c, 0.05, 1 / 60, () => true); reload(c); const at = drive(c, 0.4, 1 / 60, () => false); ok(at.length === 0, 'reloading cancels the burst') }
{ const c = mk(); drive(c, 0.05, 1 / 60, () => true); dropBurst(c); ok(drive(c, 1, 1 / 60, () => false).length === 0, 'put away mid-burst: the rest never leaves') }

// the range holds the same count
{ const g = holdGun(bb), out: Round[] = []; let n = 0; for (let i = 0; i < 180; i++) n += stepGun(g, 1 / 60, true, eye, aim, Math.random, out).length; ok(n === 15, `the range: hold 3 s fires ${n}`) }

// every other gun: rows untouched, and fire() still one round per call
const ROWS = { repeater: [0.22, 10, 16, 1, 0], spitter: [0.11, 7, 11, 1, 0], roar: [0.8, 7, 9, 1, 0], lance: [0.5, 22, 34, 1, 0], 'charred-rifle': [0.9, 34, 55, 1, 0] } as Record<string, number[]>
for (const [id, r] of Object.entries(ROWS)) { const g = RANGE_GUNS.find(x => x.id === id)!; ok(JSON.stringify([g.fireCd, g.damage, g.crit, g.burst, g.burstGap]) === JSON.stringify(r), `${id} changed`); ok(dialedGun(g) === g && withRhythm(g, 0.1, 0.5) === g, `${id}: no rhythm`) }
{ const c = mk(RANGE_GUNS.find(g => g.id === 'lance')!); ok(fire(c, eye, aim) && !fire(c, eye, aim) && c.keeper.ammo === c.gun.clip - 1, 'Lance: one round a call') }

// the dials
ok(withRhythm(bb, 0.09, 0.45) === bb && dialedGun(bb) === bb, 'on its own rhythm = the row itself')
for (const [g, d] of [[0.04, 0.3], [0.16, 0.9], [0.1, 0.6]]) { const w = withRhythm(bb, g, d); ok(near(3 * w.damage / burstCycle(w), DPS, 1e-6), `dial ${g} / ${d}: damage a second holds`) }
{ const w = withRhythm(bb, 0, 0); ok(w.burstGap === RHYTHM_DIALS.gap.min && w.fireCd === RHYTHM_DIALS.delay.min, 'a silly dial is clamped'); ok(withRhythm(bb, NaN, NaN) === bb, 'a broken dial is the row') }
selectGunTune('backbone'); setRhythm('backbone', { BURST_DELAY: 0.6 }); ok(dialedGun(bb).fireCd === 0.6 && dialedGun(bb).burstGap === 0.09, 'one dial moved, the other its row')
setGunTune({ HIP_X: defaultsFor('backbone').HIP_X }); ok(dialedGun(bb).fireCd === 0.6, 'a hand slider keeps the rhythm'); resetGunTune(); ok(dialedGun(bb) === bb, 'reset = the row')

// the settle cue: nothing until the last of the delay, home exactly when ready
ok(settleAt(0.2, 0.45) === 0 && settleAt(0.45 - SETTLE_S / 2, 0.45) > 0.4 && near(settleAt(0.45, 0.45), 1) && settleAt(RHYTHM_DIALS.gap.max, RHYTHM_DIALS.delay.min) < 1e-6, 'the settle sits just before ready, never inside a burst')

console.log(`burst: ${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('  x ' + f); if (fails.length) process.exit(1)
