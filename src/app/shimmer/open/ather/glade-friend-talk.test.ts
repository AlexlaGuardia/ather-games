// Run: npx tsx src/app/shimmer/open/ather/glade-friend-talk.test.ts
// M68 s3a: Otto, Tess, Bonn walked like a keeper would. Before Greg sends you: their bark, no gift, not heard. After: greet
// .1-.2, gift .1 hands the gift (once: a replay, a reload, a second talk = none), the last line counts them heard; then the
// bark forever. A full bag refuses gift .1 and records nothing. Every bubble is a SIGNED line. Sockets start empty.
import { friendStart, friendNode, friendScript, friendBye, GARDEN_FRIENDS, giftAt, nodeBeside, SCENE_OF, isGuideId, BESIDE, type Talker, type FriendCursor, type GardenFriend } from './glade-friend-talk'
import { readFileSync } from 'fs'
import { ASK } from './folk-talk'
import { fennelStart, fennelScript } from './glade-fennel-talk'
import { TOUR, GUIDES, GUIDE_OF, hearFriend, meetGuide, stopDone, tourStop, walkedTour, endFirstSteps, freshTut, legacyTut, gift, heardWelcome, heardMoglins, heardSpirits, heardWilds, parseTut, allHeard, socketLit, GIFT_OF, type Tut, type Gift } from './glade-tutorial'
import { GLADE_LINES, line } from './glade-tutorial-lines'
import { ANSWERS } from './greg-talk'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const signed = new Set(Object.values(GLADE_LINES).map(l => l.text))
const sent = (): Tut => heardWilds(heardSpirits(heardMoglins(heardWelcome(freshTut()))))
const rt = (t: Tut) => parseTut(JSON.parse(JSON.stringify(t)))!

/** A keeper at a friend: holds the tutorial, the cursor, a count of each gift actually handed. */
function talk(t0: Tut, f: Talker, opts: { bagFull?: boolean; beside?: boolean } = {}) {
  const k = { t: t0, c: friendStart(t0, f, opts.beside) as FriendCursor | null, handed: [] as Gift[], bubbles: [] as string[], scenes: [] as string[] }
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
  const walk = (max = 14) => { for (let n = 0; n < max && k.c; n++) { const x = node(); k.bubbles.push(x.line); k.scenes.push(x.scene ?? ''); x.options[0].pick() } }
  return { k, node, walk }
}

for (const f of GARDEN_FRIENDS) {
  // before Greg sends you
  let T = talk(freshTut(), f); T.walk()
  ok(T.k.bubbles.join('|') === line(`${f}.b1.bark`) && T.k.handed.length === 0 && !T.k.t.heard.includes(f), `${f}: before The Wilds? = bark only, no gift, not heard`)
  // the first talk after
  T = talk(sent(), f)
  const N = friendScript(T.k.c!).length, G = giftAt(T.k.c!)
  ok(N === { bonn: 7, otto: 5, tess: 6 }[f as 'bonn'], `${f}: its script (${N})`)
  ok(T.node().options.map(o => o.label).join() === ANSWERS.more, `${f}: greet .1 offers "${ANSWERS.more}"`)
  T.walk()
  ok(T.k.handed.join() === GIFT_OF[f], `${f}: hands ${GIFT_OF[f]} exactly once`)
  ok(T.k.t.heard.includes(f), `${f}: heard after the last line`)
  ok(T.k.bubbles.length === N && T.k.bubbles[N - 1] === line(f === 'bonn' ? 'bonn.b1.rooms.2' : `${f}.b1.gift.4`), `${f}: the last bubble points at their Moglin (not swapped to the bark by being heard)`)
  ok(T.k.bubbles.every(b => signed.has(b)), `${f}: every bubble signed`)
  // later talks + reload
  const T2 = talk(rt(T.k.t), f); T2.walk()
  ok(T2.k.bubbles.join('|') === line(`${f}.b1.bark`) && T2.k.handed.length === 0, `${f}: after a reload = bark, no second gift`)
  // leave after the gift, before the last line: replays, gift not handed twice, heard on finishing
  const T3 = talk(sent(), f); for (let n = 0; n < G + 1; n++) { const x = T3.node(); x.options[0].pick() }
  ok(T3.k.handed.length === 1 && !T3.k.t.heard.includes(f), `${f}: left on gift .2 = gift handed, not heard yet`)
  const T4 = talk(rt(T3.k.t), f); T4.walk()
  ok(T4.k.handed.length === 0 && T4.k.t.heard.includes(f) && T4.k.bubbles.length === N, `${f}: the replay hears them, hands nothing more`)
  // bag full
  const T5 = talk(sent(), f, { bagFull: true }); T5.walk()
  ok(T5.k.handed.length === 0 && !T5.k.t.gifts.includes(GIFT_OF[f]) && T5.k.c?.i === G - 1, `${f}: bag full = stays on the line before, nothing recorded`)
  // last line's answer is the goodbye
  const T6 = talk(sent(), f); for (let n = 0; n < N - 1; n++) T6.node().options[0].pick()
  ok(T6.node().options.map(o => o.label).join() === friendBye(f), `${f}: gift .3 offers goodbye`)
  // legacy keeper
  const L = talk(legacyTut(), f); L.walk()
  ok(L.k.bubbles.join('|') === line(`${f}.b1.bark`) && L.k.handed.length === 0, `${f}: legacy keeper = bark only`)
}
// all three + Fennel (s3b) make allHeard; three alone do not
let t = sent(); for (const f of GARDEN_FRIENDS) { const T = talk(t, f); T.walk(); t = T.k.t }
ok(!allHeard(t) && t.heard.length === 3, 'Otto, Tess, Bonn heard; Fennel still owed')

// ── M155: the batch, word for word (canon file), in order, with the node placed
const rows = new Map(readFileSync('/root/athernyx/CANON/game/shimmer-lines-batch-2026-11-25a.md', 'utf8').split('\n').map(r => r.split('|').map(c => c.trim())).filter(c => c.length >= 6 && c[1].startsWith('`')).map(c => [c[1].match(/`([^`]+)`/)![1], { today: c[2], main: c[3] }] as const))
const old = readFileSync('/root/athernyx/CANON/game/shimmer-quest-glade-tutorial.md', 'utf8')
const isCanon = (id: string) => { const r = rows.get(id), t = GLADE_LINES[id]?.text; if (!r || !t) return false
  return r.main.startsWith('**(kept') ? (id.endsWith('.scene') ? r.today === `[SCENE: ${t}]` : old.includes(`: ${t}`)) : r.main.startsWith(id.endsWith('.scene') ? `**[SCENE: ${t}]**` : `**${t}**`) }
const WANT: Record<string, string> = {
  bonn: 'greet.1 greet.2 stay.1 gift.1 try.1 gift.2 rooms.1 rooms.2', hazel: 'greet.1 room.1 point.1', otto: 'greet.1 greet.2 gift.1 gift.2 gift.3 gift.4', sax: 'greet.1 room.1 point.1',
  tess: 'greet.1 greet.2 gift.1 gift.2 gift.3 gift.4', yarrow: 'greet.1 room.1 point.1', mallow: 'greet.1 room.1 point.1' }
let u = sent()
for (const s of TOUR) {
  ok(tourStop(u) === s, `the tour stands at ${s}`)
  if (s === 'fennel') break
  const ids = WANT[s].split(' ').map(x => `${s}.b1.${x}`), T = talk(u, s, { beside: true }); T.walk()
  ok(T.k.bubbles.join('|') === ids.map(line).join('|'), `${s}: the batch's lines in order`)
  for (const id of ids) ok(isCanon(id), `${id} is the signed Main`)
  ids.forEach((id, k) => ok(T.k.scenes[k] === (SCENE_OF[id] ? line(SCENE_OF[id]) : ''), `${id}: its scene box (${T.k.scenes[k]})`))
  u = T.k.t; ok(stopDone(u, s), `${s}: done`); ok(stopDone(rt(u), s), `${s}: kept over a reload`)
  if (isGuideId(s)) { const b = talk(rt(u), s); ok(!b.k.c!.first, `${s}: once`); ok(T.k.handed.length === 0, `${s}: hands nothing`) }
}
for (const id of Object.values(SCENE_OF)) ok(isCanon(id), `${id} is the signed scene`)
ok(talk(sent(), 'bonn').k.c!.script.every(x => !x.includes('momo')), 'no Momo yet (s2)')
const fc = fennelStart(u, false, 1); ok(fc.home && fennelScript(fc).at(-1) === 'fennel.b1.point.1' && fennelScript(fc)[2] === 'fennel.b1.room.1' && isCanon('fennel.b1.point.1') && isCanon('fennel.b1.room.1'), 'Fennel last: the room, and on to Greg')
ok(!fennelScript(fennelStart(sent(), false, 1)).includes('fennel.b1.point.1'), 'Fennel early: not sent to Greg yet')
{ const k = hearFriend(u, 'fennel'), d = endFirstSteps({ ...k, m70: 'thanked' }); ok(tourStop(k) === null && !walkedTour(k) && walkedTour(d) && !walkedTour(legacyTut()) && !walkedTour({ ...sent(), fs: 'done' }), 'the old tour is replaced only for who walked this one') }
// no node placed = no line about one; a pointer at somebody already met is not said
for (const [f, id] of [['bonn', 'bonn.b1.try.1'], ['otto', 'otto.b1.gift.2']] as const) ok(!friendScript(friendStart(sent(), f)).includes(id) && friendScript(friendStart(sent(), f, true)).includes(id), `${f}: the node is named only where one is placed`)
ok(nodeBeside('bonn', { x: 0, z: 0 }, { trees: [{ x: BESIDE - 1, z: 0 }], crystals: [] }) && !nodeBeside('bonn', { x: 0, z: 0 }, { trees: [{ x: BESIDE + 1, z: 0 }], crystals: [{ x: 1, z: 0 }] }) && nodeBeside('otto', { x: 0, z: 0 }, { trees: [], crystals: [{ x: 1, z: 1 }] }) && !nodeBeside('tess', { x: 0, z: 0 }, { trees: [{ x: 0, z: 0 }], crystals: [] }), 'beside = the right kind, near')
for (const [g, next] of [['hazel', 'otto'], ['sax', 'tess'], ['mallow', 'fennel']] as const) { let v = hearFriend(sent(), GUIDE_OF[g]); ok(friendScript(friendStart(v, g)).length === 3, `${g}: points on`); v = hearFriend(v, next); const T = talk(v, g); T.walk(); ok(T.k.bubbles.length === 2 && stopDone(T.k.t, g), `${g}: ${next} already heard, no pointer, met all the same`) }
for (const g of GUIDES) { ok(!friendStart(sent(), g).first, `${g}: not before ${GUIDE_OF[g]}`); const T = talk(hearFriend(sent(), GUIDE_OF[g]), g); for (let n = 0; n < 2; n++) T.node().options[0].pick(); ok(T.node().options[0].label === ASK.bye && stopDone(T.k.t, g), `${g}: the folk goodbye`) }
for (const id of ['greg.b1.wilds.2', 'greg.b1.wilds.3', 'greg.b1.wilds.4', 'greg.b1.bark.pending']) ok(isCanon(id), `${id} is the signed Main`)
ok(rows.get('[SCENE]')!.main === `**[SCENE: ${line('greg.b1.wilds.scene')}]**`, "Greg's scene box")

// sockets
ok(!socketLit(freshTut(), 'forestry') && !socketLit(freshTut(), 'prospecting'), 'a newborn: both sockets empty')
ok(socketLit(gift(freshTut(), 'pruner').t, 'forestry') && !socketLit(gift(freshTut(), 'pruner').t, 'prospecting'), 'Bonn lights the pruner socket only')
ok(socketLit(gift(freshTut(), 'spike').t, 'prospecting') && !socketLit(gift(freshTut(), 'spike').t, 'forestry'), 'Otto lights the spike socket only')
ok(socketLit(legacyTut(), 'forestry') && socketLit(legacyTut(), 'prospecting'), 'a legacy keeper keeps both')

console.log(`glade-friend-talk: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
