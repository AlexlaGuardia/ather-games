// Run: npx tsx src/app/shimmer/open/ather/m70-alchemist.test.ts
// BETA M70 s3: A Proper Batch, reading the SIGNED canon file itself (every line Angelica says is canon word for word):
// offer -> Later / Show me -> gather -> brew at her Desk -> hand -> reward lines + the alchemy set ONCE (a reload re-gifts nothing).
import { readFileSync } from 'node:fs'
import { freshTut, parseTut, type Tut } from './glade-tutorial'
import { angelicaStart, angelicaNode, angelicaTalks, deskOpen, sideStep, sideQuest, brewBatch, batchReady, bottleToHand, brewed, BATCH_NEEDS, ALC_SET_ITEMS, ANGELICA_DESK, OFFER_SCRIPT, HAND_SCRIPT, M70SIDE_TEXT, type AngelicaCursor, type AngelicaActs } from './m70-alchemist'
import { GLADE_LINES } from './glade-tutorial-lines'
import { FURNITURE } from './furniture'
import { settlerAt } from './first-settlement'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const rt = (t: Tut) => parseTut(JSON.parse(JSON.stringify(t)))!

// ── the canon file, parsed here (not through the generator)
const canon = new Map<string, { who: string | null; text: string }>()
for (const raw of readFileSync('/root/athernyx/CANON/game/shimmer-quest-glade-tutorial.md', 'utf8').split('\n')) {
  let m = raw.match(/^- `((?:alchemist|quest\.m70side)[a-z0-9_.]*)`\s*(?:\[[^\]]*\]\s*)?(.*)$/)
  if (m) { const sm = m[2].match(/^([A-Z]+):\s*(.*)$/); canon.set(m[1], sm ? { who: sm[1][0] + sm[1].slice(1).toLowerCase(), text: sm[2] } : { who: null, text: m[2].replace(/^> /, '') }); continue }
  m = raw.match(/^\[quest log\] `(quest\.m70side[a-z0-9_.]*)` (?:\*\*(.+)\*\*|(.+))$/)
  if (m) canon.set(m[1], { who: null, text: (m[2] ?? m[3]).trim() })
}
const IDS = ['alchemist.offer.1', 'alchemist.offer.2', 'alchemist.choice.yes', 'alchemist.choice.no', 'alchemist.yes', 'alchemist.no', 'alchemist.bark.open',
  'alchemist.reward.1', 'alchemist.reward.2', 'alchemist.reward.3', 'quest.m70side.title', 'quest.m70side.done']
for (const id of IDS) ok(canon.get(id) && GLADE_LINES[id]?.text === canon.get(id)!.text && (GLADE_LINES[id].who ?? null) === (canon.get(id)!.who ?? null), `${id} = canon word for word (${JSON.stringify(GLADE_LINES[id])} vs ${JSON.stringify(canon.get(id))})`)
ok(canon.get('quest.m70side.title')?.text === 'A Proper Batch' && canon.get('alchemist.choice.yes')?.text === 'Show me.', 'canon parse sanity')
const txt = (ids: string[]) => ids.map(i => GLADE_LINES[i].text)

// ── a talk harness: picks option `pick(k)` at each node (default the first)
function walk(t0: Tut, holds: boolean, pick: (lineId: string) => number = () => 0, hand: (withSet: boolean) => boolean = () => true) {
  let t = t0, c: AngelicaCursor | null = angelicaStart(t, holds); const shown: string[] = [], labels: string[][] = []; let sets = 0, hands = 0
  const act: AngelicaActs = { set: x => { t = x }, go: i => { c = i === null ? null : { ...c!, i } }, hand: w => { const r = hand(w); if (r) { hands++; if (w) sets++ } return r } }
  for (let k = 0; c && k < 20; k++) { const n = angelicaNode(t, c, act), id = c.script[Math.min(c.i, c.script.length - 1)]; shown.push(n.line); labels.push(n.options.map(o => o.label)); n.options[pick(id)].pick() }
  return { t, shown, labels, sets, hands }
}

// ── before Lamps Out is thanked: she has nothing to say
let t = freshTut()
ok(!angelicaTalks(t) && angelicaStart(t, false) === null && !deskOpen(t), 'fresh: Angelica silent, Desk shut')
ok(angelicaStart({ ...t, m70: 'down' }, false) === null, 'champion down but not thanked: still silent')
t = { ...t, m70: 'thanked' }
ok(angelicaTalks(t) && sideQuest(t, {}, x => x) === null, 'thanked: Angelica talks, no quest yet')

// ── the offer: Later
const later = walk(t, false, id => (id === 'alchemist.offer.2' ? 1 : 0))
ok(later.shown.join('|') === txt(['alchemist.offer.1', 'alchemist.offer.2', 'alchemist.no']).join('|'), `Later: offer.1, offer.2, no (${later.shown.join(' | ')})`)
ok(later.labels[1].join('|') === txt(['alchemist.choice.yes', 'alchemist.choice.no']).join('|'), `the two choices, Show me first (${later.labels[1]})`)
ok(later.t.m70side === 'later' && !deskOpen(later.t) && sideQuest(later.t, {}, x => x) === null, 'Later: no quest, Desk shut')
// ── then Show me
const yes = walk(rt(later.t), false)
ok(yes.shown.join('|') === txt(['alchemist.offer.1', 'alchemist.offer.2', 'alchemist.yes']).join('|'), `Show me after Later: the offer again, then yes (${yes.shown.join(' | ')})`)
t = rt(yes.t)
ok(t.m70side === 'open' && deskOpen(t), 'Show me: open, Desk works')
ok(walk(t, false).shown.join() === txt(['alchemist.bark.open']).join(), 'while open: bark.open')
ok(walk(t, true).shown.join() === txt(['alchemist.bark.open']).join() && walk(t, true).sets === 0 && angelicaStart(t, true)?.mode === 'bark', 'open + a gifted Health Draught in the bag: still the bark, no hand-over (brew first)')

// ── step 1 gather
const name = (id: string) => ({ shimmerscale: 'Shimmerscale', 'crop:goldleaf': 'Goldleaf', 'crop:dewdrop_vine': 'Dewdrop Vine' } as Record<string, string>)[id] ?? id
ok(JSON.stringify(BATCH_NEEDS) === JSON.stringify([{ id: 'shimmerscale', n: 2 }, { id: 'crop:goldleaf', n: 2 }, { id: 'crop:dewdrop_vine', n: 2 }]), `the batch takes the Health Draught's raw makings (${JSON.stringify(BATCH_NEEDS)})`)
ok(sideStep(t, {}) === 'gather' && sideQuest(t, {}, name)?.note === 'Gather 2 Shimmerscale, 2 Goldleaf and 2 Dewdrop Vine.', `gather text (${sideQuest(t, {}, name)?.note})`)
ok(sideQuest(t, {}, name)?.title === 'A Proper Batch', 'journal title = canon')
const bag = { shimmerscale: 2, 'crop:goldleaf:B': 1, 'crop:goldleaf:D': 1, 'crop:dewdrop_vine:C': 2, 'potion:health:D': 3 }
ok(!batchReady({ ...bag, shimmerscale: 1 }) && brewBatch({ ...bag, shimmerscale: 1 }) === null, 'one scale short: cannot brew')
ok(batchReady(bag) && sideStep(t, bag) === 'brew' && sideQuest(t, bag, name)?.note === M70SIDE_TEXT.brew, 'all in the bag: step 2 brew')

// ── step 2 brew (the whole chain, the keeper's hands)
const b = brewBatch(bag)!
ok(b && b.make.n === 2 && b.make.id === 'potion:health:C', `the batch pours 2 Health Draughts graded from the crops (B+D goldleaf, C vine -> C) (${JSON.stringify(b?.make)})`)
ok(JSON.stringify(b.spend.map(x => `${x.id}x${x.n}`).sort()) === JSON.stringify(['crop:dewdrop_vine:Cx2', 'crop:goldleaf:Bx1', 'crop:goldleaf:Dx1', 'shimmerscalex2']), `spends exactly the raw makings (${b.spend.map(x => x.id + 'x' + x.n)})`)
t = rt(brewed(t))
ok(t.m70side === 'brewed' && brewed(t) === t, 'brewed (once; never backwards)')
ok(rt(brewed({ ...t, m70side: 'later' })).m70side === 'later', 'the Desk does not move a quest that is not open')
const bag2 = { 'potion:health:D': 3, 'potion:health:C': 2 }
ok(sideStep(t, bag2) === 'hand' && sideQuest(t, bag2, name)?.note === M70SIDE_TEXT.hand, 'step 3 hand')
ok(bottleToHand(bag2) === 'potion:health:D' && bottleToHand({}) === null, 'hands the worst bottle; none = null')

// ── step 3 hand -> reward + the set, once
const h = walk(t, true)
ok(h.shown.join('|') === txt(HAND_SCRIPT).join('|'), `hand-over: bark.open, then reward.1-3 in order (${h.shown.join(' | ')})`)
ok(h.labels[0][0] === M70SIDE_TEXT.handLabel, 'the hand label first')
ok(h.sets === 1 && h.t.m70side === 'done' && h.t.gifts.includes('m70set'), 'the set handed once, quest done')
ok(sideQuest(h.t, {}, name)?.note === GLADE_LINES['quest.m70side.done'].text, 'journal: the canon done line')
ok(!angelicaTalks(h.t) && angelicaStart(rt(h.t), true) === null && !deskOpen(h.t), 'after: Angelica silent, Desk shut (reload = parse: nothing re-offered)')
// a full bag: nothing handed, nothing moved
const full = walk(t, true, () => 0, () => false)
ok(full.t.m70side === 'brewed' && full.sets === 0 && !full.t.gifts.includes('m70set'), 'bag full: no set, still brewed, no gift recorded')
// the guard holds even if the gift were recorded somehow: no second set
const again = walk({ ...t, gifts: [...t.gifts, 'm70set'] }, true)
ok(again.sets === 0 && again.hands === 1 && again.t.m70side === 'done', 'gift already given: the bottle goes, no second set')
// Bye at the hand-over leaves it waiting
ok(walk(t, true, id => (id === 'alchemist.bark.open' ? 1 : 0)).t.m70side === 'brewed', 'Bye at the hand-over: still brewed')

// ── the set + the Desk
ok(JSON.stringify(ALC_SET_ITEMS) === JSON.stringify(['alc_desk', 'alc_mortar', 'alc_mixer', 'alc_still']), `the set = every alchemy station, Desk first (${ALC_SET_ITEMS})`)
ok(ALC_SET_ITEMS.every(id => FURNITURE[id]?.alc), 'every set piece is a real station')
const a = settlerAt('angelica'), dd = Math.hypot(ANGELICA_DESK.x - a.x, ANGELICA_DESK.z - a.z)
ok(dd > 1.2 && dd < 2.2, `the Desk stands beside Angelica (${dd.toFixed(2)} m)`)
ok(OFFER_SCRIPT.length === 4 && OFFER_SCRIPT.every(id => GLADE_LINES[id]), 'offer script ids exist')

console.log(`m70-alchemist: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0)
