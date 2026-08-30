// DOES THE DECK MEET THE SHORE? Run: npx tsx scripts/bridge-landings.mts
//
// ★★★ WHY THIS EXISTS. Alex, 2026-08-30, from play: *"i found alot of instances where they didnt
// land on the shore smoothly.. (like the shore is higher than the bridge)"*. `bridges.ts`'s header
// claimed the opposite — *"deck and bank met flush by construction, no ramp logic anywhere"* — so
// the claim and the world disagreed and nothing in the tree could say which was right.
//
// ── ⚠⚠⚠ THE FIRST NUMBER THIS FILE PRODUCED WAS WRONG, AND ITS FIX WOULD HAVE GONE THE WRONG WAY ─
// It reported **19 flush · 18 SHORE HIGHER (up to +2)**, and the board wrote the fix up as an
// abutment ramping UP to a higher bank. Re-measured correctly: of 22 crossing-ends, **5 of the 6
// real defects are DROPS and exactly one is a step up.** An up-ramp would have fixed one end and
// missed five. Four separate faults produced that number, and every one of them failed toward
// "there is a big problem here", which is the direction that gets ACTED ON:
//
//   1. ★★ IT READ `columnHeight` ON BOTH SIDES OF THE JOIN. `height.ts` contains no reference to
//      bridges, so the "deck" reading was the TERRAIN UNDER the deck and never the deck. It
//      approximated the right answer only because the approach blend aims at `table + 1` and the
//      deck springs from `table + 1`, and it sampled exactly there. ⚠ The consequence is the
//      dangerous half: raising the deck moves `deckTopAt` and leaves `columnHeight` untouched, so
//      **a working fix would have reported this number completely unchanged.**
//   2. ★★ IT COUNTED FALLING OFF THE SIDE AS A LANDING. It took all four neighbours of the end
//      cell, and two of those are PERPENDICULAR to the span — the open flanks, which stand over the
//      river by design. Stepping sideways off a bridge into the water is not a defect, it is a
//      bridge, and it was scoring 26 samples as "shore lower".
//   3. ★★ IT ANCHORED ITS SCAN ON `pierPos[0] ?? {x:0,z:0}`. A single-bay crossing has NO piers, so
//      both such crossings were measured at the WORLD ORIGIN and silently dropped. One of them,
//      `vetch-hold-9 near`, was a real vault that was never counted. **A crossing the walk cannot
//      see is a hole in the measurement, not a pass** — so coverage is asserted below, not assumed.
//   4. ★ A `Math.sign` STEP OFF THE END CELL drifts on a diagonal road, and `h <= table` is not the
//      question the world asks about water (a column outside the channel sits below the table and
//      carries none). Together those manufactured a phantom "35 samples end over water".
//   5. ★★★ AND THE ONE THAT SURVIVED ALL FOUR REPAIRS, BECAUSE IT WAS AN OFF-BY-ONE BETWEEN TWO
//      QUANTITIES THAT ARE BOTH HONEST AND BOTH NAMED LIKE HEIGHTS. `deckTopAt` returns a STANDING
//      SURFACE (`table + 1` springs one above the waterline). `columnHeight` returns the index of
//      the TOP SOLID CELL — `depth.ts` fills the surface voxel at `depth === 0`, i.e. AT `y === h`,
//      so a keeper stands at `h + 1`. Comparing them directly reported every `+1` vault as FLUSH.
//      ⚠⚠ It produced a fully self-consistent story that was wrong in DIRECTION: it said 5 of 6
//      defects were drops and the shore-higher reading was an artifact. **The original report was
//      right and this probe's correction of it was wrong** — measured on the true surface there
//      were 13 up-steps and no drops at all, and the first abutment moved that 12 → 13.
//      ★ THE RULE: read BOTH sides of a join with ONE instrument, and let that instrument be the
//      world. Two readings taken from different layers cannot be compared no matter how carefully
//      each is taken.
//
// ── WHAT IT MEASURES NOW ─────────────────────────────────────────────────────────────────────
// Walk the SPINE — the road the keeper actually walks — collect each crossing's centreline cells in
// order, and step outward from the outermost one until the road reaches ground that `materialAt`
// says is not water. Compare that ground against `deckTopAt`, which is what the world builds the
// walking surface from.
//
// The verdict bands are locomotion's, not taste: `STEP_CAPTURE` is 0.55, so a half-step is walked
// with no press and a full block "stays out of reach and stays a vault" (`locomotion.ts`). A
// half-step landing is NOT a defect, and counting it as one is what inflated the original figure.
import { bridgeSpecs, bridgeAt, deckTopAt } from '../src/app/shimmer/voxel/bridges'
import { columnHeight } from '../src/app/shimmer/voxel/height'
import { materialAt, MAT, isSolid, isHalfMat } from '../src/app/shimmer/voxel/depth'
import { STORY_NODES } from '../src/app/shimmer/voxel/story-path'

const SEEDS = [1, 1337]

// The standing surface a keeper occupies, asked of the world, used on BOTH sides of every join.
const surfAt = (x: number, z: number, SEED: number): number | null => {
  const h = columnHeight(x, z, SEED)
  for (let y = h + 6; y >= h - 8; y--) {
    const m = materialAt(x, y, z, SEED, h)
    if (m === MAT.WATER) return null                 // standing water is not a landing
    if (isSolid(m)) return isHalfMat(m) ? y + 0.5 : y + 1
  }
  return null
}

for (const SEED of SEEDS) {
  const specs = bridgeSpecs(SEED)
  const surf = (x: number, z: number) => surfAt(x, z, SEED)

  type C = { x: number; z: number; t: number; ux: number; uz: number }
  const line = new Map<number, C[]>()
  for (let n = 0; n < STORY_NODES.length - 1; n++) {
    const a = STORY_NODES[n], b = STORY_NODES[n + 1]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const ux = (b.x - a.x) / len, uz = (b.z - a.z) / len
    for (let d = -8; d <= len + 8; d += 0.5) {
      const x = Math.floor(a.x + ux * d), z = Math.floor(a.z + uz * d)
      const c = bridgeAt(x, z, SEED)
      if (!c) continue
      const arr = line.get(c.i) ?? []
      if (!arr.some(v => v.x === x && v.z === z)) arr.push({ x, z, t: c.t, ux, uz })
      line.set(c.i, arr)
    }
  }

  let flush = 0, half = 0, vault = 0, dry = 0
  const bad: string[] = []
  const rows: string[] = []
  for (let i = 0; i < specs.length; i++) {
    const b = specs[i]
    const cells = (line.get(i) ?? []).sort((p, q) => p.t - q.t)
    if (!cells.length) { rows.push(`${b.id.padEnd(20)} NOT REACHED FROM THE SPINE`); continue }
    for (const [end, c0, sgn] of [['near', cells[0], -1], ['far', cells[cells.length - 1], +1]] as const) {
      const deck = surf(c0.x, c0.z)
      const out: string[] = []
      let ground: number | null = null
      for (let k = 1; k <= 12; k++) {
        const nx = Math.floor(c0.x + 0.5 + c0.ux * sgn * k), nz = Math.floor(c0.z + 0.5 + c0.uz * sgn * k)
        if (bridgeAt(nx, nz, SEED)) { out.push('  [b]'); continue }
        const s = surf(nx, nz)
        out.push(s === null ? '   ~' : `${String(s).padStart(4)}`)
        if (s !== null && ground === null) ground = s
      }
      if (deck === null) { rows.push(`${b.id.padEnd(20)} ${end.padEnd(4)} DECK CELL HAS NO SURFACE`); continue }
      let tag: string
      if (ground === null) { tag = 'NEVER LANDS'; bad.push(`${b.id} ${end} never lands`) }
      else {
        dry++
        const d = ground - deck
        if (d === 0) { tag = 'flush'; flush++ }
        else if (Math.abs(d) <= 0.5) { tag = `${d > 0 ? '+' : ''}${d} step`; half++ }
        else { tag = `${d > 0 ? '+' : ''}${d} VAULT`; vault++; bad.push(`${b.id} ${end} ${d > 0 ? '+' : ''}${d}`) }
      }
      rows.push(`${b.id.padEnd(20)} ${end.padEnd(4)} deck=${String(deck).padStart(6)} ${tag.padStart(12)} |${out.join('')}`)
    }
  }

  console.log(`\n── seed ${SEED} · ${specs.length} crossings, ${line.size} reached from the spine ──`)
  for (const r of rows) console.log(r)
  console.log(`  flush ${flush} · half-step ${half} (walkable, STEP_CAPTURE 0.55) · FULL-BLOCK VAULT ${vault} · of ${dry} landings`)
  if (line.size !== specs.length) console.log(`  ⚠ ${specs.length - line.size} crossing(s) NOT REACHED — that is a hole in the measurement, not a pass`)
  if (bad.length) console.log(`  ⚠ ${bad.join(' · ')}`)
}
