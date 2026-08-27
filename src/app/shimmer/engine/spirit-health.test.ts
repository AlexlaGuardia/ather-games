// Persistent-wound oracle — run: npx tsx src/app/shimmer/engine/spirit-health.test.ts
//
// What actually needs guarding here is not the arithmetic, it is the two ways this feature can
// silently destroy a save:
//   1. A wound written in the WRONG SPACE. hpFrac is a fraction precisely because maxHp moves
//      (level-ups) and the arena scales it again by HP_MULT, a pacing knob that has already been
//      retuned once. If anyone "simplifies" this to an absolute HP number, the next balance pass
//      wounds or heals every spirit in every existing save. The scale-invariance asserts below are
//      the tripwire for that.
//   2. A DEAD-END save. The whole design is "wounds cost resources", which is only fun while a
//      broke player can still climb out. The trickle carve-out for an all-downed party is the one
//      thing standing between the grind and an unrecoverable file, so it is asserted directly.
// Round-tripping through the save contract is checked too, since a dropped field reads as a free
// full heal — the exact failure that would make this whole feature look like it never shipped.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createSpirit, type Spirit } from '../spirits/spirit'
import { createArena, battleResult } from './arena'
import { spiritsToSave, spiritsFromSave } from '../spirits/spirit-save'
import {
  hpFracOf, currentHpOf, maxHpOf, isDowned, canFight, fieldableSpirits, partyAllDowned,
  applyFightResult, healSpirit, healSpiritFrac, reviveSpirit, restoreParty, pickMendTarget,
  tickRecovery, REGEN_FRAC_PER_MIN, WIPE_REVIVE_FRAC_PER_MIN, REVIVE_FRAC, REST_REGEN_MULT,
  activeSpirits, restingSpirits, setSpiritActive, normalizeRoster, MAX_PARTY,
} from './spirit-health'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { console.log(`  ok    ${label}`); return }
  failures++
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}
function near(a: number, b: number, eps = 1e-6) { return Math.abs(a - b) < eps }

function mk(name = 'Test', level = 10): Spirit {
  const s = createSpirit('fox', name, 0, 0)
  s.level = level
  s.seeds = [16, 16, 16, 16, 16, 16]   // fixed IVs — no Math.random in the subject (see arena.test's lesson)
  s.temperament = 'neutral'
  return s
}

console.log('\nspirit-health oracle\n')

// ── defaults ────────────────────────────────────────────────────────────────
console.log('defaults')
{
  const s = mk()
  check('a new spirit is whole', hpFracOf(s) === 1)
  check('a new spirit can fight', canFight(s) && !isDowned(s))

  // The load path must treat a missing field as FULL, not as zero — a spirit built before this
  // feature existed, or by any code path that forgets the field, must not read as downed.
  const legacy = mk()
  delete (legacy as Partial<Spirit>).hpFrac
  check('a spirit with no hpFrac reads as whole', hpFracOf(legacy) === 1)
  check('...and is not downed', !isDowned(legacy))

  const nan = mk(); nan.hpFrac = NaN
  check('NaN reads as whole rather than downed', hpFracOf(nan) === 1)
  const over = mk(); over.hpFrac = 4
  check('an out-of-range fraction clamps to 1', hpFracOf(over) === 1)
  const under = mk(); under.hpFrac = -2
  check('a negative fraction clamps to 0', hpFracOf(under) === 0)
}

// ── the write-back is SCALE-INVARIANT (the point of storing a fraction) ─────
console.log('\nscale invariance')
{
  // Same fight, same relative damage, three different HP_MULT worlds. The stored wound must not
  // move — that is the property that makes a future pacing retune safe.
  const a = mk(), b = mk(), c = mk()
  applyFightResult(a, 90, 180)      // HP_MULT 1.8-ish world
  applyFightResult(b, 120, 240)     // 2.4 world
  applyFightResult(c, 500, 1000)    // an absurd one
  check('half a bar is half a bar at any scale', near(hpFracOf(a), 0.5) && near(hpFracOf(b), 0.5) && near(hpFracOf(c), 0.5),
    `${hpFracOf(a)} / ${hpFracOf(b)} / ${hpFracOf(c)}`)

  // A level-up raises maxHp. The WOUND (the fraction) must survive it untouched, while the
  // absolute HP rises with the bar — storing absolutes would silently deepen the wound instead.
  const s = mk('Grower', 10)
  applyFightResult(s, 50, 100)
  const maxBefore = maxHpOf(s), hpBefore = currentHpOf(s)
  s.level = 30
  const maxAfter = maxHpOf(s), hpAfter = currentHpOf(s)
  check('levelling raises the bar', maxAfter > maxBefore, `${maxBefore} -> ${maxAfter}`)
  check('...and leaves the wound fraction alone', near(hpFracOf(s), 0.5))
  check('...so absolute HP rises with it', hpAfter > hpBefore, `${hpBefore} -> ${hpAfter}`)

  const dead = mk()
  applyFightResult(dead, 0, 240)
  check('a fighter that ended at 0 is downed', isDowned(dead) && !canFight(dead))

  const bad = mk(); bad.hpFrac = 0.7
  applyFightResult(bad, 10, 0)      // malformed fighter
  check('a zero-maxHp fighter is ignored, not written as NaN', near(hpFracOf(bad), 0.7))
}

// ── display ─────────────────────────────────────────────────────────────────
console.log('\ndisplay')
{
  const s = mk()
  s.hpFrac = 0.001
  check('a live spirit never displays as 0 HP', currentHpOf(s) >= 1, `${currentHpOf(s)}`)
  s.hpFrac = 0
  check('a downed spirit displays as 0 HP', currentHpOf(s) === 0)
  s.hpFrac = 1
  check('a whole spirit displays its full bar', currentHpOf(s) === maxHpOf(s))
}

// ── healing ─────────────────────────────────────────────────────────────────
console.log('\nhealing')
{
  const s = mk()
  applyFightResult(s, 50, 200)                    // 25%
  const max = maxHpOf(s)
  const healed = healSpirit(s, max * 0.5)
  check('healing returns the HP it actually restored', near(healed / max, 0.5, 0.02), `${healed}/${max}`)
  check('...and moves the fraction', near(hpFracOf(s), 0.75, 0.02), `${hpFracOf(s)}`)

  const overheal = healSpirit(s, max * 10)
  check('overhealing caps at full', hpFracOf(s) === 1)
  check('...and reports only what it restored', overheal < max * 0.3, `${overheal}`)
  check('healing a full spirit does nothing', healSpirit(s, 50) === 0)

  // A salve must not quietly resurrect: reviving is a separate, deliberate act, or the "downed"
  // state has no teeth at all.
  const down = mk()
  applyFightResult(down, 0, 200)
  check('healing does NOT raise the downed', healSpirit(down, 999) === 0 && isDowned(down))
  check('healSpiritFrac likewise', healSpiritFrac(down, 1) === 0 && isDowned(down))

  check('revive lifts a downed spirit', reviveSpirit(down) && !isDowned(down))
  check('...to the sliver, not to full', near(hpFracOf(down), REVIVE_FRAC), `${hpFracOf(down)}`)
  check('reviving a standing spirit is refused (do not burn the item)', reviveSpirit(down) === false)

  const party = [mk('A'), mk('B')]
  applyFightResult(party[0], 0, 200); applyFightResult(party[1], 40, 200)
  restoreParty(party)
  check('restoreParty makes everyone whole', party.every(p => hpFracOf(p) === 1))
}

// ── mend targeting ──────────────────────────────────────────────────────────
console.log('\nmend targeting')
{
  const a = mk('A'), b = mk('B'), c = mk('C')
  applyFightResult(a, 150, 200)   // 75%
  applyFightResult(b, 60, 200)    // 30%
  check('the most wounded gets the salve', pickMendTarget([a, b, c])?.name === 'B')

  applyFightResult(c, 0, 200)     // downed
  check('a downed spirit outranks the most wounded', pickMendTarget([a, b, c])?.name === 'C')

  restoreParty([a, b, c])
  check('an unhurt party has no target (refuse the drink)', pickMendTarget([a, b, c]) === null)
  check('an empty party has no target', pickMendTarget([]) === null)
}

// ── fielding ────────────────────────────────────────────────────────────────
console.log('\nfielding')
{
  const a = mk('A'), b = mk('B')
  applyFightResult(a, 0, 200)
  check('a downed spirit is not fieldable', fieldableSpirits([a, b]).map(s => s.name).join() === 'B')
  check('a party with one standing is not all-downed', !partyAllDowned([a, b]))
  applyFightResult(b, 0, 200)
  check('a wiped party is all-downed', partyAllDowned([a, b]))
  check('...and has nobody to field', fieldableSpirits([a, b]).length === 0)
  check('an EMPTY party is not "all downed" (different message, different cause)', !partyAllDowned([]))

  // A spirit clinging on at 1% is the player's call to make, not the gate's.
  const sliver = mk('Sliver'); sliver.hpFrac = 0.01
  check('a nearly-dead spirit can still be sent in', canFight(sliver))
}

// ── the trickle: slow enough to matter, generous enough to never dead-end ───
console.log('\ntrickle recovery')
{
  const s = mk()
  applyFightResult(s, 100, 200)   // 50%
  tickRecovery([s], 60)
  check('a wounded spirit recovers on the clock', near(hpFracOf(s), 0.5 + REGEN_FRAC_PER_MIN), `${hpFracOf(s)}`)

  tickRecovery([s], 0); tickRecovery([s], -5)
  check('a zero/negative dt is a no-op', near(hpFracOf(s), 0.5 + REGEN_FRAC_PER_MIN))

  const full = mk(); tickRecovery([full], 600)
  check('a whole spirit stays at exactly 1', hpFracOf(full) === 1)

  // The trickle must be the SLOW path or the potion economy is pointless. A full bar should cost
  // the better part of an hour of walking; if someone raises this dial past ~10%/min, brewing
  // stops being worth doing and this assert is the thing that says so.
  const minsToFull = 1 / REGEN_FRAC_PER_MIN
  check('a full bar takes tens of minutes to trickle back', minsToFull >= 30, `${minsToFull.toFixed(0)} min`)

  // A downed spirit does NOT get up for free while the party still has legs.
  const down = mk('Down'), up = mk('Up')
  applyFightResult(down, 0, 200); applyFightResult(up, 100, 200)
  tickRecovery([down, up], 600)
  check('a downed spirit stays down while an ally stands', isDowned(down))
  check('...while its ally recovers normally', hpFracOf(up) > 0.5)

  // ★ THE ANTI-DEAD-END CARVE-OUT. Broke, no ingredients, whole party on the floor: the save has
  // to be able to climb out. If this assert ever fails, the game can be made unwinnable.
  const wiped = [mk('Lead'), mk('Second'), mk('Third')]
  for (const w of wiped) applyFightResult(w, 0, 200)
  tickRecovery(wiped, 60)
  check('a wiped party starts recovering its lead', hpFracOf(wiped[0]) > 0, `${hpFracOf(wiped[0])}`)
  check('...on the valve clock, not the trickle clock', near(hpFracOf(wiped[0]), WIPE_REVIVE_FRAC_PER_MIN), `${hpFracOf(wiped[0])}`)

  // The valve must not be a multiple of the ordinary trickle: "wounds heal ONLY with potions"
  // (REGEN_FRAC_PER_MIN = 0) has to stay a configuration that cannot brick a save.
  check('the valve is independent and non-zero', WIPE_REVIVE_FRAC_PER_MIN > 0)

  // Walk out the clock. Exactly ONE spirit comes back for free — the rest are a resource problem.
  tickRecovery(wiped, 60 * 600)
  check('...the lead ends up standing', !isDowned(wiped[0]) && hpFracOf(wiped[0]) >= REVIVE_FRAC, `${hpFracOf(wiped[0])}`)
  check('...the rest of the party stays down, however long you walk', isDowned(wiped[1]) && isDowned(wiped[2]))
  check('...so exactly one spirit is fieldable', fieldableSpirits(wiped).length === 1)

  // The valve itself never lifts anyone past the sliver — anything above that came from the
  // ordinary trickle, which only runs because the lead is standing again.
  const wiped2 = [mk('Lead2'), mk('Second2')]
  for (const w of wiped2) applyFightResult(w, 0, 200)
  const steps = 40
  for (let i = 0; i < steps; i++) tickRecovery(wiped2, 30)   // half-minute steps, ~20 min
  check('the free comeback lands at a sliver, not a full bar', hpFracOf(wiped2[0]) < 0.5, `${hpFracOf(wiped2[0])}`)

  tickRecovery([], 60)   // must not throw
  check('an empty party is a no-op', true)
}

// ── the save contract (a dropped field = a silent free heal) ────────────────
console.log('\nsave round-trip')
{
  const party = [mk('A'), mk('B'), mk('C')]
  applyFightResult(party[0], 73, 200)
  applyFightResult(party[1], 0, 200)
  const before = party.map(hpFracOf)

  const loaded = spiritsFromSave(spiritsToSave(party))
  check('wounds survive a save round-trip', loaded.every((s, i) => near(hpFracOf(s), before[i])),
    `${before.join(',')} -> ${loaded.map(hpFracOf).join(',')}`)
  check('a downed spirit is still downed after loading', isDowned(loaded[1]))
  check('an untouched spirit is still whole', hpFracOf(loaded[2]) === 1)

  // The update that ships this must not wound anyone's existing team.
  const old = spiritsToSave(party).map(s => { const c = { ...s }; delete c.hpFrac; return c })
  const migrated = spiritsFromSave(old)
  check('a pre-wound save loads at FULL health', migrated.every(s => hpFracOf(s) === 1))

  // Anything that lands in the JSON out of range must not become a permanently-dead spirit.
  const corrupt = spiritsToSave(party); corrupt[0].hpFrac = 7; corrupt[1].hpFrac = -3
  const fixed = spiritsFromSave(corrupt)
  check('an out-of-range saved fraction clamps on load', hpFracOf(fixed[0]) === 1 && hpFracOf(fixed[1]) === 0)
}

// ── active vs resting: the seam the spirit bank rests on ────────────────────
console.log('\nroster — active vs resting')
{
  const owned = [mk('A'), mk('B'), mk('C')]
  check('a spirit with no inParty flag counts as active', activeSpirits(owned).length === 3)
  check('...and nothing is resting', restingSpirits(owned).length === 0)

  owned[2].inParty = false
  check('an explicitly rested spirit leaves the active list', activeSpirits(owned).map(s => s.name).join() === 'A,B')
  check('...and appears in the resting list', restingSpirits(owned).map(s => s.name).join() === 'C')

  // The cap has to bind on the ROSTER, not just at fight time — a fifth spirit that is owned but
  // permanently unfieldable, with nothing saying why, is the bug this replaces.
  const full = [mk('1'), mk('2'), mk('3'), mk('4'), mk('5')]
  full[4].inParty = false
  check('calling one back into a full party is refused', setSpiritActive(full, full[4], true, 4) === 'Your party is full')
  check('...and the spirit stays resting', full[4].inParty === false)

  check('resting one from a full party works', setSpiritActive(full, full[0], false, 4) === null && full[0].inParty === false)
  check('...which frees the slot', setSpiritActive(full, full[4], true, 4) === null && full[4].inParty !== false)

  // Emptying the lineup entirely is legal as a state but a trap as an action: every encounter would
  // silently refuse the player with no explanation.
  const solo = [mk('Only')]
  check('you cannot rest your last active spirit', setSpiritActive(solo, solo[0], false, 4) === 'Keep at least one spirit with you')
  check('...and it stays active', solo[0].inParty !== false)

  check('a no-op move is not an error', setSpiritActive(owned, owned[0], true, 4) === null)

  // Legacy saves: everyone loaded active, however many there were.
  const legacy = [mk('a'), mk('b'), mk('c'), mk('d'), mk('e'), mk('f')]
  normalizeRoster(legacy, 4)
  check('a legacy roster is capped to the party size', activeSpirits(legacy).length === 4)
  check('...keeping the first four in order', activeSpirits(legacy).map(s => s.name).join() === 'a,b,c,d')
  check('...and resting the overflow', restingSpirits(legacy).map(s => s.name).join() === 'e,f')
  normalizeRoster(legacy, 4)
  check('normalising twice changes nothing', activeSpirits(legacy).length === 4)
}

// ── resting recovers faster, and the valve knows the difference ─────────────
console.log('\nrest recovery')
{
  const active = mk('Out'), resting = mk('Home')
  active.hpFrac = 0.5; resting.hpFrac = 0.5; resting.inParty = false
  tickRecovery([active, resting], 60)
  check('a resting spirit mends faster than one in the field',
    hpFracOf(resting) > hpFracOf(active), `${hpFracOf(resting)} vs ${hpFracOf(active)}`)
  check('...by exactly the rest multiplier',
    near(hpFracOf(resting) - 0.5, (hpFracOf(active) - 0.5) * REST_REGEN_MULT, 1e-9))

  // ★ The valve must NOT fire while a healthy spirit sits on the bench — there is no dead end to
  // rescue anyone from, and firing would hand a free revive out after every ordinary hard fight.
  const benchHealthy = [mk('Front'), mk('Bench')]
  applyFightResult(benchHealthy[0], 0, 200)      // active party wiped
  benchHealthy[1].inParty = false                // but a fresh spirit is resting at home
  tickRecovery(benchHealthy, 60 * 60)
  check('a wiped party with a healthy reserve gets NO free revive', isDowned(benchHealthy[0]))
  check('...because swapping the reserve in was always available', !isDowned(benchHealthy[1]))

  // Genuinely stranded: everything you own is down. Now it fires.
  const allDown = [mk('Front2'), mk('Bench2')]
  allDown[1].inParty = false
  for (const s of allDown) applyFightResult(s, 0, 200)
  tickRecovery(allDown, 60)
  check('with EVERY spirit down the valve fires', hpFracOf(allDown[0]) > 0, `${hpFracOf(allDown[0])}`)
  check('...on the active lead, not the resting one', isDowned(allDown[1]))

  // The re-introduction trap: the gate must not be `every(isDowned)`, which goes false the instant
  // the lead ticks off zero — that would strand the lead at a hair above nothing forever, since the
  // ordinary trickle skips the downed and the valve would have switched itself off. Walk the clock.
  for (let i = 0; i < 60; i++) tickRecovery(allDown, 60)
  check('...and lifts it clear of the sliver rather than stalling at a hair',
    hpFracOf(allDown[0]) >= REVIVE_FRAC, `${hpFracOf(allDown[0])}`)
  check('...while the resting one stays down — exactly ONE free comeback', isDowned(allDown[1]))
  check('...so the player has a spirit to field again', fieldableSpirits(activeSpirits(allDown)).length === 1)
}

// ── the actual seam: a wound has to survive the trip through a real arena ──────
console.log('\narena integration')
{
  const hurt = mk('Hurt'), whole = mk('Whole')
  hurt.hpFrac = 0.5

  const st = createArena({ allies: [hurt, whole], enemies: [mk('Foe')], seed: 1234 })
  const [fa, fb] = st.fighters.filter(f => f.side === 'ally')
  check('a wounded spirit enters the ring at half a bar', near(fa.hp / fa.maxHp, 0.5, 0.01), `${fa.hp}/${fa.maxHp}`)
  check('a whole one enters full', fb.hp === fb.maxHp)
  check('...and the arena scale is applied on top', fa.maxHp > maxHpOf(hurt), `${fa.maxHp} vs ${maxHpOf(hurt)}`)

  // A downed spirit should never reach the ring, but if the gate upstream ever leaks it must not
  // spawn dead — an instant unexplained loss is far harder to diagnose than a 1 HP sliver.
  const down = mk('Down'); down.hpFrac = 0
  const st2 = createArena({ allies: [down], enemies: [mk('Foe')], seed: 7 })
  check('a leaked downed spirit spawns at a sliver, not dead', st2.fighters[0].hp >= 1)

  // The result must come back indexed to the party slots it came from, or the write-back lands
  // the wrong wound on the wrong spirit.
  const res = battleResult(st)
  check('the result carries one row per ally', res.allies.length === 2)
  check('...indexed to party slots in order', res.allies.map(r => r.index).join() === '0,1')
  check('...and no salves were spent', res.bagUsed === 0)

  // Round-trip: what the arena reports, written back, reproduces the wound it started with.
  applyFightResult(hurt, res.allies[0].hp, res.allies[0].maxHp)
  check('an untouched fight leaves the wound exactly as it was', near(hpFracOf(hurt), 0.5, 0.01), `${hpFracOf(hurt)}`)

  // BAG is a real resource now: unspecified charges = the feel harness, which must stay unlimited
  // so oracle balance never shifts because a test party happened to be carrying potions.
  check('an unspecified bag is unlimited (harness/oracles unaffected)', st.keeper.bagCharges === Infinity)
  const st3 = createArena({ allies: [mk('A')], enemies: [mk('B')], seed: 3, bagCharges: 2 })
  check('a real satchel is finite', st3.keeper.bagCharges === 2 && st3.keeper.bagUsed === 0)
}

// ── ★★★ ONE CAP, AND EVERY WORLD THAT GROWS A PARTY MUST LAND IN A LEGAL SHAPE ────────────────
// Structural, and it reads SOURCE, because the defect it exists to catch is an ABSENCE and no
// amount of exercising the helpers can see one. Measured by the world lane 2026-08-27: `MAX_PARTY`
// appeared nowhere in `voxel3d`, `potOps.gain` appended to the party unbounded, and `inParty` was
// never written there at all — so `restingSpirits()` returned `[]` forever, the grimoire's whole
// "in garden" section was permanently empty beneath a header quoting the ruling it could not show,
// and the Home Plot spirit ring had no population to draw. Every helper below it was written,
// tested, and had zero callers in that world. **The functions were finished and stopped one call
// short**, which is the fifth instance of that shape in this codebase in a week.
//
// ⚠ WHAT THE CHEAPEST WRONG ANSWER WOULD BE, since that is the question to ask of any guard: a
// grep for the token `MAX_PARTY` is satisfied by a COMMENT mentioning it. So this asserts the
// declaration is unique in the tree (no world may re-privatise its own copy — that is exactly how
// the number got stranded in `Shimmer3D.tsx`), and that each world both imports it and calls
// `normalizeRoster`. A party-sized literal is checked separately because `slice(0, 4)` in
// `voxel3d`'s spar roster was a third copy of the same fact wearing no name at all.
{
  const src = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8')
  const WORLDS = ['voxel3d/VoxelWorld.tsx', 'play3d/Shimmer3D.tsx']

  const decl = WORLDS.map(src).concat(src('engine/spirit-health.ts'))
    .join('\n').match(/^\s*(?:export\s+)?const MAX_PARTY\b/gm) ?? []
  check(`MAX_PARTY is declared exactly once across the engine and both worlds (found ${decl.length})`,
    decl.length === 1, decl.join(' | '))

  for (const f of WORLDS) {
    const t = src(f)
    check(`${f} imports MAX_PARTY from the engine rather than restating it`,
      /import\s*\{[^}]*\bMAX_PARTY\b[^}]*\}\s*from\s*['"][^'"]*spirit-health['"]/.test(t))
    check(`${f} normalises its roster — a world that grows a party without this has no cap at all`,
      /\bnormalizeRoster\s*\(/.test(t))
    // A bare party-sized literal is the shape the name exists to retire. Narrow on purpose: only
    // slices/caps taken against a party, not every 4 in a nine-thousand-line file.
    const bare = t.match(/\b(?:party|owned|roster|spirits)[^\n]{0,60}\.slice\(\s*0\s*,\s*\d+\s*\)/g) ?? []
    check(`${f} caps a party by name, not by a literal (${bare.length} bare)`, bare.length === 0, bare.join(' | '))
  }

  // And the value itself still has to be a value the helpers can honour.
  check('MAX_PARTY is a positive whole number', Number.isInteger(MAX_PARTY) && MAX_PARTY > 0, `${MAX_PARTY}`)
}

console.log(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} failing`}\n`)
process.exit(failures === 0 ? 0 : 1)
