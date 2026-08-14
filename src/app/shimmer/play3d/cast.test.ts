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
//   4b. THE THREE SYSTEMS headless — fields tick on a clock (and don't burst-replay a stalled tab),
//       a Cordon ring is SEALED on every bearing, a wall lays perpendicular to aim, statuses extend
//       rather than stack, and a death clears its target
//   7. the birth rune is rune #1 of an inventory and can never be revoked

import { castForMove, isBuilt, defaultLoadout, eligibleMoves, canSlot, CAST_SLOTS, SLOT_KEYS, NO_CAST } from './cast'
import { KEEPER_MOVES } from './keeper-moves'
import { EMPTY_BOOK, type Book } from './scroll-market'

// A keeper who has learned everything. These asserts are about the RUNE→slot chain, so the book is
// held wide open on purpose — the book's own gate is asserted at the end of this section and in
// scroll-market.test.ts. ⚠ Do not "simplify" this into cast.ts as a default: an optional book is
// how the old, wrong answer (runes alone grant moves) would creep back in.
const ALL: Book = { learned: KEEPER_MOVES.map((m) => m.id) }
import { grantRune, revokeRune, setBirthRune, EMPTY_INVENTORY } from './rune-inventory'
import { spawnField, tickFields, expireFields, contains, containsVolume, blocksShotAt, blocksShotAtVolume,
         resetFieldIds, MAX_FIELDS, FIELD_HEIGHT, FIELD_UNDERBITE, type Field } from '../engine/field-effects'
import { wallCells, ringCells, blockCells, conjure, blockedAt, liveCells, expireConjured, resetConjuredIds } from './conjured-terrain'
import { emptyBag, applyStatus, applyStatuses, hasStatus, remaining, statusesOn, pruneStatuses, clearTarget } from './statuses'

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

  // the three systems' specs
  const wrong2: string[] = []
  for (const m of KEEPER_MOVES) {
    const s = castForMove(m.id)
    if (s.archetype === 'field' && !(s.areaSize > 0 && s.areaSecs > 0 && s.castRange > 0 && (s.fieldDps > 0 || s.fieldHps > 0))) wrong2.push(m.id)
    if (s.archetype === 'terrain' && !(s.areaSize > 0 && s.areaSecs > 0 && s.castRange > 0)) wrong2.push(m.id)
    if (s.archetype === 'status' && !(s.areaSize > 0 && s.areaSecs > 0 && s.castRange > 0 && s.statuses.length > 0)) wrong2.push(m.id)
    if (s.archetype === 'infusion' && !(s.surgeSecs > 0 && s.surgeMult > 1)) wrong2.push(m.id)
  }
  chk('placed casts carry range + size + duration', wrong2.length === 0, wrong2.join())

  // canon reads that must survive a tuning pass
  chk('Firewall is cover (canon says cover)', castForMove('firewall').fieldStopsShots)
  chk('a Healing Grove is NOT cover — you can be shot in it', !castForMove('healing-grove').fieldStopsShots)
  chk('Enlighten takes aim, never HP (a flash-bang, not a blade)',
    castForMove('enlighten').fieldDps === 0 && castForMove('enlighten').damage === 0)
  chk('Shackle both roots AND disarms (canon names both)',
    ['rooted', 'disarmed'].every((k) => castForMove('shackle').statuses.includes(k as never)))
  chk('Cordon is stone AND the metal lock in one cast',
    castForMove('cordon').shape === 'ring' && castForMove('cordon').statuses.includes('disarmed' as never))
  chk('Grey Arena stays unbuilt for a CANON reason, not a build one',
    castForMove('grey-arena').archetype === 'unbuilt' && /manatech/.test(castForMove('grey-arena').why ?? ''))
}

// 4b. the three systems, headless
{
  resetFieldIds(); resetConjuredIds()
  const T0 = 1_000_000  // fixed clock — no Date.now() anywhere in these modules

  // ── SYSTEM 1: fields ──
  {
    const fw = castForMove('firewall')
    let fields = spawnField([], { moveId: fw.moveId, x: 10, y: 0, z: 10, radius: fw.areaSize, height: FIELD_HEIGHT, secs: fw.areaSecs, dps: fw.fieldDps, hps: fw.fieldHps, stopsShots: fw.fieldStopsShots }, T0)
    chk('a field contains its centre', contains(fields[0], 10, 10))
    chk('...and not a point outside its radius', !contains(fields[0], 10 + fw.areaSize + 1, 10))
    chk('Firewall blocks a shot crossing it', blocksShotAt(fields, 10, 10))

    // ── ★ A FIELD IS A SLAB, NOT AN INFINITE COLUMN (2026-08-14, the voxel port) ──────────────
    // In play3d's flat world a circle and a column were the same thing. In a voxel world they are
    // not: a cave runs under the ground you cast on, and a ridge runs over it. Both of these would
    // have been silent — a Hollow burning through a tunnel roof reads as "the fire is buggy", never
    // as "the fire has no top".
    chk('the slab contains a body standing in it', containsVolume(fields[0], 10, 0, 10))
    chk('...and one in a shallow dip inside the radius (terrain is not flat)',
      containsVolume(fields[0], 10, -FIELD_UNDERBITE + 0.01, 10))
    chk('...but NOT one in the cave below it', !containsVolume(fields[0], 10, -6, 10))
    chk('...and NOT one on the ridge above it', !containsVolume(fields[0], 10, FIELD_HEIGHT + 2, 10))
    chk('a slab still respects its own footprint at the right height',
      !containsVolume(fields[0], 10 + fields[0].radius + 1, 0, 10))
    chk('Firewall is cover at body height', blocksShotAtVolume(fields, 10, 1, 10))
    chk('...and a round crossing the ridge above it is NOT eaten',
      !blocksShotAtVolume(fields, 10, FIELD_HEIGHT + 2, 10))

    // ticks fire once per interval, not once per frame
    let fired = 0
    for (let i = 0; i <= 60; i++) { const r = tickFields(fields, T0 + i * 50); fields = r.fields; fired += r.fired.length }  // 0 → 3000ms at 20fps
    chk('a field ticks once per second, not once per frame', fired === 3, `fired ${fired} over 3s`)

    // a backgrounded tab must not burst-apply the ticks it missed
    let f2 = spawnField([], { moveId: 'x', x: 0, y: 0, z: 0, radius: 3, height: FIELD_HEIGHT, secs: 30, dps: 5, hps: 0, stopsShots: false }, T0)
    const jump = tickFields(f2, T0 + 10_000)
    chk('a long stall resyncs instead of replaying 10 ticks', jump.fired.length === 1)

    chk('a field expires', expireFields(fields, T0 + fw.areaSecs * 1000 + 1).length === 0)

    // the cap drops the OLDEST, never the cast just paid for
    let many: Field[] = []
    for (let i = 0; i < MAX_FIELDS + 3; i++) many = spawnField(many, { moveId: `m${i}`, x: i, y: 0, z: 0, radius: 1, height: FIELD_HEIGHT, secs: 60, dps: 1, hps: 0, stopsShots: false }, T0)
    chk('the field cap holds', many.length === MAX_FIELDS)
    chk('...and drops the oldest, so a paid cast always appears', many[many.length - 1].moveId === `m${MAX_FIELDS + 2}`)
  }

  // ── SYSTEM 2: conjured terrain ──
  {
    // a wall lays PERPENDICULAR to the aim — a wall along your sightline would be a corridor
    const facingZ = wallCells(0, 0, 0, 1, 5)
    chk('facing +Z, the wall runs along X', facingZ.every((c) => c.z === 0) && new Set(facingZ.map((c) => c.x)).size === 5)
    const facingX = wallCells(0, 0, 1, 0, 5)
    chk('facing +X, the wall runs along Z', facingX.every((c) => c.x === 0) && new Set(facingX.map((c) => c.z)).size === 5)

    // a ring has to be SEALED — a gap makes containment a lie
    const ring = ringCells(0, 0, 4)
    let gaps = 0
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2
      const x = Math.round(Math.cos(a) * 4), z = Math.round(Math.sin(a) * 4)
      if (!ring.some((c) => c.x === x && c.z === z)) gaps++
    }
    chk('Cordon\'s ring is sealed on every bearing', gaps === 0, `${gaps} gaps`)
    chk('a ring does not fill its middle (it contains, not buries)', !ring.some((c) => c.x === 0 && c.z === 0))
    chk('a block is solid', blockCells(0, 0, 3).length === 9)

    let list = conjure([], 'stonewall', wallCells(5, 5, 0, 1, 5), 10, 2, T0)
    chk('conjured terrain blocks at its cells', blockedAt(list, 5, 5, T0))
    chk('...blocks on a fractional world coord that rounds into it', blockedAt(list, 5.4, 4.6, T0))
    chk('...and nowhere else', !blockedAt(list, 5, 9, T0))
    chk('...and not after it expires', !blockedAt(list, 5, 5, T0 + 10_001))
    chk('liveCells feeds the render pool', liveCells(list, T0).length === 5)
    chk('expireConjured returns the same array when nothing expired', expireConjured(list, T0) === list)
  }

  // ── SYSTEM 3: statuses ──
  {
    let bag = emptyBag()
    bag = applyStatuses(bag, 'hunter', castForMove('shackle').statuses, castForMove('shackle').areaSecs, T0)
    chk('Shackle roots the hunter', hasStatus(bag, 'hunter', 'rooted', T0))
    chk('...and disarms it', hasStatus(bag, 'hunter', 'disarmed', T0))
    chk('...and does not blind it', !hasStatus(bag, 'hunter', 'blinded', T0))
    chk('a status expires', !hasStatus(bag, 'hunter', 'rooted', T0 + 3001))

    // re-applying EXTENDS, never stacks — stacking is how CC becomes a stun-lock
    let b2 = applyStatus(emptyBag(), 'h', 'rooted', 3, T0)
    b2 = applyStatus(b2, 'h', 'rooted', 3, T0 + 1000)
    chk('re-applying extends to the later expiry', Math.round(remaining(b2, 'h', 'rooted', T0 + 1000)) === 3)
    b2 = applyStatus(b2, 'h', 'rooted', 1, T0 + 1000)  // a SHORTER one must not cut it short
    chk('a shorter re-apply never truncates a longer one', Math.round(remaining(b2, 'h', 'rooted', T0 + 1000)) === 3)

    chk('statusesOn lists what is live', statusesOn(bag, 'hunter', T0).sort().join() === 'disarmed,rooted')
    chk('pruning is identity when nothing expired', pruneStatuses(bag, T0) === bag)
    chk('pruning drops an emptied target', Object.keys(pruneStatuses(bag, T0 + 99_999)).length === 0)
    chk('a death clears the target so a root never survives a respawn',
      Object.keys(clearTarget(bag, 'hunter')).length === 0)
  }
}

// 5. the loadout is typed by canon tier
{
  chk('slots are 1 passive + 2 tacticals + 1 ultimate (the authoring target)',
    JSON.stringify(CAST_SLOTS) === JSON.stringify(['passive', 'tactical', 'tactical', 'ultimate']))
  chk('one distinct key per slot', SLOT_KEYS.length === CAST_SLOTS.length && new Set(SLOT_KEYS).size === SLOT_KEYS.length)

  const life = defaultLoadout(['life'], ALL)
  chk('a Life-born keeper slots Mend', life.includes('mend'))
  chk('...and has no passive to hold (Life registers none)', life[0] === null)
  chk('...and no ultimate (Healing Grove also needs Barrier)', life[3] === null)

  const lo = defaultLoadout(['barrier'], ALL).filter(Boolean)
  chk('never slots the same move twice', new Set(lo).size === lo.length)
  chk('an empty book yields an empty loadout, not a crash',
    JSON.stringify(defaultLoadout([], ALL)) === JSON.stringify([null, null, null, null]))

  // Star owns Firewall + Flame Infusion (both unbuilt); adding Freeze must surface Ice Dart first
  chk('prefers a move the sim can actually run', isBuilt(eligibleMoves(['star', 'freeze'], 'tactical', ALL)[0].id))

  chk('rejects a move whose runes you do not own', !canSlot(['life'], 1, 'ice-dart', ALL))
  chk('rejects a tier/slot mismatch (Mend is tactical, slot 0 is the passive)', !canSlot(['life'], 0, 'mend', ALL))
  chk('accepts a legal bind', canSlot(['life'], 1, 'mend', ALL))

  // ── ★ THE BOOK GATES THE SLOT (2026-08-13) ───────────────────────────────────────────────────
  // Carrying the rune is no longer enough — canon rules a move is OBTAINED, and the rune is the
  // filter on the scroll rather than the source of the move. If this pair ever disagrees, the
  // Passage has nothing to sell and the whole scroll economy is decoration.
  chk('★ a move you have not learned cannot be bound, even holding its rune',
    !canSlot(['life'], 1, 'mend', EMPTY_BOOK))
  chk('★ an unlearned move is not eligible for its slot either',
    eligibleMoves(['life'], 'tactical', EMPTY_BOOK).length === 0)
  chk('★ and a keeper with an empty book gets an empty starting kit',
    JSON.stringify(defaultLoadout(['life', 'barrier'], EMPTY_BOOK)) === JSON.stringify([null, null, null, null]))
  chk('★ learning just that one move opens exactly it',
    canSlot(['life'], 1, 'mend', { learned: ['mend'] }) &&
    eligibleMoves(['life'], 'tactical', { learned: ['mend'] }).length === 1)
}

// 6. a 2nd rune opens the cross-hatch
{
  chk('Life alone does not reach Healing Grove', !defaultLoadout(['life'], ALL).includes('healing-grove'))
  chk('Life + Barrier does', defaultLoadout(['life', 'barrier'], ALL).includes('healing-grove'))
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
