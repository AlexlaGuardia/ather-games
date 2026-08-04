// ── The cast layer (slot → move → archetype) + the rune inventory — headless oracle ────────────
// Run: npx tsx src/app/shimmer/play3d/cast.test.ts
//
// Locks the contracts the corrected cast model rests on:
//   1. COVERAGE — every registered canon move is classified (built, or unbuilt WITH a reason). This
//      is the guard: a newly authored move in moves.md must be given a build call, never fall
//      through to a silent no-op that reads in-game as a broken cast.
//   2. the colour law — a CastSpec carries NO colour (moves.md:5, colour is the mage's soul-frequency)
//   3. combos are never solo-castable (canon requires a second mage in sync)
//   4. built specs carry the numbers their archetype actually reads
//   5. the loadout is typed by canon tier and can't be filled with a move you can't run
//   6. a 2nd rune opens the cross-hatch (Life + Barrier reaches Healing Grove)
//   7. the birth rune is rune #1 of an inventory and can never be revoked

import { KEEPER_MOVES } from './keeper-moves'
import { castForMove, isBuilt, defaultLoadout, eligibleMoves, canSlot, CAST_SLOTS, SLOT_KEYS, NO_CAST } from './cast'
import { grantRune, revokeRune, setBirthRune, EMPTY_INVENTORY } from './rune-inventory'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

// 1. coverage — the guard against a silently unclassified move
{
  const unclassified = KEEPER_MOVES.filter((m) => castForMove(m.id).why === 'no build spec')
  chk('every registered move has a build spec', unclassified.length === 0, unclassified.map((m) => m.id).join())

  const silent = KEEPER_MOVES.filter((m) => { const s = castForMove(m.id); return s.archetype === 'unbuilt' && !s.why })
  chk('every unbuilt move says why', silent.length === 0, silent.map((m) => m.id).join())

  chk('an unknown move id resolves without throwing', castForMove('no-such-move').archetype === 'unbuilt')
  chk('an empty slot resolves to NO_CAST', castForMove(null) === NO_CAST)

  const built = KEEPER_MOVES.filter((m) => isBuilt(m.id)).length
  console.log(`  · ${built}/${KEEPER_MOVES.length} canon moves the sim can run today`)
}

// 2. the colour law — moves.md:5
{
  const spec = castForMove('ice-dart') as unknown as Record<string, unknown>
  chk('a CastSpec carries no colour (it is the mage soul-frequency, not the move)',
    !('glow' in spec) && !('core' in spec))
}

// 3. combos need a second mage — never a solo bind
{
  const solo = KEEPER_MOVES.filter((m) => m.tier === 'combo' && isBuilt(m.id))
  chk('combo moves are never castable solo', solo.length === 0, solo.map((m) => m.id).join())
  const inSlot = CAST_SLOTS.some((k) => (k as string) === 'combo')
  chk('there is no combo slot kind', !inSlot)
}

// 4. built specs carry the numbers their archetype reads
{
  const wrong: string[] = []
  for (const m of KEEPER_MOVES) {
    const s = castForMove(m.id)
    if (s.archetype === 'projectile' && !(s.damage > 0 && s.projSpeed > 0 && s.projLife > 0)) wrong.push(m.id)
    if (s.archetype === 'restore' && !(s.heal > 0)) wrong.push(m.id)
    if (s.archetype === 'surge' && !(s.surgeSecs > 0 && s.surgeMult > 1)) wrong.push(m.id)
    // canon: holding a passive pauses mana recovery — a stance that doesn't is a free permanent buff
    if (s.archetype === 'stance' && !s.pausesRecovery) wrong.push(m.id)
  }
  chk('built specs carry their archetype numbers', wrong.length === 0, wrong.join())
  chk('Chain Lightning chains (canon: arcs between every target in range)', castForMove('chain-lightning').chain > 0)
}

// 5. the loadout is typed by canon tier
{
  chk('slots are 1 passive + 2 tacticals + 1 ultimate (the authoring target)',
    JSON.stringify(CAST_SLOTS) === JSON.stringify(['passive', 'tactical', 'tactical', 'ultimate']))
  chk('one distinct key per slot', SLOT_KEYS.length === CAST_SLOTS.length && new Set(SLOT_KEYS).size === SLOT_KEYS.length)

  const life = defaultLoadout(['life'])
  chk('a Life-born keeper slots Mend', life.includes('mend'))
  chk('...and has no passive to hold (Life registers none)', life[0] === null)
  chk('...and no ultimate (Healing Grove also needs Barrier)', life[3] === null)

  const lo = defaultLoadout(['barrier']).filter(Boolean)
  chk('never slots the same move twice', new Set(lo).size === lo.length)
  chk('an empty book yields an empty loadout, not a crash',
    JSON.stringify(defaultLoadout([])) === JSON.stringify([null, null, null, null]))

  // Star owns Firewall + Flame Infusion (both unbuilt); adding Freeze must surface Ice Dart first
  chk('prefers a move the sim can actually run', isBuilt(eligibleMoves(['star', 'freeze'], 'tactical')[0].id))

  chk('rejects a move whose runes you do not own', !canSlot(['life'], 1, 'ice-dart'))
  chk('rejects a tier/slot mismatch (Mend is tactical, slot 0 is the passive)', !canSlot(['life'], 0, 'mend'))
  chk('accepts a legal bind', canSlot(['life'], 1, 'mend'))
}

// 6. a 2nd rune opens the cross-hatch
{
  chk('Life alone does not reach Healing Grove', !defaultLoadout(['life']).includes('healing-grove'))
  chk('Life + Barrier does', defaultLoadout(['life', 'barrier']).includes('healing-grove'))
}

// 7. the rune inventory
{
  let inv = setBirthRune(EMPTY_INVENTORY, 'life')
  inv = grantRune(inv, 'barrier')
  chk('birth rune is always first', JSON.stringify(inv.owned) === JSON.stringify(['life', 'barrier']))
  chk('the birth rune cannot be revoked — you cannot un-be born',
    JSON.stringify(revokeRune(inv, 'life').owned) === JSON.stringify(['life', 'barrier']))
  chk('a developed rune can be dropped',
    JSON.stringify(revokeRune(inv, 'barrier').owned) === JSON.stringify(['life']))
  chk('granting is idempotent',
    JSON.stringify(grantRune(inv, 'barrier').owned) === JSON.stringify(['life', 'barrier']))
  chk('re-birthing keeps developed runes and re-heads the list',
    JSON.stringify(setBirthRune(inv, 'freeze').owned) === JSON.stringify(['freeze', 'barrier']))
}

console.log(`\ncast oracle: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
