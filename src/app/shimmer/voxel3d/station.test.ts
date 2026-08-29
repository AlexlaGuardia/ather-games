// The workstation pattern's oracle. Run: npx tsx src/app/shimmer/voxel3d/station.test.ts
//
// ★ WHAT THIS GUARDS THAT `brew.test.ts` CANNOT. That file asks whether the CAULDRON behaves; this
// one asks whether the PATTERN does — the refusal order, the cost-position rule that the cauldron
// has no way to exercise, and the registry. The cauldron is one station, so every claim about
// "stations in general" is untested by it BY CONSTRUCTION: a single instance cannot disagree with
// itself. That is the same blind spot the doors pass found (every openable piece was 1x1, so the
// mutation that used the wrong rotation passed all 63 checks), and the answer is the same — a
// SYNTHETIC def for the shape nothing has added yet.

import { createHash } from 'node:crypto'
import { stationBlocker, absentAt, type StationDef, type StationRecipe } from './station'
import { CAULDRON, brewBlocker } from './brew'
import { STATIONS, stationFor } from './station-registry'
import { POTION_DEFS } from '../engine/alchemy'
import { blockDef } from '../voxel/registry'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) { if (cond) pass++; else fails.push(label) }

// ── 1. ★★★ THE EXTRACTION HASH — the cauldron's behaviour must not have moved ─────────────────
// `brewBlocker`'s ladder was lifted into `stationBlocker` on 2026-08-29. This pins the ANSWER over an
// exhaustive grid rather than a summary of it. ⚠ The 08-27 jigsaw extraction is why it is a hash: a
// size HISTOGRAM there was identical across a deliberately corrupted salt that changed every ruin in
// the world — a summary statistic that survives the change it exists to detect. Only a hash carries
// the claim. The histogram is printed below purely so a reader can see the grid reaches every branch.
{
  const defs = Object.values(POTION_DEFS).sort((a, b) => a.id.localeCompare(b.id))
  const rows: string[] = []
  const tally: Record<string, number> = {}
  for (const d of defs)
    for (const level of [0, 1, 5, 7, 10, 20, 99])
      for (const mana of [0, 1, d.manaCost - 1, d.manaCost, 999])
        for (const worldMode of [0, 1, 2, 3])
          // ⚠ `have` AND `room` ARE INDEPENDENT AXES. Coupled — the obvious way to write this — an
          // empty bag trips `inputs` first and `room` CAN NEVER FIRE, so the branch most likely to
          // break in an extraction goes unmeasured. The first version of this grid had that bug and
          // its histogram had no `room` row at all, which is what gave it away.
          for (const bag of [0, 1, 2]) for (const roomN of [0, 1, 99]) {
            const inWorld = (i: string) =>
              worldMode === 0 ? false : worldMode === 1 ? true
              : worldMode === 2 ? i === d.recipe[0]?.itemId
              : i !== d.recipe[d.recipe.length - 1]?.itemId
            const have = () => (bag === 0 ? 0 : bag === 1 ? 1 : 99)
            const room = () => roomN
            // ⚠ HASHES `brewBlocker`, NOT `stationBlocker`, AND THE DIFFERENCE IS THE POINT. The
            // baseline was recorded from the PRE-extraction cauldron, whose vocabulary is alchemy's
            // ('ingredients', 'mana'). The generic ladder answers 'inputs' and 'power' — the same
            // behaviour in different words, which hashes differently and would prove nothing about
            // whether the cauldron moved. Compare like with like: pin the function the panel calls.
            const b = brewBlocker(d, level, mana, have, inWorld, room)
            tally[b] = (tally[b] ?? 0) + 1
            rows.push(`${d.id}|${level}|${mana}|${worldMode}|${bag}|${roomN}=${b}`)
          }
  const hash = createHash('sha256').update(rows.join('\n')).digest('hex').slice(0, 20)
  ok(rows.length === 21420, `the grid is the one that was hashed — ${rows.length} rows`)
  ok(Object.keys(tally).length === 6,
    `★ every branch fires, so the hash is a claim about all six — got ${JSON.stringify(tally)}`)
  ok(hash === '4d76b0843ef8bcc7b731',
    `★★★ the cauldron answers exactly as it did before the ladder moved out — hash ${hash}`)
}

// ── 2. ★★ THE COST POSITION — the rule the cauldron cannot test ───────────────────────────────
// A `replenishing` cost is checked LAST because waiting fixes it. A `consumed` cost must be checked
// WITH the inputs, because waiting does not. The cauldron is the only real station and it is
// replenishing, so nothing in the world exercises the other arm. Synthetic def, per the header.
{
  const recipe: StationRecipe = {
    id: 'test_out', inputs: [{ itemId: 'plank', count: 1 }],
    outputId: 'test_out', outputCount: 1, minLevel: 0, power: 5,
  }
  const mk = (cost: 'replenishing' | 'consumed' | 'none'): StationDef<StationRecipe> => ({
    id: 'synthetic', material: -1, name: 'Synthetic', verb: 'Make', cost,
    menu: () => [recipe], toRecipe: r => r,
  })
  const plenty = () => 99, none = () => 0, yes = () => true

  // The state that separates them: everything present, the bag FULL, and the cost short.
  const burn = stationBlocker(mk('consumed'), recipe, 0, 0, plenty, yes, none)
  const pool = stationBlocker(mk('replenishing'), recipe, 0, 0, plenty, yes, none)
  ok(burn === 'inputs',
    `★★ a consumed cost is an input — short fuel reads as 'inputs', not 'power' (got ${burn})`)
  ok(pool === 'room',
    `★★ a replenishing cost is checked AFTER room, so a full bag outranks it (got ${pool})`)

  // And with room available, the replenishing one finally reports the pool.
  const poolOk = stationBlocker(mk('replenishing'), recipe, 0, 0, plenty, yes, plenty)
  ok(poolOk === 'power', `a replenishing station reports 'power' once the bag has room (got ${poolOk})`)
  // `none` ignores the pool entirely — a station with no cost can run on an empty one.
  ok(stationBlocker(mk('none'), recipe, 0, 0, plenty, yes, plenty) === 'ok',
    'a costless station runs with an empty pool')
}

// ── 3. the refusal ORDER, which is the pattern's whole argument ───────────────────────────────
{
  const recipe: StationRecipe = {
    id: 'o', inputs: [{ itemId: 'ghost', count: 1 }],
    outputId: 'o', outputCount: 1, minLevel: 50, power: 1,
  }
  const st: StationDef<StationRecipe> = {
    id: 's', material: -2, name: 'S', verb: 'V', cost: 'replenishing',
    menu: () => [recipe], toRecipe: r => r,
  }
  // ★ THE ONE THE CAULDRON PAID FOR: an input this world does not contain outranks the skill gate,
  // because "reach level 50" is a promise the world cannot keep when the herb does not grow here.
  ok(stationBlocker(st, recipe, 0, 0, () => 0, () => false, () => 0) === 'absent',
    '★★ absent outranks level — a refusal still true after you fix it is said first')
  ok(stationBlocker(st, recipe, 0, 0, () => 0, () => true, () => 0) === 'level',
    'level outranks inputs — no point listing what to gather for a locked recipe')
  ok(stationBlocker(st, recipe, 99, 0, () => 0, () => true, () => 0) === 'inputs',
    'inputs outrank room — you are told what to gather before where to put it')
  ok(absentAt(st, recipe, () => false).join() === 'ghost',
    'absentAt NAMES the missing input rather than reporting a count')
}

// ── 3b. ★★★ THE THRESHOLD ITSELF — the case the hash grid CANNOT see ──────────────────────────
// Found by mutation, not by design: flipping `have < count` to `have < count + 1` passed all
// eighteen asserts, including the 21,420-row hash. The grid supplies only 0, 1 or 99 of an item, so
// it never stands EXACTLY at a recipe's requirement — and an off-by-one is only visible there.
// ⚠ A big grid is not a fine one. Coverage of many states is not coverage of the boundary between
// two, and the hash's size is exactly what makes it feel like it must have checked this.
{
  const need = 3
  const recipe: StationRecipe = {
    id: 'thr', inputs: [{ itemId: 'herb', count: need }],
    outputId: 'thr', outputCount: 1, minLevel: 0, power: 0,
  }
  const st: StationDef<StationRecipe> = {
    id: 'thr', material: -3, name: 'T', verb: 'V', cost: 'none',
    menu: () => [recipe], toRecipe: r => r,
  }
  const at = (n: number) => stationBlocker(st, recipe, 0, 0, () => n, () => true, () => 99)
  ok(at(need - 1) === 'inputs', `★ one short of ${need} refuses`)
  ok(at(need) === 'ok', `★★ EXACTLY ${need} is enough — the off-by-one the hash could not see`)
  ok(at(need + 1) === 'ok', 'a surplus is fine')

  // The same boundary on the OUTPUT side, for the same reason.
  const wide: StationRecipe = { ...recipe, outputCount: 2 }
  const roomAt = (n: number) => stationBlocker(st, wide, 0, 0, () => 99, () => true, () => n)
  ok(roomAt(1) === 'room', 'room for 1 refuses a 2-output run')
  ok(roomAt(2) === 'ok', '★★ room for exactly the output count is enough')
}

// ── 4. the registry ───────────────────────────────────────────────────────────────────────────
{
  ok(STATIONS.length >= 1, `the registry is not empty — ${STATIONS.length} station(s)`)
  const mats = STATIONS.map(s => s.material)
  ok(new Set(mats).size === mats.length,
    '★ no two stations share a material — a collision makes one unreachable in silence')
  for (const s of STATIONS) {
    ok(!!blockDef(s.material),
      `★ ${s.id} sits on a real block (material ${s.material}) — a station on a phantom material is a station nobody can reach`)
    ok(s.name.trim().length > 0, `${s.id} has a name`)
    // ⚠ THE MENU IS CANON'S, NOT A FILTERED ONE. The cauldron's header argues this: showing only what
    // a keeper can currently make would quietly delete the Infusions from the skill's own shelf.
    ok(s.menu(99).length > 0, `${s.id}'s menu lists something at a high level`)
  }
  ok(stationFor(CAULDRON.material)?.id === 'cauldron', 'stationFor finds the cauldron by its material')
  ok(stationFor(-999) === null, 'an ordinary block is not a station')
}

console.log(`station: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
