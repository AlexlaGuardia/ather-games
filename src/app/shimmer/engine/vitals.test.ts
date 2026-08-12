// Run: npx tsx src/app/shimmer/engine/vitals.test.ts
//
// Health left Shimmer3D so the voxel world could have it without a second, subtly different copy.
// The risk is the usual extraction risk — a rule that changes while "only moving" — and here the
// rule is an ORDER, which is the kind that breaks silently: every wrong version still subtracts
// roughly the right amount, so a bad build feels slightly off for a week rather than failing.

import {
  MAX_HP, MAX_SHIELD, BARRIER_SHIELD_BONUS,
  capsFor, freshVitals, damage, heal, recap, type Vitals,
} from './vitals'
import { birthAffinity } from '../play3d/birth-affinity'

let pass = 0, fail = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

// ── 1. Alex's spread, verbatim ──────────────────────────────────────────────────────────────────
{
  check('a plain keeper is 100 and 100', MAX_HP === 100 && MAX_SHIELD === 100)
  const plain = freshVitals(null)
  check('and starts full', plain.hp === 100 && plain.shield === 100)
  check('200 effective', plain.hp + plain.shield === 200)
}

// ── 2. ★ THE BIRTH RUNE BONUS IS A LEAN, NOT A RUNE ID ─────────────────────────────────────────
// Alex stated the rule for Barrier. `birth-affinity.ts` already applies it to a FAMILY, and asserting
// the family is what stops someone "fixing" this into `if (rune === 'barrier')` and silently
// dropping Stone's shield and Life's health.
{
  const barrier = capsFor(birthAffinity('barrier'))
  check('Barrier carries 125 shield', barrier.shieldMax === MAX_SHIELD + BARRIER_SHIELD_BONUS)
  check('and its health is untouched', barrier.hpMax === MAX_HP)

  const stone = capsFor(birthAffinity('stone'))
  check('★ Stone gets the same shield lean — the rule is the family, not the rune',
    stone.shieldMax === barrier.shieldMax)

  const life = capsFor(birthAffinity('life'))
  check('Life leans health instead', life.hpMax === MAX_HP + 25 && life.shieldMax === MAX_SHIELD)

  const breeze = capsFor(birthAffinity('breeze'))
  check('a mobility rune changes neither bar', breeze.hpMax === MAX_HP && breeze.shieldMax === MAX_SHIELD)
}

// ── 3. ★ THE ORDER: resist → shield → spill ────────────────────────────────────────────────────
{
  const v: Vitals = { hp: 100, hpMax: 100, shield: 100, shieldMax: 100 }

  const small = damage(v, 40)
  check('a hit inside the shield never reaches health',
    small.vitals.shield === 60 && small.vitals.hp === 100 && small.toHp === 0)

  // ★ THE SPILL. A 150 hit on a 100 shield must cost 100 shield AND 50 health. Forgetting the
  // remainder is the classic version of this bug and it makes shields strictly better than they are.
  const big = damage(v, 150)
  check('★ overkill spills past the shield into health',
    big.vitals.shield === 0 && big.vitals.hp === 50, `shield ${big.vitals.shield} hp ${big.vitals.hp}`)
  check('and reports both halves', big.toShield === 100 && big.toHp === 50)

  // ★ RESIST APPLIES FIRST, TO THE WHOLE HIT. Applying it after the shield would mean a Barrier
  // stance protected only your health — the one thing a *shield* rune should not do.
  const stanced = damage(v, 100, 0.35)
  check('★ a stance reduces the hit BEFORE the shield soaks it',
    near(stanced.vitals.shield, 35) && stanced.vitals.hp === 100)
  check('and reports what it absorbed', near(stanced.resisted, 35))

  // Full resist is a wall, not a rounding error.
  check('total resist takes nothing', damage(v, 999, 1).vitals.hp === 100)
  // And resist is clamped both ways, so a bad stance value cannot heal you.
  check('a negative resist cannot heal', damage(v, 50, -5).vitals.shield === 50)
}

// ── 4. down is REPORTED, never acted on ────────────────────────────────────────────────────────
{
  const low: Vitals = { hp: 10, hpMax: 100, shield: 0, shieldMax: 100 }
  const out = damage(low, 25)
  check('a lethal hit floors health at zero, not below', out.vitals.hp === 0)
  check('and flags downed', out.downed)
  // ★ It must NOT respawn. play3d resets to full here; the voxel garden has not agreed to that, and
  // a pure rule that respawned you would force a death both worlds have not signed off on.
  check('★ downing does not silently refill the bars', out.vitals.hp === 0 && out.vitals.shield === 0)
  check('a survivable hit does not flag downed', !damage(low, 5).downed)
}

// ── 5. healing clamps per-bar ───────────────────────────────────────────────────────────────────
{
  const hurt: Vitals = { hp: 50, hpMax: 100, shield: 10, shieldMax: 125 }
  const h = heal(hurt, 80, 200)
  check('each bar clamps to its OWN cap', h.hp === 100 && h.shield === 125)
  check('healing one bar leaves the other alone', heal(hurt, 10).shield === 10)
}

// ── 6. re-capping on a rune change ──────────────────────────────────────────────────────────────
{
  const full = freshVitals(birthAffinity('barrier'))
  check('a Barrier keeper starts at 125 shield', full.shield === 125)
  // ★ Losing the rune must pull the CURRENT value down with the cap, or the HUD draws a bar past
  // its own end and the keeper keeps 25 shield they no longer own.
  const stripped = recap(full, null)
  check('★ a lost lean drags the current value down with the cap',
    stripped.shieldMax === 100 && stripped.shield === 100)
  // ...but gaining one is not a free heal mid-fight.
  const hurt: Vitals = { hp: 40, hpMax: 100, shield: 5, shieldMax: 100 }
  const gained = recap(hurt, birthAffinity('barrier'))
  check('★ gaining a lean raises the cap without topping you up',
    gained.shieldMax === 125 && gained.shield === 5 && gained.hp === 40)
}

console.log(`\nvitals: ${pass} passed, ${fail} failed`)
if (fail === 0) console.log('✅ resist → shield → spill, one order, both worlds')
process.exit(fail === 0 ? 0 : 1)
