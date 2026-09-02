// ── Every birthable rune seats a starting tactical — and the one that once did not is now guarded by name ──
// Run: npx tsx src/app/shimmer/play3d/birth-tactical.test.ts
//
// Canon (`moves.md` › Doubled focus, amended 2026-08-15): every rune has a one-rune tactical and every
// keeper is BORN holding theirs. The play-lane note of 2026-09-02 counted "3 of 20 birth runes seat no
// tactical" — but the birth carousel offers 17, not 20: Static / Dust / Vapor are `lostState` and are
// kept off it by canon's own ruling. Re-measured, the player-facing count was ONE, and it was Barrier.
//
// ★ THE EXCEPTION THIS FILE SHIPPED WITH HAS EXPIRED, THE WAY IT WAS BUILT TO. Its first version let
// Barrier seat nothing ONLY while the gap naming it was [OPEN] and no one-rune Barrier tactical existed,
// asserting both. Magii ruled the same evening (`Threshold`, name locked by Alex 2026-09-02), the flip to
// [RULED] turned this red, and the row landed. Section C now guards the RESULT instead: the ruled gap is
// there, once, and the build's row carries canon's name verbatim — the canon gate checks that too, but
// this file is where the next reader of "born holding nothing" will look.

import { readFileSync } from 'node:fs'
import { noComments } from '../testing/guard'
import { RUNES, runesOf, ELEMENTS } from './birth/runes.data'
import { KEEPER_MOVES } from './keeper-moves'
import { resolveLoadout } from './loadout'
import { keeperBook } from './book'
import { ALL_BANDS } from './cast'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

// A real store, so `resolveLoadout` is observed with no save — the fresh-keeper path.
const store: Record<string, string> = {}
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
}

const GAPS = '/root/athernyx/CANON/CANON_GAPS.md'
const GAP_TITLE = '## [RULED] Barrier has no doubled-focus tactical'

const birthable = ELEMENTS.flatMap((e) => runesOf(e.id))
const lost = RUNES.filter((r) => r.lostState).map((r) => r.id).sort()
const oneRuneTactical = (rune: string) =>
  KEEPER_MOVES.filter((m) => m.tier === 'tactical' && m.runes.length === 1 && m.runes[0] === rune)

console.log('\n── A. the carousel is canon-shaped ──')
chk('17 birthable runes on the carousel', birthable.length === 17, `got ${birthable.length}`)
chk('★ the three lost-state runes are exactly Scatter, and none is on the carousel',
  lost.join(',') === 'dust,static,vapor' && !birthable.some((r) => r.lostState), lost.join(','))

console.log('\n── B. every birthable rune is born holding a tactical, except the declared one ──')
const tIdx = ALL_BANDS.indexOf('tactical')
chk('the cast bar has a tactical band', tIdx >= 0)
for (const r of birthable) {
  // ⚠ One keeper per iteration. `keeperBook` SEEDS the book into the store on first read, keyed per
  // keeper — and every rune here is the same keeper, so without this reset the first rune's book
  // answers for all sixteen and every one of them reads as "born holding nothing". It did.
  for (const k of Object.keys(store)) delete store[k]
  const seated = resolveLoadout([r.id], r.id, keeperBook([r.id])).slots[tIdx]
  chk(`${r.name}: a one-rune tactical exists`, oneRuneTactical(r.id).length > 0)
  chk(`${r.name}: a fresh keeper is born with it seated`, !!seated)
}

console.log('\n── C. the Barrier ruling is in canon, once, and the build carries its name verbatim ──')
const gaps = readFileSync(GAPS, 'utf8')
const n = gaps.split(GAP_TITLE).length - 1
chk('★★ the Barrier gap is [RULED], once', n === 1, `matched ${n}`)
const row = KEEPER_MOVES.find((m) => m.id === 'threshold')
chk('★ the build registers Barrier\'s doubled focus as a one-rune tactical', !!row && row.tier === 'tactical' && row.runes.join() === 'barrier')
const canonRow = readFileSync('/root/athernyx/CANON/game/moves.md', 'utf8').match(/^\| \*\*(Threshold)\*\* \| Barrier \+ Barrier \(doubled focus\)/m)
chk('★★ ...under the name canon locked, verbatim (`moves.md` row, not this file, is the source)', !!canonRow && row?.name === canonRow[1])
for (const k of Object.keys(store)) delete store[k]   // same fixture rule as section B: one keeper per resolve
chk('★ a Barrier-born keeper is born holding it', resolveLoadout(['barrier'], 'barrier', keeperBook(['barrier'])).slots[tIdx] === 'threshold')

console.log('\n── D. the dev readout says a lost-state birth is canon, not a registry gap ──')
// Literal-bearing asserts read `noComments`, never `codeOnly` (which blanks string bodies).
const host = noComments(readFileSync('src/app/shimmer/voxel3d/VoxelWorld.tsx', 'utf8'))
const once = (re: RegExp) => (host.match(new RegExp(re.source, 'g')) || []).length === 1
chk('★ /rune names a lost-state birth as a LOST STATE, once', once(/is a LOST STATE — never offered at birth/))
chk('★ ...decided from the rune data flag, not a hand-kept id list', once(/birthRune\?\.lostState/) && !/\['static', 'dust', 'vapor'\]/.test(host))

console.log(`\nbirth-tactical: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
