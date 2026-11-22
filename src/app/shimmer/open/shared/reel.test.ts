// THE REEL, RE-RULED 11-16 (shared/reel.ts): the rinn can get away. Run: npx tsx src/app/shimmer/open/shared/reel.test.ts
// The keepers here are stand-ins for a person: `keen` follows the zone with a fifth of a second's lag (a person
// watching the bar), `clumsy` holds the button the whole time, `idle` never touches it.
import { newReel, stepReel, landed, gone, PATTERNS, PATTERN_TELL, STRAIN_S, BOB_ACCEL, BOB_DRAG, SPLASHES, type Reel, type Pattern } from './reel'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
let seed = 11; const rng = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296 }
const DT = 1 / 60
const run = (p: Pattern, tier: number, ctl: (r: Reel) => boolean, lag = 0, ease = 1) => {
  let r = newReel(p, tier, rng, ease); const seen: Reel[] = []
  while (r.state === 'on' && r.t < 120) { seen.push(r); r = stepReel(r, DT, ctl(seen[Math.max(0, seen.length - 1 - lag)]), rng) }
  return r
}
const track = (r: Reel) => (r.zone - r.bob) * 6 + (r.zoneV - r.bobV) * 1.6 > 0
const rate = (p: Pattern, tier: number, lag: number, n = 30, ease = 1) => {
  let land = 0, t = 0
  for (let i = 0; i < n; i++) { const r = run(p, tier, track, lag, ease); if (landed(r)) { land++; t += r.t } }
  return { land: land / n, t: t / Math.max(1, land) }
}

for (const p of PATTERNS) {
  ok(!!PATTERN_TELL[p], `${p}: no tell for the reel bar`)
  // ★ the re-ruling: it CAN be lost, and the two lazy plays lose it
  ok(gone(run(p, 1, () => true)), `${p}: holding the whole time still landed it (taking against every fight must lose it)`)
  ok(gone(run(p, 1, () => false)), `${p}: never touching the button still landed it`)
  // a keeper who watches the bar lands the common ones, every habit
  const t1 = rate(p, 1, 12)
  ok(t1.land >= 0.95, `${p}: a keen keeper landed only ${(t1.land * 100).toFixed(0)}% of tier 1`)
  ok(t1.t > 4 && t1.t < 12, `${p}: a tier 1 reel lasts ${t1.t.toFixed(1)} s (want 4–12)`)
  // a rarer rinn is a longer reel, never a shorter one
  const t4 = rate(p, 4, 0)
  ok(t4.land >= 0.9 && t4.t > t1.t, `${p}: tier 4 is not a longer reel than tier 1 for a perfect keeper (${t4.t.toFixed(1)} vs ${t1.t.toFixed(1)} s)`)
}
// the rare ones are hard for a person: across the habits, a keen keeper loses a real share of tier 4
const t4all = PATTERNS.map(p => rate(p, 4, 12).land), mean4 = t4all.reduce((a, b) => a + b, 0) / t4all.length
// M90 (Alex 11-22): three splashes before it is gone + a slower bobber made the rare ones kinder: a keen keeper ~92% (was <85%)
ok(mean4 < 0.97 && mean4 > 0.2, `tier 4: a keen keeper lands ${(mean4 * 100).toFixed(0)}% (want not hopeless and not certain, 20–97%)`)
// the rinstick's ease widens the zone, so it lands more of the hard ones
const eased = PATTERNS.map(p => rate(p, 4, 12, 30, 1.35).land).reduce((a, b) => a + b, 0) / PATTERNS.length
ok(eased > mean4, `ease: a better rinstick landed no more tier 4 (${(eased * 100).toFixed(0)}% vs ${(mean4 * 100).toFixed(0)}%)`)
// a graze is not a loss: one step at the edge, then back inside, keeps it on
{
  let r = newReel('steady', 1, rng); r = { ...r, bob: r.zone + r.half * 1.2 }
  r = stepReel(r, DT, false, rng); r = { ...r, bob: r.zone }
  for (let i = 0; i < 10; i++) r = stepReel(r, DT, track(r), rng)
  ok(r.state === 'on', 'edge: a single frame at the edge lost the rinn (a graze must not be a loss)')
  let s = newReel('steady', 1, rng)
  for (let i = 0; i < Math.ceil(STRAIN_S / DT) + 4; i++) s = stepReel({ ...s, bob: Math.min(1, s.zone + s.half * 1.3) }, DT, false, rng)
  ok(s.state === 'on' && s.splashes === 1, `edge: held past the edge for ${STRAIN_S} s = a splash, still on (M90; state ${s.state}, splashes ${s.splashes})`)
  for (let i = 0; i < (SPLASHES - 1) * (Math.ceil(STRAIN_S / DT) + 4) && s.state === 'on'; i++) s = stepReel({ ...s, bob: Math.min(1, s.zone + s.half * 1.3) }, DT, false, rng)
  ok(gone(s), `edge: kept past the edge for ${SPLASHES} strain-outs and it did not get away`)
}

// ── M88 (Alex 11-22 playtest): the far wall is open water, never an edge ──────────────────────────────────────────────
// A rinn run out to the far end pins its zone there (left edge at 0); a keeper who lets go rests the bobber at 0. That is
// NOT touching the zone's edge: before M88 it read off = 1.0 and the rinn was gone 0.35 s later with nothing to do.
{ let r: Reel = { ...newReel('steady', 1, rng), zone: 0.17, half: 0.17, zoneV: -0.2, bob: 0, bobV: 0 }
  const hold = () => ({ ...r, leg: 1, legLeft: 5 })   // steady's fight leg the whole time: it runs out and stays pinned at the wall
  for (let t = 0; t < 3; t += 1 / 60) { r = stepReel(hold(), 1 / 60, false, rng); if (r.state !== 'on') break }
  ok(r.state === 'on' && r.strain === 0, `M88: zone pinned at the far wall + bobber resting at 0 for 3 s = no strain, still on (state ${r.state}, strain ${r.strain.toFixed(2)})`)
}
// the row's keeper (M88): hold while the zone is above the bobber, let go while it is below. Lands every pattern at tier 1.
// (With a person's fifth-of-a-second lag a sign-only keeper oscillates out of the zone on the bobber's weight: that is
// the designed skill, and `keen` above, which also reads the zone's motion, lands them. Measured 11-22.)
// The discriminating one: a keeper who reads the bar but LETS GO whenever the rinn has run out to the wall (the bobber
// comes to rest on it). Before M88 that lost roller 16/40, sulker 8/40, darter 8/40 at tier 1; now it must land them.
{ const keeper = (pattern: Pattern, tier: number, sd: number, ctl: (r: Reel) => boolean) => {
    seed = sd; let r = newReel(pattern, tier, rng)
    for (let t = 0; t < 60 && r.state === 'on'; t += 1 / 60) r = stepReel(r, 1 / 60, ctl(r), rng)
    return r.state
  }
  const sign = (r: Reel) => r.zone > r.bob
  const restsAtWall = (r: Reel) => r.zone - r.half < 0.02 ? false : (r.zone - r.bob) * 6 + (r.zoneV - r.bobV) * 1.6 > 0
  const rate: Record<string, string> = {}
  for (const tier of [1, 2, 3, 4]) for (const pt of PATTERNS) {
    let a = 0, b = 0
    for (let k = 0; k < 40; k++) { if (keeper(pt, tier, 500 + k * 7, sign) === 'landed') a++; if (keeper(pt, tier, 500 + k * 7, restsAtWall) === 'landed') b++ }
    rate[`${pt}@${tier}`] = `sign ${a} wall ${b}`
    if (tier === 1) { ok(a === 40, `M88: the read-the-bar keeper lands every ${pt} at tier 1 (${a}/40)`); ok(b >= 38, `M88: resting on the far wall no longer loses ${pt} at tier 1 (${b}/40)`) }
  }
  if (process.env.REEL_RATES) console.log(JSON.stringify(rate))
}

// ── M90 (Alex 11-22: "i just spent 16 bait an didnt catch anything") ─────────────────────────────────────────────────
// (1) the bobber is 20% slower: top speed (ACCEL / DRAG) 0.75 -> 0.6 bar/s
ok(Math.abs(BOB_ACCEL / BOB_DRAG - 0.6) < 1e-9, `M90: bobber top speed is 0.6 bar/s (${(BOB_ACCEL / BOB_DRAG).toFixed(3)})`)
// (2) a strain-out is a SPLASH: strain resets, the rinn stays on; the third splash and it is gone
{ seed = 77; let r: Reel = { ...newReel('steady', 1, rng), zone: 0.6, half: 0.17, zoneV: 0, bob: 0.6 + 0.17, bobV: 0 }
  const outside = (x: Reel): Reel => ({ ...x, zone: 0.6, zoneV: 0, bob: 0.6 + x.half, bobV: 0, leg: 0, legLeft: 9 })   // held at the edge
  const seen: { splashes: number; state: string; strain: number }[] = []
  let last = 0
  for (let t = 0; t < 5 && r.state === 'on'; t += 1 / 60) { r = stepReel(outside(r), 1 / 60, false, rng); if ((r.splashes ?? 0) !== last) { last = r.splashes ?? 0; seen.push({ splashes: last, state: r.state, strain: r.strain }) } }
  ok(SPLASHES === 3, 'M90: three splashes')
  ok(seen[0]?.splashes === 1 && seen[0].state === 'on' && seen[0].strain === 0, `M90: strain-out 1 = a splash, strain reset, still on (${JSON.stringify(seen[0])})`)
  ok(seen[1]?.splashes === 2 && seen[1].state === 'on', `M90: strain-out 2 = a splash, still on (${JSON.stringify(seen[1])})`)
  ok(seen[2]?.splashes === 3 && seen[2].state === 'gone', `M90: strain-out 3 = gone (${JSON.stringify(seen[2])})`)
}

if (fails.length) { console.error(`reel: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`reel: ${pass}/0`)
