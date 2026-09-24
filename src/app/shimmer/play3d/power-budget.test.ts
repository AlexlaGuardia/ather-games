/** The power budget — no move lifts a keeper past the band. Run: `npx tsx src/app/shimmer/play3d/power-budget.test.ts` */
import { BUDGET, FIGHTS, uplift, worstUplift, gunSustainedDps, gunDmgPerMana, DEFAULT_GUN, loadoutDamage } from './power-budget'
import { KEEPER_MOVES } from './keeper-moves'
import { castForMove, isBuilt } from './cast'
import { WEAPONS } from '../engine/weapons'
import { startHold, parseLanding, fieldStrike, HOLD_TUNING } from './hold'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

const built = KEEPER_MOVES.filter(m => isBuilt(m.id)).map(m => m.id)
const casts = built.filter(id => castForMove(id).tier !== 'passive')

// ── the model reads the real tables ──
ok(DEFAULT_GUN().id === 'repeater', 'the baseline is the sidearm every keeper walks into the hold with')
ok(Math.abs(gunSustainedDps(DEFAULT_GUN()) - 42) < 1, 'the repeater sustains ~42 dps')
ok(WEAPONS.every(w => gunDmgPerMana(w) > 10), 'every gun turns mana into damage far better than a cast does')
ok(BUDGET.band === 0.2, "Alex's band is 20%")
ok(FIGHTS.length === 4, 'four fights: boss, horde, and both rich')
ok(casts.length > 30, `the roster is measured, not a sample (${casts.length} built casts)`)

// ── ★ THE RULE: every built move, in every fight, within the band ──
for (const id of casts) {
  const w = worstUplift([id])
  ok(w <= BUDGET.band + 1e-9, `${id}: worst uplift ${(w * 100).toFixed(1)}% is over the ${BUDGET.band * 100}% band — tune the move (fieldDps / surgeMult / damage), never the budget`)
}

// ── the model is not blind: it sees the shapes it exists to catch ──
const fw = castForMove('firewall')
ok(loadoutDamage(DEFAULT_GUN(), [{ ...fw, fieldDps: 30 }], 'horde-rich') > loadoutDamage(DEFAULT_GUN(), [{ ...fw, fieldDps: 30 }], 'boss-rich'), 'a field is worth more in a horde (it would catch an AoE outlier)')
const inf = castForMove('forge-fist')
const hot = [{ ...inf, surgeMult: 1.8 }]
ok(loadoutDamage(DEFAULT_GUN(), hot, 'boss-rich') / loadoutDamage(DEFAULT_GUN(), [], 'boss-rich') - 1 > BUDGET.band, 'a fat infusion shows as over-band on flush mana (it would catch a multiplier)')
ok(uplift('forge-fist', 'boss') < uplift('forge-fist', 'boss-rich'), 'scarce mana hides a multiplier; rich mana shows it')

// ── ★ LOADOUTS STACK — a ratchet until Alex rules the full-loadout band ──
// Every move is in band alone; a tactical + an ultimate + a cast-damage stance together reach higher.
// Holding the whole loadout to 20% means fields at ~1/4 of today's damage (asked of Alex 2026-09-24).
// Until then this may only go DOWN: lower `LOADOUT_CEILING` when a tune lowers it, never raise it.
const LOADOUT_CEILING = 0.33
{
  const by = (tier: string) => built.filter(id => castForMove(id).tier === tier)
  const T = by('tactical'), U = by('ultimate'), P = by('passive').filter(id => (castForMove(id).castMult ?? 1) > 1)
  let worst = { u: -1, l: [] as string[] }
  for (const t of T) for (const u of U) for (const p of [null, ...P]) {
    const l = p ? [t, u, p] : [t, u]
    const x = worstUplift(l)
    if (x > worst.u) worst = { u: x, l }
  }
  ok(worst.u <= LOADOUT_CEILING, `worst full loadout ${worst.l.join(' + ')} at ${(worst.u * 100).toFixed(1)}% is over the ratchet ${LOADOUT_CEILING * 100}%`)
  console.log(`  worst full loadout: ${worst.l.join(' + ')} +${(worst.u * 100).toFixed(1)}%`)
}

// ── the hold enforces the cap the budget assumes ──
{
  const s = startHold(parseLanding())
  for (let k = 0; k < 6; k++) s.flood.push({ id: 100 + k, kind: 'drift', x: 14 + k * 0.2, z: 18, hp: 100, maxHp: 100, speed: 1, phase: 'inside', win: 0, tearT: 0, strikeT: 1, alive: true })
  ok(fieldStrike(s, 14, 18, 3, 10) === HOLD_TUNING.fieldFullTargets, `★ a field strikes ${HOLD_TUNING.fieldFullTargets} bodies, not all 6 inside`)
  ok(s.flood.filter(b => b.hp < 100).length === BUDGET.fieldFullTargets, 'the budget and the hold agree on the cap')
  ok(s.flood.find(b => b.id === 100)!.hp < 100 && s.flood.find(b => b.id === 105)!.hp === 100, 'the nearest are struck, the far edge is not')
}

console.log(`power-budget: ${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
