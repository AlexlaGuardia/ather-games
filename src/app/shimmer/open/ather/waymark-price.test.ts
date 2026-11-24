// Run: npx tsx src/app/shimmer/open/ather/waymark-price.test.ts   (from the repo root)
// BETA M71 s2 (Magii 43fef80 #6): a NEW bag starts with 3 free waymarks; Greg sells more at 500 grey matter each, only to a
// keeper with a folded garden (a waymark leads home to it); under the price refuses with the shortfall; spends exactly the price.
// HARD RULE: a keeper from before keeps every waymark (a saved bag is read as is; a bag first made for a keeper who already
// has a garden save is made at the old 12).
import { newInv, loadInv, startingWaymarks, countOf, give, FREE_WAYMARKS, LEGACY_WAYMARKS, INV_KEY, SLOTS } from '../shared/inventory'
import { tryBuyWaymark, buyPick, foldNode, WAYMARK_PRICE, FOLD_TEXT, type FoldStep } from './garden-fold'
import { freshTut, type Tut } from './glade-tutorial'
import { gregTalk } from './greg-talk'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }

// ── a new bag ──
ok(FREE_WAYMARKS === 3 && LEGACY_WAYMARKS === 12 && WAYMARK_PRICE === 500, 'the numbers: 3 free, old 12, 500 each')
ok(countOf(newInv(), 'waymark') === 3, 'a new bag holds 3 waymarks')
ok(startingWaymarks(0, false) === 3 && startingWaymarks(1, false) === 2 && startingWaymarks(5, false) === 0, 'a new keeper: 3 less any planted, never negative')
ok(startingWaymarks(0, true) === 12 && startingWaymarks(4, true) === 8, 'a keeper with a garden save already: the old 12 less planted')

// ── old saves keep their count (loadInv reads a saved bag as is) ──
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) }, clear: () => mem.clear(), key: () => null, length: 0 } as Storage
for (const n of [12, 7, 1]) {
  mem.clear()
  const saved = newInv(n); saved.gifts = ['bait1']
  for (const k of [INV_KEY, `ather:keeper:x:${INV_KEY}`]) mem.set(k, JSON.stringify(saved))
  const back = loadInv()
  ok(back.slots.length === SLOTS && countOf(back, 'waymark') === n, `an old save with ${n} waymarks loads with ${countOf(back, 'waymark')}`)
}
mem.clear()
ok(countOf(loadInv(), 'waymark') === 3, 'no saved bag: a new one with 3')

// ── the buy ──
const folded: Tut = { ...freshTut(), folded: true }, unfolded: Tut = { ...freshTut(), folded: false }
const u = tryBuyWaymark(unfolded, 9999)
ok(!u.ok && u.why === 'unfolded', 'no garden, no waymark for sale')
const s = tryBuyWaymark(folded, 499)
ok(!s.ok && s.why === 'grey' && s.need === 1, 'under the price refuses with the shortfall')
const b = tryBuyWaymark(folded, 500)
ok(b.ok && b.grey === 0, 'at the price: exactly 500 spent')
const c = tryBuyWaymark(folded, 1234.7)
ok(c.ok && c.grey === 734, 'spends exactly the price, never more')

// buyPick wires it: +1 waymark through act.buy, the grey it gets is exactly grey - price; refusals do not call buy
let inv = newInv(), grey = 620
let step = 'none' as FoldStep | null | 'none'
const act = (g: () => number) => ({ grey: g, pay: () => {}, home: () => {}, go: (x: FoldStep | null) => { step = x }, buy: (left: number) => { const r = give(inv, 'waymark', 1); if (r.left) return false; inv = r.inv; grey = left; return true } })
buyPick(folded, act(() => grey))
ok(countOf(inv, 'waymark') === 4 && grey === 120 && step === 'buyDone', `buy at 620: 3 -> ${countOf(inv, 'waymark')} waymarks, grey ${grey}, step ${step}`)
buyPick(folded, act(() => grey))
ok(countOf(inv, 'waymark') === 4 && grey === 120 && step === 'buyShort', 'at 120: refused, nothing spent, the shortfall screen')
buyPick(unfolded, act(() => 9999))
ok(countOf(inv, 'waymark') === 4 && step === null, 'unfolded: nothing bought, talk closes')
const full = { ...act(() => 900), buy: () => false }
buyPick(folded, full)
ok(step === null, 'a full bag: nothing spent (buy returns false), talk closes')

// the talk: the buy answer shows when offered, the short screen says the shortfall
const n = gregTalk({ stage: 'done' } as never, 0, { bye: () => {}, goto: () => {}, buy: { label: FOLD_TEXT.buyAsk, pick: () => {} } })
ok(n.options.some(o => o.label === FOLD_TEXT.buyAsk), "Greg's talk offers 'Buy a waymark' when given")
ok(!gregTalk({ stage: 'done' } as never, 0, { bye: () => {}, goto: () => {} }).options.some(o => o.label === FOLD_TEXT.buyAsk), 'and not when absent')
ok(foldNode(folded, 'buyShort', act(() => 120)).line === FOLD_TEXT.buyShort(120), 'the short screen names what the keeper has')

console.log(`waymark-price: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
