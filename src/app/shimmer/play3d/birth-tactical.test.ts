// ── Every birthable rune seats a starting tactical — and the one that does not is DECLARED ──────
// Run: npx tsx src/app/shimmer/play3d/birth-tactical.test.ts
//
// Canon (`moves.md` › Doubled focus, amended 2026-08-15): every rune has a one-rune tactical and every
// keeper is BORN holding theirs. The play-lane note of 2026-09-02 counted "3 of 20 birth runes seat no
// tactical" — but the birth carousel offers 17, not 20: Static / Dust / Vapor are `lostState` and are
// kept off it by canon's own ruling. Re-measured, the player-facing count is ONE, and it is Barrier.
//
// ⚠ THIS FILE IS NOT AN EXEMPTION LIST; IT IS AN EXEMPTION WITH AN EXPIRY. Barrier is allowed to seat
// nothing ONLY while the gap that names it is still [OPEN] in CANON_GAPS.md AND no one-rune Barrier
// tactical has landed in the registry. Either event turns this red, naming Barrier, so the day Magii
// registers the move (or rules there is none) somebody has to come back here and either build it or
// rewrite the premise. A hand-kept "known gaps" list is the thing still sitting there a month after the
// gap closed (PATTERNS 08-22: "write the exemption so it EXPIRES").

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
const GAP_TITLE = '## [OPEN] Barrier has no doubled-focus tactical'
const EXCEPTION = new Set(['barrier'])

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
  const has = oneRuneTactical(r.id).length > 0
  if (EXCEPTION.has(r.id)) {
    chk(`★ ${r.name}: the exception still holds — NO one-rune tactical registered (else build it and delete the exception)`,
      !has && !seated, has ? `registry now has: ${oneRuneTactical(r.id).map((m) => m.id).join(',')}` : `seated ${seated}`)
  } else {
    chk(`${r.name}: a one-rune tactical exists`, has)
    chk(`${r.name}: a fresh keeper is born with it seated`, !!seated)
  }
}

console.log('\n── C. the exception\'s premise is still true in canon ──')
const gaps = readFileSync(GAPS, 'utf8')
const n = gaps.split(GAP_TITLE).length - 1
chk('★★ the Barrier gap is filed, ONCE, and still [OPEN] — when it flips to [RULED] this goes red on purpose',
  n === 1, n === 0 ? 'no [OPEN] entry with that title: ruled? then build the move and retire the exception' : `matched ${n}`)
chk('★ and the exception set is exactly the runes the gap names (no silent widening)',
  [...EXCEPTION].join(',') === 'barrier')

console.log('\n── D. the dev readout says a lost-state birth is canon, not a registry gap ──')
// Literal-bearing asserts read `noComments`, never `codeOnly` (which blanks string bodies).
const host = noComments(readFileSync('src/app/shimmer/voxel3d/VoxelWorld.tsx', 'utf8'))
const once = (re: RegExp) => (host.match(new RegExp(re.source, 'g')) || []).length === 1
chk('★ /rune names a lost-state birth as a LOST STATE, once', once(/is a LOST STATE — never offered at birth/))
chk('★ ...decided from the rune data flag, not a hand-kept id list', once(/birthRune\?\.lostState/) && !/\['static', 'dust', 'vapor'\]/.test(host))

console.log(`\nbirth-tactical: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
