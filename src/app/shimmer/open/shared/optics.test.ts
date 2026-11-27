// shared/optics.ts: Alex's defaults by Slate, a per-gun override, true focal-length zoom, and the look slow-down that matches it.
//   npx tsx src/app/shimmer/open/shared/optics.test.ts
import { OPTICS, opticOf, adsFov, adsLookScale, throughScope, SCOPE_IN, isIrons, OPTIC_OF_SLATE_M149 } from './optics'
import { RANGE_GUNS } from './gunplay'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('✗', m) } }
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e
const tanH = (deg: number) => Math.tan((deg * Math.PI) / 360)

// M178 (Alex 11-25, replacing 11-18's red dot / 2x / 3x): EVERY gun's default sight is irons; a long gun's punch in a little further
const by = (id: string) => RANGE_GUNS.find(g => g.id === id)!
for (const id of ['roar', 'spitter', 'repeater']) ok(opticOf(by(id)).id === 'irons', `${id} (a short gun) wears irons`)
for (const id of ['backbone', 'charred-rifle', 'lance']) ok(opticOf(by(id)).id === 'irons-long', `${id} (a long gun) wears the long irons`)
ok(RANGE_GUNS.length >= 6 && RANGE_GUNS.every(g => isIrons(opticOf(g).id)), 'every gun on the racks wears irons by default')
ok(RANGE_GUNS.every(g => !opticOf(g).scoped && !throughScope(opticOf(g), 1)), 'no gun looks through the scope ring by default, even at full ADS')
ok(isIrons('irons') && isIrons('irons-long') && !isIrons('reddot') && !isIrons('scope2') && !isIrons(null), 'isIrons')
// the irons' zoom is modest from BOTH sides: a punch-in you can feel, never a scope's
for (const o of [OPTICS.irons, OPTICS['irons-long']]) ok(o.zoom > 1.05 && o.zoom <= 1.35 && o.mag === 1, `${o.id}: a modest punch-in (${o.zoom})`)
ok(OPTICS['irons-long'].zoom > OPTICS.irons.zoom, "a long gun's irons punch in further than a short gun's")
// the better sights are still there for s2 (bought), worn by no gun by default
ok(OPTICS.scope2.scoped && OPTICS.scope3.scoped && !!OPTICS.prism3 && !!OPTICS.reddot, 'the red dot, scopes and prism code paths stay')
ok(OPTIC_OF_SLATE_M149.LONGBARREL === 'scope2' && OPTIC_OF_SLATE_M149.REACHER === 'scope3', "11-18's defaults kept for s2, not worn")
// the swap is data: a gun naming its own optic (the per-gun sight field) wins over its Slate
ok(opticOf({ slot: 'LONGBARREL', optic: 'reddot' }).id === 'reddot', "a gun's own optic beats its Slate's default")
ok(opticOf({ slot: 'NOPE' }).id === 'irons', 'an unknown Slate falls back to irons')

// zoom is focal length: things look `zoom` times bigger, so tan(fov/2) shrinks by exactly `zoom`
for (const base of [60, 70, 90]) for (const o of Object.values(OPTICS)) {
  ok(near(tanH(base) / tanH(adsFov(base, o)), o.zoom, 1e-9), `${o.id} at ${base}°: true ${o.zoom}x magnification`)
  ok(near(adsLookScale(base, o), 1 / o.zoom, 1e-9), `${o.id} at ${base}°: the look slows by exactly 1/zoom`)
}
// and NOT the naive half-the-fov (which over-zooms): at 70° a 2x is ~38.6°, never 35°
ok(adsFov(70, OPTICS.scope2) > 38 && adsFov(70, OPTICS.scope2) < 39, `2x at 70° is ~38.6°, not 35° (${adsFov(70, OPTICS.scope2).toFixed(2)})`)
// the 1x still punches in a little (no zoom at all reads as broken), but less than any scope
ok(adsFov(70, OPTICS.reddot) < 70 && adsFov(70, OPTICS.reddot) > adsFov(70, OPTICS.scope2), 'the red dot punches in, less than a 2x')
ok(adsFov(70, OPTICS.scope2) > adsFov(70, OPTICS.scope3), 'a 3x zooms further than a 2x')

// the glide: t=0 is your own view, t=1 the sights, and it never overshoots between
for (const o of Object.values(OPTICS)) {
  ok(near(adsFov(70, o, 0), 70), `${o.id}: t=0 is the keeper's own fov`)
  let prev = 70, mono = true
  for (let t = 0.05; t <= 1.0001; t += 0.05) { const f = adsFov(70, o, t); if (f > prev + 1e-9 || f < adsFov(70, o) - 1e-9) mono = false; prev = f }
  ok(mono, `${o.id}: the zoom glides one way, no overshoot`)
}
ok(near(adsFov(70, OPTICS.scope3, 2), adsFov(70, OPTICS.scope3)), 't past 1 clamps')

// the scope ring takes the screen only near full ADS, and never on a red dot
ok(!throughScope(OPTICS.reddot, 1), 'a red dot never goes through a scope ring')
ok(!throughScope(OPTICS.scope2, SCOPE_IN - 0.01) && throughScope(OPTICS.scope2, SCOPE_IN), 'a scope ring only at full ADS')

console.log(`optics: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
