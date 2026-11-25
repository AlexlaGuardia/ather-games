// Run: npx tsx src/app/shimmer/open/ather/glade-tutorial.test.ts
// M68 s1: Greg's chain in order (The Wilds? only after Moglins? + Spirits?; the gate ask only after all four), each gift once
// (a reload = parse(save) cannot re-gift), Tess's packet holds exactly one grade-A seed, Fennel's jar once per in-game day,
// older saves migrate as DONE, and every line id the build reads exists in the signed lines.
import { freshTut, legacyTut, gregScreen, heardWelcome, heardMoglins, heardSpirits, heardWilds, answerGate, hearFriend, friendScreen, gift, GIFT_OF, allHeard, firstStepsOn, endFirstSteps, tessPacket, TESS_SEEDS, claimJar, jarFull, JAR_BAIT, parseTut, adoptTut, FRIENDS } from './glade-tutorial'
import { GLADE_LINES, line } from './glade-tutorial-lines'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const rt = <T,>(t: T) => parseTut(JSON.parse(JSON.stringify(t)))!

let t = freshTut()
ok(gregScreen(t).kind === 'welcome', 'a newborn meets Greg on welcome')
t = heardWelcome(t)
let s = gregScreen(t)
ok(s.kind === 'hub' && s.choices.join() === 'a,b', 'hub: Moglins? + Spirits?, no The Wilds? yet')
ok(heardWilds(t) === t, 'The Wilds? refused before both are heard')
t = heardMoglins(t); s = gregScreen(t)
ok(s.kind === 'hub' && s.choices.join() === 'b', 'Moglins heard: Spirits? left')
t = heardSpirits(t)
let g = gift(t, 'grimoire'); ok(g.fresh, 'Spirits hands the grimoire'); t = g.t
ok(!gift(t, 'grimoire').fresh && !gift(rt(t), 'grimoire').fresh, 'the grimoire never twice, reload included')
s = gregScreen(t); ok(s.kind === 'hub' && s.choices.join() === 'c', 'both heard: The Wilds? opens')
// friends before Greg sends you do not tick the quest
ok(hearFriend(t, 'otto') === t, 'a friend heard before The Wilds? does not count')
t = heardWilds(t)
ok(gregScreen(t).kind === 'pending', 'sent: Greg barks pending until all four')
ok(answerGate(t, true) === t, 'no gate answer before all four')
for (const f of FRIENDS) {
  ok(friendScreen(t, f) === 'greet', `${f}: greet first`)
  t = hearFriend(t, f); const r = gift(t, GIFT_OF[f]); ok(r.fresh, `${f}: gift lands`); t = r.t
  ok(friendScreen(t, f) === 'bark' && !gift(rt(t), GIFT_OF[f]).fresh, `${f}: then bark, gift never again (reload)`)
  ok(hearFriend(t, f) === t, `${f}: heard once`)
}
ok(GIFT_OF.otto === 'spike' && GIFT_OF.bonn === 'pruner' && GIFT_OF.tess === 'seeds' && GIFT_OF.fennel === 'rinquest', 'gardens table: Otto spike, Bonn pruner, Tess seeds, Fennel the quest')
ok(allHeard(t), 'all four heard')   // the quest's steps: first-steps.test.ts (M146)
ok(gregScreen(t).kind === 'ask', 'all four heard: the gate ask')
t = answerGate(t, false); ok(t.b2 === 'asked' && gregScreen(t).kind === 'ask', 'Not yet: asked again next talk')
t = answerGate(t, true); ok(gregScreen(t).kind === 'open', "I'll go: bark.open")
ok(JSON.stringify(rt(t)) === JSON.stringify(t), 'state round-trips')

// Tess: exactly one grade-A seed of the eight, every roll
const total = TESS_SEEDS.reduce((a, x) => a + x.n, 0)
for (let k = 0; k < total; k++) {
  const p = tessPacket((k + 0.5) / total), n = p.reduce((a, x) => a + x.n, 0), a = p.filter(x => x.id.endsWith(':A'))
  ok(n === total && a.length === 1 && a[0].n === 1, `packet ${k}: ${total} seeds, one grade-A`)
}
ok(tessPacket(0.999).some(x => x.id.endsWith(':A')) && tessPacket(0).some(x => x.id.endsWith(':A')), 'edge rolls still give one A')

// Fennel's jar
let j = claimJar(t, 10); ok(j.bait === JAR_BAIT && !jarFull(j.t, 10), 'jar: 25 today')
ok(claimJar(j.t, 10).bait === 0 && claimJar(rt(j.t), 10).bait === 0, 'jar: once a day, reload included')
ok(jarFull(j.t, 11) && claimJar(j.t, 11).bait === JAR_BAIT, 'jar: full again the next in-game day')

// migration
const L = legacyTut()
ok(!L.live && gregScreen(L).kind === 'open' && !firstStepsOn(L) && endFirstSteps(L) === L, 'legacy: done, First Steps off')
ok(['grimoire', 'spike', 'pruner', 'seeds', 'rinquest'].every(x => !gift(L, x as never).fresh), 'legacy: nothing re-gifted')
ok(adoptTut(null, true).live === false && adoptTut(null, false).live === true, 'no save: played before = legacy, brand new = fresh')
ok(adoptTut({ v: 1, live: true, greg: { welcome: true }, heard: ['otto', 'zed'], gifts: ['spike', 'gun'], b2: 'x', baitDay: 'q' }, true).heard.join() === 'otto', 'garbage cleaned, a real save wins over the played-before guess')

// every id the build reads is in the signed lines
const ids = ['greg.b1.welcome.1', 'greg.b1.welcome.4', 'greg.b1.choice.a', 'greg.b1.choice.b', 'greg.b1.choice.c', 'greg.b1.hub.back', 'greg.b1.moglins.3', 'greg.b1.spirits.6', 'greg.b1.wilds.5', 'greg.b1.bark.pending', 'greg.b1.bark.blue',
  'quest.b1.title', 'quest.b1.step', 'quest.b1.done', 'quest.b2.title', 'quest.b2.step', 'greg.b2.ask.1', 'greg.b2.ask.6', 'greg.b2.choice.go', 'greg.b2.choice.wait', 'greg.b2.go', 'greg.b2.wait', 'greg.b2.bark.open',
  ...FRIENDS.flatMap(f => [`${f}.b1.greet.1`, `${f}.b1.gift.1`]), 'otto.b1.bark', 'tess.b1.bark', 'bonn.b1.bark', 'fennel.b1.done.1', 'fennel.b1.gift.5', 'fennel.bait.ready', 'fennel.bait.empty', 'overlay.greg', 'overlay.f']
for (const id of ids) ok(!!GLADE_LINES[id]?.text, `line ${id}`)
ok(line('quest.b1.step').includes('{N}'), 'the step line carries its {N}')
let threw = false; try { line('greg.nope') } catch { threw = true }
ok(threw, 'a missing id throws')

console.log(`glade-tutorial: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
