/**
 * /reborn — a keeper born again of another rune, and the PREMISE that makes the door necessary.
 *
 * ★ THE PREMISE IS ASSERTED, NOT DESCRIBED. `reborn.ts` exists because a developed rune does not
 * grant its doubled-focus tactical: tempest-born + Barrier developed seats Squall, never Threshold.
 * Section A pins that. The day the build starts granting focus on a developed rune, A goes red
 * naming this file, and the reason for `/reborn` expires OUT LOUD instead of in a header comment
 * (PATTERNS 09-01: a note rots into something plausible; a premise can be checked).
 *
 * ★ EVERY CLEAR IS OBSERVED THROUGH THE CONSUMER, NOT THE KEY. Section C asks `resolveLoadout`
 * and `keeperBook` what the reborn keeper can cast — a rebirth that forgot the loadout resolves
 * the old bind as `dropped`; one that forgot the book keeps Squall as "learned". Both mutations
 * fire on a named assert (see the sweep note at the bottom).
 *
 * Run: `npx tsx src/app/shimmer/play3d/reborn.test.ts`
 */
import { readFileSync } from 'node:fs'
import { rebirth } from './reborn'
import { loadRuneInventory, saveRuneInventory, setBirthRune, grantRune, EMPTY_INVENTORY, BIRTH_KEY, RUNES_KEY } from './rune-inventory'
import { resolveLoadout, saveLoadout, LOADOUT_KEY } from './loadout'
import { keeperBook, saveBook, BOOK_KEY } from './book'
import { ALL_BANDS } from './cast'
import { RUNES } from './birth/runes.data'
import { noComments } from '../testing/guard'
import { starterFor } from './scroll-market'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

const store: Record<string, string> = {}
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
}
const wipe = () => { for (const k of Object.keys(store)) delete store[k] }
const TAC = ALL_BANDS.indexOf('tactical')
ok(TAC >= 0, 'the band list has a tactical slot — otherwise nothing below measures anything')

// ── A. ★ THE PREMISE: a developed rune does not grant its doubled focus ──────────────────────
{
  wipe()
  const inv = grantRune(setBirthRune(EMPTY_INVENTORY, 'tempest'), 'barrier')
  saveRuneInventory(inv)
  const res = resolveLoadout(inv.owned, inv.birth, keeperBook(inv.owned))
  ok(res.slots[TAC] === 'squall', `tempest-born + Barrier developed seats Squall (got ${res.slots[TAC]})`)
  ok(!res.slots.includes('threshold'), '★ PREMISE: a DEVELOPED Barrier does not seat Threshold — this is why /reborn exists; if this goes red, the door may be unnecessary and reborn.ts\'s header is stale')
}

// ── B. a rebirth rewrites the three saves ────────────────────────────────────────────────────
{
  wipe()
  const old = grantRune(setBirthRune(EMPTY_INVENTORY, 'tempest'), 'barrier')
  saveRuneInventory(old)
  saveLoadout(['squall', null])
  saveBook({ learned: ['squall'] })
  ok(store[LOADOUT_KEY] !== undefined && store[BOOK_KEY] !== undefined, 'fixture: a loadout and a book are saved before the rebirth')

  const inv = rebirth('barrier')
  ok(inv.birth === 'barrier' && JSON.stringify(inv.owned) === JSON.stringify(['barrier']), `the returned hand is exactly [barrier] (${JSON.stringify(inv)})`)
  ok(store[BIRTH_KEY] === 'barrier', 'the birth key now reads barrier')
  ok(store[RUNES_KEY] === JSON.stringify(['barrier']), `developed runes are NOT carried over (${store[RUNES_KEY]})`)
  ok(store[LOADOUT_KEY] === undefined, 'the saved loadout is REMOVED, not blanked')
  ok(store[BOOK_KEY] === undefined, 'the saved book is REMOVED')
  const re = loadRuneInventory()
  ok(re.birth === 'barrier' && re.owned.length === 1, 'a fresh read agrees with the returned hand')

  // ── C. and the kit re-derives for the NEW keeper, through the real consumers ──────────────
  const book = keeperBook(inv.owned)
  ok(book.learned.includes('threshold'), `the re-seeded book knows Threshold (${book.learned.join(', ')})`)
  ok(!book.learned.includes('squall'), '★ the old keeper\'s Squall is gone from the book — a book that survives a rebirth is the mutation this catches')
  const res = resolveLoadout(inv.owned, inv.birth, book)
  ok(res.slots[TAC] === 'threshold', `★ the tactical slot seats Threshold (got ${res.slots[TAC]}, why=${res.why[TAC]}) — a loadout that survives resolves as 'dropped'`)
  ok(res.why[TAC] === null, `and it is a seated bind, not an excuse (why=${res.why[TAC]})`)
}

// ── D. a lost-state rebirth is allowed and lands empty by canon, not by bug ─────────────────
{
  wipe()
  const lost = RUNES.find(r => r.lostState)
  ok(!!lost, 'canon keeps at least one lost state')
  if (lost) {
    const inv = rebirth(lost.id)
    const res = resolveLoadout(inv.owned, inv.birth, keeperBook(inv.owned))
    ok(inv.birth === lost.id, `a keeper can be reborn of ${lost.name} through the dev door`)
    // ⚠ NOT "empty": Gregory's gift (`starterFor`) seeds any keeper a tactical from the trade pool
    // when their runes can read one — my first version asserted `no-move` here and the world said
    // otherwise. So the claim is: the seat is exactly the gift, or no-move when there is no gift.
    const gift = starterFor(inv.owned)
    ok(res.slots[TAC] === null ? res.why[TAC] === 'no-move' : res.slots[TAC] === gift,
      `and its tactical is Gregory's gift or honestly empty (seat=${res.slots[TAC]} gift=${gift} why=${res.why[TAC]})`)
  }
}

// ── E. the host wires it: vitals + mana re-derive on the same tick the world re-resolves ────
// Index-sliced, not a spanning regex (guard.ts says why). `noComments`, not `codeOnly`: the row is
// found by its NAME STRING, and codeOnly empties strings — two asserts went red on that on first run. `rebirth(` must appear exactly once in
// the host — the op is the ONLY door, and a second caller would be a second acquisition path.
{
  const src = noComments(readFileSync(new URL('../voxel3d/VoxelWorld.tsx', import.meta.url), 'utf8'))
  const hits = src.split('rebirth(').length - 1
  ok(hits === 1, `VoxelWorld calls rebirth( exactly once (${hits})`)
  const at = src.indexOf('reborn: (arg) =>')
  ok(at >= 0, 'VoxelWorld has the reborn op')
  const end = src.indexOf('\n    },\n', at)
  const op = at >= 0 && end > at ? src.slice(at, end) : ''
  ok(op.length > 0 && op.length < 2000, `the op is sliced (${op.length} chars)`)
  for (const needle of ['rebirth(', 'freshVitals(', 'vitals.current =', 'mana.current.max =', 'mana.current.cur =', 'setRuneTick(', 'handReport('])
    ok(op.includes(needle), `the reborn op does \`${needle}\``)
  ok(op.indexOf('rebirth(') < op.indexOf('setRuneTick('), 'the saves are written BEFORE the tick that re-reads them')
  ok(/isOwner\) return/.test(op), 'the op refuses a non-owner even if a row ever forgets to')
  const con = noComments(readFileSync(new URL('../voxel3d/console.ts', import.meta.url), 'utf8'))
  const row = con.slice(con.indexOf("name: 'reborn'"), con.indexOf("name: 'reborn'") + 400)
  ok(/owner: true/.test(row), 'the console row is a whole-command owner gate')
  ok(/c\.reborn\(a\[0\]\)/.test(row), 'and hands the rune to the ctx')
}

console.log(`reborn: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
