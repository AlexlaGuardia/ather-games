// shared/fp-gun.tsx + sight-marks.ts: aiming puts EVERY gun's sight line dead on the camera axis (so the etched mark sits at screen
// centre with no HUD crosshair), and the etching lights only while mana runs through a drawn gun (canon: never a free light).
//   npx tsx src/app/shimmer/open/shared/fp-gun.test.ts
import { modelOf, sightOf, adsPos, VM, defaultsFor, selectGunTune, GUN_DEFAULTS, GUN_TUNE_KEYS } from './fp-gun'
import { readFileSync } from 'node:fs'
import { opticOf } from './optics'
import { RANGE_GUNS } from './gunplay'
import { MARKS, TINTS, markGlow, MARK_IDLE, MARK_FLARE_MS, defaultLook, isLook } from './sight-marks'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('✗', m) } }
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e

// ── the sight line: gun-local sight point, scaled and placed at adsPos, lands at (0, 0, -ADS_DIST) in the camera's frame ──
for (const g of RANGE_GUNS) {
  const m = modelOf(g), o = opticOf(g), s = sightOf(m, o), p = adsPos(m, o)
  const x = p[0], y = p[1] + s.y * VM.S, z = p[2] + s.z * VM.S
  ok(near(x, 0) && near(y, 0) && near(z, -VM.ADS_DIST), `${g.id}: aimed, the sight sits on the camera axis (${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)})`)
  ok(s.y > m.top, `${g.id}: the sight line rides above the receiver`)
  ok(p[1] < 0, `${g.id}: aimed, the gun sits BELOW the eye (you look over it, not through it)`)
}
// one silhouette per Slate, Kael's rifle its own; every gun has a model
ok(RANGE_GUNS.every(g => modelOf(g).parts.length > 0), 'every gun on the racks has a model')
ok(modelOf({ id: 'charred-rifle', slot: 'LONGBARREL' }) !== modelOf({ id: 'backbone', slot: 'LONGBARREL' }), "Kael's Charred Rifle is not just a Backbone")
ok(modelOf({ id: 'charred-rifle', slot: 'LONGBARREL' }).parts.some(p => p.c === 'ember'), 'the Charred Rifle carries its lit charge seam')

// ── the etching (canon: lights faintly when mana runs through the gun; no free light) ──
ok(markGlow(false, 1000, 990, 1) === 0, 'stowed: the mark is dark, whatever else is happening')
// FAINT is a claim from both sides (never fitted to MARK_IDLE itself): lit, so not dark, and well short of a firing flare
const idle = markGlow(true, 10000, -Infinity, 0)
ok(idle >= 0.15 && idle <= 0.5, `drawn and quiet: the mark lights FAINTLY, neither dark nor full (${idle})`)
ok(markGlow(true, 1000, 1000, 0) === 1, 'a round leaving: the mark flares full')
ok(near(markGlow(true, 1000 + MARK_FLARE_MS, 1000, 0), idle), 'the flare fades back to faint, not to dark')
ok(markGlow(true, 1000 + MARK_FLARE_MS / 2, 1000, 0) > MARK_IDLE && markGlow(true, 1000 + MARK_FLARE_MS / 2, 1000, 0) < 1, 'mid-flare is between')
ok(markGlow(true, 10000, -Infinity, 1) === 1 && markGlow(true, 10000, -Infinity, 0.5) > MARK_IDLE, 'a building charge (the Charred Rifle) lights it')
ok(markGlow(true, 10000, -Infinity, 9) <= 1, 'never brighter than full')

// ── the cut is the owner's (look only) ──
ok(defaultLook(false).mark === 'dot' && defaultLook(true).mark === 'cross', 'defaults: a dot on a red-dot sight, a cross in a scope')
ok(Object.values(MARKS).every(k => k.strokes.length > 0), 'every cut has something etched')
ok(isLook({ mark: 'ring', tint: 'mana' }) && !isLook({ mark: 'laser', tint: 'mana' }) && !isLook({ mark: 'ring', tint: 'neon' }) && !isLook(null), 'a stored look is checked before it is trusted')
ok(Object.values(TINTS).every(t => /^#[0-9a-f]{6}$/i.test(t.hex)), 'every tint is a colour')

// Alex's 11-22 per-gun hands (SPITTER + BACKBONE) are the SHIPPED numbers: every key of the handoff file, read from the file itself
{ const tune = JSON.parse(readFileSync(new URL('../../../../../docs/handoff/gun-hands-tune-2026-11-22.json', import.meta.url), 'utf8')) as Record<string, Record<string, number>>
  for (const g of ['spitter', 'backbone']) {
    ok(GUN_TUNE_KEYS.every(k => defaultsFor(g)[k] === tune[g][k]) && Object.keys(tune[g]).length === GUN_TUNE_KEYS.length, `${g}: every hands key ships as Alex tuned it`)
    selectGunTune(g); ok(GUN_TUNE_KEYS.every(k => VM[k] === tune[g][k]), `${g}: in hand, the live numbers are his`)
  }
  ok(defaultsFor('backbone').KICK_DECAY !== defaultsFor('spitter').KICK_DECAY && defaultsFor('repeater').S === 1.18, 'each gun keeps its own tune (the Repeater untouched)')
  ok(GUN_TUNE_KEYS.every(k => defaultsFor('breacher')[k] === GUN_DEFAULTS[k]), 'an untuned gun stays on the base') }

console.log(`fp-gun: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
