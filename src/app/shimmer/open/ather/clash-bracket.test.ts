// BETA M233 v2a: the Clash line-up tree (clash-bracket.ts) and the bout runner seam's placeholder (clash-bout.ts).
// Run: npx tsx src/app/shimmer/open/ather/clash-bracket.test.ts
import { newBracket, nextBout, recordBout, keeperOut, keeperWon, runOver, hasYou, YOU, type Bracket } from './clash-bracket'
import { placeholderRunner, fightRunner, timeline, decideBout, PLACEHOLDER_S, RING_R, NEAR } from './clash-bout'
import { evenSpirit, clashLineup } from './fair-clash'
import { LINEUP_SIZE } from './fair-clash-rules'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── the tree ──
const b0 = newBracket(LINEUP_SIZE)
ok(b0.size === 4 && b0.bouts.length === 3, `3 foes + her = 4 entrants, 3 bouts (${b0.size}/${b0.bouts.length})`)
ok(b0.bouts[0].a === 1 && b0.bouts[0].b === 2 && !hasYou(b0.bouts[0]), 'the first bout is the troupe\'s own (1 v 2)')
ok(b0.bouts[1].a === 3 && b0.bouts[1].b === YOU, 'her bout comes second, against the last of the line-up')
ok(b0.bouts[2].a === null && b0.bouts[2].b === null && b0.bouts[2].round === 1, 'the final waits on both semis')
ok(nextBout(b0) === 0, 'bouts run in order: the troupe\'s first')
const b1 = recordBout(b0, 0, 2)
ok(b1.bouts[2].a === 2 && b1.bouts[2].b === null && b0.bouts[0].winner === null, 'the winner moves up the tree (and the old tree is untouched)')
ok(nextBout(b1) === 1, 'then it is her turn')
const lost = recordBout(b1, 1, 3)
ok(keeperOut(lost) && runOver(lost) && nextBout(lost) === null && !keeperWon(lost), 'beaten = her run is over (no final)')
const b2 = recordBout(b1, 1, YOU)
ok(b2.bouts[2].a === 2 && b2.bouts[2].b === YOU && nextBout(b2) === 2 && !runOver(b2), 'she wins her semi: the final is 2 v her')
const won = recordBout(b2, 2, YOU)
ok(keeperWon(won) && runOver(won) && nextBout(won) === null, 'she wins the final = the tent is won')
let threw = false; try { recordBout(b0, 0, YOU) } catch { threw = true }
ok(threw, 'a winner who was not in the bout is refused')
threw = false; try { newBracket(4) } catch { threw = true }
ok(threw, 'a field that is not a power of two is refused')
const b8 = newBracket(7)
ok(b8.bouts.length === 7 && b8.bouts[3].b === YOU && b8.bouts[6].round === 2, 'a field of 8: her bout last in round one, 3 rounds')
let b8r: Bracket = b8
for (let i = 0; i < 4; i++) b8r = recordBout(b8r, i, i === 3 ? YOU : b8r.bouts[i].a!)
ok(b8r.bouts[4].a === 1 && b8r.bouts[4].b === 3 && b8r.bouts[5].a === 5 && b8r.bouts[5].b === YOU && nextBout(b8r) === 4, 'round two pairs the winners in order')

// ── the placeholder runner (the seam v2b-2 swaps the live engine into) ──
const line = clashLineup(1, 0, 'easy')
const me = () => evenSpirit('fox', 'base', 'easy'), foe = (i: number) => evenSpirit(line[i].species, line[i].element, 'easy')
let wins = 0
for (let i = 0; i < 60; i++) if (decideBout({ spirit: me(), keeper: true }, { spirit: foe(2) }, 'easy').winner === 'a') wins++
ok(wins >= 36, `an easy tent stays winnable for her fox (${wins}/60 bouts)`)
const play = placeholderRunner.run({ spirit: me(), keeper: true }, { spirit: foe(2) }, { tier: 'easy' })
const troupe = placeholderRunner.run({ spirit: foe(0) }, { spirit: foe(1) }, { tier: 'easy' })
ok(play.duration === PLACEHOLDER_S.keeper && play.over(play.duration) && !play.over(1) && play.winner() !== null && troupe.duration === PLACEHOLDER_S.troupe, 'her bout runs longer than the troupe\'s')
const evs = play.events ?? []
ok(evs[0].kind === 'start' && evs[evs.length - 1].kind === 'end' && evs.some(e => e.kind === 'hit'), 'events: start, hits, end')
const end = play.at(play.duration!), lose = play.winner() === 'a' ? end.b : end.a, win = play.winner() === 'a' ? end.a : end.b
ok(lose.hp === 0 && lose.act === 'down' && win.act === 'win' && win.hp > 0, `the bout ends with the loser down (${lose.hp}/${lose.act}, ${win.hp.toFixed(2)}/${win.act})`)
const st = play.at(0)
ok(st.a.hp === 1 && st.b.hp === 1, 'both start at full HP')
let inRing = true, faceOk = true, hpDown = true, prevA = 1, prevB = 1
for (let t = 0; t <= play.duration!; t += 0.1) {
  const f = play.at(t)
  for (const p of [f.a, f.b]) if (Math.hypot(p.x, p.z) > RING_R * 0.95 && t > 1.2) inRing = false
  if (Math.abs(Math.atan2(f.b.x - f.a.x, f.b.z - f.a.z) - f.a.face) > 1e-6) faceOk = false
  if (f.a.hp > prevA + 1e-9 || f.b.hp > prevB + 1e-9) hpDown = false
  prevA = f.a.hp; prevB = f.b.hp
}
ok(inRing, 'they pace inside the ring')
ok(faceOk, 'she faces her opponent')
ok(hpDown, 'HP only goes down through a bout (no cheer yet)')
const tl = timeline('b', [{ by: 'b', hpA: 0.5, hpB: 1 }, { by: 'b', hpA: 0, hpB: 1 }], 10)
ok(tl.at(1).a.hp === 1 && tl.at(4).a.hp === 0.5 && tl.at(9).a.hp === 0 && tl.at(10).a.act === 'down' && tl.winner() === 'b', 'a timeline drops HP at each blow')
const mid = tl.at(1.4)
ok(mid.b.act === 'strike' && Math.hypot(mid.a.x - mid.b.x, mid.a.z - mid.b.z) < NEAR + 0.5, 'the striker closes in at a blow')


// ── the live engine behind the seam (fightRunner: clash-fight.ts stepped as the ring asks) ──
{
  const lv = fightRunner.run({ spirit: me(), keeper: true }, { spirit: foe(2) }, { tier: 'easy' })
  const f0 = lv.at(0)
  ok(f0.a.hp === 1 && f0.b.hp === 1 && f0.a.x < 0 && f0.b.x > 0, `a live bout starts at full HP, the two apart (${f0.a.x.toFixed(2)}, ${f0.b.x.toFixed(2)})`)
  let t = 0, acts = new Set<string>(), cues = new Set<string>(), hpDrop = false, inside = true, cheered = false
  for (; t < 400 && !lv.over(t); t += 0.05) {
    const f = lv.at(t)
    if (t > 2 && !cheered && f.a.hp < 0.92 && f.a.hp > 0) { const c1 = lv.cheer!('a'); const f2 = lv.at(t + 0.06); const c2 = lv.cheer!('a'); cheered = c1 && !c2 && f2.a.cheered === true && f2.a.hp > f.a.hp }
    for (const p of [f.a, f.b]) { acts.add(p.act); if (p.cue) cues.add(p.cue); if (Math.hypot(p.x, p.z) > RING_R + 0.01) inside = false }
    if (f.a.hp < 1 || f.b.hp < 1) hpDrop = true
  }
  const end = lv.at(t), w = lv.winner()
  ok(lv.over(t) && w !== null && t < 300, `the live bout ends (${t.toFixed(1)} s, winner ${w})`)
  ok(hpDrop && (w === 'a' ? end.b : end.a).hp === 0 && (w === 'a' ? end.b : end.a).act === 'down' && (w === 'a' ? end.a : end.b).act === 'win', 'blows land, the loser is down at 0 HP')
  ok(acts.has('windup') && acts.has('strike') && acts.has('walk'), `the ring sees wind-ups, strikes and footwork (${[...acts].join(' ')})`)
  ok(cues.has('hit'), `cues float over the struck (${[...cues].join(' ')})`)
  ok(inside, 'the engine\'s ring is drawn inside the ring\'s wall')
  ok(cheered, `her cheer lands once (+HP, cheered), a second is refused (${cheered})`)
}

console.log(`clash-bracket: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗', f)
process.exit(fails.length ? 1 : 0)
