// ── Keeper move registry + book index — headless oracle ────────────────────────
// Run: npx tsx src/app/shimmer/play3d/keeper-moves.test.ts
//
// Locks the contracts the book model rests on:
//   1. registry integrity — unique ids/names, every rune requirement is a real rune
//   2. the index is DERIVED — a move shows up under every rune it names, and only those
//   3. multi-rune moves are AND — Cordon needs Stone AND Metalergy, never either alone
//   4. the lane model matches the canon mages (Eyuun/Samantha/Kael) and its two known breaks
//      (Veyra/Lazerin) stay off-lane — so a silent change to the matrix trips here
//   5. no birth rune opens an EMPTY book once lanes are applied (the reason for the model)
//   6. the coverage gap is pinned — the move-less runes are asserted, so filling one is a
//      deliberate edit here and not a silent drift (was 8 runes; the Great Registration left 1)

import { castForMove } from './cast'
import { RUNES } from './birth/runes.data'
import {
  KEEPER_MOVES, MOVES_BY_RUNE, RUNES_WITHOUT_MOVES,
  lanesFor, reachableRunes, knownMoves, learnableMoves,
} from './keeper-moves'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

const runeIds = new Set(RUNES.map((r) => r.id))

// 1. registry integrity
{
  const ids = KEEPER_MOVES.map((m) => m.id)
  const names = KEEPER_MOVES.map((m) => m.name)
  chk('ids unique', new Set(ids).size === ids.length)
  chk('names unique', new Set(names).size === names.length)
  for (const m of KEEPER_MOVES) {
    chk(`${m.name}: runes are real`, m.runes.every((r) => runeIds.has(r)), m.runes.join('+'))
    chk(`${m.name}: has an effect line`, m.effect.length > 20)
  }
  // Herbal Knowledge is the one canon move with NO rune (a craft, not magic)
  const runeless = KEEPER_MOVES.filter((m) => m.runes.length === 0)
  chk('exactly one rune-less move (Herbal Knowledge)',
    runeless.length === 1 && runeless[0].name === 'Herbal Knowledge', runeless.map((m) => m.name).join())
}

// 2. the index is derived, not hand-kept
{
  for (const m of KEEPER_MOVES) {
    for (const r of m.runes) {
      chk(`${m.name} indexed under ${r}`, MOVES_BY_RUNE[r].some((x) => x.id === m.id))
    }
    const listedUnder = RUNES.filter((r) => MOVES_BY_RUNE[r.id].some((x) => x.id === m.id)).map((r) => r.id)
    chk(`${m.name} appears under exactly its runes`,
      listedUnder.length === m.runes.length, `${listedUnder.join()} vs ${m.runes.join()}`)
  }
  chk('every rune has a book page (possibly empty)', Object.keys(MOVES_BY_RUNE).length === RUNES.length)
}

// 3. multi-rune moves are AND, not OR — the runeword compatibility rule
{
  chk('Cordon: not known from Stone alone', !knownMoves(['stone']).some((m) => m.id === 'cordon'))
  chk('Cordon: not known from Metalergy alone', !knownMoves(['metalergy']).some((m) => m.id === 'cordon'))
  chk('Cordon: known with both', knownMoves(['stone', 'metalergy']).some((m) => m.id === 'cordon'))
  chk('Bind Mastery needs all three Bind runes',
    !knownMoves(['enchant', 'metalergy']).some((m) => m.id === 'bind-mastery') &&
    knownMoves(['enchant', 'metalergy', 'illuminate']).some((m) => m.id === 'bind-mastery'))
}

// 4. the lane model vs the canon mages (CANON/game/runes.md character tables)
{
  const onLane = (birth: string, developed: string) => lanesFor(birth).reach.includes(developed)

  // holds — 5 of 7 developed runes
  chk('Kael: Static → Lightning (Storm element lane)', onLane('static', 'lightning'))
  chk('Samantha: Fluid → Life (Flow state lane)', onLane('fluid', 'life'))
  chk('Samantha: Fluid → Freeze (Water element lane)', onLane('fluid', 'freeze'))
  chk('Eyuun: Enchant → Metalergy (Bind state lane)', onLane('enchant', 'metalergy'))
  chk('Eyuun: Enchant → Illuminate (Bind state lane)', onLane('enchant', 'illuminate'))
  chk('Lazerin: Life → Barrier (Mana element lane)', onLane('life', 'barrier'))

  // the two KNOWN breaks — pinned so the matrix can't drift under us unnoticed
  chk('Veyra: Star → Breeze is OFF-lane (known canon exception)', !onLane('star', 'breeze'))
  chk('Lazerin: Life → Illuminate is OFF-lane (known canon exception)', !onLane('life', 'illuminate'))

  // Eyuun's trick: the whole Bind column is one lane
  chk("Eyuun's three Bind runes share a state lane",
    ['enchant', 'metalergy', 'illuminate'].every((r) => lanesFor('enchant').state.includes(r)))

  // shape: element row is 5, state column 2-3 — breadth vs signature scarcity
  for (const r of RUNES) {
    const l = lanesFor(r.id)
    chk(`${r.name}: element row is 5`, l.element.length === 5, String(l.element.length))
    chk(`${r.name}: state column is 2-3`, l.state.length >= 2 && l.state.length <= 3, String(l.state.length))
  }
}

// 5. no birth rune opens an empty book once lanes apply
{
  const thin: string[] = []
  for (const r of RUNES) {
    const reach = knownMoves([r.id]).length + learnableMoves([r.id]).length
    if (reach === 0) thin.push(r.name)
  }
  chk('no birth rune reaches zero moves via its lanes', thin.length === 0, thin.join())

  // ── ★ UPDATED 2026-08-17: THE DIRECT PAGE IS NO LONGER EMPTY FOR ANYONE ──────────────────────
  // These two asserts used to read *"Manalic has no moves of its own"* + *"but still reaches some via
  // lanes"* — a pin on a TRANSITIONAL state, making the point that the lane model carried the one
  // rune the registry had missed. Canon's doubled-focus pass (08-15) registered seven single-rune
  // tacticals so that *"every keeper-reachable rune owns at least one move written in that rune
  // alone"*, and Quickform is Manalic's. The pin is replaced by the stronger claim rather than
  // deleted: what mattered was never Manalic, it was that **no keeper opens their book on nothing.**
  const emptyPage = RUNES.filter((r) => MOVES_BY_RUNE[r.id]?.length ? false : true).map((r) => r.name)
  chk('★ every rune owns at least one move written in that rune alone', emptyPage.length === 0, emptyPage.join())
}

// 6. the coverage gap — CLOSED 2026-08-17, and the pin becomes a floor
//
// The history, because it is the whole shape of this file: 8 move-less runes (CANON_GAPS.md,
// 2026-08-03) → 1 after THE GREAT REGISTRATION (08-13/14: 37 School techniques carrying full effect
// text in `runes.md` Part III, exactly 2 of them registered in `moves.md`) → **0** after canon's
// doubled-focus pass (08-15) registered seven single-rune tacticals and this build adopted them.
//
// ⚠ SO THE ASSERT INVERTS RATHER THAN RETIRING. It used to name the survivors; naming an empty list
// is a test that passes by describing today. It now says the RULE — nobody is move-less — which is a
// claim about every rune anyone adds later, and the direction the failure comes from is the useful
// one: a new rune with no move fails here instead of shipping as a blank page.
{
  chk('★★ no rune is move-less any more — the empty-page problem is closed',
    RUNES_WITHOUT_MOVES.length === 0, RUNES_WITHOUT_MOVES.join())

  // ⚠ THE POINT THIS PIN MAKES, AND IT IS NOT THE SAME AS THE ONE ABOVE: a rune having a book page is
  // not a rune having an ULTIMATE. Freeze and Fluid both reached none before this pass; Freeze now
  // reaches Pillar Tomb (Stone shares its Solid state) and Fluid reaches Healing Stream (Life shares
  // its Flow state), so the pin shrinks to Vapor alone — whose only ultimate, Monsoon Veil, also
  // needs Life, which is on neither of its lanes.
  const noUlt = ['freeze', 'fluid', 'vapor'].filter(
    (r) => ![...knownMoves([r]), ...learnableMoves([r])].some((m) => m.tier === 'ultimate'))
  chk('Vapor alone still reaches no ultimate (pinned gap, was Freeze/Fluid/Vapor)',
    JSON.stringify(noUlt) === JSON.stringify(['vapor']), noUlt.join())
}

// 7. a second rune opens a cross-hatch, not a list
{
  const one = reachableRunes(['star']).length
  const two = reachableRunes(['star', 'stone']).length
  chk('a 2nd rune widens reach', two > one, `${one} → ${two}`)
  chk('Veyra (Star+Breeze) unlocks Flame Barrage', knownMoves(['star', 'breeze']).some((m) => m.id === 'flame-barrage'))
}

// ── ★★ EVERY CASTABLE MOVE DECLARES HOW IT ANSWERS A COLLAR (ruled 2026-08-16, /magii) ──────────
// The anti-rot half of the ruling: the PRINCIPLE is canon, the CLASSIFICATION travels with the move
// and is decided when the move is written. A list kept anywhere else goes stale the first time
// anyone authors a move, and then someone has to go back to Magii for a fresh one.
//
// ★ THIS ASSERT IS THE THING THAT MAKES "FAIL CLOSED" REAL RATHER THAN POLITE. `answerCollar`
// already refuses an unclassified move at runtime, so nothing unsafe ships either way — but a
// silent refusal would show up as a rune that mysteriously cannot free anyone, which is exactly the
// bug the ruling was called in to fix. This turns that into a red test at authoring time instead.
{
  const castable = KEEPER_MOVES.filter((m) => {
    const a = castForMove(m.id).archetype
    return a !== 'unbuilt' && a !== 'stance'
  })
  const unclassified = castable.filter((m) => !m.collar)
  chk('★★ every castable move declares a collar class',
    unclassified.length === 0,
    unclassified.length
      ? `unclassified: ${unclassified.map((m) => m.id).join(', ')} — decide it where the move is written, ` +
        'test 1 is Rule-3 cruelty (is the BODY the described mechanism?), test 2 is thematic control ' +
        '(IS the move force-control?), then no-contest for heals/launches, else opens'
      : `${castable.length} castable moves, all classified`)

  // ⚠ A class that nothing carries is a class nobody is applying. Both refusal classes must have at
  // least one real member, or a later "tidy-up" quietly deletes a distinction canon drew on purpose.
  chk('both refusal classes are actually in use',
    castable.some((m) => m.collar === 'cruelty') && castable.some((m) => m.collar === 'control'),
    'canon drew two classes because class 2 catches gentle moves class 1 clears')
}

console.log(`\nkeeper-moves oracle: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
