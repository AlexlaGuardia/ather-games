// Run: npx tsx src/app/shimmer/open/ather/glade-fennel-talk.test.ts
// M68 s3b: Fennel in the Glade, walked like a keeper would. Before Greg sends a live keeper: her Moglin talk (folk), nothing
// recorded. After: greet .1-.2, then gift .1-.3 starts the first-rinstick quest at its step 2 (or done .1 with a stick, quest
// untouched), gift .4 hands the day's jar (once), the last line counts her heard; later talks = the jar (ready once per day,
// then empty), both with 'Something else.' into her Moglin talk. A full bag refuses the jar and records nothing. Legacy = jar.
import { fennelStart, fennelNode, fennelScript, questAt, baitAt, FENNEL_MORE, FENNEL_THANKS, type FennelCursor } from './glade-fennel-talk'
import { freshTut, legacyTut, heardWelcome, heardMoglins, heardSpirits, heardWilds, hearFriend, parseTut, allHeard, fennelInGlade, farmStarterOn, JAR_BAIT, type Tut } from './glade-tutorial'
import { startAtGlade, fresh, onShop, currentStep, migrate, type RinQuest } from './rinquest'
import { GLADE_LINES, line } from './glade-tutorial-lines'
import { ANSWERS } from './greg-talk'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const signed = new Set(Object.values(GLADE_LINES).map(l => l.text))
const sent = (): Tut => heardWilds(heardSpirits(heardMoglins(heardWelcome(freshTut()))))
const rt = (t: Tut) => parseTut(JSON.parse(JSON.stringify(t)))!
const DAY = 100

/** A keeper at Fennel: the tutorial, the rinquest, the bag's bait, the cursor. */
function talk(t0: Tut, opts: { stick?: boolean; bagFull?: boolean; day?: number; q?: RinQuest } = {}) {
  const k = { t: t0, q: opts.q ?? fresh(), bait: 0, folk: 0, c: fennelStart(t0, !!opts.stick, opts.day ?? DAY) as FennelCursor | null, bubbles: [] as string[] }
  const acts = {
    set: (t: Tut) => { k.t = t },
    go: (i: number | null) => { k.c = i === null ? null : { ...k.c!, i } },
    startQuest: () => { k.q = startAtGlade(k.q) },
    giveBait: (n: number) => { if (opts.bagFull) return false; k.bait += n; return true },
    folk: () => { k.folk++; k.c = null },
  }
  const node = () => fennelNode(k.t, k.c!, acts)
  const walk = (max = 12) => { for (let n = 0; n < max && k.c; n++) { const x = node(); k.bubbles.push(x.line); x.options[0].pick() } }
  return { k, node, walk }
}

// ── before Greg sends you
{
  const c = fennelStart(freshTut(), false, DAY)
  ok(c.mode === 'folk' && fennelScript(c).length === 0, 'before Greg sends a live keeper: her Moglin talk only')
}
// ── the first talk, no stick
{
  const { k, walk } = talk(sent())
  ok(k.c!.mode === 'first', 'after Greg sent you: the first talk')
  walk()
  ok(k.bubbles.length === 8 && k.bubbles[0] === line('fennel.b1.greet.1') && k.bubbles[5] === line('fennel.b1.gift.3') && k.bubbles[7] === line('fennel.b1.gift.5'), 'greet .1-.2, room .1, gift .1-.5 in order')
  ok(k.bubbles.every(b => signed.has(b)), 'every bubble is a SIGNED line')
  ok(!k.bubbles.includes(line('fennel.b1.done.1')), 'no stick: done .1 is not said')
  ok(k.q.state === 'active' && k.q.step === 1 && currentStep(k.q)?.id === 'dusk', 'gift .3 starts the quest at the Moonwell wait (meet done)')
  ok(k.bait === JAR_BAIT && k.t.baitDay === DAY && k.t.gifts.includes('bait'), "gift .4 hands today's jar")
  ok(k.t.gifts.includes('rinquest') && k.t.heard.includes('fennel'), 'rinquest gift recorded, Fennel heard on the last line')
  ok(!fennelInGlade(k.t), 'heard: the quest no longer waits for her')
  ok(k.c === null, 'the goodbye closes')
  // again, same day: jar empty, nothing new
  const b = talk(rt(k.t), { q: k.q })
  ok(b.k.c!.mode === 'jar' && !b.k.c!.full && b.node().line === line('fennel.bait.empty'), 'same day: bait.empty')
  ok(b.node().options[0].label === FENNEL_MORE, "bait.empty offers FENNEL_MORE first")
  b.node().options[0].pick(); ok(b.k.folk === 1 && b.k.bait === 0, 'FENNEL_MORE opens her Moglin talk, no bait')
  // the next day: jar ready, once
  const d = talk(rt(k.t), { q: k.q, day: DAY + 1 })
  ok(d.k.c!.full && d.node().line === line('fennel.bait.ready') && d.node().options[0].label === FENNEL_THANKS, 'next day: bait.ready')
  d.node().options[0].pick()
  ok(d.k.bait === JAR_BAIT && d.k.t.baitDay === DAY + 1 && d.k.c === null, 'the thanks takes the jar and closes')
  const e = talk(rt(d.k.t), { day: DAY + 1 })
  ok(!e.k.c!.full, 'the same day after: empty')
  // a stale cursor (jar opened full, claimed elsewhere): nothing handed twice
  const f = talk(d.k.t, { day: DAY + 1 }); f.k.c = { ...f.k.c!, full: true }; f.node().options[0].pick()
  ok(f.k.bait === 0, 'a stale full cursor hands nothing (claimJar guards the day)')
}
// ── the first talk, a stick already (quest done at the Rinnshop)
{
  const q0: RinQuest = { v: 1, state: 'done', step: 5 }
  const { k, walk } = talk(sent(), { stick: true, q: q0 })
  walk()
  ok(k.bubbles.length === 6 && k.bubbles[3] === line('fennel.b1.done.1') && !k.bubbles.includes(line('fennel.b1.gift.1')), 'a stick: greet .1-.2, done .1, gift .4-.5')
  ok(k.q === q0, 'a stick: the quest is untouched')
  ok(k.bait === JAR_BAIT && k.t.heard.includes('fennel') && k.t.gifts.includes('rinquest'), 'a stick: the jar + heard')
}
// ── leave mid-script and replay: nothing twice
{
  const a = talk(sent())
  for (let n = 0; n < 6; n++) a.node().options[0].pick()   // to gift .4 (bait handed), leave
  ok(a.k.bait === JAR_BAIT && !a.k.t.heard.includes('fennel'), 'left after gift .4: bait given, not heard yet')
  const qMid = a.k.q
  const b = talk(rt(a.k.t), { q: qMid }); b.walk()
  ok(b.k.bait === 0 && b.k.t.heard.includes('fennel'), 'the replay hands no second jar, and hears her')
  ok(b.k.q === qMid, 'the replay does not restart the quest')
  // the quest moved on (wait done), then a replay: still not restarted
  const moved: RinQuest = { v: 1, state: 'active', step: 3 }
  const c = talk(sent(), { q: moved }); c.walk()
  ok(c.k.q.step === 3, 'a quest past the wait is never wound back')
}
// ── a full bag at gift .4
{
  const a = talk(sent(), { bagFull: true })
  for (let n = 0; n < 7; n++) a.node().options[0].pick()
  ok(a.k.c!.i === baitAt(a.k.c!) - 1 && a.k.bait === 0, 'a full bag: stays on gift .3')
  ok(!a.k.t.gifts.includes('bait') && a.k.t.baitDay === null && !a.k.t.heard.includes('fennel'), 'a full bag records no jar, not heard')
  ok(a.k.t.gifts.includes('rinquest') && a.k.q.step === 1, 'the quest it started stays started')
  const full = talk(hearFriend(sent(), 'fennel'), { bagFull: true, day: DAY + 3 })
  full.node().options[0].pick()
  ok(full.k.t.baitDay === null && full.k.c !== null, 'a full bag refuses the daily jar and keeps the talk open')
}
// ── legacy keepers
{
  const c = fennelStart(legacyTut(), true, DAY)
  ok(c.mode === 'jar' && c.full, 'legacy: the jar from the start')
  ok(!fennelInGlade(legacyTut()) && farmStarterOn(legacyTut()), 'legacy: Rinnshop quest + farm starter unchanged')
  ok(!farmStarterOn(freshTut()) && !farmStarterOn(hearFriend(sent(), 'fennel')), 'live keepers: no farm starter packet, ever')
}
// ── the quest helpers
{
  ok(startAtGlade(fresh()).step === 1 && startAtGlade(fresh()).state === 'active', 'startAtGlade from none: active, step 2')
  ok(startAtGlade({ v: 1, state: 'active', step: 0 }).step === 1, "startAtGlade from 'meet' (Rinnshop first): to the wait")
  const d: RinQuest = { v: 1, state: 'done', step: 5 }; ok(startAtGlade(d) === d, 'startAtGlade leaves a done quest')
  const q2: RinQuest = { v: 1, state: 'active', step: 2 }; ok(startAtGlade(q2) === q2, 'startAtGlade leaves a later step')
  ok(onShop(startAtGlade(fresh()), true).step === 1, 'a Rinnshop raised later does not reset a Glade-started quest')
  ok(migrate(JSON.parse(JSON.stringify(startAtGlade(fresh())))).step === 1, 'round-trips the save')
  ok(questAt(fennelStart(sent(), false, DAY)) === 5 && questAt(fennelStart(sent(), true, DAY)) === 3, 'quest line = gift .3 / done .1')
  ok(fennelInGlade(sent()) && fennelInGlade(freshTut()), 'a live keeper before Fennel: the quest waits for her')
  ok(!allHeard(hearFriend(sent(), 'fennel')), 'Fennel alone is not all four')
}
// every non-last first-talk node offers 'And then?'
{
  const { node } = talk(sent())
  ok(node().options[0].label === ANSWERS.more, "first talk advances on 'And then?'")
}

console.log(`glade-fennel-talk: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
