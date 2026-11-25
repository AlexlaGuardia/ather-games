// BETA M151: every gun fires while held at its own cadence; the Roar is a breacher (9 pellets + shove). npx tsx src/app/shimmer/open/ather/hold-fire.test.ts
import { newCombat, stepCombat, stepTrigger, spawnHollow, fire, reload, heldGun, M151, SHOVE_MAX, BODY_Y, type Combat, type Terrain } from './combat'
import { RANGE_GUNS } from '../shared/gunplay'
import { weaponDef, WEAPONS } from '../../engine/weapons'
import { FLAT } from './wilds-sim'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const AIR: Terrain = { heightAt: () => -50, walkable: () => true }, eye = { x: 0, y: 1.62, z: 0 }, aim = { x: 0, y: 0, z: -1 }
const gun = (id: string) => RANGE_GUNS.find(g => g.id === id)!
const mk = (id: string): Combat => { const c = newCombat(3); c.gun = gun(id); c.keeper.ammo = c.gun.clip; c.mana = { cur: 1000 }; return c }
const drive = (c: Combat, secs: number, dt: number, down: (t: number) => boolean) => { const at: number[] = []; for (let i = 0; i < Math.round(secs / dt); i++) { const n = stepTrigger(c, eye, aim, false, down(i * dt), dt); for (let k = 0; k < n; k++) at.push(i * dt); stepCombat(c, AIR, eye, dt) } return at }

ok(RANGE_GUNS.every(g => g.auto || g.burst > 1 || M151.hold.includes(g.id)), 'every gun keeps firing while held')
ok(!heldGun(gun('spitter')) && heldGun(gun('backbone')) && !heldGun(gun('charred-rifle')), 'auto and charged guns keep their own drive')
ok(gun('repeater').fireCd === 0.22 && newCombat().gun.fireCd === 0.22, 'the Repeater is 0.22 s, in hand and as the default')
ok(weaponDef('repeater')!.fireCd === 0.16 && WEAPONS.length === 3, 'the engine row (the other games) is untouched')
for (const id of ['repeater', 'roar', 'lance']) for (const fps of [20, 30, 60, 144]) {
  const g = gun(id), dt = 1 / fps, at = drive(mk(id), (g.clip - 1) * g.fireCd + 0.1, dt, () => true)
  ok(at.length === g.clip, `${id} ${fps} fps: one clip held = ${at.length} of ${g.clip}`)
  ok(at.every((t, i) => Math.abs(t - i * g.fireCd) <= dt + 1e-6), `${id} ${fps} fps: on its own cadence`)
  ok(drive(mk(id), 3, dt, t => t < dt / 2).length === 1, `${id} ${fps} fps: a tap = one round`)
}
for (const id of ['repeater', 'roar', 'lance']) {
  const g = gun(id), c = mk(id), at = drive(c, g.clip * g.fireCd + g.reloadTime + 0.5, 1 / 60, () => true), gap = at[g.clip] - at[g.clip - 1]
  ok(gap >= g.reloadTime - 1e-6 && gap < g.reloadTime + 0.1 && c.mana!.cur < 1000, `${id}: held through the reload (${gap?.toFixed(2)} s), paid`)
  const r = mk(id); drive(r, 0.05, 1 / 60, () => true); const n = r.keeper.ammo; reload(r); ok(drive(r, g.reloadTime - 0.1, 1 / 60, () => true).length === 0 && r.keeper.ammo === n, `${id}: a reload stops it`); ok(drive(r, 0.5, 1 / 60, () => true).length >= 1 && r.keeper.reloading <= 0, `${id}: and it resumes`)
}
// the Roar
{ const c = mk('roar'), rs = (fire(c, eye, aim), c.rounds); ok(rs.length === 9 && c.keeper.ammo === 5, `a Roar shell = ${rs.length} pellets, one round`); ok(new Set(rs.map(r => r.vx)).size > 1, 'spread') }
for (const id of ['repeater', 'lance', 'backbone', 'spitter', 'charred-rifle']) { const c = mk(id); fire(c, eye, aim); ok(c.rounds.length === 1 && c.rounds[0].shove === undefined, `${id}: one round, no shove`) }
const shot = (id: string, T: Terrain = FLAT, lunge = false) => {
  const c = mk(id), h = spawnHollow(c, FLAT, 0, -4); h.hp = 500; h.state = lunge ? 'lunge' : 'stagger'; h.t = 99
  const z0 = h.z; h.y = 0; let d = { x: 0, y: BODY_Y - eye.y, z: -4 }; const l = Math.hypot(d.x, d.y, d.z); d = { x: 0, y: d.y / l, z: d.z / l }
  fire(c, eye, d); let hits = 0; for (let i = 0; i < 12; i++) { h.t = 99; stepCombat(c, T, { x: 0, y: 0, z: 0 }, 1 / 60); hits += c.events.filter(e => e.kind === 'hit').length }
  return { moved: z0 - h.z, lost: 500 - h.hp, hits }
}
{ const s = shot('roar'); ok(s.hits >= 3 && s.lost >= 21, `up close many pellets land (${s.hits}, ${s.lost})`); ok(s.moved > 0.5 && s.moved <= SHOVE_MAX + 0.05, `and shove the body back (${s.moved.toFixed(2)} m)`)
  ok(Math.abs(shot('lance').moved) < 0.05, 'a Lance does not'); ok(shot('roar', { ...FLAT, walkable: (_x, z) => z > -4.05 }).moved < 0.1, 'never off walkable ground') }
console.log(`hold-fire: ${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('  x ' + f); if (fails.length) process.exit(1)
