// Loadout oracle — the keeper's CHOICE, and the rules that keep a stored choice honest.
// Run: npx tsx src/app/shimmer/play3d/loadout.test.ts
//
// Every failure mode here is silent in play. A slot that quietly refills, a bind that survives
// losing its rune, a move sitting in two slots on one cooldown — none of them throw, none of them
// look wrong on the HUD, and all of them read to a player as "casting is broken" rather than as a
// loadout that lied. So the asserts are about what a STORED loadout is allowed to become.

import { CAST_SLOTS, defaultLoadout, eligibleMoves } from './cast'
import { KEEPER_MOVES } from './keeper-moves'
import type { Book } from './scroll-market'

/** This file is about STORED CHOICE, so the book is held open — see cast.test.ts for its gate. */
const ALL: Book = { learned: KEEPER_MOVES.map((m) => m.id) }
import { LOADOUT_KEY, loadLoadout, saveLoadout, setSlot, type Loadout } from './loadout'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── a localStorage that exists only here ──────────────────────────────────────────────────────
// tsx runs this in node, where `localStorage` is absent. The module is written to survive that
// (a throw reads as "no save"), and the absent case is asserted below — but most of this file
// needs a working store, so we install one.
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
}

/**
 * A keeper holding Barrier + Star + Life.
 *
 * ⚠ These ids are REAL — checked against `RUNES` in `birth/runes.data.ts`. The first version of this
 * fixture said `['barrier', 'storm']` and there is no rune called `storm`: it was an element name.
 * Every assert still passed, because an unknown rune simply contributes no moves, so the file was
 * quietly testing a one-rune keeper with no tactical at all. A fixture that names something
 * non-existent does not fail — it shrinks the test until the interesting cases stop happening.
 *
 * This trio is chosen so every slot kind has real competition: passives from barrier + star,
 * four tacticals across star/life/barrier, and two ultimates. The tactical count is what makes the
 * two-slots-of-one-kind case below testable at all.
 */
const OWNED = ['barrier', 'star', 'life']
const reset = () => store.clear()

// ── never chosen vs chosen ────────────────────────────────────────────────────────────────────
{
  reset()
  const fresh = loadLoadout(OWNED, ALL)
  ok(fresh.length === CAST_SLOTS.length, 'a loadout always has exactly one entry per slot')
  ok(JSON.stringify(fresh) === JSON.stringify(defaultLoadout(OWNED, ALL)),
     'a keeper who never chose gets the starting kit')
}
{
  // ★ THE ONE THAT MATTERS. An emptied slot must survive a reload.
  reset()
  const emptied: Loadout = CAST_SLOTS.map(() => null)
  saveLoadout(emptied)
  const back = loadLoadout(OWNED, ALL)
  ok(back.every((s) => s === null),
     '★ a saved empty loadout stays empty — clearing a slot is a choice, not a hole to refill')
  ok(JSON.stringify(back) !== JSON.stringify(defaultLoadout(OWNED, ALL)),
     '★ and is not silently replaced by the default kit')
}

// ── a save is validated, never trusted ────────────────────────────────────────────────────────
{
  reset()
  store.set(LOADOUT_KEY, JSON.stringify(['no-such-move', null, null, null]))
  const back = loadLoadout(OWNED, ALL)
  ok(back[0] === null, '★ a move that no longer exists fails to EMPTY, not to a dead bind')
}
{
  reset()
  // A legal loadout, then the runes that made it legal go away.
  const legal = defaultLoadout(OWNED, ALL)
  const bound = legal.findIndex((m) => m !== null)
  if (bound >= 0) {
    saveLoadout(legal)
    const back = loadLoadout([], ALL)   // keeper now holds no runes at all
    ok(back[bound] === null, '★ losing the rune unbinds the move it justified')
    ok(back.length === CAST_SLOTS.length, 'and the loadout keeps its shape')
  } else {
    ok(false, 'fixture problem: default loadout bound nothing for OWNED')
    ok(false, 'fixture problem (2)')
  }
}
{
  reset()
  store.set(LOADOUT_KEY, '{not json')
  ok(JSON.stringify(loadLoadout(OWNED, ALL)) === JSON.stringify(defaultLoadout(OWNED, ALL)),
     'corrupt JSON reads as never-chosen, not as an empty loadout')
}
{
  reset()
  store.set(LOADOUT_KEY, JSON.stringify({ passive: 'barrier' }))   // an older/other shape
  ok(JSON.stringify(loadLoadout(OWNED, ALL)) === JSON.stringify(defaultLoadout(OWNED, ALL)),
     'a non-array save is refused rather than indexed into')
}
{
  reset()
  store.set(LOADOUT_KEY, JSON.stringify(['barrier']))   // short save, e.g. from fewer slots
  const back = loadLoadout(OWNED, ALL)
  ok(back.length === CAST_SLOTS.length, 'a short save is padded to the full slot count')
  ok(back.slice(1).every((s) => s === null), 'and the missing entries read as empty')
}

// ── setSlot ───────────────────────────────────────────────────────────────────────────────────
{
  reset()
  const empty: Loadout = CAST_SLOTS.map(() => null)
  const kit = defaultLoadout(OWNED, ALL)
  const move = kit.find((m) => m !== null)!
  const slot = kit.indexOf(move)

  ok(setSlot(OWNED, empty, slot, move, ALL)[slot] === move, 'a legal bind lands in its slot')
  ok(setSlot(OWNED, empty, slot, 'no-such-move', ALL)[slot] === null,
     'an illegal bind is refused — the caller cannot produce an invalid loadout')
  ok(setSlot(OWNED, empty, 99, move, ALL).every((s) => s === null), 'an out-of-range slot changes nothing')
  ok(setSlot(OWNED, empty, -1, move, ALL).every((s) => s === null), 'and so does a negative one')

  const held = setSlot(OWNED, empty, slot, move, ALL)
  ok(setSlot(OWNED, held, slot, null, ALL)[slot] === null, 'a slot can be cleared')

}

// ── ★ a move cannot occupy two slots ──────────────────────────────────────────────────────────
// Two buttons sharing one cooldown is never what a keeper meant. This has to be tested on the
// TACTICAL pair, because they are the only two slots of the same kind — an earlier version of this
// block derived the pair from whatever `defaultLoadout` bound first, drew the passive, found no
// second passive slot and passed itself through an `else`. It survived a mutation that deleted the
// rule outright. An assert that cannot fail is worse than no assert: it reports coverage it does
// not have.
{
  const a = CAST_SLOTS.indexOf('tactical')
  const b = CAST_SLOTS.indexOf('tactical', a + 1)
  ok(a >= 0 && b > a, 'fixture: there are two tactical slots to contest')

  const tacticals = eligibleMoves(OWNED, 'tactical', ALL)
  ok(tacticals.length > 0, 'fixture: this keeper knows at least one tactical')

  const move = tacticals[0].id
  const empty: Loadout = CAST_SLOTS.map(() => null)
  const held = setSlot(OWNED, empty, a, move, ALL)
  ok(held[a] === move, 'the tactical binds to the first tactical slot')

  const moved = setSlot(OWNED, held, b, move, ALL)
  ok(moved[b] === move, '★ re-binding it to the other tactical slot puts it there')
  ok(moved[a] === null, '★ and VACATES the first — it moves, it does not duplicate')
  ok(moved.filter((s) => s === move).length === 1, '★ exactly one slot holds it')
}

// ── the absent-localStorage path (the shape this runs in outside a browser) ───────────────────
{
  const real = (globalThis as unknown as { localStorage: unknown }).localStorage
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage
  let threw = false
  let kit: Loadout = []
  try { kit = loadLoadout(OWNED, ALL) } catch { threw = true }
  ok(!threw, '★ no localStorage must not throw — private mode is a keeper, not a crash')
  ok(JSON.stringify(kit) === JSON.stringify(defaultLoadout(OWNED, ALL)), 'and they still get a kit')
  let saveThrew = false
  try { saveLoadout(kit) } catch { saveThrew = true }
  ok(!saveThrew, 'saving without a store is a no-op, not a throw')
  ;(globalThis as unknown as { localStorage: unknown }).localStorage = real
}

console.log(`\nloadout: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
