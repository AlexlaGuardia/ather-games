// M78 mana + health economy. Run: npx tsx src/app/shimmer/open/shared/vitals-economy.test.ts
import { ECON, manaTick, draughtHeal, potionCdLeft, payReload, skinStep, type ManaPool } from './vitals-economy'
import { holdGun, reloadGun, RANGE_GUNS } from './gunplay'
import { newCombat, stepCombat, hurtKeeper, reload, skinOf } from '../ather/combat'
import { drink } from '../ather/alchemy'
import { effectOf, potionId } from '../ather/alchemy-set'
let fail = 0
const ok = (c: unknown, m: string) => { if (!c) { fail++; console.log('FAIL', m) } }
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e
const run = (m: ManaPool, from: number, to: number, flow = 1, dt = 0.05) => { let t = from; while (t < to - 1e-9) { t += dt; manaTick(m, t, dt, flow) } return t }

// (1) the refill pauses 3 s after a spend, then 0.4/s
{ const m: ManaPool = { cur: 50, max: 100, regen: ECON.manaRegen }
  manaTick(m, 0, 0.05)
  m.cur -= 10; const base = m.cur              // a cast, outside the tick
  run(m, 0, 2.95)
  ok(near(m.cur, base), `no refill inside 3 s of a spend (got ${m.cur})`)
  run(m, 2.95, 13.0)
  ok(Math.abs(m.cur - (base + 0.4 * 10)) < 0.05, `0.4/s after the pause (got ${m.cur})`)
  // a spend mid-refill restarts the pause
  m.cur -= 1; const at = m.cur; run(m, 13, 15.5); ok(near(m.cur, at), 'a second spend restarts the pause')
}
// an untouched bar refills from the start (no spend yet = resting)
{ const m: ManaPool = { cur: 0, max: 100, regen: ECON.manaRegen }; run(m, 0, 10); ok(Math.abs(m.cur - 4) < 0.05, `fresh bar refills at 0.4/s (got ${m.cur})`) }
// (2) x2 under flow
{ const m: ManaPool = { cur: 0, max: 100, regen: ECON.manaRegen }; run(m, 0, 10, ECON.flowMult); ok(Math.abs(m.cur - 8) < 0.05, `flow doubles it (got ${m.cur})`) }
// a drink RAISING the bar does not start the pause
{ const m: ManaPool = { cur: 10, max: 100, regen: ECON.manaRegen }; manaTick(m, 0, 0.05); m.cur += 30; const c0 = m.cur; manaTick(m, 0.1, 0.1); ok(m.cur > c0, 'a refill from a tonic does not pause the refill') }
// capped at max
{ const m: ManaPool = { cur: 99.9, max: 100, regen: ECON.manaRegen }; run(m, 0, 5); ok(m.cur === 100, 'refill caps at max') }

// (3) HP 0.3/s after 5 s unhurt
{ const c = newCombat(1)
  const T = { heightAt: () => 0 } as never
  c.keeper.hp = 50; c.keeper.sinceHurt = 0
  let t = 0; while (t < 4.9) { stepCombat(c, T, { x: 0, y: 0, z: 0 }, 0.1); t += 0.1 }
  ok(near(c.keeper.hp, 50), `no regen inside 5 s (got ${c.keeper.hp})`)
  while (t < 15) { stepCombat(c, T, { x: 0, y: 0, z: 0 }, 0.1); t += 0.1 }
  ok(c.keeper.hp > 51.5 && c.keeper.hp < 53.5, `0.3/s after the delay (got ${c.keeper.hp.toFixed(2)})`)
  void hurtKeeper
}

// (4) draught by grade heals the % of max HP, capped by the page at max
{ const want = { D: 25, C: 35, B: 45, A: 60, S: 75 } as const
  for (const g of ['D', 'C', 'B', 'A', 'S'] as const) {
    ok(draughtHeal(g, 100) === want[g], `draught ${g} heals ${want[g]}% (got ${draughtHeal(g, 100)})`)
    const e = effectOf(potionId('health', g)); ok(!!e && 'heal' in e && e.heal === want[g], `effectOf health ${g} = ${want[g]} (got ${JSON.stringify(e)})`)
    const d = drink(potionId('health', g), { cur: 0, max: 100 }, {}, 0, 140); ok(d.ok && d.heal === Math.round(ECON.draughtPct[g] * 140), `drink scales with hpMax at ${g}`)
  }
  ok(draughtHeal('S', 100) <= 100, 'never above max')
}
// Ather Infusion lasts the open-world span
{ const d = drink('ather_infusion', { cur: 0, max: 100 }, {}, 1000); ok(d.ok && d.buffs.ather_flow === 1000 + ECON.flowMs, `infusion lasts ECON.flowMs (got ${d.ok && d.buffs.ather_flow})`) }

// (5) one 15 s cooldown shared by every potion
ok(potionCdLeft(null, 5) === 0, 'never drunk = ready')
ok(potionCdLeft(100, 105) === 10, 'second drink inside 15 s is refused (10 s left)')
ok(potionCdLeft(100, 115) === 0, 'ready at 15 s')

// (6) reloads spend mana; refused when short
{ const p = { cur: 5 }; ok(payReload(p) && near(p.cur, 5 - ECON.reloadMana), 'a reload spends reloadMana'); ok(!payReload({ cur: 2.9 }), 'short = refused'); ok(payReload(undefined), 'no pool = free (the range)') }
{ const c = newCombat(1); const pool = { cur: 10, max: 100, regen: 0.4 }; c.mana = pool
  c.keeper.ammo = 0; reload(c); ok(c.keeper.reloading > 0 && near(pool.cur, 10 - ECON.reloadMana), 'combat reload pays')
  const c2 = newCombat(1); c2.mana = { cur: 1 }; c2.keeper.ammo = 0; c2.events = []; reload(c2)
  ok(c2.keeper.reloading === 0 && c2.events.some(e => e.kind === 'reload-dry'), 'combat reload short of mana refuses with an event')
  const c3 = newCombat(1); c3.keeper.ammo = 0; reload(c3); ok(c3.keeper.reloading > 0, 'no pool on the combat = free (old behaviour)') }


// M80 hold F: the keeper's own Mana Skin
{ const ch = { heldFor: 0 }, mana = { cur: 100 }, skin = { cur: 0 }
  const hold = (secs: number, held = true) => { for (let t = 0; t < secs - 1e-9; t += 0.05) skinStep(ch, held, 0.05, mana, skin) }
  hold(0.95); ok(skin.cur === 0 && mana.cur === 100, `nothing for the 1 s stall (skin ${skin.cur})`)
  hold(0.55); ok(skin.cur > 5 && skin.cur < 15, `then it climbs (skin ${skin.cur.toFixed(1)} at 1.5 s)`)
  ok(near(100 - mana.cur, skin.cur / 5, 1e-6), `10 skin per 2 mana (spent ${(100 - mana.cur).toFixed(2)} for ${skin.cur.toFixed(1)})`)
  hold(5); ok(near(skin.cur, ECON.skinCap) && near(mana.cur, 100 - ECON.skinCap / 5), `stops at the cap (skin ${skin.cur}, mana ${mana.cur})`)
  hold(0.1, false); const s0 = skin.cur; skin.cur = 20; hold(0.5); ok(skin.cur === 20, 'letting go resets the stall'); void s0
  const m2 = { cur: 1 }, k2 = { cur: 0 }, c2 = { heldFor: 0 }; for (let t = 0; t < 4; t += 0.05) skinStep(c2, true, 0.05, m2, k2)
  ok(near(k2.cur, 5) && m2.cur < 1e-9, `no mana = no more charge (skin ${k2.cur}, mana ${m2.cur})`) }
// a charge is a spend for the M78 refill pause
{ const m: ManaPool = { cur: 50, max: 100, regen: ECON.manaRegen }, sk = { cur: 0 }, ch = { heldFor: 0 }
  manaTick(m, 0, 0.05); let t = 0
  for (; t < 2; t += 0.05) { skinStep(ch, true, 0.05, m, sk); manaTick(m, t, 0.05) }
  const after = m.cur; for (let u = 0; u < 2.5; u += 0.05) { t += 0.05; manaTick(m, t, 0.05) }
  ok(near(m.cur, after), 'charging the skin pauses the refill like any spend') }
// combat: the keeper's own skin takes a blow after any field skin and pops at 0
{ const c = newCombat(1); c.skin = { cur: 20 }; c.events = []
  ok(skinOf(c).skin === 20 && skinOf(c).skinMax === ECON.skinCap, 'skinOf shows the keeper skin on the health bar')
  hurtKeeper(c, 14); ok(c.keeper.hp === 100 && near(c.skin.cur, 6), `a blow lands on the skin first (hp ${c.keeper.hp}, skin ${c.skin.cur})`)
  c.events = []; hurtKeeper(c, 14); ok(c.skin.cur === 0 && c.keeper.hp === 92 && c.events.some(e => e.kind === 'skin-pop'), `it pops at 0 and the rest reaches health (hp ${c.keeper.hp})`) }
// the range: reloads cost mana there too
{ const g = { ...holdGun(RANGE_GUNS[0]), mana: { cur: 4 } }; g.ammo = 0; reloadGun(g); ok(g.reloading > 0 && near(g.mana.cur, 1), 'a range reload pays 3 mana')
  const g2 = { ...holdGun(RANGE_GUNS[0]), mana: { cur: 1 } }; g2.ammo = 0; reloadGun(g2); ok(g2.reloading === 0 && g2.dry === 1, 'short = refused, counted for the line') }

console.log(fail ? `vitals-economy: ${fail} FAILED` : 'vitals-economy: all pass')
process.exit(fail ? 1 : 0)
