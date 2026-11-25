// M176: each gun keeps its own clip, and a gun not in hand reloads itself after ECON.awayReload for one hand reload's mana.
//   npx tsx src/app/shimmer/open/ather/stowed-reload.test.ts
import { newCombat, canReload, reload, stepAway, stepCombat, swapGun, revive } from './combat'
import { RANGE_GUNS, holdGun, canReloadGun } from '../shared/gunplay'
import { ECON } from '../shared/vitals-economy'
let fails = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.error('✗', m) } }
const [A, B] = RANGE_GUNS, BOTH = [A.id, B.id]
const setup = (mana = 100) => { const c = newCombat(1); swapGun(c, A); c.rack = {}; c.mana = { cur: mana }; return c }
const T = { heightAt: () => 0, walkable: () => true }, feet = { x: 0, y: 0, z: 0 }
const run = (c: ReturnType<typeof setup>, secs: number, drawn: boolean, carried = BOTH) => { for (let t = 0; t < secs - 1e-9; t += 0.1) stepAway(c, 0.1, drawn, carried) }
const half = Math.floor(A.clip / 2)
{ const c = setup(); c.keeper.ammo = half
  swapGun(c, B); ok(c.keeper.ammo === B.clip, 'a gun never drawn is full')
  c.keeper.ammo = 1; swapGun(c, A); ok(c.keeper.ammo === half, 'swapping back does NOT refill (no free clip)')
  swapGun(c, B); ok(c.keeper.ammo === 1, 'the other keeps its own count'); ok(c.mana!.cur === 100, 'a swap costs nothing') }
{ const c = setup(); c.keeper.ammo = half; swapGun(c, B)
  run(c, ECON.awayReload - 0.3, true); ok(c.rack![A.id].ammo === half && c.mana!.cur === 100, 'not before the dial')
  run(c, 0.6, true); ok(c.rack![A.id].ammo === A.clip, 'swapped away: full after the dial'); ok(c.mana!.cur === 100 - ECON.reloadMana, 'for one reload')
  run(c, 20, true); ok(c.mana!.cur === 100 - ECON.reloadMana, 'paid once')
  swapGun(c, A); ok(c.keeper.ammo === A.clip, 'drawn full') }
{ const c = setup(); c.keeper.ammo = 1; swapGun(c, B); c.keeper.ammo = 1
  run(c, ECON.awayReload + 0.5, false); ok(c.keeper.ammo === B.clip && c.rack![A.id].ammo === A.clip, 'stowed: both'); ok(c.mana!.cur === 100 - 2 * ECON.reloadMana, 'each paid once') }
{ const c = setup(); c.keeper.ammo = half; run(c, 30, true); ok(c.keeper.ammo === half && c.mana!.cur === 100, 'in hand: never by itself')
  run(c, 3, false); run(c, 0.1, true); run(c, 3, false); ok(c.keeper.ammo === half, 'drawing it again restarts the dial') }
{ const c = setup(ECON.reloadMana - 0.5); c.keeper.ammo = half; run(c, 20, false); ok(c.keeper.ammo === half && c.mana!.cur === ECON.reloadMana - 0.5, 'no mana: waits, spends nothing')
  c.mana!.cur = ECON.reloadMana + 1; run(c, 0.1, false); ok(c.keeper.ammo === A.clip && Math.abs(c.mana!.cur - 1) < 1e-9, 'and pays when the mana is there') }
{ const c = setup(); c.keeper.ammo = half; reload(c); ok(c.mana!.cur === 100 - ECON.reloadMana, 'hand reload paid'); swapGun(c, B)
  run(c, 20, true); swapGun(c, A); ok(c.keeper.ammo === A.clip && c.mana!.cur === 100 - ECON.reloadMana, 'put away mid-reload: finishes, not paid twice') }
{ const c = setup(); c.keeper.ammo = half; reload(c); for (let t = 0; t < 8; t += 0.1) { stepAway(c, 0.1, false, BOTH); stepCombat(c, T, feet, 0.1) }
  ok(c.keeper.ammo === A.clip && c.mana!.cur === 100 - ECON.reloadMana, 'stowed mid-reload in the Wilds: paid once') }
{ const c = setup(); c.keeper.ammo = half; reload(c); for (let t = 0; t < 5; t += 0.1) stepAway(c, 0.1, true, BOTH, true)
  ok(c.keeper.ammo === A.clip && c.keeper.reloading === 0, 'off the Wilds a hand reload still finishes (tick)') }
{ const c = setup(); c.keeper.ammo = half; swapGun(c, B); run(c, 20, true, [B.id]); ok(c.rack![A.id].ammo === half && c.mana!.cur === 100, 'a gun left in the Armory spends nothing') }
{ const c = setup(); c.keeper.ammo = half; swapGun(c, B); c.keeper.hp = 0; run(c, 20, true); ok(c.mana!.cur === 100, 'down: nothing reloads'); revive(c); swapGun(c, A); ok(c.keeper.ammo === A.clip, 'revived: full') }
{ const c = setup(); c.keeper.ammo = half; reload(c); swapGun(c, B); run(c, 0.2, true); swapGun(c, A)
  ok(c.keeper.reloading > 0 && c.keeper.reloading < A.reloadTime && c.keeper.ammo === half, 'back before it ends: the paid reload resumes, not restarted or lost') }
{ const c = setup(); c.keeper.ammo = half; reload(c); swapGun(c, B); c.rack![A.id].reloading = 9; run(c, 8, true); ok(c.mana!.cur === 100 - ECON.reloadMana, 'a running reload longer than the dial is not paid again') }
{ const c = setup(); ok(!canReload(c), 'full clip: E interacts'); c.keeper.ammo = half; ok(canReload(c), 'part clip: E reloads'); reload(c); ok(!canReload(c), 'running: E interacts')
  const d = setup(0); d.keeper.ammo = half; ok(!canReload(d), 'no mana: E interacts') }
{ const g = { ...holdGun(A), mana: { cur: 100 } }; ok(!canReloadGun(g), 'range: full'); g.ammo = 1; ok(canReloadGun(g), 'range: part'); g.mana.cur = 0; ok(!canReloadGun(g), 'range: no mana') }
console.log(fails ? `${fails} of ${n} FAILED` : `stowed-reload: ${n} ok`); process.exit(fails ? 1 : 0)
