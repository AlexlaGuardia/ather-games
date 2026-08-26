// Loadout oracle — the keeper's CHOICE, and the rules that keep a stored choice honest.
// Run: npx tsx src/app/shimmer/play3d/loadout.test.ts
//
// Every failure mode here is silent in play. A slot that quietly refills, a bind that survives
// losing its rune, a move sitting in two slots on one cooldown — none of them throw, none of them
// look wrong on the HUD, and all of them read to a player as "casting is broken" rather than as a
// loadout that lied. So the asserts are about what a STORED loadout is allowed to become.

import { ALL_BANDS, CAST_SLOTS, derivePassive, defaultLoadout, eligibleMoves } from './cast'
import { KEEPER_MOVES } from './keeper-moves'
import type { Book } from './scroll-market'

/** This file is about STORED CHOICE, so the book is held open — see cast.test.ts for its gate. */
const ALL: Book = { learned: KEEPER_MOVES.map((m) => m.id) }

// ── Test keepers are described by their rune list, BIRTH RUNE FIRST ────────────────────────────
// These wrappers supply the `birth` argument the cast layer gained on 2026-08-26 (the birth-exclusive
// band) from the head of the rune list — the same invariant `rune-inventory.ts` › `normalize()`
// enforces for a real keeper (`owned[0] === birth`).
//
// ⚠ THE WRAPPER IS A TEST CONVENIENCE AND `cast.ts` DELIBERATELY DOES NOT DO THIS. Production takes
// `birth` explicitly, because making an ORDERING contract load-bearing inside functions that treat
// `owned` as a SET would let any filter/concat of runes silently re-decide birth-exclusivity. Here
// the list IS the description of a keeper, so reading the head is honest rather than incidental.
const bornOf = (owned: string[]): string | null => owned[0] ?? null
const eligibleFor = (owned: string[], kind: Parameters<typeof eligibleMoves>[2], book: Book) =>
  eligibleMoves(owned, bornOf(owned), kind, book)
const defaultFor = (owned: string[], book: Book) => defaultLoadout(owned, bornOf(owned), book)
const passiveFor = (owned: string[], book: Book) => derivePassive(owned, bornOf(owned), book)

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
/** OWNED's head, per the inventory invariant — see the `bornOf` note above. */
const BIRTH = bornOf(OWNED)
const reset = () => store.clear()

// ── never chosen vs chosen ────────────────────────────────────────────────────────────────────
{
  reset()
  const fresh = loadLoadout(OWNED, BIRTH, ALL)
  ok(fresh.length === ALL_BANDS.length, 'a loadout always has exactly one entry per band slot')
  ok(JSON.stringify(fresh) === JSON.stringify(defaultFor(OWNED, ALL)),
     'a keeper who never chose gets the starting kit')
}
{
  // ★ THE ONE THAT MATTERS. An emptied slot must survive a reload.
  reset()
  const emptied: Loadout = ALL_BANDS.map(() => null)
  saveLoadout(emptied)
  const back = loadLoadout(OWNED, BIRTH, ALL)
  ok(back.every((s) => s === null),
     '★ a saved empty loadout stays empty — clearing a slot is a choice, not a hole to refill')
  ok(JSON.stringify(back) !== JSON.stringify(defaultFor(OWNED, ALL)),
     '★ and is not silently replaced by the default kit')
}

// ── a save is validated, never trusted ────────────────────────────────────────────────────────
{
  reset()
  // ⚠ A CURRENT-SHAPE (2-entry) save on purpose. A 4-entry save is now LEGACY and would be MIGRATED,
  // so `no-such-move` would drop as the old passive slot before it ever reached `canSlot` — the test
  // would pass while testing migration, not the unknown-move rejection it names. Two entries routes
  // it through the validate path this assert is about.
  store.set(LOADOUT_KEY, JSON.stringify(['no-such-move', null]))
  const back = loadLoadout(OWNED, BIRTH, ALL)
  ok(back[0] === null, '★ a move that no longer exists fails to EMPTY, not to a dead bind')
}
{
  reset()
  // A legal loadout, then the runes that made it legal go away.
  const legal = defaultFor(OWNED, ALL)
  const bound = legal.findIndex((m) => m !== null)
  if (bound >= 0) {
    saveLoadout(legal)
    const back = loadLoadout([], null, ALL)   // keeper now holds no runes at all, so no birth rune either
    ok(back[bound] === null, '★ losing the rune unbinds the move it justified')
    ok(back.length === ALL_BANDS.length, 'and the loadout keeps its shape')
  } else {
    ok(false, 'fixture problem: default loadout bound nothing for OWNED')
    ok(false, 'fixture problem (2)')
  }
}
{
  reset()
  store.set(LOADOUT_KEY, '{not json')
  ok(JSON.stringify(loadLoadout(OWNED, BIRTH, ALL)) === JSON.stringify(defaultFor(OWNED, ALL)),
     'corrupt JSON reads as never-chosen, not as an empty loadout')
}
{
  reset()
  store.set(LOADOUT_KEY, JSON.stringify({ passive: 'barrier' }))   // an older/other shape
  ok(JSON.stringify(loadLoadout(OWNED, BIRTH, ALL)) === JSON.stringify(defaultFor(OWNED, ALL)),
     'a non-array save is refused rather than indexed into')
}
{
  reset()
  store.set(LOADOUT_KEY, JSON.stringify(['barrier']))   // short save, e.g. from fewer slots
  const back = loadLoadout(OWNED, BIRTH, ALL)
  ok(back.length === ALL_BANDS.length, 'a short save is padded to the full slot count')
  ok(back.slice(1).every((s) => s === null), 'and the missing entries read as empty')
}

// ── setSlot ───────────────────────────────────────────────────────────────────────────────────
{
  reset()
  const empty: Loadout = CAST_SLOTS.map(() => null)
  const kit = defaultFor(OWNED, ALL)
  const move = kit.find((m) => m !== null)!
  const slot = kit.indexOf(move)

  ok(setSlot(OWNED, BIRTH, empty, slot, move, ALL)[slot] === move, 'a legal bind lands in its slot')
  ok(setSlot(OWNED, BIRTH, empty, slot, 'no-such-move', ALL)[slot] === null,
     'an illegal bind is refused — the caller cannot produce an invalid loadout')
  ok(setSlot(OWNED, BIRTH, empty, 99, move, ALL).every((s) => s === null), 'an out-of-range slot changes nothing')
  ok(setSlot(OWNED, BIRTH, empty, -1, move, ALL).every((s) => s === null), 'and so does a negative one')

  const held = setSlot(OWNED, BIRTH, empty, slot, move, ALL)
  ok(setSlot(OWNED, BIRTH, held, slot, null, ALL)[slot] === null, 'a slot can be cleared')

}

// ── ★ a move cannot occupy two slots ──────────────────────────────────────────────────────────
// Two buttons sharing one cooldown is never what a keeper meant. This has to be tested on the
// TACTICAL pair, because they are the only two slots of the same kind — an earlier version of this
// block derived the pair from whatever `defaultLoadout` bound first, drew the passive, found no
// second passive slot and passed itself through an `else`. It survived a mutation that deleted the
// rule outright. An assert that cannot fail is worse than no assert: it reports coverage it does
// not have.
//
// ── ⚠ REWRITTEN 2026-08-25: THE CONTEST BECAME UNREACHABLE, AND THAT IS SAID OUT LOUD ──────────
// The block above describes a version of this test that could not fail. What replaced it could —
// until the cast bar collapsed to one tactical + one signature, at which point NO TWO BANDS SHARE A
// KIND, a move has exactly one tier, and `setSlot`'s dedup branch stopped being reachable by any
// legal bind. GBOARD called this correctly in advance.
//
// The wrong move here is to keep the old asserts limping (they would need an illegal bind to set
// up, which tests nothing about a keeper) or to delete them (silently retiring a real rule). So the
// test now asserts THE PREMISE that makes the branch unreachable, and says so. The day a band gains
// a second slot of some kind, this goes red and names it — which is the signal to restore a real
// contest, not to widen the exemption. An exemption that cannot expire is a promise nobody kept.
{
  const dupes = ALL_BANDS.filter((k, i) => ALL_BANDS.indexOf(k) !== i)
  ok(dupes.length === 0,
     `no two band slots share a kind, so a legal move fits exactly one${dupes.length ? ` — DUPLICATED: ${[...new Set(dupes)].join(', ')}, restore the contest test` : ''}`)

  // The rule is still exercised end-to-end at the only strength the current shape allows: a legal
  // bind lands where it was asked for, and lands in exactly one place.
  const tacticals = eligibleFor(OWNED, 'tactical', ALL)
  ok(tacticals.length > 0, 'fixture: this keeper knows at least one tactical')
  const t = ALL_BANDS.indexOf('tactical')
  ok(t >= 0, 'fixture: the bar still has a tactical slot to bind into')

  const move = tacticals[0].id
  const empty: Loadout = ALL_BANDS.map(() => null)
  const held = setSlot(OWNED, BIRTH, empty, t, move, ALL)
  ok(held[t] === move, 'the tactical binds to the tactical slot')
  ok(held.filter((s) => s === move).length === 1, '★ exactly one slot holds it')

  // ★ AND THE PASSIVE HAS A HOME OFF THE BAR — DERIVED, NOT BOUND (RULED 2026-08-26, Alex).
  // The 08-25 stance socket was reverted the next day: the passive is not a bindable band any more,
  // it is the ONE always-on passive `derivePassive` surfaces from the keeper's runes. So the band
  // list must NOT contain 'passive' — a passive band would put it back into the stored loadout array,
  // which is exactly what the ruling removed — and the keeper must still HAVE a passive, just not a slot.
  ok(ALL_BANDS.indexOf('passive') === -1, '★ there is no passive band — the passive left the loadout array')
  const passive = passiveFor(OWNED, ALL)
  ok(passive !== null, '★ ...but the keeper still has a passive, derived from their runes')
  ok(passive === null || eligibleFor(OWNED, 'passive', ALL).some((x) => x.id === passive.id),
     '★ and the derived passive is one their runes actually make eligible')
}

// ── the absent-localStorage path (the shape this runs in outside a browser) ───────────────────
{
  const real = (globalThis as unknown as { localStorage: unknown }).localStorage
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage
  let threw = false
  let kit: Loadout = []
  try { kit = loadLoadout(OWNED, BIRTH, ALL) } catch { threw = true }
  ok(!threw, '★ no localStorage must not throw — private mode is a keeper, not a crash')
  ok(JSON.stringify(kit) === JSON.stringify(defaultFor(OWNED, ALL)), 'and they still get a kit')
  let saveThrew = false
  try { saveLoadout(kit) } catch { saveThrew = true }
  ok(!saveThrew, 'saving without a store is a no-op, not a throw')
  ;(globalThis as unknown as { localStorage: unknown }).localStorage = real
}

console.log(`\nloadout: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log(`  ✗ ${f}`)
process.exit(fails.length ? 1 : 0)
