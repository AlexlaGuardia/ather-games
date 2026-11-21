// Yarrow's bait teach beat (yarrow-teach.ts + folk-talk.ts) and the Bait Page (shared/inventory.ts): pure.
// Run: npx tsx src/app/shimmer/open/ather/yarrow-teach.test.ts
import { folkTalk, helloFor, _resetHeard, type FolkTalkState } from './folk-talk'
import { YARROW_TEACH, YARROW_BARKS, LISTEN, WRONG, RIGHT } from './yarrow-teach'
import { GLADE_STATION_LINES } from './moonwell-glade'
import { freshTrust, type Folk } from './settlement-folk'
import { newInv, give, take, countOf, makeBait, baitYield, readBaitPage, yarrowTeach, hasGift, BAIT_FROM, BAIT_PAGE, GIFT_BAIT_READ, GIFT_YARROW_TAUGHT, YARROW_GIFT_BAIT, SLOTS, isCatch, type Inv } from '../shared/inventory'
import { makeBaitAt } from './rooms'
import type { Works } from './rooms'
import { readFileSync } from 'fs'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

const y = { id: 'moonwell:yarrow', name: 'Yarrow', home: 'moonwell', profession: 'rinnshop', employed: true, wants: [{ id: 'mast', n: 6 }], dream: 'dream', grades: { craft: 4, yield: 2, trade: 4 } } as unknown as Folk
let cur: FolkTalkState | null = null
const taught: string[] = []
let teachOk = true
const acts = { go: (s: FolkTalkState) => { cur = s }, give: () => {}, recruit: () => {}, bye: () => { cur = null }, teach: (a: 'pointed' | 'silent') => { taught.push(a); return teachOk } }
const ctx = (yarrow?: { canTeach: boolean; hasCatch: boolean }) => ({ folk: [y], home: [y], trust: freshTrust(), have: () => 0, room: 3, yarrow })
const labels = (n: { options: { label: string }[] }) => n.options.map(o => o.label)
const pick = (n: { options: { label: string; pick: () => void }[] }, l: string) => n.options.find(o => o.label === l)!.pick()

// ── the lines are the signed script, verbatim (the canon file is the source; <WRONG>/<RIGHT> filled with Mast/Bait)
{ const canon = readFileSync('/root/athernyx/CANON/game/yarrow-baitmaker-lines-script.md', 'utf8')
  const fill = (t: string) => t.replace(/<WRONG>/g, WRONG).replace(/<RIGHT>/g, RIGHT)
  const said = [...canon.matchAll(/YARROW: "([^"]+)"/g)].map(m => fill(m[1])), scenes = [...canon.matchAll(/\[SCENE: ([^\]]+)\]/g)].map(m => fill(m[1]))
  const ours = [YARROW_TEACH.open.line, YARROW_TEACH.pointed, YARROW_TEACH.silent, ...YARROW_TEACH.page.lines, YARROW_BARKS.jars, YARROW_BARKS.catch]
  for (const l of ours) ok(said.includes(l), `verbatim: "${l.slice(0, 40)}" is not in the signed script`)
  for (const sc of [YARROW_TEACH.open.scene, YARROW_TEACH.hand.scene, YARROW_TEACH.page.scene]) ok(scenes.includes(sc), `verbatim scene: "${sc.slice(0, 40)}"`)
  ok(canon.includes(`> ${YARROW_TEACH.options.pointed}`) && canon.includes(`> ${YARROW_TEACH.options.silent}`), 'verbatim: the two answers')
  ok(![...ours, YARROW_TEACH.hand.scene, YARROW_TEACH.page.scene].some(l => /[<>]/.test(l)), 'a slot was left unfilled') }

// ── the beat: due -> replaces the hello; both answers reach the page; nothing gates
for (const a of ['pointed', 'silent'] as const) {
  _resetHeard(); taught.length = 0; teachOk = true
  let n = folkTalk(ctx({ canTeach: true, hasCatch: false }), helloFor(y.id), acts)
  ok(n.line === YARROW_TEACH.open.line && n.scene === YARROW_TEACH.open.scene, `${a}: the first talk after a stick opens the beat`)
  pick(n, LISTEN); n = folkTalk(ctx({ canTeach: true, hasCatch: false }), cur!, acts)
  ok(n.scene === YARROW_TEACH.hand.scene && labels(n).join('|') === `${YARROW_TEACH.options.pointed}|${YARROW_TEACH.options.silent}`, `${a}: the Mast in hand, two answers`)
  pick(n, YARROW_TEACH.options[a])
  ok(taught.join() === a, `${a}: the hand-over ran once with the answer`)
  // after the hand-over the beat is no longer due; the talk carries on from its own state
  n = folkTalk(ctx({ canTeach: false, hasCatch: false }), cur!, acts)
  ok(n.line === YARROW_TEACH[a], `${a}: Yarrow's answer line`)
  pick(n, LISTEN); n = folkTalk(ctx({ canTeach: false, hasCatch: false }), cur!, acts)
  ok(n.scene === YARROW_TEACH.page.scene && n.line === YARROW_TEACH.page.lines[0], `${a}: the page runs after the answer`)
  pick(n, LISTEN); n = folkTalk(ctx({ canTeach: false, hasCatch: false }), cur!, acts)
  ok(n.line === YARROW_TEACH.page.lines[1], `${a}: the page's second line`)
}
// a full bag: the hand-over refuses, the beat does NOT advance (stays armed)
{ _resetHeard(); teachOk = false
  const n = folkTalk(ctx({ canTeach: true, hasCatch: false }), { fid: y.id, screen: 'teach', step: 1 }, acts)
  cur = null; pick(n, YARROW_TEACH.options.silent)
  ok(cur === null, 'a refused hand-over moved the beat on (the page would be skipped)'); teachOk = true }
// not due (no stick yet, or already taught): the ordinary hello
{ _resetHeard()
  ok(folkTalk(ctx({ canTeach: false, hasCatch: false }), helloFor(y.id), acts).line === GLADE_STATION_LINES.yarrow.main, 'not due: the station hello')
  ok(folkTalk(ctx(), { fid: 'moonwell:hazel', screen: 'teach', step: 0 }, acts).line !== YARROW_TEACH.open.line, 'the beat leaked onto another Moglin') }
// B barks: a catch in the bag -> B2; repeats go main, alt, B1, alt, B1
{ _resetHeard()
  const seq = [0, 1, 2, 3, 4].map(() => folkTalk(ctx({ canTeach: false, hasCatch: false }), helloFor(y.id), acts).line)
  const L = GLADE_STATION_LINES.yarrow
  ok(seq.join('|') === [L.main, L.alt, YARROW_BARKS.jars, L.alt, YARROW_BARKS.jars].join('|'), `repeat order: ${seq.map(s => s.slice(0, 12)).join(' / ')}`)
  ok(folkTalk(ctx({ canTeach: false, hasCatch: true }), helloFor(y.id), acts).line === YARROW_BARKS.catch, 'carrying a catch: B2 is the hello') }

// ── the hand-over + the page (inventory.ts)
{ const fresh = newInv()
  const t = yarrowTeach(fresh)!
  ok(!!t && countOf(t, 'mast') === 1 && countOf(t, 'bait') === countOf(fresh, 'bait') + YARROW_GIFT_BAIT && countOf(t, BAIT_PAGE) === 1, 'teach: Mast + a few Bait + the page')
  ok(hasGift(t, GIFT_YARROW_TAUGHT) && yarrowTeach(t) === null, 'teach: once only')
  ok(!isCatch(BAIT_PAGE), 'the page reads as a catch (Fennel would take it)')
  // a full bag: all or nothing
  let full: Inv = fresh; for (let k = 0; k < SLOTS; k++) if (!full.slots[k]) full = { ...full, slots: full.slots.map((s, i) => (i === k ? { id: `junk${k}`, n: 1 } : s)) }
  ok(yarrowTeach(full) === null && countOf(full, BAIT_PAGE) === 0, 'teach: a full bag got half the hand-over')
  // reading: needs the page, once; the page stays in the bag
  ok(readBaitPage(fresh) === null, 'read without a page')
  const r = readBaitPage(t)!
  ok(!!r && hasGift(r, GIFT_BAIT_READ) && countOf(r, BAIT_PAGE) === 1 && readBaitPage(r) === null, 'read: marks once, keeps the page')
  // the mark survives bag ops (the gifts record)
  ok(hasGift(take(give(r, 'mast', 3).inv, 'mast', 1)!, GIFT_BAIT_READ), 'a bag op dropped the read mark')
  // every cut +1 after reading, in the bag ...
  for (const id of Object.keys(BAIT_FROM)) ok(baitYield(t, id) === BAIT_FROM[id] && baitYield(r, id) === BAIT_FROM[id] + 1, `yield ${id}: +1 only after reading`)
  const before = makeBait(give(t, 'mast', 1).inv, 'mast')!, after = makeBait(give(r, 'mast', 1).inv, 'mast')!
  ok(before.made === BAIT_FROM.mast && after.made === BAIT_FROM.mast + 1, `bag cut: ${before.made} -> ${after.made}`)
  ok(baitYield(r, 'moonkoi') === 0 && makeBait(give(r, 'moonkoi', 1).inv, 'moonkoi') === null, 'the +1 made bait out of something that is not bait food')
  // ... and at the Rinnshop bench
  const w = { v: 1, rooms: [{ id: 'r1', kind: 'rinnshop', store: [{ id: 'mast', n: 2 }] }] } as unknown as Works
  const b0 = makeBaitAt(w, 'r1', t, 'mast'), b1 = makeBaitAt(w, 'r1', r, 'mast')
  ok(!!b0 && !!b1 && b0.made === BAIT_FROM.mast && b1.made === BAIT_FROM.mast + 1, `bench cut: ${b0?.made} -> ${b1?.made}`) }

console.log(`yarrow-teach: ${pass} ok, ${fail} fail`); process.exit(fail ? 1 : 0)
