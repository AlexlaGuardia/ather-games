// crucible-prize.ts — WHO GETS THE VESSEL, and the rule is the last third of canon's ladder.
//
// ★ PURE. No react/three/DOM. A rule, so it lives where a test can reach it — the day's own lesson:
// host-only edge logic is invisible to every suite and reads as covered because the module beside
// it is green (`crucible-phases.ts` is 42/0 and was imported by NOTHING until today).
//
// ── ★★ CANON (design-briefs/shimmer-casting-vessels.md › THE THREE ROADS, RULED 2026-09-05) ────
// *"WON = the Crucible, and its band is THE PAPER FOR AN ULTIMATE."* The Crucible is Pyramid Zero
// (`game/pyramid-zero.md`): three floors, then **The Vault, which is not a combat floor**. The
// Three Puppet Guards hold **The Throne** — L3, and `crucible-phases.ts` already carries that as
// data (`{ id: 'throne', guards: true }`), which is how a rule written weeks apart still lines up.
//
// ── ★★★ THE PRIZE IS PAID IN THE VAULT, NOT ON THE LAST GUARD'S DEATH ─────────────────────────
// Until today `Shimmer3D` paid the moment `enc.cleared` flipped, wherever that happened. Two things
// were wrong with it and only one was obvious:
//   1. **It was a DEV DOOR.** The T range-console can summon the Three anywhere, so the game's top
//      reward sat one keypress away in a practice zone. Magii, 09-05: the Puppet Guards hook is the
//      RIGHT one — it was wired to the wrong door.
//   2. **It made the Vault mean nothing.** Canon gives Pyramid Zero a prize ROOM; paying at the kill
//      turns the last floor into the end of the match and leaves the Vault as scenery.
// So: clearing the Throne **inside a match** arms the prize, and **the Vault pays it**.
//
// ⚠ THE VAULT OPENS ON THE CLOCK, THE PRIZE DOES NOT. `crucible-phases` reaches `'vault'` from
// elapsed seconds alone — its header's timed-ascent reading — so a keeper who hid for fifteen
// minutes reaches the Vault too. They do not get paid. **Reaching the room is the clock's business;
// deserving it is this file's**, and keeping those apart is why the prize is not `phase === 'vault'`.
//
// ⚠ AND IT PAYS EXACTLY ONCE PER MATCH. `vessel-drops.ts` already holds the per-keeper LEDGER that
// makes a first clear sure and later ones a roll; this guards the narrower thing that ledger cannot
// see — a single Vault window ticking at 60fps, which without an edge latch pays every frame.

import type { MatchPhase } from './crucible-phases'

export interface PrizeState {
  /** the Three fell on the Throne, in a real match — the prize is armed */
  throneCleared: boolean
  /** the Vault has already paid this match */
  paid: boolean
}

export const EMPTY_PRIZE: PrizeState = { throneCleared: false, paid: false }

export interface PrizeStep {
  next: PrizeState
  /** true on exactly ONE frame: the Vault is open and the Throne was earned */
  pay: boolean
}

/**
 * One frame of the prize rule.
 *
 * @param prev          last frame's state
 * @param matchPhase    from `crucibleAt(elapsed).matchPhase` — never re-derived here
 * @param guardsCleared the encounter's own `cleared` flag
 * @param viaMatch      were the Three summoned by the Throne window, or by the range console?
 *
 * ★ `viaMatch` IS THE WHOLE "STOP BEING A DEV DOOR" CHANGE, and it is a PARAMETER rather than a
 * check on a zone id because the host owns where it is standing and this file owns what that earns.
 */
export function stepPrize(
  prev: PrizeState, matchPhase: MatchPhase, guardsCleared: boolean, viaMatch: boolean,
): PrizeStep {
  const throneCleared = prev.throneCleared || (guardsCleared && viaMatch)
  const pay = matchPhase === 'vault' && throneCleared && !prev.paid
  return { next: { throneCleared, paid: prev.paid || pay }, pay }
}

/**
 * A new match wipes the arming. ⚠ NOT the same as `vessel-drops`' `clearTrials`, which is the
 * per-keeper LEDGER and survives a match on purpose — re-entering the Crucible must not make the
 * first clear sure again. This clears only "what has happened since the glyph".
 */
export function resetPrize(): PrizeState { return { ...EMPTY_PRIZE } }
