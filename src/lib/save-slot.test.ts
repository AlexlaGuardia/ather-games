// The save slot's own guard. Run: npx tsx src/lib/save-slot.test.ts
//
// ── ⚠ THIS FILE EXISTS BECAUSE THE KEY WAS A SCATTERED LITERAL (#682, 2026-08-23) ───────────────
// `ather:save:shimmer` was hand-written in five places across four files. Making it per-account
// meant moving all five together, and a reader left behind does not fail — it quietly keeps using
// the legacy slot while everything else moves on. That is the same silent-textual-reader shape that
// broke three rewrites and a canon gate on 2026-08-22, so the rule is enforced rather than
// remembered: NOBODY may spell the literal except this module.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  ANON_SAVE_KEY, SAVE_KEY_PREFIX, OWNER_FIELD,
  setSaveOwner, saveKey, saveOwner, slotFor, stampOwner, ownerOf, ownedBy,
  gameSlot, planSlotAdoption, ADOPTABLE, saveOwnerResolved, adoptAnonSlots, SLOT_CLAIM,
} from './save-slot'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── the slot itself ─────────────────────────────────────────────────────────────────────────────
setSaveOwner(null)
ok(saveKey() === ANON_SAVE_KEY, `anonymous slot is the bare key (got ${saveKey()})`)
ok(saveOwner() === null, 'anonymous owner is null')

setSaveOwner('u_aaa')
ok(saveKey() === 'ather:save:shimmer:u_aaa', `signed-in slot carries the account (got ${saveKey()})`)
setSaveOwner('u_bbb')
ok(saveKey() === 'ather:save:shimmer:u_bbb', 'a second account gets a DIFFERENT slot')
ok(slotFor('u_aaa') !== slotFor('u_bbb'), 'two accounts never share a slot')
ok(slotFor(null) === ANON_SAVE_KEY, 'slotFor(null) is the anonymous slot')
ok(saveKey().startsWith(SAVE_KEY_PREFIX), 'every slot starts with the prefix the epoch reset sweeps')

// ── the stamp ───────────────────────────────────────────────────────────────────────────────────
const blob = JSON.stringify({ whose: 'A', pos: [1, 2, 3] })
const stampedA = stampOwner(blob, 'u_aaa')
ok(ownerOf(stampedA) === 'u_aaa', 'a stamped blob names its owner')
ok(JSON.parse(stampedA).whose === 'A', 'stamping preserves the save')
ok(ownerOf(blob) === null, 'an unstamped blob names nobody')
ok(stampOwner(blob, null) === blob, 'anonymous saves are not stamped')
ok(stampOwner('not json', 'u_aaa') === 'not json', 'an unparseable blob is passed through, not lost')
ok(JSON.parse(stampedA)[OWNER_FIELD] === 'u_aaa', 'the stamp rides in the documented field')

// ── the gate: THE BUG, both directions ──────────────────────────────────────────────────────────
ok(ownedBy(stampedA, 'u_aaa'), 'my own save is mine')
ok(!ownedBy(stampedA, 'u_bbb'), "★ #682: account B may NOT hold account A's save")
ok(ownedBy(blob, 'u_bbb'), 'an unstamped legacy save is adoptable (never delete an old garden)')
ok(ownedBy(blob, null), 'anonymous holds unstamped')
ok(!ownedBy(stampedA, null), "signing OUT does not inherit a signed-in keeper's save")

// ── ★ NO SECOND SPELLING OF THE KEY, ANYWHERE ───────────────────────────────────────────────────
// ⚠ COMMENTS ARE STRIPPED FIRST, AND THAT IS NOT TIDINESS. Several files legitimately DESCRIBE the
// old key in prose, and on 2026-08-22 a header quoting its own declaration handed a scanner a
// second match and made a canon gate report zero. A guard that matches prose either fires on honest
// documentation or gets loosened until it sees nothing. It reads code only.
const ROOT = join(process.cwd(), 'src')
const LITERAL = "'ather:save:shimmer'"
const ALLOWED = ['lib/save-slot.ts', 'lib/save-slot.test.ts']

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(e)) out.push(p)
  }
  return out
}
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const offenders: string[] = []
let scanned = 0
for (const file of walk(ROOT)) {
  const rel = file.slice(ROOT.length + 1)
  if (ALLOWED.some(a => rel === a)) continue
  scanned++
  const code = stripComments(readFileSync(file, 'utf8'))
  if (code.includes(LITERAL)) offenders.push(rel)
}
// ⚠ AND THE SCAN MUST PROVE IT COULD SEE. A walker that finds no files reports a clean sweep, which
// is the `ℹ check skipped / exit 0` shape — "I found nothing" and "I could not look" must not share
// an answer. If this ever reads 0, the guard is blind, not satisfied.
ok(scanned > 100, `the scan actually read the tree (${scanned} files) — 0 would mean BLIND, not clean`)
ok(offenders.length === 0, `★ the save key is spelled outside save-slot.ts: ${offenders.join(', ')}`)

// The module must still be the one place the literal DOES live, or the rule above is vacuous.
ok(readFileSync(join(ROOT, 'lib/save-slot.ts'), 'utf8').includes(LITERAL),
   'save-slot.ts still owns the literal — otherwise this whole guard asserts nothing')

// ── ★★ THE SLOT FAMILY, AND THE PURSE SPLIT (2026-08-23, Alex: "split it per account") ──────────
setSaveOwner(null)
ok(gameSlot('wallet', null) === 'ather:save:wallet', `the anonymous purse keeps the bare key (got ${gameSlot('wallet', null)})`)
ok(gameSlot('magii', null) === 'ather:save:magii', 'so does the anonymous card save')
ok(gameSlot('shimmer', null) === ANON_SAVE_KEY, 'and shimmer, which is the key this whole file is about')
ok(gameSlot('wallet', 'u_aaa') === 'ather:save:wallet:u_aaa', '★ a signed-in purse carries the account')
ok(gameSlot('wallet', 'u_aaa') !== gameSlot('wallet', 'u_bbb'), '★ two accounts never share a balance')
ok(slotFor('u_aaa') === gameSlot('shimmer', 'u_aaa'), 'slotFor is shimmer\'s gameSlot, not a second spelling of the shape')

// ★★★ THE ONE-WORD CHANGE THAT WOULD CONFISCATE EVERY PLAYER'S MARKS. `ather-epoch.ts` deletes every
// key starting with SAVE_KEY_PREFIX on a world reset, and the epoch's own header promises that Marks
// SURVIVE one — "start the world over" is not "delete everything the player has ever done". Widening
// this constant to `ather:save:` to cover the family would read as tidying and would empty every
// wallet on the next bump. It is asserted here rather than remembered.
ok(SAVE_KEY_PREFIX === ANON_SAVE_KEY, 'the epoch sweep prefix is SHIMMER\'s, not the slot family\'s')
ok(!gameSlot('wallet', null).startsWith(SAVE_KEY_PREFIX), '★★ the anonymous purse is OUT of the epoch sweep')
ok(!gameSlot('wallet', 'u_aaa').startsWith(SAVE_KEY_PREFIX), '★★ and so is a signed-in purse')
ok(gameSlot('shimmer', 'u_aaa').startsWith(SAVE_KEY_PREFIX), 'while every shimmer slot is still IN it, or a reset stops resetting')

// ── adoption of the purse: the rules, and the one that protects coins ───────────────────────────
const A = 'u_aaa', B = 'u_bbb'
const anonPurse = [gameSlot('wallet', null), gameSlot('magii', null)]
const first = planSlotAdoption(anonPurse, null, A)
ok(first.reason === 'adopted' && first.claim && first.moves.length === 2, `a first sign-in adopts the purse and the card save (${first.reason}, ${first.moves.length})`)
ok(first.moves.every(([from, to]) => to === `${from}:${A}`), 'a move adds the account and changes nothing else')
ok(!planSlotAdoption(anonPurse, A, B).moves.length && planSlotAdoption(anonPurse, A, B).reason === 'someone-elses',
   '★ a second account does not inherit the first one\'s coins')
ok(planSlotAdoption([], null, A).reason === 'nothing-anonymous', 'an empty browser is claimed by nobody')
ok(planSlotAdoption(anonPurse, null, null).reason === 'anonymous', 'an anonymous boot adopts nothing')

// ★★ PER-GAME, AND NEVER OVER A BALANCE THE ACCOUNT ALREADY HAS. Their own purse is the newer claim
// on it; adopting over it would DESTROY coins rather than misfile them. The card save still comes.
const partly = planSlotAdoption([...anonPurse, gameSlot('wallet', A)], null, A)
ok(partly.moves.length === 1 && partly.moves[0][0] === gameSlot('magii', null),
   `★★ an account that already has a purse keeps it and still adopts the card save (moved ${partly.moves.map(m => m[0]).join(',') || 'nothing'})`)
ok(!planSlotAdoption([...anonPurse, gameSlot('wallet', A)], null, A).moves.some(([, to]) => to === gameSlot('wallet', A)),
   '★★ the account\'s own balance is never written over')

// ★ SHIMMER IS NOT IN THIS MECHANISM — its adoption lives in play3d/page.tsx, wrapped around the
// cloud pull. Two mechanisms reaching for one slot is how one adopts a garden the other moved.
ok(!ADOPTABLE.includes('shimmer' as never), '★ shimmer is not adoptable through the slot mechanism')
ok(!planSlotAdoption([ANON_SAVE_KEY], null, A).moves.length, 'an anonymous shimmer save is left alone by it')

// ── the resolution flag, which is what stops money landing in the wrong purse ───────────────────
ok(saveOwnerResolved(), 'setSaveOwner marks the answer known')

// ── ★★ AND THE IMPERATIVE HALF, INCLUDING THE ORDERING THAT PROTECTS A BALANCE ──────────────────
// localStorage has no transaction, so `adoptAnonSlots` writes every destination BEFORE deleting any
// source: interrupted, the player holds both copies rather than neither. Reversed, a tab closed at
// the wrong millisecond is a balance that exists nowhere. That rule lived only in prose until a
// mutation sweep on the sibling mechanism walked straight past it.
{
  const ops: Array<{ op: string; key: string }> = []
  const data = new Map<string, string>([
    [gameSlot('wallet', null), '{"marks":240,"totalEarned":240,"totalSpent":0}'],
    [gameSlot('magii', null), '{"seeded":true}'],
    [ANON_SAVE_KEY, '{"zoneId":"glade"}'],          // shimmer — a different mechanism's business
  ])
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    get length() { return data.size },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { ops.push({ op: 'set', key: k }); data.set(k, v) },
    removeItem: (k: string) => { ops.push({ op: 'remove', key: k }); data.delete(k) },
  }
  const plan = adoptAnonSlots(A)
  ok(plan.reason === 'adopted' && plan.moves.length === 2, `the real function moved the purse (${plan.reason}, ${plan.moves.length})`)
  ok(data.get(gameSlot('wallet', A)) === '{"marks":240,"totalEarned":240,"totalSpent":0}', '★ 240 marks arrived in the account, to the coin')
  ok(data.get(gameSlot('wallet', null)) === undefined, 'and the anonymous purse is empty, so nobody adopts it twice')
  ok(data.get(ANON_SAVE_KEY) === '{"zoneId":"glade"}', '★ the shimmer save was NOT touched by the slot mechanism')
  ok(data.get(SLOT_CLAIM) === A, 'the browser is claimed for A')

  const firstRemove = ops.findIndex(o => o.op === 'remove')
  const lastCopy = ops.map((o, i) => ({ o, i })).filter(({ o }) => o.op === 'set' && plan.moves.some(([, to]) => to === o.key))
    .map(({ i }) => i).reduce((a, b) => Math.max(a, b), -1)
  ok(firstRemove > lastCopy, `★★ every destination is written before any source is deleted (first remove ${firstRemove}, last copy ${lastCopy}) — reversed, an interrupted adoption is a balance that exists nowhere`)

  ok(adoptAnonSlots(A).reason === 'nothing-anonymous', 'a second call does nothing')
  data.set(gameSlot('wallet', null), '{"marks":5}')      // as if they played signed out afterwards
  ok(adoptAnonSlots(B).reason === 'someone-elses' && data.get(gameSlot('wallet', B)) === undefined,
     "★ B signing in on the same browser inherits no coins")
  ok(data.get(gameSlot('wallet', A)) === '{"marks":240,"totalEarned":240,"totalSpent":0}', "and A's 240 are untouched by B's visit")
  delete (globalThis as { localStorage?: unknown }).localStorage
}

console.log(`\nsave-slot: ${pass} passed, ${fails.length} failed  (${scanned} files scanned)`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
