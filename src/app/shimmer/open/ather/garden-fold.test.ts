// Run: npx tsx src/app/shimmer/open/ather/garden-fold.test.ts
// M71 s1: Greg folds the first garden for exactly 100 grey matter. 99 refuses (and says how much is missing), 100 spends exactly 100,
// the folded flag survives a save round-trip, never folds twice, is only offered after the first settlement's thanks, and EVERY save
// from before M71 (a garden already) reads as folded.
import { freshTut, legacyTut, parseTut, adoptTut, type Tut } from './glade-tutorial'
import { FOLD_COST, tryFold, foldOffered, gardenOpen, foldNode, FOLD_TEXT, type FoldStep } from './garden-fold'
import { line } from './glade-tutorial-lines'
import { ANSWERS } from './greg-talk'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const rt = (t: Tut) => parseTut(JSON.parse(JSON.stringify(t)))!

ok(FOLD_COST === 100, 'the first fold costs 100 grey matter')
const born = freshTut()
ok(!born.folded && !gardenOpen(born), 'a newborn has no garden')
ok(!foldOffered(born), 'not offered before the first settlement')
for (const m70 of ['none', 'open', 'down'] as const) ok(!foldOffered({ ...born, m70 }), `not offered at m70 ${m70}`)
ok(tryFold(born, 500).ok === false, 'no fold before the beat, however much grey')
const back: Tut = { ...born, m70: 'thanked' }
ok(foldOffered(back), 'offered once Chamomile thanked you')

// the gate: 99 refuses, 100 spends exactly 100
const r99 = tryFold(back, 99)
ok(!r99.ok && r99.why === 'grey' && r99.need === 1, '99 refuses: 1 short')
ok(!tryFold(back, 0).ok && !tryFold(back, 99.9).ok, '0 and 99.9 refuse')
const r100 = tryFold(back, 100)
ok(r100.ok && r100.grey === 0 && r100.t.folded, '100 folds and leaves 0')
const r250 = tryFold(back, 250)
ok(r250.ok && r250.grey === 150, '250 folds and leaves 150 (exactly 100 spent)')
if (r100.ok) {
  ok(back.folded === false, 'the fold is pure (the old state untouched)')
  const saved = rt(r100.t)
  ok(saved.folded && gardenOpen(saved), 'the folded flag persists through a save')
  ok(!foldOffered(saved), 'never offered again')
  const again = tryFold(saved, 1000)
  ok(!again.ok && again.why === 'folded', 'never folds twice')
}
ok(rt(back).folded === false, 'an unfolded save stays unfolded through a save')

// MIGRATION: an existing garden is never taken
const oldSave = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto'], gifts: ['grimoire'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none' }
ok(parseTut(oldSave)!.folded === true, 'a pre-M71 live save (no field) = folded')
ok(parseTut({ ...oldSave, live: false })!.folded === true, 'a pre-M71 legacy save = folded')
ok(legacyTut().folded && adoptTut(null, true).folded, 'a keeper who played before the tutorial (garden save, no tutorial save) = folded')
ok(adoptTut(null, false).folded === false, 'a brand-new keeper = unfolded')
ok(parseTut({ ...oldSave, folded: 'x' })!.folded === true, 'junk in the field never takes a garden')

// the talk
const st = { step: 'offer' as FoldStep | null, grey: 60, paid: null as { t: Tut; grey: number } | null, home: 0 }
const acts = { grey: () => st.grey, pay: (t: Tut, g: number) => { st.paid = { t, grey: g } }, go: (s: FoldStep | null) => { st.step = s }, home: () => { st.home++ } }
let n = foldNode(back, 'offer', acts)
ok(n.line === FOLD_TEXT.offer && n.options.map(o => o.label).join('|') === `${FOLD_TEXT.ask}|${line('greg.b2.choice.wait')}`, 'offer: fold or the signed Not yet.')
n.options[0].pick()
ok(st.step === 'short' && st.paid === null, 'under 100: refused, nothing paid')
n = foldNode(back, 'short', acts)
ok(n.line === FOLD_TEXT.short(60) && n.line.includes('60') && n.line.includes('100'), 'the refusal says the reason (have 60, takes 100)')
ok(n.options[1].label === ANSWERS.bye, 'the refusal lets you leave')
st.grey = 130; n.options[0].pick()
ok(st.step === 'done' && st.paid?.grey === 30 && st.paid?.t.folded, 'at 130: paid, 30 left, folded')
n = foldNode(back, 'done', acts)
n.options[0].pick()
ok(st.step === null && st.home === 1, 'done: through the gate, home')
ok(!/[—;]/.test(Object.values(FOLD_TEXT).map(v => (typeof v === 'string' ? v : v(1))).join(' ')), 'no em dash or semicolon in the placeholders')

console.log(`garden-fold: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
