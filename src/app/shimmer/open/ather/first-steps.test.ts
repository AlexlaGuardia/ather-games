// Run: npx tsx src/app/shimmer/open/ather/first-steps.test.ts
// M146: one quest from Greg to Greg. The title + step lines are canon's; each step's marks are its own and nothing else's; the
// gate favour is asked once, in order; a hold ends only at Greg after the thanks; skip, mid-tutorial, legacy and old saves.
import { readFileSync } from 'fs'
import { adoptTut, endFirstSteps, firstStepsOn, freshTut, heardMoglins, heardSpirits, heardWelcome, heardWilds, hearFriend, legacyTut, meetGuide, parseTut, GUIDES, TOUR, FRIENDS, type Guide, type Stop, type Tut } from './glade-tutorial'
import { FIRST_STEPS_TITLE, firstStep, firstStepsEntries, mapSpots, stepSpots, type FirstStepsWorld } from './first-steps'
import { acceptM70, m70Down, m70Quest, SETTLEMENT, settlerStart } from './first-settlement'
import { firstStepsHello, tutNode, tutStart, type TutCursor } from './glade-greg-talk'
import { foldOffered, tryFold } from './garden-fold'
import { withDefault, postEntries, guides, type JournalEntry, type JournalPrefs } from '../shared/journal'
import { line } from './glade-tutorial-lines'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }

const canon = readFileSync('/root/athernyx/CANON/game/shimmer-quest-glade-tutorial.md', 'utf8')
ok(canon.includes(`the whole opening quest is titled **${FIRST_STEPS_TITLE}**`), 'the title is canon\'s, word for word')
const batch = readFileSync('/root/athernyx/CANON/game/shimmer-lines-batch-2026-11-25a.md', 'utf8')
for (const s of ['greg', ...TOUR]) ok(batch.includes(`| **${line(`quest.b1.step.${s}`)}** |`), `quest.b1.step.${s} is the batch's Main`)
for (const id of ['quest.b1.done', 'quest.b2.step', 'quest.m70.step', 'quest.m70.done', 'quest.m70.after']) ok(canon.includes(line(id)), `${id} is canon's line`)

const w: FirstStepsWorld = { greg: { x: 1, z: 1 }, gate: { x: 2, z: 2 }, stone: { x: 3, z: 3 }, stops: { bonn: { x: 11, z: 0 }, hazel: { x: 12, z: 0 }, otto: { x: 13, z: 0 }, sax: { x: 14, z: 0 }, tess: { x: 15, z: 0 }, yarrow: { x: 16, z: 0 }, mallow: { x: 17, z: 0 }, fennel: { x: 18, z: 0 } }, bigone: { x: 50, z: 60 } }
const xs = (t: Tut, z: string) => stepSpots(t, w).filter(s => s.zone === z).map(s => s.x).join()
const at = (t: Tut, step: string, glade: string, wilds: string, l: string) => {
  ok(firstStep(t) === step, `${step}: the step (${firstStep(t)})`); ok(xs(t, 'glade') === glade, `${step}: Glade marks ${xs(t, 'glade')}`); ok(xs(t, 'wilds') === wilds, `${step}: Wilds marks ${xs(t, 'wilds')}`)
  ok(mapSpots(t, w).map(m => m.zone[0] + m.x).join() === (['gate', 'bigone', 'settlers'].includes(step) ? wilds.split(',').map(x => 'w' + x) : glade.split(',').map(x => 'g' + x)).join(), `${step}: the map's pins are the step's own side`)
  const e = firstStepsEntries(t, w); ok(e.length === 1 && e[0].title === 'First Steps' && e[0].note === l, `${step}: the one line (${e[0]?.note})`)
  ok(m70Quest(t) === null, `${step}: no second line`); const r = parseTut(JSON.parse(JSON.stringify(t)))!; ok(firstStep(r) === step, `${step}: survives a reload`)
}
let t = freshTut()
at(t, 'greg', '1', '3', line('quest.b1.step.greg'))
const done = (u: Tut, s: Stop) => (GUIDES as readonly string[]).includes(s) ? meetGuide(u, s as Guide) : hearFriend(u, s as never)
const tourAll = (u: Tut) => TOUR.reduce(done, u)
t = heardWilds(heardSpirits(heardMoglins(heardWelcome(t))))
ok(firstStepsHello(t) === line('greg.b1.bark.pending') && tutStart(t) === null, 'sent: the pending bark')
ok(TOUR.join() === 'bonn,hazel,otto,sax,tess,yarrow,mallow,fennel', "Alex's order")
TOUR.forEach((s, k) => { at(t, 'tour', String(11 + k), '3', line(`quest.b1.step.${s}`)); ok(firstStepsHello(t) === line('greg.b1.bark.pending') && tutStart(t) === null, `${s}: Greg waits`); t = done(t, s) })
at(t, 'back', '1', '3', line('quest.b1.done'))
// Beat 2: six lines, two answers
const walk = (pickGo: boolean, t0: Tut) => {
  let u = t0, c: TutCursor | null = tutStart(u); const said: string[] = []
  for (let k = 0; k < 12 && c; k++) { const n = tutNode(u, c, { set: x => { u = x }, go: x => { c = x }, grimoire: () => true }); said.push(n.line); (n.options.length === 2 ? n.options[pickGo ? 0 : 1] : n.options[0]).pick() }
  return { u, said }
}
const no = walk(false, t); ok(no.said.length === 7 && no.said[6] === line('greg.b2.wait') && no.u.b2 === 'asked' && firstStep(no.u) === 'back' && tutStart(no.u)?.b === 'ask', 'Not yet: asked again')
const yes = walk(true, no.u); ok([1, 2, 3, 4, 5, 6].every(k => yes.said[k - 1] === line(`greg.b2.ask.${k}`)) && yes.said[6] === line('greg.b2.go'), 'the favour, word for word in order')
t = yes.u
at(t, 'gate', '2', String(SETTLEMENT.x), line('quest.b2.step'))
ok(tutStart(t) === null && firstStepsHello(t) === line('greg.b2.bark.open'), 'accepted: the open bark, never asked again')
t = acceptM70(t, 'n1'); at(t, 'bigone', '2', '50', line('quest.m70.step'))
ok(m70Down(t, 'n2', 'n2') === t, 'another champion is not it')
t = m70Down(t, 'n1', 'n1'); at(t, 'settlers', '2', String(SETTLEMENT.x), line('quest.m70.done'))
ok(endFirstSteps(t) === t && firstStepsOn(t), 'Greg before the thanks: not done')
t = { ...t, m70: 'thanked' }; at(t, 'home', '1', '3', line('quest.m70.after'))
t = endFirstSteps(t)
ok(!firstStepsOn(t) && firstStepsEntries(t, w).length === 0 && stepSpots(t, w).length === 0 && m70Quest(t) === null && foldOffered(t) && firstStepsHello(t) === undefined, 'back at Greg: done, the fold is offered, no line left over')
ok(!firstStepsOn(parseTut(JSON.parse(JSON.stringify(t)))!), 'done survives a reload (before the fold is paid)')
const fold = tryFold(t, 100); ok(fold.ok && !firstStepsOn(fold.t), 'and after the fold')

// M155: the Wilds? branch: line .3 carries the scene that lights Bonn's marker, and sends the keeper there and then
{ let u = heardSpirits(heardMoglins(heardWelcome(freshTut()))), c: TutCursor | null = { b: 'wilds', i: 0 }; const seen: string[] = []
  for (let k = 0; k < 6 && c; k++) { const n = tutNode(u, c, { set: x => { u = x }, go: x => { c = x }, grimoire: () => true }); seen.push(`${n.line}|${n.scene ?? ''}|${firstStep(u)}`); n.options[0].pick() }
  ok(seen.join('\n') === [1, 2, 3, 4].map(k => `${line(`greg.b1.wilds.${k}`)}|${k === 3 ? line('greg.b1.wilds.scene') : ''}|${k < 3 ? 'greg' : 'tour'}`).join('\n'), 'The Wilds?: four lines, the scene on .3, sent from .3 on') }

// skip: straight through the gate, the settlement's own big one first, nobody heard
let s = m70Down(freshTut(), 'far', 'near'); ok(s.m70 === 'none', 'skip: a champion far from the settlement does not count')
s = m70Down(freshTut(), 'near', 'near'); ok(firstStep(s) === 'settlers' && settlerStart(s, 'chamomile')?.mode === 'thanks', 'skip: down first, Chamomile thanks')
s = { ...s, m70: 'thanked' }; ok(firstStep(s) === 'home', 'skip: then Greg'); s = endFirstSteps(s)
ok(!firstStepsOn(s) && tutStart(s)?.b === 'welcome', 'skip: done at Greg, his welcome still his to say')
s = heardWilds(heardSpirits(heardMoglins(heardWelcome(s)))); for (const f of FRIENDS) s = hearFriend(s, f)
ok(s.b2 === 'none' && firstStepsHello(s) === undefined, 'skip: the four heard is all Greg waits for then')
ok(meetGuide(s, 'hazel') === s, 'skip: after First Steps the Moglins keep their own talk')
ok(tutStart(s) === null, 'skip: the gate favour is never asked after the fact')
ok(m70Down(legacyTut(), 'near', 'near').m70 === 'none', 'legacy: no skip, as before')
let a = acceptM70(freshTut(), 'n'); ok(firstStep(a) === 'bigone', 'skip by Chamomile: the big one'); a = { ...a, greg: { ...heardWilds(heardSpirits(heardMoglins(heardWelcome(a)))).greg }, heard: [...FRIENDS] }
ok(tutStart(a) === null, 'asked by Chamomile already: Greg does not ask again')

// old saves
const L = legacyTut(), L70: Tut = { ...L, m70: 'thanked' }
ok(!firstStepsOn(L) && endFirstSteps(L70) === L70 && m70Quest(L70)?.title === 'quest.m70.after' && firstStepsEntries(L, w).length === 0, 'legacy: untouched')
for (const o of [L, L70, { ...freshTut(), folded: true, m70: 'thanked' as const }, { ...freshTut(), heard: ['otto' as const] }]) ok(JSON.stringify(parseTut(JSON.parse(JSON.stringify(o)))) === JSON.stringify(o), 'a save without fs round-trips byte for byte')
const pre = adoptTut({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [...FRIENDS], gifts: [], b2: 'none' }, true)
ok(!firstStepsOn(pre) && tutStart(pre) === null && m70Quest({ ...pre, m70: 'open' })?.title === 'quest.m70.title', 'a pre-M71 live save (its garden) is past it: no favour, Lamps Out as before')
ok(firstStep(adoptTut({ ...freshTut(), greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto'] }, true)) === 'tour', 'a mid-tutorial save continues')
const O = (heard: string[], more: object = {}) => parseTut({ ...freshTut(), greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard, ...more })!
const where = (u: Tut) => xs(u, 'glade')
ok(where(O(['otto', 'tess'])) === '11' && O(['otto', 'tess']).met === undefined, 'old flow, Otto + Tess heard: Bonn next (the save itself unchanged)')
{ let u = O(['otto', 'tess']); u = hearFriend(u, 'bonn'); ok(where(u) === '12', 'then Hazel'); u = meetGuide(u, 'hazel'); ok(where(u) === '18', 'then Fennel: the Moglins of who was heard before are behind them'); ok(where(parseTut(JSON.parse(JSON.stringify(u)))!) === '18', 'reload'); u = hearFriend(u, 'fennel'); ok(firstStep(u) === 'back' && tutStart(u)?.b === 'ask', 'then Greg') }
ok(firstStep(O([...FRIENDS])) === 'back' && firstStep(O([...FRIENDS], { b2: 'accepted' })) === 'gate', 'old flow, all four heard: on to Greg / the gate, never back to a Moglin')
{ let u = O([], { met: [] }); u = hearFriend(u, 'fennel'); u = hearFriend(u, 'otto'); ok(where(u) === '11', 'out of order: still Bonn first'); u = meetGuide(hearFriend(u, 'bonn'), 'hazel'); ok(where(u) === '14', 'and the ones heard early are passed over (Sax is next)'); u = tourAll(u); ok(firstStep(u) === 'back', 'never stuck') }
ok(meetGuide(O([], { met: [] }), 'sax').met!.length === 0, 'a Moglin waits for their friend')
ok(O(['bonn'], { met: ['hazel', 'zed', 'hazel'] }).met!.join() === 'hazel', 'junk in met is dropped')

// the journal: it leads, and points at every spot of the step
const P: JournalPrefs = { v: 1, active: null, marker: {}, trail: {} }, E: JournalEntry = { id: 'first-steps', hand: 'keeper', title: '', note: '', where: null }, X: JournalEntry = { ...E, id: 'x' }
ok(withDefault(P, [X, E]).active === 'first-steps', 'nothing picked: First Steps leads')
ok(withDefault({ ...P, active: 'errand', chosen: true }, [X, E]).active === 'first-steps', 'a pick that is not open: First Steps leads')
ok(withDefault({ ...P, active: 'x', chosen: true }, [X, E]).active === 'x' && withDefault({ ...P, chosen: true }, [E]).active === null, 'the player\'s own pick (or clear) stands')
postEntries('first-steps', firstStepsEntries({ ...freshTut(), greg: { welcome: true, moglins: true, spirits: true, wilds: true } }, w))
const gm = guides('glade'); ok(gm.markers.length === 1 && gm.markers[0].active && gm.markers[0].x === 11 && gm.trails.filter(m => m.active).length === 1, 'ONE mark (Bonn), one routed trail')
ok(guides('wilds').markers.length === 1, 'in the Wilds: the one mark home')

console.log(`first-steps: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
