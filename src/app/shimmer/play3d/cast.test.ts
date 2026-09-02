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

import { castForMove, isBuilt, defaultLoadout, eligibleMoves, canSlot, derivePassive, CAST_SLOTS, SLOT_KEYS,
         ALL_BANDS, BAND_KEYS, NO_CAST, laneRunes } from './cast'
/** the same every-rune rule `cast.ts` › `onLane` applies, restated here so a divergence shows. */
const onLaneTest = (runes: string[], lane: Set<string>) => runes.length > 0 && runes.every((r) => lane.has(r))
import { KEEPER_MOVES, knownMoves } from './keeper-moves'
import { RUNES } from './birth/runes.data'
import { EMPTY_BOOK, type Book } from './scroll-market'

// A keeper who has learned everything. These asserts are about the RUNE→slot chain, so the book is
// held wide open on purpose — the book's own gate is asserted at the end of this section and in
// scroll-market.test.ts. ⚠ Do not "simplify" this into cast.ts as a default: an optional book is
// how the old, wrong answer (runes alone grant moves) would creep back in.
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
const canSlotFor = (owned: string[], slot: number, id: string, book: Book) =>
  canSlot(owned, bornOf(owned), slot, id, book)

import { grantRune, revokeRune, setBirthRune, EMPTY_INVENTORY } from './rune-inventory'
import { spawnField, tickFields, expireFields, contains, containsVolume, blocksShotAt, blocksShotAtVolume,
         resetFieldIds, MAX_FIELDS, FIELD_HEIGHT, FIELD_UNDERBITE, type Field } from '../engine/field-effects'
import { wallCells, ringCells, blockCells, conjure, blockedAt, liveCells, expireConjured, resetConjuredIds } from '../engine/conjured-terrain'
import { emptyBag, applyStatus, applyStatuses, hasStatus, remaining, statusesOn, pruneStatuses, clearTarget } from '../engine/statuses'

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
    // ── ★ RE-SCOPED 2026-08-26 (the SECOND ruling): the cost is per-MOVE, not per-tier ───────────
    // This assert has now been written three ways in two days, and the shape it settled on is the
    // only one that is a claim about the WORLD rather than about the current design:
    //   v1 "a stance that does not pause recovery is a free permanent buff"  → wrong once passives
    //      became always-on and free, which is what most of them now are.
    //   v2 "NO stance may pause recovery"                                     → wrong once canon kept
    //      the drain on Barrier/Bulwark. It would have gone red on correct code.
    //   v3 (here) a worn passive may not ZERO recovery, whatever it costs.
    // v3 survives both rulings because it does not encode which moves are costed — it encodes the
    // thing that is broken either way: the passive is ALWAYS-ON and UNDROPPABLE, so a `regenMult` of
    // 0 is not a trade a player can decline, it is a keeper who never regenerates mana again.
    // A drain (0 < mult < 1) is canon's "slow ebb" and passes; a stop does not.
    if (s.archetype === 'stance' && s.regenMult <= 0) wrong.push(m.id)
    // ★ AND A CANON COST/BENEFIT MUST ACTUALLY REACH THE GAME. `drainsWhileWorn` / `feedsWhileWorn`
    // are the canon FACTS (keeper-moves.ts); the rate is Jin's. Asserting the fact against the
    // DIRECTION of the number — never against the number — catches a spec that silently drifts back
    // to free without being a mirror of the constant, which could only ever fail by being edited.
    // Moisture Gathering's feed was unreachable for weeks precisely because nothing checked this.
    if (m.drainsWhileWorn && !(s.regenMult < 1)) wrong.push(`${m.id} (canon says it drains, spec does not)`)
    if (m.feedsWhileWorn && !(s.regenMult > 1)) wrong.push(`${m.id} (canon says it feeds, spec does not)`)
  }
  chk('built specs carry their archetype numbers', wrong.length === 0, wrong.join())
  chk('Chain Lightning chains (canon: arcs between every target in range)', castForMove('chain-lightning').chain > 0)

  // the three systems' specs
  const wrong2: string[] = []
  for (const m of KEEPER_MOVES) {
    const s = castForMove(m.id)
    // A field must DO one of three things — hurt, heal, or COVER — or it is the silent no-op the
    // honesty rule outlaws. Cover joined the list 2026-09-02 with Threshold, the first zero-damage
    // field: a shield set down across a doorway that stops shots and nothing else. The rule was not
    // loosened for it; a field with all three off still fails here, which is the case this exists for.
    if (s.archetype === 'field' && !(s.areaSize > 0 && s.areaSecs > 0 && s.castRange > 0 && (s.fieldDps > 0 || s.fieldHps > 0 || s.fieldStopsShots))) wrong2.push(m.id)
    if (s.archetype === 'terrain' && !(s.areaSize > 0 && s.areaSecs > 0 && s.castRange > 0)) wrong2.push(m.id)
    if (s.archetype === 'status' && !(s.areaSize > 0 && s.areaSecs > 0 && s.castRange > 0 && s.statuses.length > 0)) wrong2.push(m.id)
    if (s.archetype === 'infusion' && !(s.surgeSecs > 0 && s.surgeMult > 1)) wrong2.push(m.id)
  }
  chk('placed casts carry range + size + duration', wrong2.length === 0, wrong2.join())

  // canon reads that must survive a tuning pass
  chk('Firewall is cover (canon says cover)', castForMove('firewall').fieldStopsShots)
  chk('Threshold is cover and ONLY cover — a shield you give away hurts nobody', castForMove('threshold').fieldStopsShots && castForMove('threshold').fieldDps === 0 && castForMove('threshold').fieldHps === 0)
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
    let fields = spawnField([], { moveId: fw.moveId, x: 10, y: 0, z: 10, radius: fw.areaSize, height: FIELD_HEIGHT, secs: fw.areaSecs, dps: fw.fieldDps, hps: fw.fieldHps, stopsShots: fw.fieldStopsShots , hp: 0}, T0)
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
    let f2 = spawnField([], { moveId: 'x', x: 0, y: 0, z: 0, radius: 3, height: FIELD_HEIGHT, secs: 30, dps: 5, hps: 0, stopsShots: false , hp: 0}, T0)
    const jump = tickFields(f2, T0 + 10_000)
    chk('a long stall resyncs instead of replaying 10 ticks', jump.fired.length === 1)

    chk('a field expires', expireFields(fields, T0 + fw.areaSecs * 1000 + 1).length === 0)

    // the cap drops the OLDEST, never the cast just paid for
    let many: Field[] = []
    for (let i = 0; i < MAX_FIELDS + 3; i++) many = spawnField(many, { moveId: `m${i}`, x: i, y: 0, z: 0, radius: 1, height: FIELD_HEIGHT, secs: 60, dps: 1, hps: 0, stopsShots: false , hp: 0}, T0)
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
  chk('one distinct key per band slot, across both bands',
    BAND_KEYS.length === ALL_BANDS.length && new Set(BAND_KEYS).size === BAND_KEYS.length)

  // ── ★★★ NO BUILT MOVE MAY BE ORPHANED (added 2026-08-25; REWRITTEN 2026-08-26 for the passive ruling) ───
  //
  // The defect this exists to catch: `resolveCast(slot, …)` in `engine/cast-dispatch.ts` is the ONLY
  // writer of `stanceChange`, and a CAST move's only route into the game is a band whose kind matches
  // its tier. So removing a kind from a band silently retires every move of that tier, with nothing
  // that looks like an error. This guard asks: is every move the sim can RUN still reachable?
  //
  // ⚠ TWO ROUTES NOW, NOT ONE — the passive left the bar (RULED 2026-08-26, Alex). A CAST move
  // (tactical/ultimate) is reachable iff its tier is a band. A PASSIVE reaches the game a DIFFERENT
  // way: `derivePassive` surfaces the one always-on passive, off the bar entirely. So a built passive
  // is not orphaned by having no band — it is orphaned only if no keeper who owns its runes could ever
  // have it in the derive pool. (Capped-at-one may still not PICK a passive that shares a rune with a
  // higher-sorted one — Bulwark under Barrier — but that is RANKING, not orphaning: it remains a
  // candidate, and the guard tests candidacy, not the winner. If it tested the winner it would demand
  // every passive be reachable, which capped-at-one deliberately does not promise.)
  //
  // It NAMES the orphans rather than counting them — a count goes red without saying why, and the
  // cheapest lie that makes a red count green is to change the number.
  {
    const orphaned = KEEPER_MOVES
      .filter((m) => {
        if (!isBuilt(m.id) || m.tier === 'combo') return false
        if (m.tier === 'passive') {
          // reachable = the derive pool for a keeper owning exactly its runes surfaces this passive.
          // ⚠ The keeper must be BORN with the right rune for a birth-exclusive (2026-08-26), so the
          // hypothetical keeper is born holding the move's own gate where it has one. Passing a null
          // birth here would report both band members as orphans — a guard failing on correct code.
          const born = m.birthExclusive ?? m.runes[0] ?? null
          // ⚠ The hypothetical keeper must OWN the rune they were born with — `normalize()` puts the
          // birth rune in `owned` for every real keeper, and a fixture that skips it is describing a
          // person who cannot exist. Same family as an oracle calling past the gate the game uses.
          const owns = born && !m.runes.includes(born as never) ? [born, ...m.runes] : [...m.runes]
          return !eligibleMoves(owns, born, 'passive', ALL).some((x) => x.id === m.id)
        }
        // A trait is reachable by EXISTING — runeless, always on, nothing to bind. It is not
        // orphaned by having no band; having no band is what a trait IS.
        if (m.tier === 'trait') return false
        return !ALL_BANDS.includes(m.tier as never)
      })
      .map((m) => `${m.name} (${m.tier})`)
    chk(`every BUILT move is reachable — via a band (cast) or derivePassive (passive)${orphaned.length ? ` — ORPHANED: ${orphaned.join(', ')}` : ''}`,
      orphaned.length === 0)
  }

  // ── ★ THE BIRTH-EXCLUSIVE BAND, BOTH DIRECTIONS (RULED 2026-08-26) ────────────────────────────
  // The structural guards above ask whether the band is well-FORMED. This asks whether it BITES,
  // and the negative is the whole point: canon's claim is that Flame Manipulation cannot be bought
  // or taught, so OWNING Star must not be enough. A test that only checked the positive would pass
  // against a build with no gate at all.
  {
    const STAR_BORN = ['star']
    const LIFE_BORN_WITH_STAR = ['life', 'star']   // head = birth rune, per `bornOf`
    chk('a Star-born keeper derives Flame Manipulation',
      derivePassive(STAR_BORN, 'star', ALL)?.id === 'flame-manipulation')
    chk('★ a keeper who OWNS Star but was not BORN Star cannot hold it — not at any price',
      !eligibleMoves(LIFE_BORN_WITH_STAR, 'life', 'passive', ALL).some((m) => m.id === 'flame-manipulation'))
    chk('same for Moisture Gathering — Fluid-born only',
      derivePassive(['fluid'], 'fluid', ALL)?.id === 'moisture-gathering' &&
      !eligibleMoves(['life', 'fluid'], 'life', 'passive', ALL).some((m) => m.id === 'moisture-gathering'))
    // A keeper with no birth rune (the ritual unfinished) is a real state, not a crash, and holds
    // nothing in the band — `null` must read as "born of nothing", never as a wildcard that matches.
    chk('a keeper with no birth rune holds no band member',
      !eligibleMoves(['star', 'fluid'], null, 'passive', ALL).some((m) => m.birthExclusive))
    // ── ★ CANON'S NO-RUNE TEST, ENCODED AS THE BIDIRECTIONAL DERIVATION IT IS ──────────────────
    // `runes.md`: **no rune → Trait. A rune → Passive.** Both directions, because the bug that
    // actually shipped ran one way (Herbal Knowledge: runeless, tiered `passive`) and the tempting
    // repair runs the other (tier something `trait` to get it out of a pool).
    //
    // ⚠ WRITTEN THIS WAY AFTER THE FIRST VERSION FAILED ITS OWN MUTATION TEST. That one asserted
    // Herbal Knowledge never enters the passive derive pool — and `knownMoves()` already drops every
    // runeless move, so it was TRUE no matter what tier the row carried. Reverting the fix left it
    // green. An assert that cannot fail is decoration; this one names offenders and fails both ways.
    {
      const misfiled = KEEPER_MOVES
        .filter((m) => (m.runes.length === 0) !== (m.tier === 'trait'))
        .map((m) => `${m.name} (${m.runes.length === 0 ? 'runeless' : `${m.runes.length} rune(s)`}, tier ${m.tier})`)
      chk(`no rune → Trait, a rune → Passive${misfiled.length ? ` — MISFILED: ${misfiled.join(', ')}` : ''}`,
        misfiled.length === 0)
    }
  }

  // ── ★★★ THE LANE LAW (canon 2026-08-03, built 08-26) ─────────────────────────────────────────
  // tacticals ← your ELEMENT lane (breadth) · signature ← your STATE lane (scarcity) · passive ← no
  // lane. Asserted against canon's own worked examples, which is the only way to know the axes are
  // not silently transposed: `runes.md` draws the matrix with elements as COLUMN HEADERS but its
  // prose calls the element grouping a ROW, so a build that read the picture instead of the meaning
  // would swap the two bands and still look plausible everywhere.
  {
    const bandOf = (k: string) => ALL_BANDS.indexOf(k as never)
    const el = (b: string) => laneRunes(b, 'element')
    const st = (b: string) => laneRunes(b, 'state')
    chk('the fixture found the bands it seats into', bandOf('tactical') >= 0 && bandOf('ultimate') >= 0)
    // Canon's three developed mages. Each one pins an axis by NAME, so a transposition fails here.
    chk("Eyuun's Trick is a STATE lane — Enchant, Illuminate, Metalergy are all Bind",
      st('enchant').has('illuminate') && st('enchant').has('metalergy') && !el('enchant').has('illuminate'))
    chk('Kael Static → Lightning is an ELEMENT lane — both Storm',
      el('static').has('lightning') && !st('static').has('lightning'))
    chk('Samantha demonstrates both — Fluid → Life is Flow (state), Fluid → Freeze is Water (element)',
      st('fluid').has('life') && el('fluid').has('freeze'))
    // Canon's own sizing claim: element = breadth, state = scarcity (2-3). If these ever invert, the
    // bands are transposed even if every membership assert above still happens to hold.
    chk('the element lane is the wide one and the state lane is the scarce one (canon: 2-3)',
      el('breeze').size === 5 && st('breeze').size === 3 && st('breeze').size <= 3)
    // A move must be on the lane with EVERY rune, not any — canon's off-lane rule. Fog Bank holds
    // neither axis constant, so it is the exact combination canon says must be DRIVEN.
    chk('★ a runeword holding NEITHER axis is off-lane — Fog Bank is not a Mist-born tactical',
      !canSlotFor(['mist', 'breeze'], bandOf('tactical'), 'fog-bank', ALL))
    chk('...while one holding the element axis IS — Flash Freeze is all-Water',
      canSlotFor(['fluid', 'freeze'], bandOf('tactical'), 'flash-freeze', ALL))
    // The passive band is deliberately unscoped (ruled: reached by TRAINED rune, not birth lane).
    // Barrier is mana/Compact; a Stone-born keeper shares neither axis and must still derive it.
    chk('the passive band takes NO lane — a Stone-born keeper still derives Barrier',
      derivePassive(['stone', 'barrier'], 'stone', ALL)?.id === 'barrier')
  }

  // ── ⚠ THE COVERAGE DEBT, MEASURED AND NAMED RATHER THAN DISCOVERED BY A PLAYER ────────────────
  // The Lane Law is canon and correct, and applying it leaves whole STATE lanes with no built
  // signature — a keeper born on one has a permanently empty B slot. `defaultLoadout` already calls
  // an empty slot "the coverage gap rendered, not a bug", and canon's ruling says the thin runes ARE
  // the declared authoring debt ("derive, don't author"). So this does not fail; it PRINTS, because
  // a debt nobody can see is a debt nobody pays. It goes red only if the debt GROWS.
  {
    const states = [...new Set(RUNES.filter((r) => !r.lostState).map((r) => r.state))]
    const starved = states.filter((st) => {
      const lane = new Set(RUNES.filter((r) => r.state === st).map((r) => r.id))
      return !KEEPER_MOVES.some((m) => m.tier === 'ultimate' && isBuilt(m.id) && m.runes.length > 0
        && m.runes.every((r) => lane.has(r)))
    })
    console.log(`  · state lanes with NO built signature: ${starved.length ? starved.join(', ') : 'none'}`)
    // ── ⚠⚠ THE REGISTRY HALF IS FIXED; THIS COUNTS THE BUILD HALF, AND THEY ARE DIFFERENT DEBTS ──
    // Canon RULED both lanes on 2026-08-26 and the registry caught up on 08-27: `Gate` widened to
    // all three Bind runes (the build was reading a summary cell that made canon's flagship
    // gate-mage illegal), and `Overpressure` (Barrier+Gem+Hydro) registered as Compact's signature.
    //
    // ★ AND THE COUNT DID NOT MOVE, WHICH IS CORRECT AND WORTH SAYING OUT LOUD. A canon-agent's
    // note predicted this would go to 0. It cannot: this filter requires `isBuilt`, and both of
    // those ultimates are deliberately `unbuilt` — Gate needs a two-point bind on a placed anchor,
    // Overpressure needs a damage-to-shield bank. **So both lanes now HAVE a canon signature and
    // neither has one you can cast.** Believe the code, not the note, including a canon note.
    //
    // ⚠ THE CEILING STAYS 2 RATHER THAN BEING TIGHTENED, because the debt is still real. It drops
    // the day either cast is built, and THAT is when this number should follow it down.
    chk(`no MORE than the 2 known-starved state lanes (Compact, Bind) — currently: ${starved.join(', ') || 'none'}`,
      starved.length <= 2)
    // Every birthable rune must at least reach a TACTICAL, or that keeper has no cast at all.
    const noTactical = RUNES.filter((r) => !r.lostState).filter((b) => {
      const lane = laneRunes(b.id, 'element')
      return !KEEPER_MOVES.some((m) => m.tier === 'tactical' && isBuilt(m.id) && onLaneTest(m.runes, lane))
    }).map((r) => r.name)
    chk(`every birthable rune reaches at least one built tactical${noTactical.length ? ` — STARVED: ${noTactical.join(', ')}` : ''}`,
      noTactical.length === 0)
  }

  // ── ★ A BIRTH-EXCLUSIVE MUST NAME A RUNE A KEEPER CAN ACTUALLY BE BORN WITH (2026-08-26) ──────
  // The orphan guard above CANNOT catch this, and that is why this is separate rather than folded in:
  // it builds its hypothetical keeper from the move's own gate, so a birth-exclusive is reachable by
  // construction and the assert is satisfied no matter which rune the gate names. It is a guard that
  // can fail, does discriminate, and simply does not constrain the axis that matters here.
  //
  // The axis that matters: `runes.data.ts` marks some runes `lostState` — real runes a character can
  // hold (Kael is Static-born) but which are deliberately NOT offered on the birth carousel. A move
  // gated on one is unreachable by every player who will ever exist, and nothing else in the suite
  // would say so. It NAMES the offender; a count would invite the cheapest green.
  {
    const unreachable = KEEPER_MOVES
      .filter((m) => m.birthExclusive)
      .filter((m) => {
        const r = RUNES.find((x) => x.id === m.birthExclusive)
        return !r || r.lostState === true
      })
      .map((m) => `${m.name} → ${m.birthExclusive}`)
    chk(`every birth-exclusive names a birthable rune${unreachable.length ? ` — UNREACHABLE: ${unreachable.join(', ')}` : ''}`,
      unreachable.length === 0)
    // And the band must not have silently swallowed the registry: exactly the two canon wrote.
    // ⚠ This one is a COUNT on purpose and it is the declared authoring debt (2 of 17), so it is the
    // row that goes red the day a 3rd is authored — which is the moment canon wants a human to look.
    chk('the birth-exclusive band holds the 2 members canon has written',
      KEEPER_MOVES.filter((m) => m.birthExclusive).length === 2)
  }

  // The bar's kinds must stay a subset of canon's non-combo tiers, and hold no duplicates it cannot
  // justify. This constrains the shape WITHOUT restating it, so the ruled collapse passes untouched.
  chk('every band kind is a real canon tier', ALL_BANDS.every((k) => KEEPER_MOVES.some((m) => m.tier === k)))

  // ── ★ SLOT INDICES ARE DERIVED, NEVER LITERAL (2026-08-25, play lane) ─────────────────────────
  // Every assert below used to name its slot by number — `life[0]`, `life[3]`, `canSlotFor(…, 1, …)`,
  // and a `[null,null,null,null]` shape literal. Those are mirrors of a list that is ABOUT TO MOVE:
  // the ruled 4→2 collapse makes all of them red at once, every one for a CORRECT reason, and the
  // cheapest way to make a wall of red green again is to paste the new numbers in. That is the moment
  // a suite stops testing behaviour and starts testing its own transcription — and it would happen on
  // exactly the commit that most needs a suite testing behaviour.
  // Derived indices survive any ruled shape and go red only if the RULE changed.
  const slotOf = (k: string) => ALL_BANDS.indexOf(k as never)
  const TACTICAL = slotOf('tactical')
  const ULTIMATE = slotOf('ultimate')
  // ⚠ Assert the fixture FOUND what it needs. A derived index that silently comes back -1 turns every
  // assert under it into a comparison against `undefined` — the empty-measurement-window trap, where a
  // check that cannot fire reads identically to one that passed.
  chk('the bar keeps a tactical slot and a signature slot (the two the ruling keeps)',
    TACTICAL >= 0 && ULTIMATE >= 0)

  const life = defaultFor(['life'], ALL)
  chk('a Life-born keeper slots Mend', life.includes('mend'))
  chk('...and no ultimate (Healing Grove also needs Barrier)', life[ULTIMATE] === null)
  // (The old "nothing to hold in a passive slot" assert retired 2026-08-26: there is no passive band
  //  to hold anything, so that check became vacuous — an assert that cannot fire. The passive path is
  //  covered by its own section below.)
  chk('the bar has no passive slot — the passive is off the bar', !ALL_BANDS.includes('passive' as never))

  const lo = defaultFor(['barrier'], ALL).filter(Boolean)
  chk('never slots the same move twice', new Set(lo).size === lo.length)
  {
    const none = defaultFor([], ALL)
    chk('an empty book yields an empty loadout, not a crash',
      none.length === ALL_BANDS.length && none.every((x) => x === null))
  }

  // Star owns Firewall + Flame Infusion (both unbuilt); adding Freeze must surface Ice Dart first
  chk('prefers a move the sim can actually run', isBuilt(eligibleFor(['star', 'freeze'], 'tactical', ALL)[0].id))

  chk('rejects a move whose runes you do not own', !canSlotFor(['life'], TACTICAL, 'ice-dart', ALL))
  {
    // Any slot that is not a tactical must refuse Mend, which is tactical. Derived so the assert
    // keeps meaning the same thing after the collapse — and it names the case it could not find
    // rather than passing vacuously if the bar ever becomes tacticals only.
    const offTier = ALL_BANDS.findIndex((k) => k !== 'tactical')
    chk('the bar still has a non-tactical slot to test the tier gate with', offTier >= 0)
    chk(`rejects a tier/slot mismatch (Mend is tactical, slot ${offTier} is the ${ALL_BANDS[offTier]})`,
      !canSlotFor(['life'], offTier, 'mend', ALL))
  }
  chk('accepts a legal bind', canSlotFor(['life'], TACTICAL, 'mend', ALL))

  // ── ★ THE BOOK GATES THE SLOT (2026-08-13) ───────────────────────────────────────────────────
  // Carrying the rune is no longer enough — canon rules a move is OBTAINED, and the rune is the
  // filter on the scroll rather than the source of the move. If this pair ever disagrees, the
  // Passage has nothing to sell and the whole scroll economy is decoration.
  chk('★ a move you have not learned cannot be bound, even holding its rune',
    !canSlotFor(['life'], TACTICAL, 'mend', EMPTY_BOOK))
  chk('★ an unlearned move is not eligible for its slot either',
    eligibleFor(['life'], 'tactical', EMPTY_BOOK).length === 0)
  {
    const kit = defaultFor(['life', 'barrier'], EMPTY_BOOK)
    chk('★ and a keeper with an empty book gets an empty starting kit',
      kit.length === ALL_BANDS.length && kit.every((x) => x === null))
  }
  chk('★ learning just that one move opens exactly it',
    canSlotFor(['life'], TACTICAL, 'mend', { learned: ['mend'] }) &&
    eligibleFor(['life'], 'tactical', { learned: ['mend'] }).length === 1)
}

// 6. a 2nd rune opens the cross-hatch
{
  // ── ★★ REWRITTEN 2026-08-26 WHEN THE LANE LAW LANDED, AND NOT BY PASTING A NEW EXPECTATION ────
  // The old pair asserted `defaultLoadout(['life','barrier'])` CONTAINS healing-grove, and the Lane
  // Law turned that red. The red was correct and the test was not wrong about anything it MEANT:
  // its subject is the cross-hatch — a 2nd rune unlocking a runeword neither rune reaches alone —
  // which lives in `knownMoves` and the Lane Law does not touch at all. What it happened to MEASURE
  // was seating, and seating is exactly what changed.
  //
  // So the claim is asserted where it actually lives, and the seating consequence is stated in both
  // directions rather than deleted. ⚠ Flipping this to `!includes(...)` would have been the cheap
  // green: same one-line edit, and it would have quietly retired the cross-hatch from the suite —
  // the mechanic would then have had NO coverage while the file still listed it as item 6.
  // Same derivation as the block above, and the same reason: an index literal here would be a mirror
  // of `ALL_BANDS`. The -1 guard travels with it, or a missing band would turn both seating asserts
  // into compares against `undefined` and read exactly like a pass.
  const bandOf = (k: string) => ALL_BANDS.indexOf(k as never)
  const TAC = bandOf('tactical'), ULT = bandOf('ultimate')
  chk('the fixture found both bands it seats into', TAC >= 0 && ULT >= 0)
  chk('Life alone does not reach Healing Grove', !knownMoves(['life']).some((m) => m.id === 'healing-grove'))
  chk('★ the cross-hatch still opens: Life + Barrier makes Healing Grove KNOWN',
    knownMoves(['life', 'barrier']).some((m) => m.id === 'healing-grove'))
  // And what the Lane Law then decides about it. Life is mana/Flow, so:
  //   · signature ← the Flow STATE lane {life, breeze, fluid}. Healing Grove needs Barrier (Compact),
  //     so a Life-born keeper cannot SEAT it — canon's scarcity, working.
  //   · tactical ← the mana ELEMENT lane {manalic, barrier, star, life, enchant}. Living Architecture
  //     is life + barrier, both mana, so the SAME second rune does open a seat — in the other band.
  // Asserting only the refusal would read as "the cross-hatch gives you nothing", which is false.
  chk('a Life-born keeper cannot seat Healing Grove — signature comes from the STATE lane',
    !defaultFor(['life', 'barrier'], ALL).includes('healing-grove') &&
    !canSlotFor(['life', 'barrier'], ULT, 'healing-grove', ALL))
  chk('★ but the same 2nd rune DOES open a tactical — Living Architecture is all-mana',
    canSlotFor(['life', 'barrier'], TAC, 'living-architecture', ALL))
}

// 6b. the passive is DERIVED, always-on, capped at one (RULED 2026-08-26, Alex)
{
  // capped at one is guaranteed by the return type (KeeperMove | null) — these assert the DERIVATION.
  const bp = passiveFor(['barrier'], ALL)
  chk('a barrier keeper derives a passive', bp !== null)
  chk('...and it is a BUILT one, not the always-eligible unbuilt Herbal Knowledge (built sorts first)',
    !!bp && isBuilt(bp.id))
  chk('...and it is one the keeper\'s runes actually make eligible',
    !!bp && eligibleFor(['barrier'], 'passive', ALL).some((x) => x.id === bp.id))
  chk('a keeper who has learned nothing derives no passive (empty book → null)',
    passiveFor(['barrier'], EMPTY_BOOK) === null)
  // ⚠ built-first is the whole ranking, and it only BITES when the pool is MIXED — a barrier keeper's
  // passives are all built, so order cannot surface an unbuilt one there and a reverse mutation slips
  // past.
  //
  // ★★ THE FIXTURE IS SEARCHED FOR, NOT NAMED, AND THAT IS A REPAIR NOT A FLOURISH. It used to be
  // hardcoded as star+static (Flame Manipulation BUILT, Flame Cloak UNBUILT). Flame Cloak was built
  // on 2026-08-31 and the pair stopped being mixed — so the non-vacuity assert went red and caught
  // it, exactly as written. But a hand-named pair would just go stale again on the next build, and
  // the fix that only re-picks a pair is the fix that has to be made a third time. Searching means
  // the fixture repairs itself, and the day NO pair is mixed the search returns nothing and this
  // goes red on purpose: built-first would no longer be testable, which is worth being told.
  {
    // ⚠ SEARCHES PAIRS *AND TRIPLES*, and the widening is itself a finding. With flame-cloak built,
    // NO two-rune keeper has a mixed pool any more — it was the last unbuilt passive reachable with
    // two runes. The only one left, Bind Mastery, is Enchant + Metalergy + Illuminate, so a pair-only
    // search reports "built-first is untestable" while a perfectly good fixture exists one rune away.
    // That is an instrument too narrow to see its subject, not an absence.
    const runeIds = RUNES.map((r) => r.id)
    const isMixed = (owned: string[]) => {
      const pool = eligibleFor(owned, 'passive', ALL)
      return pool.some((x) => isBuilt(x.id)) && pool.some((x) => !isBuilt(x.id))
    }
    let mixedPair: string[] | null = null
    outer: for (const a of runeIds) {
      for (const b of runeIds) {
        if (a === b) continue
        if (isMixed([a, b])) { mixedPair = [a, b]; break outer }
        for (const c of runeIds) {
          if (c === a || c === b) continue
          if (isMixed([a, b, c])) { mixedPair = [a, b, c]; break outer }
        }
      }
    }
    chk('fixture: SOME rune pair has both a built and an unbuilt passive eligible (or built-first is untestable)',
      mixedPair !== null)
    if (mixedPair) {
      const p = passiveFor(mixedPair, ALL)
      chk(`built-first: the derived passive is the BUILT one when the pool mixes (${mixedPair.join('+')})`,
        !!p && isBuilt(p.id))
    }
  }
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
