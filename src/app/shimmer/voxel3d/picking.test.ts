/**
 * ── PICKING A WILD BUSH: THE FRUIT COMES OFF, THE PLANT STAYS, IT FRUITS AGAIN TOMORROW ───────
 * Run: npx tsx src/app/shimmer/voxel3d/picking.test.ts
 * ⚠ PLAIN `tsx`, NOT vitest — vitest is not a dependency here and the sweep runs `npx tsx`.
 */
import {
  REGROW_MS, PICK_YIELD, bushKey, isFruitBush, isFruited, regrowLeft, pickBlocker, pickBush,
  pruneRegrown, pickRefusalLine, pickedToSave, pickedFromSave, type PickedBushes,
} from './picking'
import { MAT } from '../voxel/depth'
import { blockDef } from '../voxel/registry'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const T0 = 1_700_000_000_000
const fresh = (): PickedBushes => new Map()

// ── 1. an untouched bush is fruited, and costs nothing ────────────────────────────────────────
{
  const p = fresh()
  ok(isFruited(p, 'wilds', 5, 40, 7, T0), 'a bush nobody touched is not fruited')
  ok(p.size === 0, 'merely ASKING about a bush wrote a record — the store must stay empty until a pick')
  ok(regrowLeft(p, 'wilds', 5, 40, 7, T0) === 0, 'an untouched bush reports regrow time left')
}

// ── 2. picking yields, leaves a record, and empties the bush ──────────────────────────────────
{
  const p = fresh()
  const got = pickBush(p, MAT.SUNFRUIT_BUSH, 'wilds', 5, 40, 7, T0)
  ok(got !== null && got.itemId === 'sunfruit' && got.count === PICK_YIELD, 'picking a sunfruit bush did not yield sunfruit')
  ok(!isFruited(p, 'wilds', 5, 40, 7, T0), 'a just-picked bush still reads as fruited')
  ok(pickBush(p, MAT.SUNFRUIT_BUSH, 'wilds', 5, 40, 7, T0) === null, 'a picked bush could be picked twice')
  const moon = pickBush(fresh(), MAT.MOONBERRY_BUSH, 'wilds', 1, 2, 3, T0)
  ok(moon !== null && moon.itemId === 'moonberry', 'picking a moonberry bush did not yield moonberry')
}

// ── 3. ★ IT FRUITS AGAIN, AND THE BOUNDARY IS CHECKED FROM BOTH SIDES ─────────────────────────
// A window checked only from one side is satisfied by any larger number, which makes it a comment.
{
  const p = fresh()
  pickBush(p, MAT.SUNFRUIT_BUSH, 'wilds', 5, 40, 7, T0)
  ok(!isFruited(p, 'wilds', 5, 40, 7, T0 + REGROW_MS - 1), 'the bush fruited a millisecond EARLY')
  ok(isFruited(p, 'wilds', 5, 40, 7, T0 + REGROW_MS), 'the bush had not fruited at exactly REGROW_MS')
  ok(regrowLeft(p, 'wilds', 5, 40, 7, T0 + REGROW_MS / 2) === REGROW_MS / 2, 'regrowLeft is not the remaining half')
}

// ── 4. ★★ THE STORE IS SELF-LIMITING — the property the whole design rests on ─────────────────
{
  const p = fresh()
  for (let i = 0; i < 500; i++) pickBush(p, MAT.SUNFRUIT_BUSH, 'wilds', i, 40, 7, T0)
  ok(p.size === 500, 'picks were not recorded')
  ok(pruneRegrown(p, T0 + 1) === 0 && p.size === 500, 'prune dropped bushes that had NOT regrown')
  ok(pruneRegrown(p, T0 + REGROW_MS) === 500 && p.size === 0,
    'a regrown record survived the prune — this is the one structure here that could grow unbounded')
}

// ── 5. spaces do not collide ──────────────────────────────────────────────────────────────────
// `save.ts` records what this prevents: plot (0,0) and Wilds (0,0) are different places.
{
  const p = fresh()
  pickBush(p, MAT.SUNFRUIT_BUSH, 'wilds', 0, 0, 0, T0)
  ok(!isFruited(p, 'wilds', 0, 0, 0, T0), 'the wilds bush is not picked')
  ok(isFruited(p, 'plot', 0, 0, 0, T0), 'picking a WILDS bush also emptied the PLOT bush at the same numbers')
  ok(bushKey('wilds', 0, 0, 0) !== bushKey('plot', 0, 0, 0), 'the two spaces share a key')
}

// ── 6. only a fruit bush is pickable ──────────────────────────────────────────────────────────
{
  const p = fresh()
  ok(isFruitBush(MAT.SUNFRUIT_BUSH) && isFruitBush(MAT.MOONBERRY_BUSH), 'a fruit bush is not a fruit bush')
  ok(!isFruitBush(MAT.TOPSOIL) && !isFruitBush(MAT.AIR), 'ground reads as a fruit bush')
  ok(pickBlocker(p, MAT.TOPSOIL, 'wilds', 1, 1, 1, T0) === 'not-a-bush', 'ground did not refuse the pick')
  ok(pickBush(p, MAT.TOPSOIL, 'wilds', 1, 1, 1, T0) === null, 'ground yielded fruit')
}

// ── 7. ★ PICKING PAYS AT LEAST AS WELL AS BREAKING — read off the SHIPPED registry row ─────────
// If picking paid less, the optimal play would be to destroy every bush met, which is the exact
// behaviour this feature exists to stop. Read from `blockDef` rather than restated, so a change to
// the drop row fails HERE instead of quietly re-creating the incentive.
{
  for (const m of [MAT.SUNFRUIT_BUSH, MAT.MOONBERRY_BUSH]) {
    const drop = blockDef(m)?.drops?.[0]
    ok(!!drop, `no drop row for material ${m}`)
    if (!drop) continue
    ok(PICK_YIELD >= (drop.count ?? 1),
      `picking material ${m} yields ${PICK_YIELD} but BREAKING it yields ${drop.count} — that rewards destroying the bush`)
    ok(pickBush(fresh(), m, 'wilds', 0, 0, 0, T0)?.itemId === drop.itemId,
      `picking material ${m} gives a different item than breaking it does`)
  }
}

// ── 8. the refusal says what to do next ───────────────────────────────────────────────────────
{
  const p = fresh()
  pickBush(p, MAT.SUNFRUIT_BUSH, 'wilds', 5, 40, 7, T0)
  const why = pickBlocker(p, MAT.SUNFRUIT_BUSH, 'wilds', 5, 40, 7, T0)
  ok(why === 'already-picked', 'a bare bush did not refuse')
  const line = pickRefusalLine(why, p, 'wilds', 5, 40, 7, T0)
  ok(/\d+h/.test(line), `the refusal does not say how long to wait: "${line}"`)
  const soon = pickRefusalLine(why, p, 'wilds', 5, 40, 7, T0 + REGROW_MS - 60_000)
  ok(soon.includes('hour'), `the nearly-ready refusal reads wrong: "${soon}"`)
}

// ── 9. a save round-trips, and prunes on the way through in BOTH directions ───────────────────
{
  const p = fresh()
  pickBush(p, MAT.SUNFRUIT_BUSH, 'wilds', 5, 40, 7, T0)
  pickBush(p, MAT.MOONBERRY_BUSH, 'wilds', 9, 40, 7, T0)
  const saved = pickedToSave(p, T0 + 1)
  ok(saved.length === 2, 'the save lost a picked bush')
  const back = pickedFromSave(saved, T0 + 1)
  ok(!isFruited(back, 'wilds', 5, 40, 7, T0 + 1), 'a picked bush came back fruited')
  ok(pickedToSave(p, T0 + REGROW_MS).length === 0, 'the save wrote records that had already regrown')
  ok(pickedFromSave(saved, T0 + REGROW_MS).size === 0, 'a long absence loaded back regrown records')
  ok(pickedFromSave(null, T0).size === 0 && pickedFromSave([{ bad: 1 }], T0).size === 0,
    'a malformed save did not load as empty')
}

console.log(`\npicking: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the fruit comes off, the plant stays, and the record deletes itself')
