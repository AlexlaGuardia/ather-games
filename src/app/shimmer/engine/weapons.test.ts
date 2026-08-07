// Run: npx tsx src/app/shimmer/engine/weapons.test.ts
//
// The table moved out of Shimmer3D on 2026-08-07 so two walkers could share it. That move is the
// risk this file covers: an extraction that silently changes a number is a feel regression nobody
// can trace, because the code "only moved".
//
// The cone sampler gets the most attention. It is the one piece of real math here, it is invisible
// when wrong (a gun just feels off), and it has two classic bugs baked into its shape: a degenerate
// basis when the seed vector is parallel to forward, and a centre-heavy disc when you forget the
// sqrt. Both are asserted below.

import {
  WEAPONS, weaponDef, weaponAt, spreadDeg, bloomAfterShot, bloomAfterRest,
  canFire, reloadCost, moveMult, recoilKick, coneDirection,
} from './weapons'

let pass = 0, fail = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) pass++
  else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const spitter = weaponDef('spitter')!
const lance = weaponDef('lance')!
const repeater = weaponDef('repeater')!

console.log('table')
{
  check('three models ship', WEAPONS.length === 3)
  check('ids unique', new Set(WEAPONS.map(w => w.id)).size === 3)
  // REVIEW-PASSES rule 5: every slate is one of the canon five. A typo here is a canon violation,
  // not a build bug, so it is asserted rather than trusted.
  const SLATES = new Set(['SIDEARM', 'SHORTBARREL', 'LONGBARREL', 'BREACHER', 'REACHER'])
  check('every slate is one of the canon five', WEAPONS.every(w => SLATES.has(w.slot)))
  check('canon: the Repeater holds 12', repeater.clip === 12, 'canon says 12 shots before overheat')
  check('every weapon has a positive clip and cooldown', WEAPONS.every(w => w.clip > 0 && w.fireCd > 0))
  check('crit always beats body damage', WEAPONS.every(w => w.crit > w.damage))
  check('ADS is never looser than the hip', WEAPONS.every(w => w.adsSpread <= w.hipSpread))
  check('ADS never moves you faster than hipfire', WEAPONS.every(w => w.adsMove <= w.hipMove))
  check('bloomMax is reachable from zero', WEAPONS.every(w => w.bloomPerShot <= w.bloomMax))
}

console.log('the three feels stay distinct')
{
  // The whole point of three guns. If an extraction flattened them this is what notices.
  check('Lance hits hardest', lance.damage > spitter.damage && lance.damage > repeater.damage)
  check('Spitter fires fastest', spitter.fireCd < lance.fireCd && spitter.fireCd < repeater.fireCd)
  check('Lance is the most accurate aimed', lance.adsSpread < spitter.adsSpread && lance.adsSpread < repeater.adsSpread)
  check('Lance costs the most movement', lance.hipMove < spitter.hipMove && lance.hipMove < repeater.hipMove)
  check('Repeater costs the least movement', repeater.hipMove > spitter.hipMove)
  check('only the Spitter is full-auto', WEAPONS.filter(w => w.auto).length === 1 && spitter.auto)
}

console.log('lookup')
{
  check('by id', weaponDef('lance')?.name === 'LANCE')
  check('unknown id is undefined', weaponDef('railgun') === undefined)
  // A stale weapon index out of a save must never crash the sim mid-frame.
  check('index clamps low', weaponAt(-5).id === WEAPONS[0].id)
  check('index clamps high', weaponAt(99).id === WEAPONS[WEAPONS.length - 1].id)
  check('fractional index truncates', weaponAt(1.9).id === WEAPONS[1].id)
}

console.log('spread + bloom')
{
  check('no bloom → base cone', spreadDeg(spitter, 0, false) === spitter.hipSpread)
  check('ADS narrows it', spreadDeg(spitter, 0, true) < spreadDeg(spitter, 0, false))
  check('bloom widens it', spreadDeg(spitter, 1, false) > spreadDeg(spitter, 0, false))
  // ADS must scale the BLOOM too, not just the base — otherwise aimed fire degrades exactly as fast
  // as hipfire and the stance stops mattering the moment you hold the trigger.
  const adsGrowth = spreadDeg(spitter, 2, true) - spreadDeg(spitter, 0, true)
  const hipGrowth = spreadDeg(spitter, 2, false) - spreadDeg(spitter, 0, false)
  check('★ ADS blooms slower than the hip', adsGrowth < hipGrowth, `${adsGrowth} vs ${hipGrowth}`)

  let b = 0
  for (let i = 0; i < 50; i++) b = bloomAfterShot(spitter, b)
  check('bloom caps', b === spitter.bloomMax)
  check('rest recovers', bloomAfterRest(spitter, b, 0.1) < b)
  check('★ rest never goes negative', bloomAfterRest(spitter, 0.01, 999) === 0,
    'a negative cone inverts the spread math downstream')
}

console.log('fire gate')
{
  check('ready fires', canFire(spitter, 1, 10, 0))
  check('cooldown blocks', canFire(spitter, 0.01, 10, 0) === false)
  check('empty clip blocks', canFire(spitter, 1, 0, 0) === false)
  check('reloading blocks', canFire(spitter, 1, 10, 0.5) === false)
  check('exactly at cooldown fires', canFire(spitter, spitter.fireCd, 1, 0))
}

console.log('reload cost')
{
  check('full clip costs nothing', reloadCost(spitter, spitter.clip) === 0)
  check('empty clip costs full', reloadCost(spitter, 0) === spitter.reloadMana)
  // ★ The rule this exists for: if a partial reload cost full price, the optimal play would be to
  // always run dry first — the opposite of what a reload cost is meant to encourage.
  const half = reloadCost(spitter, spitter.clip / 2)
  check('★ a half clip costs about half', Math.abs(half - spitter.reloadMana / 2) < 1e-9, String(half))
  check('over-full never goes negative', reloadCost(spitter, spitter.clip + 99) === 0)
}

console.log('recoil + move')
{
  check('kick pitch is the weapon\'s', recoilKick(lance, () => 0.5).pitch === lance.kickPitch)
  check('yaw is centred at rand 0.5', Math.abs(recoilKick(lance, () => 0.5).yaw) < 1e-12)
  check('yaw swings both ways', recoilKick(lance, () => 0).yaw < 0 && recoilKick(lance, () => 1).yaw > 0)
  check('yaw stays inside kickYaw', Math.abs(recoilKick(lance, () => 1).yaw) <= lance.kickYaw + 1e-12)
  check('ADS slows you more', moveMult(lance, true) < moveMult(lance, false))
}

console.log('cone sampler')
{
  const unit = (v: [number, number, number]) => Math.abs(Math.hypot(...v) - 1) < 1e-9
  check('zero spread returns forward, normalised', coneDirection(0, 0, -2, 0, 0.5, 0.5).every((c, i) => c === [0, 0, -1][i]))

  // ★ THE DEGENERATE-BASIS BUG. Build the perpendicular basis from a fixed seed vector and the
  // cross product collapses to zero whenever forward is parallel to that seed — the shot then flies
  // to NaN, which reads in-game as "the gun sometimes does nothing". Every axis must be safe.
  for (const f of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
    const d = coneDirection(f[0], f[1], f[2], 3, 0.7, 0.3)
    check(`★ axis-aligned forward (${f}) stays finite and unit`, d.every(Number.isFinite) && unit(d))
  }

  // Samples stay inside the cone, and the cone is actually used.
  let maxAngle = 0
  for (let i = 0; i < 400; i++) {
    const d = coneDirection(0, 0, -1, 4, (i * 0.61803398875) % 1, (i * 0.31830988618) % 1)
    if (!unit(d)) { check('every sample is unit length', false); break }
    maxAngle = Math.max(maxAngle, (Math.acos(Math.min(1, -d[2])) * 180) / Math.PI)
  }
  check('every sample is unit length', true)
  check('samples stay within the cone', maxAngle <= 4 + 1e-6, `max ${maxAngle.toFixed(3)}°`)
  check('the cone is actually used', maxAngle > 3, `max ${maxAngle.toFixed(3)}° — suspiciously tight`)

  // ★ THE sqrt(r1) BUG. Without it the disc is centre-heavy and every gun shoots tighter than its
  // cone claims. Under a uniform disc, HALF the samples land beyond r/sqrt(2) ~= 0.707r.
  const R = 5, outer = R * Math.SQRT1_2
  let beyond = 0, n = 2000
  for (let i = 0; i < n; i++) {
    const d = coneDirection(0, 0, -1, R, (i + 0.5) / n, (i * 0.7548776662) % 1)
    if ((Math.acos(Math.min(1, -d[2])) * 180) / Math.PI > outer) beyond++
  }
  const frac = beyond / n
  check('★ the disc is uniform, not centre-heavy', Math.abs(frac - 0.5) < 0.06,
    `${(frac * 100).toFixed(1)}% beyond r/sqrt2, expected ~50% — a low number means sqrt(r1) was dropped`)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
