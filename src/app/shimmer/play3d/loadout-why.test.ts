// ── WHY A CAST SLOT IS EMPTY — the oracle, and the host wiring that carries it ──────────────────
// Run: npx tsx src/app/shimmer/play3d/loadout-why.test.ts
//
// ── ★★★ THE DEFECT THIS EXISTS FOR, MEASURED 2026-09-02 ────────────────────────────────────────
// Alex, playing: *"i dont have a tactical yet since we havent built a way to aquire them yet."* He
// was born of TEMPEST. Tempest knows Squall, Squall is BUILT (`archetype: 'field'`), `field` is in
// the fold's `supports` set, and a fresh tempest keeper resolves to `["squall", null]`. Nothing was
// unbuilt. A save said the slot was empty, and `loadLoadout` honours a save exactly — *"a saved
// empty slot is a CHOICE, not a hole"*, which is correct and deliberate.
//
// ⚠⚠ WHAT TURNED THAT INTO A LOST SESSION WAS THE SENTENCE. `engine/cast-dispatch` answers an empty
// slot with *"your book has none for your runes"* — ONE of three possible causes, asserted as fact,
// from the bound ids alone, which are the one thing that cannot tell them apart. So the game
// confidently named the wrong cause, and a wrong explanation does not merely misinform: **it cancels
// the look.** He stopped investigating a save because he had been told it was a content gap.
//
// ★ THE FIX IS A DERIVED REASON, NOT BETTER WORDING. `resolveLoadout` decides the binds and the
// reasons in ONE pass, so no consumer can explain a slot the bar would contradict.
import { resolveLoadout, emptySlotWhy, emptySlotSentence, loadLoadout, LOADOUT_KEY } from './loadout'
import { keeperBook } from './book'
import { keeperKey } from '@/lib/keeper-local'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codeOnly, noComments } from '../testing/guard'

let ok = 0, bad = 0, blind = 0
const chk = (name: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ok   ${name}`) }
  else { bad++; console.log(`  FAIL: ${name} ${extra}`) }
}

// A real store, so these are OBSERVATIONS of the shipped function rather than restatements of it.
const store: Record<string, string> = {}
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
}
const K = keeperKey(LOADOUT_KEY)
const why = (owned: string[], birth: string, slot = 0) =>
  resolveLoadout(owned, birth, keeperBook(owned)).why[slot]
const bind = (owned: string[], birth: string, slot = 0) =>
  resolveLoadout(owned, birth, keeperBook(owned)).slots[slot]

console.log('\n── 1. the three reasons are actually distinguished ──')
delete store[K]
chk('★ no save + an eligible move → the kit fills the slot, so there is no reason to give',
  bind(['tempest'], 'tempest') === 'squall' && why(['tempest'], 'tempest') === null)

delete store[K]
chk('★ no save + nothing eligible → `no-move` (vapor teaches no tactical)',
  bind(['vapor'], 'vapor') === null && why(['vapor'], 'vapor') === 'no-move')

store[K] = JSON.stringify([null, null])
chk('★★★ a save with a null slot → `cleared`, NOT `no-move` — THE BUG, exactly as Alex met it',
  why(['tempest'], 'tempest') === 'cleared',
  `got ${why(['tempest'], 'tempest')}`)

store[K] = JSON.stringify(['meltbore', null])
chk('★★ a save holding a now-illegal bind → `dropped` — something they HAD went away',
  bind(['tempest'], 'tempest') === null && why(['tempest'], 'tempest') === 'dropped')

// ⚠ Both are true here and only one is actionable: telling a vapor keeper to go and pick a move
// invites them to look for something that does not exist.
store[K] = JSON.stringify([null, null])
chk('★★ a null save on a keeper with nothing eligible prefers `no-move` over `cleared`',
  why(['vapor'], 'vapor') === 'no-move')

store[K] = JSON.stringify(['somePassiveId', 'squall', null, null])
chk('★ a legacy 4-slot save still migrates — the reason path did not eat the migration',
  bind(['tempest'], 'tempest') === 'squall' && why(['tempest'], 'tempest') === null)

console.log('\n── 2. a reason is never given for a slot that is FILLED ──')
delete store[K]
{
  const r = resolveLoadout(['tempest'], 'tempest', keeperBook(['tempest']))
  chk('★★ `why` is null wherever `slots` is set, at every index',
    r.slots.every((id, i) => (id === null) === (r.why[i] !== null)))
}

console.log('\n── 3. `loadLoadout` still answers the same thing it always did ──')
// ⚠ It is now a wrapper over `resolveLoadout`. If that delegation ever became a second
// implementation, the binds and the reasons could describe different saves — the mirror shape.
for (const [label, saved] of [['no save', null], ['null slot', [null, null]], ['illegal', ['meltbore', null]], ['legacy', ['p', 'squall', null, null]]] as const) {
  if (saved === null) delete store[K]; else store[K] = JSON.stringify(saved)
  const a = loadLoadout(['tempest'], 'tempest', keeperBook(['tempest']))
  const b = resolveLoadout(['tempest'], 'tempest', keeperBook(['tempest'])).slots
  chk(`★★ loadLoadout == resolveLoadout().slots (${label})`, JSON.stringify(a) === JSON.stringify(b))
}

console.log('\n── 4. the sentence composes, and nothing cuts it back up ──')
for (const r of ['no-move', 'cleared', 'dropped'] as const) {
  chk(`★ the full sentence contains its own clause verbatim (${r})`,
    emptySlotSentence('tactical', r).includes(emptySlotWhy(r)))
}
chk('★ the panel key is only named when a caller supplies it',
  !emptySlotWhy('cleared').includes('(') && emptySlotWhy('cleared', 'I').includes('(I to pick one)'))
chk('★★ `no-move` never offers a key — there is nothing to go and pick',
  emptySlotWhy('no-move', 'I') === emptySlotWhy('no-move'))

console.log('\n── 5. the host actually carries it (a call-site guard) ──')
const HOST = join(process.cwd(), 'src/app/shimmer/voxel3d/VoxelWorld.tsx')
const hostSrc = readFileSync(HOST, 'utf8')
// ⚠⚠ TWO READINGS OF ONE FILE, AND PICKING THE WRONG ONE COST THREE ASSERTS ON THE FIRST RUN.
// `codeOnly` blanks comments AND STRING BODIES, so it answers *"does this file DO x"*; every
// pattern below that names a string literal (`'ui.inventory'`, `'cleared'`, a separator) matched
// ZERO against it and reported BLIND on code that was right there. `noComments` keeps the literals
// and still cannot be fooled by prose. **Structure asks `code`; literals ask `nc`.**
const hostCode = codeOnly(hostSrc)
const nc = noComments(hostSrc)
const once = (label: string, re: RegExp, src: string): boolean => {
  const n = (src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []).length
  if (n === 1) return true
  blind++
  console.log(`  BLIND: ${label} — matched ${n} times, expected exactly 1`)
  return false
}
chk('★★ the host resolves binds and reasons together, in ONE ref',
  once('loadoutRes ref', /const loadoutRes = useRef<ResolvedLoadout>/, hostCode))
chk('★★★ the empty-slot refusal is answered with the DERIVED reason, not the engine sentence',
  once('empty-slot override', /out\.reason === 'empty-slot' \? loadoutRes\.current\.why\[slot\] : null/, noComments(hostSrc)))
// ⚠ The engine's own sentence must still exist as the fallback for every OTHER refusal — this is
// not an instruction to gut it, and a host that stopped saying `out.message` at all would go silent
// on cooldown, mana and unbuilt.
chk('★ ...while every other refusal still says what the engine said',
  /: out\.message\)/.test(hostCode))
chk('★★ the panel key is read from the live bindings, never spelled as a literal',
  once('hintFor call', /hintFor\(bindings\.current, 'ui\.inventory', 'key'\)/, nc))
chk('★ the loadout panel shows a reason under an empty slot',
  once('panel reason', /emptySlotWhy\(initial\.why\[i\] \?\? 'cleared'\)/, nc))
chk('★★ the /rune readout names the empty slots, so the one diagnostic reports cause not symptom',
  /empties\.length \? ` · \$\{empties\.join\(' · '\)\}` : ''/.test(nc))

// ★★ AND NO CONSUMER MAY STRIP THE SENTENCE BACK APART. The panel's first version did exactly that
// (`.replace(\`no ${kind} bound — \`, '')`), and `String.replace` with a pattern that stops matching
// returns the string UNCHANGED and throws nothing — so a reworded sentence would have silently
// printed whole inside a 9px span. Ask for the half you want.
chk('★★★ nothing strips the "bound —" lead back off a sentence',
  !/\.replace\([^)]*bound —/.test(hostCode))

console.log(`\nloadout-why: ${ok} passed, ${bad} failed, ${blind} blind`)
process.exit(bad || blind ? 1 : 0)
