import { readFileSync } from 'node:fs'
// stillwind.test.ts — the Stillwind on the edge: canon's rules, then a scripted keeper who draws it off its line.
import {
  STILLWIND_TUNING as T, startStillwind, stepStillwind, stepStillwindParty, stillwindTarget, hitStillwind, stillwindTakes, edgeHazard, stillwindPhase, lineMend,
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
      // the wind died: step aside of the run (it strikes within runHalf). ⚠ Since the 09-29 balance pass 2.7 is INSIDE
      // the wider band, so it mends there: a keeper who never comes back to the band must stay off it here too
      if (s.wind !== 'blowing') px = returns ? 2.7 * side : lureX * side
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
  // Alex 09-29 (playtest): the fight was too long with too few choices. Now ~2-3 minutes solo, still not a sprint
  ok(shallow.t > 90 && shallow.t < 300 && deep.t > 90, `a fight, not a sprint or a slog (${Math.round(shallow.t)}s / ${Math.round(deep.t)}s)`)
  ok(!greedy.alive, 'a keeper who never comes back to the line burns out')
  ok(lineMend(0, 5) === T.lineMend && lineMend(0, 0.5) === 0 && lineMend(T.safeHalf + 0.5, 5) === 0, 'the line mends: on it, unhurt a moment')
  console.log(`  stillwind: lure 3 → ${Math.round(shallow.t)}s (low ${Math.round(shallow.low)}/200) · lure 7 → ${Math.round(deep.t)}s (low ${Math.round(deep.low)}) · never back → ${greedy.alive ? 'lives?!' : 'dies'} · hp ${T.hp}`)
}

// ── CO-OP (09-29): one Stillwind, a party. It goes after the nearest; a run strikes everyone on the line once each.
{
  // solo through the party step == the solo step, step for step (the wrapper is the whole solo fight)
  const a = startStillwind(), b = startStillwind()
  let same = true
  for (let t = 0; t < 60; t += 0.05) {
    const pz = a.z - 4 + Math.sin(t) * 3, px = Math.sin(t * 0.3) * 6
    const o1 = stepStillwind(a, 0.05, px, pz), o2 = stepStillwindParty(b, 0.05, [{ x: px, z: pz }])
    if (o1.strike !== o2.strikes[0] || a.x !== b.x || a.z !== b.z || a.heat !== b.heat || a.wind !== b.wind) { same = false; break }
  }
  ok(same, 'co-op: a party of one fights exactly the solo fight')

  const s = startStillwind()
  ok(stillwindTarget(s, [{ x: 0, z: s.z - 30 }, { x: 5, z: s.z - 4 }]) === 1, 'co-op: it goes after the nearest keeper')
  ok(stepStillwindParty(s, 0.05, []).target === -1, 'co-op: nobody there, nobody struck')

  // a lurer draws it toward the Glare while a mate stands far back on the line: it follows the LURER, and overheats
  const l = startStillwind(); let opened = false
  for (let t = 0; t < 40 && !opened; t += 0.05) {
    const o = stepStillwindParty(l, 0.05, [{ x: 0, z: l.z - 25 }, { x: 7, z: l.z - 5 }])
    if (o.opened) opened = true
  }
  ok(opened && l.x > T.offTiles, 'co-op: one keeper lures it off the line while the other keeps between')

  // a run passes two keepers on the line and strikes each once; the one off to the side is spared
  const r = startStillwind(); r.wind = 'stalled'; r.windT = 0.01; r.strikeT = 0
  const z0 = r.z, ks = [{ x: 0, z: z0 - 6 }, { x: 1, z: z0 - 12 }, { x: 8, z: z0 - 9 }]
  const got = [0, 0, 0]
  for (let t = 0; t < T.runSec + 0.2; t += 0.05) stepStillwindParty(r, 0.05, ks).strikes.forEach((d, i) => { got[i] += d })
  ok(got[0] === T.runDmg && got[1] === T.runDmg && got[2] === 0, `co-op: a run strikes each keeper on the line once (${got.join('/')})`)
}

// ── ★ THE BALANCE PASS (Alex 09-29): room to stand, a tell to read, phases that change the fight ──
{
  ok(T.safeHalf >= 3 && edgeHazard(T.safeHalf + 1).dps <= T.shoulderBurn && edgeHazard(-(T.safeHalf + 1)).dps <= T.shoulderFrost, '★ a real band to move in, and a shoulder that only nips (room to sidestep)')
  ok(edgeHazard(T.shoulder + 4).dps > edgeHazard(T.shoulder - 1).dps * 3, 'past the shoulder the edge still climbs hard')
  // the swing has a tell: in reach it draws back first; a keeper who steps out of reach during it is not struck
  const s = startStillwind(); s.z = 50; s.x = 0; s.strikeT = 0; s.windT = 99
  const o1 = stepStillwind(s, 0.05, 0, 51.5)
  ok(!!o1.windup && o1.strike === 0 && (s.swingT ?? 0) > 0, 'in reach, it draws back first (the tell), no damage yet')
  let hit = 0; for (let i = 0; i < 20; i++) hit += stepStillwind(s, 0.05, 0, 58).strike
  ok(hit === 0, '★ step out of reach during the tell and the swing misses')
  const s2 = startStillwind(); s2.z = 50; s2.strikeT = 0; s2.windT = 99
  let hit2 = 0; for (let i = 0; i < 20; i++) hit2 += stepStillwind(s2, 0.05, 0, 51.5).strike
  ok(hit2 === T.strikeDmg, 'stay in reach and it lands')
  // phase 2: the sweep is marked, then lands on the band, not on a shoulder
  const s3 = startStillwind(); s3.hp = T.hp * 0.5; s3.z = 20; s3.windT = 99; s3.sweepIn = 0.01; s3.strikeT = 99
  const k = [{ x: 0, z: 80 }, { x: T.safeHalf + 1, z: 80 }]
  const m = stepStillwindParty(s3, 0.05, k)
  ok(!!m.sweepMarked && s3.sweepZ === 80, 'phase 2: a stretch of the band is marked where it hunts')
  let got = [0, 0]; let swept = false
  for (let i = 0; i < 40; i++) { const o = stepStillwindParty(s3, 0.05, k); got = got.map((g, j) => g + o.strikes[j]); swept ||= !!o.swept }
  ok(swept && got[0] === T.sweepDmg && got[1] === 0, '★ the sweep strikes the band once and spares the shoulder: a choice, every time')
  const s4 = startStillwind(); s4.sweepIn = 0.01; s4.windT = 99
  ok(!stepStillwindParty(s4, 0.05, [{ x: 0, z: 40 }]).sweepMarked, 'phase 1 has no sweep')
}

// ── ★ SECOND PASS (Alex 09-29): a wider band, the lee stones, a body you cannot run through, and the way home ──
{
  const { LEE_STONES, onLeeStone, edgeHazardAt, stillwindBlock, edgeHeights, EDGE_ROWS, EDGE_COLS, simToEdge } = require('./stillwind') as typeof import('./stillwind')
  ok(T.safeHalf >= 4.5, 'the band is wide enough to move in (±4.5)')
  ok(LEE_STONES.length >= 16 && LEE_STONES.some((s) => s.x > 0) && LEE_STONES.some((s) => s.x < 0), `lee stones down both sides of the band (${LEE_STONES.length})`)
  const st = LEE_STONES.find((s) => s.x > 0)!
  ok(onLeeStone(st.x, st.z) && !onLeeStone(st.x + 3, st.z), 'a stone is its own 3x3 of ground')
  ok(edgeHazardAt(st.x, st.z).dps === T.shoulderBurn && edgeHazard(st.x).dps > T.shoulderBurn * 2, '★ on a stone the Glare only nips; beside it, it burns (a stone is cheaper, never free)')
  const h = edgeHeights()
  const cell = simToEdge(st.x, st.z)
  ok(h.length === EDGE_ROWS && h[0].length === EDGE_COLS && h[cell.z][cell.x] === 1 && h[cell.z][cell.x + 3] === 0, 'the stones stand one tier up (a walker steps onto them)')
  const s = startStillwind(); s.x = 0; s.z = 50
  const pushed = stillwindBlock(s, 0.3, 50.5)
  ok(!!pushed && Math.hypot(pushed.x - s.x, pushed.z - s.z) >= T.radius, '★ it has a body: a keeper inside it is set back out to its edge')
  ok(stillwindBlock(s, 0, 50 + T.radius + 1) === null, 'a keeper outside its reach of body is left alone')
  const zones = readFileSync(new URL('../world/zones.ts', import.meta.url), 'utf8')
  ok(zones.includes("{ fromX: EDGE_EXIT.x, fromY: EDGE_EXIT.z, toZone: 'travelers-station'"), '★ the way out goes home to the Station, not the Breach')
}

console.log(`stillwind: ${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
