// Run: npx tsx src/app/shimmer/open/ather/glade-friend-talk.test.ts
// M68 s3a: Otto, Tess, Bonn walked like a keeper would. Before Greg sends you: their bark, no gift, not heard. After: greet
// .1-.2, gift .1 hands the gift (once: a replay, a reload, a second talk = none), the last line counts them heard; then the
// bark forever. A full bag refuses gift .1 and records nothing. Every bubble is a SIGNED line. Sockets start empty.
import { friendStart, friendNode, friendScript, friendBye, GARDEN_FRIENDS, GIFT_AT, type FriendCursor, type GardenFriend } from './glade-friend-talk'
import { freshTut, legacyTut, gift, heardWelcome, heardMoglins, heardSpirits, heardWilds, parseTut, allHeard, socketLit, GIFT_OF, type Tut, type Gift } from './glade-tutorial'
import { GLADE_LINES, line } from './glade-tutorial-lines'
import { ANSWERS } from './greg-talk'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const signed = new Set(Object.values(GLADE_LINES).map(l => l.text))
const sent = (): Tut => heardWilds(heardSpirits(heardMoglins(heardWelcome(freshTut()))))
const rt = (t: Tut) => parseTut(JSON.parse(JSON.stringify(t)))!

/** A keeper at a friend: holds the tutorial, the cursor, a count of each gift actually handed. */
function talk(t0: Tut, f: GardenFriend, opts: { bagFull?: boolean } = {}) {
  const k = { t: t0, c: friendStart(t0, f) as FriendCursor | null, handed: [] as Gift[], bubbles: [] as string[] }
  const acts = {
    set: (t: Tut) => { k.t = t },
    go: (i: number | null) => { k.c = i === null ? null : { ...k.c!, i } },
    give: (g: Gift) => {
      if (k.t.gifts.includes(g)) return true
      if (opts.bagFull) return false
      k.handed.push(g); k.t = gift(k.t, g).t; return true
    },
  }
  const node = () => friendNode(k.t, k.c!, acts)
  const walk = (max = 10) => { for (let n = 0; n < max && k.c; n++) { const x = node(); k.bubbles.push(x.line); x.options[0].pick() } }
  return { k, node, walk }
}

for (const f of GARDEN_FRIENDS) {
  // before Greg sends you
  let T = talk(freshTut(), f); T.walk()
  ok(T.k.bubbles.join('|') === line(`${f}.b1.bark`) && T.k.handed.length === 0 && !T.k.t.heard.includes(f), `${f}: before The Wilds? = bark only, no gift, not heard`)
  // the first talk after
  T = talk(sent(), f)
  ok(friendScript(T.k.c!).length === 5, `${f}: greet + gift script`)
  ok(T.node().options.map(o => o.label).join() === ANSWERS.more, `${f}: greet .1 offers "${ANSWERS.more}"`)
  T.walk()
  ok(T.k.handed.join() === GIFT_OF[f], `${f}: hands ${GIFT_OF[f]} exactly once`)
  ok(T.k.t.heard.includes(f), `${f}: heard after the last line`)
  ok(T.k.bubbles.length === 5 && T.k.bubbles[4] === line(`${f}.b1.gift.3`), `${f}: the last bubble is gift .3 (not swapped to the bark by being heard)`)
  ok(T.k.bubbles.every(b => signed.has(b)), `${f}: every bubble signed`)
  // later talks + reload
  const T2 = talk(rt(T.k.t), f); T2.walk()
  ok(T2.k.bubbles.join('|') === line(`${f}.b1.bark`) && T2.k.handed.length === 0, `${f}: after a reload = bark, no second gift`)
  // leave after the gift, before the last line: replays, gift not handed twice, heard on finishing
  const T3 = talk(sent(), f); for (let n = 0; n < GIFT_AT + 1; n++) { const x = T3.node(); x.options[0].pick() }
  ok(T3.k.handed.length === 1 && !T3.k.t.heard.includes(f), `${f}: left on gift .2 = gift handed, not heard yet`)
  const T4 = talk(rt(T3.k.t), f); T4.walk()
  ok(T4.k.handed.length === 0 && T4.k.t.heard.includes(f) && T4.k.bubbles.length === 5, `${f}: the replay hears them, hands nothing more`)
  // bag full
  const T5 = talk(sent(), f, { bagFull: true }); T5.walk()
  ok(T5.k.handed.length === 0 && !T5.k.t.gifts.includes(GIFT_OF[f]) && T5.k.c?.i === GIFT_AT - 1, `${f}: bag full = stays on greet .2, nothing recorded`)
  // last line's answer is the goodbye
  const T6 = talk(sent(), f); for (let n = 0; n < 4; n++) T6.node().options[0].pick()
  ok(T6.node().options.map(o => o.label).join() === friendBye(f), `${f}: gift .3 offers goodbye`)
  // legacy keeper
  const L = talk(legacyTut(), f); L.walk()
  ok(L.k.bubbles.join('|') === line(`${f}.b1.bark`) && L.k.handed.length === 0, `${f}: legacy keeper = bark only`)
}
// all three + Fennel (s3b) make allHeard; three alone do not
let t = sent(); for (const f of GARDEN_FRIENDS) { const T = talk(t, f); T.walk(); t = T.k.t }
ok(!allHeard(t) && t.heard.length === 3, 'Otto, Tess, Bonn heard; Fennel still owed')

// sockets
ok(!socketLit(freshTut(), 'forestry') && !socketLit(freshTut(), 'prospecting'), 'a newborn: both sockets empty')
ok(socketLit(gift(freshTut(), 'pruner').t, 'forestry') && !socketLit(gift(freshTut(), 'pruner').t, 'prospecting'), 'Bonn lights the pruner socket only')
ok(socketLit(gift(freshTut(), 'spike').t, 'prospecting') && !socketLit(gift(freshTut(), 'spike').t, 'forestry'), 'Otto lights the spike socket only')
ok(socketLit(legacyTut(), 'forestry') && socketLit(legacyTut(), 'prospecting'), 'a legacy keeper keeps both')

console.log(`glade-friend-talk: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
