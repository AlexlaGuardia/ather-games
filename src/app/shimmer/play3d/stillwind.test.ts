// stillwind.test.ts — the Stillwind on the edge: canon's rules, then a scripted keeper who draws it off its line.
import {
  STILLWIND_TUNING as T, startStillwind, stepStillwind, hitStillwind, stillwindTakes, edgeHazard, stillwindPhase, lineMend,
  type StillwindState,
} from './stillwind'

let pass = 0; const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }
const run = (s: StillwindState, secs: number, px: number, pz: number | (() => number)) => {
  let strike = 0, stalls = 0, runs = 0, opened = 0, froze = 0
  for (let t = 0; t < secs; t += 0.05) {
    const o = stepStillwind(s, 0.05, px, typeof pz === 'function' ? pz() : pz)
    strike += o.strike; if (o.stalled) stalls++; if (o.ran) runs++; if (o.opened) opened++; if (o.froze) froze++
  }
  return { strike, stalls, runs, opened, froze }
}

// step until a condition holds (or give up), so a mood is checked while it is still on
const until = (s: StillwindState, secs: number, px: number, pz: () => number, done: () => boolean) => {
  for (let t = 0; t < secs && !done(); t += 0.05) stepStillwind(s, 0.05, px, pz())
  return done()
}

// ── the edge (canon: step toward the Glare and you burn; toward the Rime and you freeze) ──
{
  ok(edgeHazard(0).dps === 0 && edgeHazard(T.safeHalf * 0.9).side === 'line', 'the line is safe')
  const g = edgeHazard(6), r = edgeHazard(-6)
  ok(g.side === 'glare' && g.dps > 0 && g.slow === 0, `toward the Glare: it burns (${g.dps.toFixed(0)}/s)`)
  ok(r.side === 'rime' && r.dps > 0 && r.slow > 0, `toward the Rime: it freezes and slows (${r.dps.toFixed(0)}/s, −${Math.round(r.slow * 100)}%)`)
  ok(edgeHazard(9).dps > edgeHazard(4).dps && edgeHazard(T.halfWidth).dps === T.burnMax, 'deeper is worse, up to a cap')
}

// ── on its line it barely takes a scratch ──
{
  const s = startStillwind()
  ok(stillwindTakes(s) === T.lineDmg, 'on its line: a tenth of a hit')
  // a keeper who stands on the line and pours in 40 dmg/s for five minutes does not fell it
  let t = 0
  for (; t < 300 && !s.felled; t += 0.05) { stepStillwind(s, 0.05, 0, s.z - 8); hitStillwind(s, 40 * 0.05) }
  ok(!s.felled, `standing on its line and shooting for 5 min: not felled (hp ${Math.round(s.hp)}/${T.hp})`)
}

// ── drawn toward the Glare it runs hot, and opens ──
{
  const s = startStillwind(); s.windT = 1e9
  ok(until(s, 30, 6, () => s.z - 6, () => s.mood === 'open'), `lured to the Glare side: it overheats and opens (${s.elapsed.toFixed(1)}s)`)
  ok(stillwindTakes(s) === T.openDmg, 'open: a hit lands ×3')
  const z = s.z
  run(s, 1, 6, z - 6)
  ok(Math.abs(s.z - z) < 1e-9, 'open: it stands still')
  run(s, T.openSec, 0, z - 20)
  ok(s.mood === 'walk' && s.heat === 0, 'then it closes and walks again, cooled')
}

// ── drawn toward the Rime it runs cold, and turns brittle ──
{
  const s = startStillwind(); s.windT = 1e9
  ok(until(s, 30, -6, () => s.z - 6, () => s.mood === 'brittle') && stillwindTakes(s) === T.brittleDmg, 'lured to the Rime side: brittle, a hit lands ×2')
  const z0 = s.z; run(s, 1, 0, z0 - 30)
  const crawl = Math.abs(z0 - s.z)
  ok(crawl > 0 && crawl < T.speed * 0.6, `brittle: it crawls (${crawl.toFixed(2)} tiles in 1s)`)
}

// ── the tell: the wind stalls, then it runs the line ──
{
  const s = startStillwind(); const standZ = s.z - 60   // it stands its ground on the line, out of its reach until it runs
  const onLine = run(s, T.stallEvery + T.stallSec + T.runSec + 0.5, 0, standZ)
  ok(onLine.stalls === 1 && onLine.runs === 1, 'the wind stalls once, then it runs once')
  ok(onLine.strike >= T.runDmg, 'a keeper on the line when it runs is struck')
  const s2 = startStillwind(); const asideZ = s2.z - 60
  const aside = run(s2, T.stallEvery + T.stallSec + T.runSec + 0.5, 4, asideZ)
  ok(aside.runs === 1 && aside.strike === 0, 'a keeper off the line lets it run past')
  // every run comes after a stall
  const s3 = startStillwind(); let stalled = false, bad = 0
  for (let t = 0; t < 200; t += 0.05) { const o = stepStillwind(s3, 0.05, 5, s3.z - 12); if (o.stalled) stalled = true; if (o.ran) { if (!stalled) bad++; stalled = false } }
  ok(bad === 0, 'it never runs without the wind stalling first')
}

// ── phases ──
{
  const s = startStillwind()
  ok(stillwindPhase(s) === 1, 'full: phase 1')
  s.hp = T.hp * 0.5; ok(stillwindPhase(s) === 2, 'half: phase 2')
  s.hp = T.hp * 0.2; ok(stillwindPhase(s) === 3, 'a fifth: phase 3')
}

// ── ★ a keeper who draws it off its line fells it and lives; one who never comes back to the line does not ──
{
  // 100 hp + 100 shield, no other healing: the line's mend is the only way back
  const fight = (lureX: number, returns: boolean) => {
    const s = startStillwind()
    let hp = 100, sh = 100, low = 200, t = 0, side = 1, px = 0, since = 99
    for (; t < 900 && !s.felled && hp > 0; t += 0.05) {
      if (s.wind !== 'blowing') px = 2.7 * side                   // the wind died: just off the line
      else if (s.mood !== 'walk') px = returns ? 0 : lureX * side // it's open or brittle: back to the line, shoot
      else px = lureX * side                                      // lure it
      const o = stepStillwind(s, 0.05, px, s.z > 20 ? s.z - 7 : s.z + 7)
      let d = o.strike + edgeHazard(px).dps * 0.05
      since = d > 0 ? 0 : since + 0.05
      sh = Math.min(100, sh + lineMend(px, since) * 0.05)
      const a = Math.min(sh, d); sh -= a; d -= a; hp -= d
      low = Math.min(low, Math.max(0, hp) + sh)
      if (o.opened || o.froze) side = -side
      hitStillwind(s, 30 * 0.05)
    }
    return { felled: s.felled, t, low, alive: hp > 0 }
  }
  const shallow = fight(3, true), deep = fight(7, true), greedy = fight(5, false)
  ok(shallow.felled && shallow.alive && deep.felled && deep.alive, `drawing it off and coming back to the line: felled, alive (${Math.round(shallow.t)}s / ${Math.round(deep.t)}s)`)
  ok(deep.t < shallow.t && Math.abs(deep.low - shallow.low) < 40, 'a deeper lure is a faster fight at about the same risk — a choice, not a trap')
  ok(shallow.t > 150 && shallow.t < 420 && deep.t > 150, 'a fight, not a sprint or a slog')
  ok(!greedy.alive, 'a keeper who never comes back to the line burns out')
  ok(lineMend(0, 5) === T.lineMend && lineMend(0, 0.5) === 0 && lineMend(3, 5) === 0, 'the line mends: on it, unhurt a moment')
  console.log(`  stillwind: lure 3 → ${Math.round(shallow.t)}s (low ${Math.round(shallow.low)}/200) · lure 7 → ${Math.round(deep.t)}s (low ${Math.round(deep.low)}) · never back → ${greedy.alive ? 'lives?!' : 'dies'} · hp ${T.hp}`)
}

console.log(`stillwind: ${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
