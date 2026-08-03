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
//   6. the coverage gap is pinned — the 8 move-less runes are asserted, so filling one is a
//      deliberate edit here and not a silent drift

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

  // and the direct book IS empty for the gap runes — the model is doing the work, not luck
  chk('Magma has no moves of its own', MOVES_BY_RUNE['magma'].length === 0)
  chk('Magma still reaches moves via lanes', learnableMoves(['magma']).length > 0)
}

// 6. the coverage gap, pinned (CANON_GAPS.md 2026-08-03)
{
  const expected = ['manalic', 'tempest', 'gem', 'magma', 'dust', 'hydro', 'mist', 'vapor'].sort()
  chk('the 8 move-less runes are exactly the ones filed as a canon gap',
    JSON.stringify([...RUNES_WITHOUT_MOVES].sort()) === JSON.stringify(expected),
    RUNES_WITHOUT_MOVES.join())

  // Freeze/Fluid/Vapor reach no ultimate anywhere on their lanes — the sharpest half of the gap
  const noUlt = ['freeze', 'fluid', 'vapor'].filter(
    (r) => ![...knownMoves([r]), ...learnableMoves([r])].some((m) => m.tier === 'ultimate'))
  chk('Freeze/Fluid/Vapor still reach no ultimate (pinned gap)', noUlt.length === 3, noUlt.join())
}

// 7. a second rune opens a cross-hatch, not a list
{
  const one = reachableRunes(['star']).length
  const two = reachableRunes(['star', 'stone']).length
  chk('a 2nd rune widens reach', two > one, `${one} → ${two}`)
  chk('Veyra (Star+Breeze) unlocks Flame Barrage', knownMoves(['star', 'breeze']).some((m) => m.id === 'flame-barrage'))
}

console.log(`\nkeeper-moves oracle: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
