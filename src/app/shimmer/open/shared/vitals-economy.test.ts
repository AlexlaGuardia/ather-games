// M78 mana + health economy. Run: npx tsx src/app/shimmer/open/shared/vitals-economy.test.ts
import { ECON, manaTick, draughtHeal, potionCdLeft, payReload, type ManaPool } from './vitals-economy'
import { newCombat, stepCombat, hurtKeeper, reload } from '../ather/combat'
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

console.log(fail ? `vitals-economy: ${fail} FAILED` : 'vitals-economy: all pass')
process.exit(fail ? 1 : 0)
