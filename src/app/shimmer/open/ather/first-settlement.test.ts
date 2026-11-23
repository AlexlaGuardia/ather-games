// Run: npx tsx src/app/shimmer/open/ather/first-settlement.test.ts
// BETA M70 s1: the first settlement's Lamps Out chain, reading the SIGNED canon file itself (every line the talk shows is
// the canon text word for word), the gift once (a reload = parse(save) cannot re-gift), lamps dark -> lit, barks open -> after.
import { readFileSync } from 'node:fs'
import { freshTut, legacyTut, parseTut, type Tut } from './glade-tutorial'
import { settlerStart, settlerNode, m70Down, m70Quest, lampsLit, pickTarget, acceptM70, SETTLERS, LAMPS, SETTLEMENT, M70_GIFT, speakerOf, type SettlerCursor, type SettlerActs } from './first-settlement'
import { GLADE_LINES } from './glade-tutorial-lines'
import { GLEANER_POST } from './gleaner'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const rt = (t: Tut) => parseTut(JSON.parse(JSON.stringify(t)))!

// ── the canon file, parsed here (not through the generator): id -> [speaker, text]
const canon = new Map<string, { who: string | null; text: string }>()
for (const raw of readFileSync('/root/athernyx/CANON/game/shimmer-quest-glade-tutorial.md', 'utf8').split('\n')) {
  let m = raw.match(/^- `((?:settler|quest\.m70)[a-z0-9_.]*)`\s*(?:\[[^\]]*\]\s*)?(.*)$/)
  if (m) { const sm = m[2].match(/^([A-Z]+):\s*(.*)$/); canon.set(m[1], sm ? { who: sm[1][0] + sm[1].slice(1).toLowerCase(), text: sm[2] } : { who: null, text: m[2].replace(/^> /, '') }); continue }
  m = raw.match(/^\[quest log\] `(quest\.m70[a-z0-9_.]*)` (?:\*\*(.+)\*\*|(.+))$/)
  if (m) canon.set(m[1], { who: null, text: (m[2] ?? m[3]).trim() })
}
const IDS = ['settler.arrive.1', 'settler.arrive.2', 'settler.arrive.3', 'settler.arrive.4', 'settler.choice.go', 'settler.go', 'quest.m70.title', 'quest.m70.step', 'quest.m70.done',
  'settler.bark.open', 'settler.bark.tired', 'settler.thanks.1', 'settler.thanks.2', 'settler.thanks.3', 'settler.thanks.4', 'settler.thanks.5', 'quest.m70.after', 'settler.after.bark']
for (const id of IDS) ok(canon.get(id) && GLADE_LINES[id]?.text === canon.get(id)!.text && (GLADE_LINES[id].who ?? null) === (canon.get(id)!.who ?? null), `${id} = canon word for word (${JSON.stringify(GLADE_LINES[id])} vs ${JSON.stringify(canon.get(id))})`)
ok(canon.get('quest.m70.title')?.text === 'Lamps Out', 'canon parse sanity: Lamps Out')

// ── a talk harness: walk a cursor to its end, picking the only answer each time
function walk(t0: Tut, who: SettlerCursor['who'], opt: { target?: string | null; give?: boolean } = {}) {
  let t = t0, c = settlerStart(t, who), shown: string[] = [], labels: string[] = [], gave = 0
  const act: SettlerActs = { set: x => { t = x }, go: i => { c = i === null ? null : { ...c!, i } }, target: () => opt.target ?? null, give: () => { if (opt.give === false) return false; gave++; return true } }
  for (let k = 0; c && k < 20; k++) { const n = settlerNode(t, c, act); shown.push(n.line); labels.push(n.options[0].label); n.options[0].pick() }
  return { t, shown, labels, gave }
}
const txt = (ids: string[]) => ids.map(i => GLADE_LINES[i].text)

let t = freshTut()
ok(t.m70 === 'none' && !lampsLit(t) && m70Quest(t) === null, 'fresh: no quest, lamps dark')
// barks while the big one stands (before and after the ask)
ok(walk(t, 'borage').shown.join() === txt(['settler.bark.open']).join(), 'Borage: bark.open while it stands')
ok(walk(t, 'feverfew').shown.join() === txt(['settler.bark.tired']).join(), 'Feverfew: bark.tired while it stands')
ok(settlerStart(t, 'angelica') === null, 'Angelica: no talk yet (s3)')
ok(speakerOf('settler.bark.open').id === 'borage' && speakerOf('settler.bark.tired').id === 'feverfew', 'a bark is spoken by its canon speaker')
// the arrival, in order, with the choice
let w = walk(t, 'chamomile', { target: 'first-wilds:1,1' })
ok(w.shown.join('|') === txt(['settler.arrive.1', 'settler.arrive.2', 'settler.arrive.3', 'settler.arrive.4', 'settler.go']).join('|'), `Chamomile's arrival in order (${w.shown.join('|')})`)
ok(w.labels[3] === GLADE_LINES['settler.choice.go'].text, 'the choice = "Leave it to me."')
t = w.t
ok(t.m70 === 'open' && t.m70node === 'first-wilds:1,1', 'the ask opens Lamps Out on the picked node')
ok(m70Quest(t)?.title === 'quest.m70.title' && m70Quest(t)?.step === 'quest.m70.step', 'journal: Lamps Out / Defeat the big Hollow')
ok(rt(t).m70 === 'open' && rt(t).m70node === 'first-wilds:1,1', 'the quest survives a reload')
ok(walk(t, 'chamomile').shown.join() === txt(['settler.go']).join() && walk(t, 'chamomile').t === t, 'asked again: settler.go, nothing changes')
ok(acceptM70(t, 'x') === t, 'no second accept')
// another node's champion is not the big one
ok(m70Down(t, 'first-wilds:3,3') === t, "another node's champion does not count")
ok(!lampsLit(t), 'lamps dark while it stands')
t = m70Down(t, 'first-wilds:1,1')
ok(t.m70 === 'down' && lampsLit(t), 'the big one down: lamps lit')
ok(m70Quest(t)?.step === 'quest.m70.done', 'journal: Tell the settlers')
ok(walk(t, 'borage').shown.join() === txt(['settler.after.bark']).join() && walk(t, 'feverfew').shown.join() === txt(['settler.after.bark']).join(), 'barks switch to after.bark')
// the bag refuses: nothing recorded, the thanks wait
const full = walk(t, 'chamomile', { give: false })
ok(full.t.m70 === 'down' && !full.t.gifts.includes('m70pack') && full.gave === 0, 'a full bag: nothing handed, nothing recorded')
// the thanks: in order, the gift once
w = walk(t, 'chamomile')
ok(w.shown.join('|') === txt(['settler.thanks.1', 'settler.thanks.2', 'settler.thanks.3', 'settler.thanks.4', 'settler.thanks.5']).join('|'), `the thanks in order (${w.shown.join('|')})`)
ok(w.gave === 1 && w.t.m70 === 'thanked' && w.t.gifts.includes('m70pack'), 'the gift handed once, recorded')
t = w.t
ok(m70Quest(t)?.step === 'quest.m70.after', 'journal: Go back to Greg at the Glade.')
const again = walk(rt(t), 'chamomile')
ok(again.gave === 0 && again.shown.join() === txt(['settler.after.bark']).join(), 'reload + talk again: no second gift')
// a save mid-thanks (gift recorded, state somehow still down) never re-gifts
ok(walk({ ...t, m70: 'down' }, 'chamomile').gave === 0, 'the gift guard holds even if the state rolls back')
// legacy keepers can earn it (the pack is the settlement's, not the Glade's)
ok(!legacyTut().gifts.includes('m70pack') && legacyTut().m70 === 'none', 'a legacy keeper still meets Lamps Out')
ok(parseTut({ v: 1, live: true, greg: {}, heard: [], gifts: [], b2: 'none' })!.m70 === 'none', 'an older save parses with no M70 state')
ok(parseTut({ ...freshTut(), m70: 'bogus' })!.m70 === 'none', 'a bad state reads as none')
// places + the pick
const near = pickTarget([{ id: 'a', x: SETTLEMENT.x + 200, z: SETTLEMENT.z }, { id: 'b', x: SETTLEMENT.x + 90, z: SETTLEMENT.z - 20 }, { id: 'c', x: 900, z: 900 }])
ok(near?.id === 'b', 'the big one = the nearest infected node')
ok(pickTarget([]) === null, 'no node: null')
ok(SETTLERS.length === 4 && SETTLERS.every(s => Math.hypot(s.x - SETTLEMENT.x, s.z - SETTLEMENT.z) < 16), 'four settlers round the arrival')
ok(Math.hypot(GLEANER_POST.x - SETTLEMENT.x, GLEANER_POST.z - SETTLEMENT.z) < SETTLEMENT.r, "Gleaner's stall stands in the settlement")
ok(LAMPS.length >= 6 && LAMPS.every(l => Math.hypot(l.x - SETTLEMENT.x, l.z - SETTLEMENT.z) < SETTLEMENT.r), 'lamps along the paths, inside the settlement')
ok(M70_GIFT[0].id === 'potion:health:D' && M70_GIFT[0].n === 3, 'three basic Health Draughts')
console.log(fail ? `FAIL ${fail} (pass ${pass})` : `PASS ${pass}`); process.exit(fail ? 1 : 0)
