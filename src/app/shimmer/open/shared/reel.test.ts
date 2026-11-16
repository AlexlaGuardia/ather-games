// THE REEL, RE-RULED 11-16 (shared/reel.ts): the rinn can get away. Run: npx tsx src/app/shimmer/open/shared/reel.test.ts
// The keepers here are stand-ins for a person: `keen` follows the zone with a fifth of a second's lag (a person
// watching the bar), `clumsy` holds the button the whole time, `idle` never touches it.
import { newReel, stepReel, landed, gone, PATTERNS, PATTERN_TELL, STRAIN_S, type Reel, type Pattern } from './reel'

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
ok(mean4 < 0.85 && mean4 > 0.2, `tier 4: a keen keeper lands ${(mean4 * 100).toFixed(0)}% (want hard but not hopeless, 20–85%)`)
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
  ok(gone(s), `edge: held past the edge for ${STRAIN_S} s and it did not get away`)
}

if (fails.length) { console.error(`reel: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`reel: ${pass}/0`)
