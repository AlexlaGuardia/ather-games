// ── recovery: health knits, shields are bought ─────────────────────────────────────────────────
// Run: npx tsx src/app/shimmer/engine/recovery.test.ts

import {
  hpRegenTick, focusTick, HP_CALM_S, HP_REGEN_FRAC,
  FOCUS_SHIELD_PER_SEC, FOCUS_MANA_PER_SHIELD,
} from './recovery'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const DT = 1 / 60

// ── health knits, late and slowly ──────────────────────────────────────────────────────────────
{
  ok(hpRegenTick(50, 100, 0, DT) === 0, 'a fresh wound does not knit')
  ok(hpRegenTick(50, 100, HP_CALM_S - 0.1, DT) === 0, '...nor a moment before the calm is up')
  ok(hpRegenTick(50, 100, HP_CALM_S + 0.1, DT) > 0, '...and does once it is')
  ok(hpRegenTick(100, 100, 99, DT) === 0, 'a keeper at full gains nothing')
  // ⚠ DOWNED IS NOT WOUNDED. At zero the host has already sent you to the glade; a rule that healed
  // from 0 would quietly resurrect a keeper the world considers down, in the frame before the host
  // acts on it.
  ok(hpRegenTick(0, 100, 99, DT) === 0, '★ a downed keeper does not knit back up on their own')
  // Never overshoots the cap in one tick, however long the frame was.
  ok(hpRegenTick(99, 100, 99, 10) === 1, 'a long frame cannot overshoot the cap')

  // The rate is what the constant says: full from near-death in about a minute.
  let hp = 1
  for (let t = 0; t < 60 * 60; t++) hp += hpRegenTick(hp, 100, 99, DT)
  ok(hp > 60 && hp < 100, `~60s of calm is most of a bar, not all of it (${hp.toFixed(1)})`)
  ok(Math.abs(HP_REGEN_FRAC * 100 - 1.5) < 1e-9, 'the documented rate and the constant agree')
}

// ── the shield is bought, and the price is real ────────────────────────────────────────────────
{
  const t = focusTick(0, 100, 999, 1)
  ok(t.shield === FOCUS_SHIELD_PER_SEC, 'a second of focus raises a second of shield')
  ok(t.mana === FOCUS_SHIELD_PER_SEC * FOCUS_MANA_PER_SHIELD, '...and is charged for every point of it')
  ok(FOCUS_MANA_PER_SHIELD > 1, '★ armour is never free — a point of shield costs more than a point of mana')

  ok(focusTick(100, 100, 999, 1).refused === 'full', 'a full shield refuses, and says why')
  ok(focusTick(0, 100, 0, 1).refused === 'no-mana', 'an empty pool refuses, and says why')
  ok(focusTick(0, 100, 0, 1).mana === 0, '...and is not charged for the refusal')

  // ⚠ CLAMPED BY MANA *AND* BY THE CAP, AND THE ORDER IS THE POINT. Clamping to the cap first would
  // charge a keeper the full second's price for the last sliver of a nearly-full shield.
  const sliver = focusTick(99, 100, 999, 1)
  ok(Math.abs(sliver.shield - 1) < 1e-9, 'the last sliver raises only what is missing')
  ok(Math.abs(sliver.mana - 1 * FOCUS_MANA_PER_SHIELD) < 1e-9,
    '★ ...and costs only what that sliver is worth, not a full second')

  // A pool that can afford half a tick buys half a tick, not nothing and not a full one.
  const poor = focusTick(0, 100, FOCUS_MANA_PER_SHIELD * 5, 1)
  ok(Math.abs(poor.shield - 5) < 1e-9, 'a thin pool buys exactly what it can afford')
  ok(poor.mana <= FOCUS_MANA_PER_SHIELD * 5 + 1e-9, '...and never spends more than it has')

  // ⚠ THE INVERSION, ASSERTED SO IT CAN ACTUALLY FAIL. The first version of this multiplied a
  // regen tick by zero and checked it was zero — true of every number, a decoration. What is really
  // being claimed is that shield only ever arrives THROUGH A PURCHASE: there is no input to
  // `focusTick` that yields shield for nothing. Swept, so a future "free top-up" branch goes red.
  let freeShield = 0
  for (let sh = 0; sh <= 100; sh += 5) {
    for (const pool of [0, 0.5, 1, 5, 50, 999]) {
      for (const step of [1 / 60, 0.25, 1, 5]) {
        const r = focusTick(sh, 100, pool, step)
        if (r.shield > 0 && r.mana <= 0) freeShield++
        if (r.mana > pool + 1e-9) freeShield++          // and never spends more than is held
      }
    }
  }
  ok(freeShield === 0, `★★ shield only ever arrives BOUGHT — ${freeShield} free/overdrawn cases`)
}

if (fails.length) {
  console.error(`❌ recovery: ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exitCode = 1
} else {
  console.log(`✅ recovery: health knits, shields are bought — ${pass} passed`)
}
