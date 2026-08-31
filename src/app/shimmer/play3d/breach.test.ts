// ── The bore — headless oracle ─────────────────────────────────────────────────────────────────
// Run: npx tsx src/app/shimmer/play3d/breach.test.ts
//
// Canon packs four claims into one sentence (`moves.md:82`) and each is a rule that can be lost
// without anything looking broken:
//   HELD          — seconds come from a channel that was paid for, never from wall-clock
//   ONE SPOT      — moving the aim resets, or patience stops being the cost
//   SLOW          — a bore is slower than the right tool, or "patient" is decorative
//   NOTHING REFUSES IT — the TOOL gates do not apply; the material gate still does

import { blockDef, breakSeconds } from '../voxel/registry'
import { MAT } from '../voxel/depth'
import { BORE_PATIENCE, boreSeconds, isBorable, freshBore, boreStep, sameSpot, type Bore } from './breach'
import { beginSustain, sustainStep } from './sustain'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps
const SPOT = { x: 4, y: 130, z: -7 }
const OTHER = { x: 5, y: 130, z: -7 }

/** A gated block: needs a tool family AND a tier, so all three refusal reasons are reachable. */
const GATED = MAT.STONE
const gatedDef = blockDef(GATED)

// ── 1. ★★★ nothing refuses it — the TOOL gates do not apply ────────────────────────────────────
{
  chk('fixture: the test block is genuinely tool-gated, or section 1 is vacuous',
    !!gatedDef && gatedDef.skill !== null && gatedDef.minTier > 0,
    `skill ${gatedDef?.skill} minTier ${gatedDef?.minTier}`)

  chk('a keeper with the WRONG tool family is refused by mining',
    breakSeconds(GATED, 9, null) === Infinity)
  chk('★★★ ...and the bore is not — it has no family to mismatch',
    isBorable(GATED) && boreSeconds(GATED) !== Infinity)

  chk('a tool BELOW the minimum tier is refused by mining — "refused, not slowed"',
    !!gatedDef && breakSeconds(GATED, 0, gatedDef.skill) === Infinity)
  chk('★★★ ...and the bore is not — it has no tier to fall short of',
    boreSeconds(GATED) !== Infinity)

  // ⚠ The one gate that DOES apply, and it is not a refusal — it is the world saying "not matter".
  chk('★★ water is absolute for mining', breakSeconds(MAT.WATER, 9, null) === Infinity)
  chk('★★ ...and absolute for the bore too — hardness Infinity is about the MATERIAL, not the asker',
    !isBorable(MAT.WATER))
  chk('conjured matter is absolute, so a Stonewall answers a bore', !isBorable(MAT.CONJURED))
  chk('an unknown material fails closed rather than boring a mystery', !isBorable(-999))
}

// ── 2. SLOW — patience has to cost something ───────────────────────────────────────────────────
{
  chk('★ a bore is SLOWER than a bare tier-1 tool on the same block',
    !!gatedDef && boreSeconds(GATED) > gatedDef.hardness, `${boreSeconds(GATED)} vs ${gatedDef?.hardness}`)
  chk('...by exactly the declared patience',
    !!gatedDef && near(boreSeconds(GATED), gatedDef.hardness * BORE_PATIENCE))
  chk('★ ...and slower than the RIGHT tool at the right tier, which is the trade',
    !!gatedDef && boreSeconds(GATED) > breakSeconds(GATED, gatedDef.minTier, gatedDef.skill),
    `bore ${boreSeconds(GATED)} vs pick ${gatedDef && breakSeconds(GATED, gatedDef.minTier, gatedDef.skill)}`)
  chk('patience is above 1, or "slow" is decorative', BORE_PATIENCE > 1)
  // ⚠ NO `!` HERE. A non-null assertion on a missing row THROWS, and a crash is neither a pass nor
  // a fail — it is the 2026-08-22 origin-fixture bug, which buried the sanity assert one line above
  // it. `MAT.DIRT` does not exist in this world (the soil is SUBSOIL) and the first draft of this
  // line found that out by crashing rather than by going red. Look the rows up, then assert.
  const soft = blockDef(MAT.SUBSOIL), hard = blockDef(MAT.STONE)
  chk('fixture: both comparison rows exist, or the hardness assert below is a crash waiting',
    !!soft && !!hard, `subsoil ${!!soft} stone ${!!hard}`)
  chk('a harder block takes a bore longer — it reads the same hardness mining does',
    !soft || !hard || (hard.hardness > soft.hardness) === (boreSeconds(MAT.STONE) > boreSeconds(MAT.SUBSOIL)),
    `stone h${hard?.hardness} bore ${boreSeconds(MAT.STONE)} | subsoil h${soft?.hardness} bore ${boreSeconds(MAT.SUBSOIL)}`)
}

// ── 3. ★★ ONE SPOT ─────────────────────────────────────────────────────────────────────────────
{
  const need = boreSeconds(GATED)
  let b: Bore = freshBore()
  b = boreStep(b, SPOT, GATED, need * 0.6).bore
  chk('a bore accumulates on the spot it is held against', b.spent > 0 && sameSpot(b.at, SPOT))

  const moved = boreStep(b, OTHER, GATED, 0)
  chk('★★ aiming at a different voxel RESETS the progress — canon\'s "one spot"',
    moved.bore.spent === 0 && sameSpot(moved.bore.at, OTHER))
  chk('...so a swept reticle cannot collapse a wall on time that belonged to no block',
    boreStep(boreStep(b, OTHER, GATED, need * 0.6).bore, SPOT, GATED, 0).bore.spent === 0)

  const kept = boreStep(b, SPOT, GATED, 0)
  chk('...while holding the SAME spot keeps every second already paid for',
    near(kept.bore.spent, b.spent))

  chk('losing the aim entirely goes idle and drops the progress',
    boreStep(b, null, GATED, 1).state === 'idle' && boreStep(b, null, GATED, 1).bore.spent === 0)
}

// ── 4. breaking through, and the honest readout ────────────────────────────────────────────────
{
  const need = boreSeconds(GATED)
  chk('a bore short of the cost has not broken through',
    boreStep(freshBore(), SPOT, GATED, need - 0.001).state === 'boring')
  chk('★ reaching the cost breaks the spot', boreStep(freshBore(), SPOT, GATED, need).state === 'broke')
  chk('...and overshooting still breaks it exactly once',
    boreStep(freshBore(), SPOT, GATED, need * 5).state === 'broke')
  chk('a broken bore resets, so the next frame starts a new spot',
    boreStep(freshBore(), SPOT, GATED, need).bore.at === null)

  chk('progress reads 0..1 while boring',
    near(boreStep(freshBore(), SPOT, GATED, need / 2).progress, 0.5))
  chk('★★ an ABSOLUTE block is named, not silently stalled — the keeper must be told',
    boreStep(freshBore(), SPOT, MAT.WATER, 99).state === 'absolute')
  chk('★★ ...and its progress stays 0 — never a bar filling toward something unreachable',
    boreStep(freshBore(), SPOT, MAT.WATER, 99).progress === 0 &&
    boreStep(freshBore(), SPOT, MAT.WATER, 99).bore.spent === 0)
  chk('...and holding it longer still gets nowhere',
    boreStep(boreStep(freshBore(), SPOT, MAT.WATER, 99).bore, SPOT, MAT.WATER, 99).bore.spent === 0)

  chk('negative credit cannot rewind a bore',
    near(boreStep({ at: SPOT, spent: 2 }, SPOT, GATED, -5).bore.spent, 2))
}

// ── 5. ★★★ the chain has no free step: mana → seconds → hardness ───────────────────────────────
{
  // Drive the bore the way a host must — through the channel, not with hand-made numbers.
  const DRAIN = 4
  const need = boreSeconds(GATED)
  const run = (pool: number) => {
    let s = beginSustain(0, 'meltbore'), b = freshBore(), mana = pool, broke = false
    for (let i = 0; i < 20000 && !broke; i++) {
      const step = sustainStep(s, 0.05, mana, DRAIN)
      if (step.ended === 'dry' && step.credited === 0) break
      s = step.sustain; mana -= step.manaSpent
      const bs = boreStep(b, SPOT, GATED, step.credited)
      b = bs.bore; broke = bs.state === 'broke'
      if (step.ended) break
    }
    return { broke, held: s.held }
  }
  const rich = run(need * DRAIN + 10)
  const poor = run(need * DRAIN * 0.5)
  chk('★★★ a keeper who can pay for the whole channel breaks through', rich.broke)
  chk('★★★ ...and one who runs dry halfway does NOT — an empty pool bores nothing free',
    !poor.broke, `held ${poor.held} of ${need}`)
  chk('the dry keeper still got exactly the channel they paid for',
    near(poor.held, need * 0.5), `${poor.held} vs ${need * 0.5}`)
}

console.log(`\nbreach oracle: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
