// Run: npx tsx src/app/shimmer/voxel/bridges.test.ts
//
// The bridge geometry oracle. Everything here is measured against REAL generated crossings on two
// seeds, never against a hand-written fixture — a bridge is a thing worldgen finds, so a literal
// fixture would be a mirror of the survey and would agree with it while both went stale. That is
// the failure mode `merge.test.ts` hit today with a hardcoded column coordinate, and the one the
// PATTERNS entry calls a copy reading as corroboration.

import {
  bridgeSpecs, bridgeAt, deckTopAt, bridgeVoxelAt, __clearBridgeCache, BRIDGE_REACH, kindFor,
  bridgeGenPiecesForCol, ABUT_REACH,
} from './bridges'
import { STORY_NODES } from './story-path'
import { columnHeight } from './height'
import { materialAt, isSolid, isHalfMat, MAT } from './depth'

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++ } else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const SEEDS = [1, 1337]
const DECK = 53, DECK_HALF = 53 | 0x0100, STONE = 1

console.log('bridges')

for (const SEED of SEEDS) {
  const specs = bridgeSpecs(SEED)

  // ── the crossings exist at all ────────────────────────────────────────────────
  // Mirrors bridge-deck.test.ts's own existence assert for the same reason it gives: if this goes
  // to zero the road fords every river and the whole bridge pass is silently undone.
  check(`s${SEED}: the spine has crossings`, specs.length > 0, `${specs.length}`)

  for (const b of specs) {
    // ── ★ THE WALKABILITY INVARIANT — the reason the arch is built out of slabs ──────────────
    // locomotion.ts: STEP_CAPTURE 0.55 walks a +0.5 rise with no press; a full +1 "stays out of
    // reach and stays a vault". A deck that steps a whole block is a bridge you MANTLE across.
    // This is the single assert that must never be relaxed to make a nicer-looking arch fit.
    // ⚠⚠ THE DOMAIN IS THE WHOLE RIBBON, NOT THE SPAN. Both of these used to walk `0 .. span`,
    // which is the arch and nothing else — so when the abutment added deck OUTSIDE the span they
    // could not see it, and a mutation dropping the apron's `Math.floor` (deck tops like
    // `113.655`, the exact defect the 0.5-grid assert exists to catch) passed all 2185 asserts.
    // An assert that cannot reach its subject reports "nothing wrong" and means "I could not look".
    // ⚠⚠ AND THE PHASE MATTERS AS MUCH AS THE DOMAIN. Sampling at INTEGER `t` makes every
    // `Math.floor` in `deckTopAt` a no-op, so the widened domain STILL passed a mutation that
    // removed the apron's floor. The generator evaluates this at the ribbon's own continuous
    // offsets (`RASTER` 0.5, and a cell's `t` is a projected float), so the sweep steps in
    // quarters. Two guards, one blind spot each, and both read as green.
    const T0 = -ABUT_REACH, T1 = b.span + ABUT_REACH
    let worst = 0
    for (let t = T0; t < T1; t += 0.25) worst = Math.max(worst, Math.abs(deckTopAt(b, t + 1) - deckTopAt(b, t)))
    check(`s${SEED}/${b.id}: no deck step exceeds STEP_CAPTURE`, worst <= 0.5, `steepest ${worst}`)

    // A height between the halves is unrepresentable — there is no third slab.
    let offGrid = 0
    for (let t = T0; t <= T1; t += 0.25) { const v = deckTopAt(b, t); if (Math.abs(v * 2 - Math.round(v * 2)) > 1e-9) offGrid++ }
    check(`s${SEED}/${b.id}: every deck height sits on the 0.5 grid`, offGrid === 0, `${offGrid} off-grid`)

    // ── the springing meets the bank ─────────────────────────────────────────────────────────
    // ⚠⚠ CONTRACT CHANGE 2026-08-30 — NOT A REGRESSION, AND DO NOT "FIX" IT BACK. This pair used to
    // assert `deckTopAt(b, 0) === b.table + 1` outright, on the premise quoted from height.ts:368
    // that the approach blend pins every bank to `table + 1`. MEASURED, that premise is false in
    // BOTH directions: banks land at the table itself and banks stand above `table + 1`. Springing
    // at `table + 1` regardless is what PUT a full-block step at 6 of 22 crossing-ends — the assert
    // was not merely stale, it was pinning the deck to the height that caused the defect.
    //
    // The half that was always load-bearing survives: the springing may never sit BELOW the
    // waterline, which is what keeps the deck out of the river. The upper bound is its own landing,
    // so the abutment can lift the end to meet high ground and cannot invent height beyond it.
    for (const [end, t, land] of [['near', 0, b.abut[0]], ['far', b.span, b.abut[1]]] as const) {
      check(`s${SEED}/${b.id}: springs no lower than the waterline at the ${end} bank`,
        deckTopAt(b, t) >= b.table + 1, `${deckTopAt(b, t)} vs ${b.table + 1}`)
      check(`s${SEED}/${b.id}: springs no higher than its own landing at the ${end} bank`,
        deckTopAt(b, t) <= Math.max(b.table + 1, land), `${deckTopAt(b, t)} vs landing ${land}`)
    }

    // The deck never dips into the water it crosses.
    let sunk = 0
    for (let t = 0; t <= b.span; t++) if (deckTopAt(b, t) <= b.table) sunk++
    check(`s${SEED}/${b.id}: the deck stays above the table`, sunk === 0, `${sunk} submerged rows`)

    // ── piers ────────────────────────────────────────────────────────────────────────────────
    for (let k = 0; k < b.piers.length; k++) {
      const p = b.piers[k]
      check(`s${SEED}/${b.id}: pier ${p} clears both banks`, p >= 3 && p <= b.span - 3, `span ${b.span}`)
      // A pier stands in the water, not up a bank. Its own bed must be under the table.
      check(`s${SEED}/${b.id}: pier ${p} stands in the channel`, b.pierBed[k] <= b.table, `bed ${b.pierBed[k]} table ${b.table}`)
      // ★★ RE-DERIVED, NOT RANGE-CHECKED. The assert this replaces was `pierBed[k] >= bed`, which
      // equality satisfies — so collapsing every pier back onto the crossing minimum passed the
      // whole oracle. A mutation sweep caught it. Ask worldgen the same question the survey asked
      // and demand the same answer: the value is only evidence if its DERIVATION is what is checked.
      const truth = columnHeight(b.pierPos[k].x, b.pierPos[k].z, SEED)
      check(`s${SEED}/${b.id}: pier ${p} bed is the ground under THAT pier`, b.pierBed[k] === truth,
        `stored ${b.pierBed[k]}, worldgen says ${truth}`)
    }
    check(`s${SEED}/${b.id}: pierBed is index-parallel to piers`, b.pierBed.length === b.piers.length)
    check(`s${SEED}/${b.id}: pierPos is index-parallel to piers`, b.pierPos.length === b.piers.length)

    // ── ★★ SPAN-TYPING (2026-08-22) ───────────────────────────────────────────────────────────
    // The kind must be a pure function of the span, and every crossing must agree with it.
    check(`s${SEED}/${b.id}: kind matches its span`, b.kind === kindFor(b.span), `${b.kind} at span ${b.span}`)

    // ★★ THE BAY FLOOR IS ENFORCED, NOT ADVERTISED. Rounding the bay COUNT up can push the resulting
    // bay under the minimum — the first cut of this pass shipped 10.0-block bays beneath a stated
    // floor of 12. Assert the DELIVERED bay, never the target, or the constant is free to lie.
    const BOUNDS: Record<string, [number, number]> = { plank: [14, 14], trestle: [9, 14], viaduct: [18, 26] }
    const [lo, hi] = BOUNDS[b.kind]
    if (b.piers.length > 0) {
      const bay = b.span / (b.piers.length + 1)
      check(`s${SEED}/${b.id}: delivered bay is inside ${b.kind} bounds`, bay >= lo - 1e-9 && bay <= hi + 1e-9,
        `bay ${bay.toFixed(2)} vs [${lo},${hi}]`)
      // Evenly divided, so no pier can crowd a bank and every bay is the same length.
      for (let k = 1; k < b.piers.length; k++) {
        check(`s${SEED}/${b.id}: bays are even`, Math.abs((b.piers[k] - b.piers[k - 1]) - bay) < 1e-6)
      }
    }

    // ★ A PLANK STANDS ON NOTHING. A log over a creek does not need masonry, and this falls out of
    // the bay arithmetic rather than a branch — no bay fits, so there is one bay.
    if (b.kind === 'plank') check(`s${SEED}/${b.id}: a plank carries no pier`, b.piers.length === 0, `${b.piers.length}`)

    // ★★ THE TRAPEZOID'S WHOLE POINT: a long crossing RUNS LEVEL. An arch stretched over 149 blocks
    // is an imperceptible sag, which is why the parabola had to go. Assert the flat, not the curve.
    if (b.span >= 55) {
      let flat = 0
      for (let t = 0; t < b.span; t++) if (deckTopAt(b, t + 1) === deckTopAt(b, t)) flat++
      check(`s${SEED}/${b.id}: a viaduct runs level over most of its length`, flat > b.span / 2,
        `${flat} level of ${b.span}`)
    }

    // ★ `spec.rise` MUST BE THE CROWN ACTUALLY REACHED, not the crown its kind asked for. The
    // trapezoid is self-limiting (`min(rise, t, span - t)`), so an oversized rise does not produce a
    // vault — it produces a SPEC THAT LIES, claiming a crown the deck never gets to. That is what
    // the survey's ramp-fitting clamp is really for, and this is the assert that holds it.
    //
    // ⚠ HONESTLY LABELLED: no crossing on either seed is short enough for that clamp to bind, so
    // this assert has no live subject today and a mutation removing the clamp passes unnoticed. It
    // is here for the day a seed generates a crossing under ~16 blocks, not as evidence the clamp
    // is exercised now. An assert with no input that can make it fire is decoration, and calling
    // this one covered would be the same lie as a guard that cannot see its subject.
    const crown = Math.round((deckTopAt(b, b.span / 2) - (b.table + 1)) * 2)
    check(`s${SEED}/${b.id}: rise is the crown the deck actually reaches`, crown === b.rise,
      `spec says ${b.rise}, profile gives ${crown}`)
    check(`s${SEED}/${b.id}: both ramps fit inside the span`, 2 * b.rise <= b.span + 1,
      `rise ${b.rise}, span ${b.span}`)
  }

  // ── ★★ THE ACTUAL BUG THIS PASS EXISTS TO KILL ────────────────────────────────────────────
  // "A four-block creek and a sixty-block river generate identically." Asserting the fix as a
  // PROPERTY rather than as a number: the shortest and longest crossings must not share a profile.
  // Written this way on purpose — a numeric assert on rise would go green again the day someone
  // reintroduces a single global deck height with a different constant in it.
  if (specs.length >= 2) {
    const byLen = [...specs].sort((a, b) => a.span - b.span)
    const shortest = byLen[0], longest = byLen[byLen.length - 1]
    check(`s${SEED}: span changes the arch`, shortest.rise !== longest.rise,
      `${shortest.id} rise ${shortest.rise} vs ${longest.id} rise ${longest.rise}`)
    check(`s${SEED}: span changes the pier count`, shortest.piers.length !== longest.piers.length,
      `${shortest.piers.length} vs ${longest.piers.length}`)
    check(`s${SEED}: span changes the KIND`, shortest.kind !== longest.kind,
      `${shortest.kind} vs ${longest.kind}`)
    // ★★ AND THE BAY MUST GROW WITH THE SPAN — the defect that produced "crunched". A constant bay
    // passes every other assert here: same kinds, same rises, same even division. Only this one
    // fires, and it is the whole reason this pass exists.
    const bayOf = (x: typeof shortest) => x.piers.length ? x.span / (x.piers.length + 1) : x.span
    check(`s${SEED}: bay length grows with span`, bayOf(longest) > bayOf(shortest) + 1,
      `${bayOf(shortest).toFixed(1)} vs ${bayOf(longest).toFixed(1)}`)

    // ★★★ AND THE LONGEST CROSSING MUST REACH FOR THE TOP OF ITS RANGE, NOT SIT ON ITS FLOOR.
    // This assert exists because a mutation sweep walked straight past the others: replacing the
    // derived bay with a hardcoded 7 — THE original crunched bug, restored verbatim — passed every
    // check above. The per-kind floor absorbed it (`floor(span/minBay)` still capped the count) and
    // the delivered bay stayed inside [18,26], so "inside bounds" and "grows with span" both went
    // green while the 149-block viaduct quietly went from 5 piers to 7. A span whose target bay is
    // clamped by its kind's MAXIMUM must actually get bays near that maximum; that is the entire
    // difference between a viaduct and a fence in water.
    if (longest.piers.length > 0 && longest.kind === 'viaduct') {
      check(`s${SEED}: the longest span uses its kind's long bays`, bayOf(longest) >= 0.85 * 26,
        `bay ${bayOf(longest).toFixed(1)}, viaduct max 26`)
    }
  }

  // ── the rail follows the band, measured not assumed ───────────────────────────────────────
  // The old rail asked `!roadAt(x+1,z)` and could not tell the bridge's edge from the road's own
  // wobble. Every row of a crossing must carry an edge on BOTH sides or a keeper walks off it.
  {
    const rows = new Map<string, { edges: number; n: number }>()
    // Walk the corridor and group the real cells by (bridge, whole t).
    const seen = new Set<string>()
    for (let n = 0; n < STORY_NODES.length - 1; n++) {
      const a = STORY_NODES[n], b2 = STORY_NODES[n + 1]
      const dx = b2.x - a.x, dz = b2.z - a.z
      const steps = Math.ceil(Math.hypot(dx, dz))
      for (let s = 0; s <= steps; s++) {
        const bx = Math.round(a.x + (dx * s) / steps), bz = Math.round(a.z + (dz * s) / steps)
        for (let ox = -6; ox <= 6; ox++) for (let oz = -6; oz <= 6; oz++) {
          const x = bx + ox, z = bz + oz, key = `${x},${z}`
          if (seen.has(key)) continue
          seen.add(key)
          const c = bridgeAt(x, z, SEED)
          if (!c) continue
          const rk = `${c.i}:${Math.round(c.t)}`
          const cur = rows.get(rk) ?? { edges: 0, n: 0 }
          cur.n++
          if (c.edge) cur.edges++
          rows.set(rk, cur)
        }
      }
    }
    // ★ Two asserts, opposite directions, and the pair is the point. A wide row must be railed on
    // both flanks (walk off the side) and a NARROW row must not be railed at all (walled mouth).
    // Sides are counted as "two distinct edge cells", never by the sign of `s`: the waterline cuts
    // the road diagonally, so a perfectly good row can sit entirely to one side of the chord — the
    // first version of this assert read that as a defect and would have been "fixed" by deleting it.
    // ★★★ CONTINUITY — THE ASSERT THAT DID NOT EXIST, AND ITS ABSENCE WAS THE SCARIEST FINDING OF
    // THE PASS. Every check in this file described what a deck row LOOKS like: railed, at the right
    // height, on the 0.5 grid, over a pier. Not one of them asked whether the rows JOIN UP. A
    // crossing with a 26-block hole punched through the middle passed all 301 — the keeper walks
    // off the end of the world and into the river, and the oracle calls it green.
    //
    // Found the way these things are always found: a cross-section LOOKED like it had a hole. That
    // one was a probe artifact (it sampled the straight chord while the road wobbles), but the
    // right response to a false alarm is not relief — it is noticing that nothing would have caught
    // a true one. An interior gap is a fall; a missing row at either END is the run's last
    // centreline step having no road cells round to it, which costs a 0.5 step onto the bank and is
    // why the tolerance below is exactly ±1 and no wider.
    const spans = new Map<number, number[]>()
    for (const [rk] of rows) {
      const [i, t] = rk.split(':').map(Number)
      if (!spans.has(i)) spans.set(i, [])
      spans.get(i)!.push(t)
    }
    for (const [i, ts] of spans) {
      const b = specs[i]
      ts.sort((a, c) => a - c)
      const lo = ts[0], hi = ts[ts.length - 1]
      let holes = 0
      for (let t = lo; t <= hi; t++) if (!ts.includes(t)) holes++
      check(`s${SEED}/${b.id}: the deck has no interior gap`, holes === 0, `${holes} missing rows between ${lo} and ${hi}`)
      check(`s${SEED}/${b.id}: the deck reaches both banks`, lo <= 1 && hi >= b.span - 1,
        `covers ${lo}..${hi} of 0..${b.span}`)
    }

    // ★★★ CAN YOU ACTUALLY WALK IT? THE ASSERT THAT SHOULD HAVE COME FIRST.
    // Every check in this file described how a deck LOOKS — railed, right height, on the grid, over
    // a pier, continuous. None asked how much of it you can stand on. Measured before this landed:
    // walkable width had a MEDIAN OF 2 and **152 of 546 rows were a single cell**, because the
    // footprint was `road ∩ waterline` and the rail then ate the outermost cell of whatever that
    // accident produced. One crossing was a one-block catwalk end to end. It passed 329 asserts.
    // ⚠ A guard that describes appearance will never catch unusability. Assert the AFFORDANCE.
    const walk = new Map<number, number[]>()
    for (const [rk, r] of rows) {
      const [i, t] = rk.split(':').map(Number)
      if (!walk.has(i)) walk.set(i, [])
      walk.get(i)![t] = r.n - r.edges
    }
    for (const [i, widths] of walk) {
      const b = specs[i]
      let tooNarrow = 0
      for (let t = 2; t <= b.span - 2; t++) {
        const w = widths[t]
        if (w !== undefined && w < 3) tooNarrow++
      }
      check(`s${SEED}/${b.id}: the deck is walkable along its length`, tooNarrow === 0,
        `${tooNarrow} interior rows under 3 cells wide`)
      const present = widths.filter(w => w !== undefined).sort((a, c) => a - c)
      const median = present[Math.floor(present.length / 2)]
      check(`s${SEED}/${b.id}: median walkable width is a road, not a catwalk`, median >= 4,
        `median ${median}`)
    }

    // ★★ TWO ASSERTS IN OPPOSITE DIRECTIONS, STATED AS THE AFFORDANCE RATHER THAN AS A THRESHOLD.
    // A row wide enough to pay for a parapet must have one (or you walk off the side); a row that
    // cannot pay must not (or the parapet is what makes it impassable). Both are the SAME rule —
    // **the rail may never be the thing that makes a row unusable** — and writing them against
    // `MIN_WALK` instead of copying `RAIL_MIN_WIDTH` is deliberate: a test that mirrors the source's
    // constant agrees with it while both go wrong, which is the failure this file keeps meeting.
    // Linked by arithmetic instead: a row can afford rails exactly when it has MIN_WALK + 2 cells,
    // so dropping the source threshold to 4 fails HERE rather than quietly pinching the walkway.
    const MIN_WALK = 3
    // ★★★ NO HOLE IN THE DECK — THE OTHER AXIS OF CONTINUITY, AND I ONLY HAD ONE.
    // The along-span assert above checks that every ROW exists. It says nothing about whether a row
    // is SOLID. Coarsening the ribbon raster from 0.5 to 1.0 drops 478 of 3822 deck cells — 12.5% of
    // the bridge — as scattered single-cell holes inside otherwise present, otherwise wide rows, and
    // the whole oracle stayed green: rows existed, the median width held, the rails were in place.
    // A hole in a deck is a fall, and it was invisible to every check I had.
    // ⚠ The general shape, third time today: I asserted a property along ONE axis and assumed it
    // covered the surface. Test the void, not the material — an enclosed empty cell is the defect.
    {
      const own = new Map<number, Set<string>>()
      const seenC = new Set<string>()
      for (let n = 0; n < STORY_NODES.length - 1; n++) {
        const a = STORY_NODES[n], q = STORY_NODES[n + 1]
        const dx = q.x - a.x, dz = q.z - a.z, L = Math.hypot(dx, dz)
        for (let st = 0; st <= Math.ceil(L); st++) {
          const bx = Math.round(a.x + (dx * st) / L), bz = Math.round(a.z + (dz * st) / L)
          for (let o1 = -10; o1 <= 10; o1++) for (let o2 = -10; o2 <= 10; o2++) {
            const x = bx + o1, z = bz + o2, kk = `${x},${z}`
            if (seenC.has(kk)) continue
            seenC.add(kk)
            const c = bridgeAt(x, z, SEED)
            if (!c) continue
            if (!own.has(c.i)) own.set(c.i, new Set())
            own.get(c.i)!.add(kk)
          }
        }
      }
      for (const [i, set] of own) {
        let holes = 0
        const b = specs[i]
        const counted = new Set<string>()
        for (const kk of set) {
          const [x, z] = kk.split(',').map(Number)
          // any empty cell hemmed in on three or more sides by this same deck is a candidate
          for (const [dx2, dz2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx2, nz = z + dz2, nk = `${nx},${nz}`
            if (set.has(nk) || counted.has(nk)) continue
            let touch = 0, top = -Infinity
            for (const [ex, ez] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const c2 = bridgeAt(nx + ex, nz + ez, SEED)
              if (c2 && c2.i === i) { touch++; top = Math.max(top, deckTopAt(b, c2.t)) }
            }
            if (touch < 3) continue
            // ⚠ SET MEMBERSHIP IS NOT THE AFFORDANCE. A gap in the deck CELLS is only a hole if you
            // would fall through it. At the springing the bank sits flush with the deck, so a cell
            // the ribbon skipped there is solid ground at walking height — the first version of this
            // assert flagged two of those as defects and would have been "fixed" by damaging the
            // abutment. Ask how far the drop is, not whether the cell is in the set.
            counted.add(nk)
            if (columnHeight(nx, nz, SEED) < top - 0.5) holes++
          }
        }
        check(`s${SEED}/${specs[i].id}: the deck surface has no hole in it`, holes === 0,
          `${holes} enclosed empty cells`)
      }
    }

    let railless = 0, walled = 0
    for (const [, r] of rows) {
      if (r.edges > 0 && r.n - r.edges < MIN_WALK) walled++
      if (r.n >= MIN_WALK + 2 && r.edges !== 2) railless++
    }
    check(`s${SEED}: every row that can afford a parapet has one`, railless === 0, `${railless} unrailed of ${rows.size}`)
    check(`s${SEED}: no parapet pinches its row below ${MIN_WALK} abreast`, walled === 0, `${walled} pinched rows`)
    check(`s${SEED}: the corridor walk actually found deck rows`, rows.size > 0, `${rows.size}`)
  }

  // ── the voxel function agrees with the profile ────────────────────────────────────────────
  {
    const b = specs[0]
    let deckCells = 0, stoneCells = 0, bad = 0
    const seen = new Set<string>()
    for (let n = 0; n < STORY_NODES.length - 1 && deckCells < 400; n++) {
      const a = STORY_NODES[n], b2 = STORY_NODES[n + 1]
      const dx = b2.x - a.x, dz = b2.z - a.z
      const steps = Math.ceil(Math.hypot(dx, dz))
      for (let s = 0; s <= steps; s++) {
        const bx = Math.round(a.x + (dx * s) / steps), bz = Math.round(a.z + (dz * s) / steps)
        for (let ox = -6; ox <= 6; ox++) for (let oz = -6; oz <= 6; oz++) {
          const x = bx + ox, z = bz + oz, key = `${x},${z}`
          if (seen.has(key)) continue
          seen.add(key)
          const c = bridgeAt(x, z, SEED)
          if (!c) continue
          const spec = specs[c.i]
          const top = deckTopAt(spec, c.t)
          const yc = Math.ceil(top) - 1
          const m = bridgeVoxelAt(yc, c, spec, DECK, DECK_HALF, STONE)
          if (m !== DECK && m !== DECK_HALF) bad++
          else deckCells++
          // A half-profile cell is a slab — EXCEPT on the flanks, which are rounded up to full so
          // the railing has an integer surface to stand on (see the deck emitter). Assert both
          // halves of that rule, or the edge rule is unguarded and the walkway rule is wrong.
          const got2 = bridgeVoxelAt(yc, c, spec, DECK, DECK_HALF, STONE)
          if (top - yc < 1 && !c.edge && got2 !== DECK_HALF) bad++
          if (c.edge && got2 !== DECK) bad++
          for (let y = spec.bed; y < yc; y++) if (bridgeVoxelAt(y, c, spec, DECK, DECK_HALF, STONE) === STONE) stoneCells++
        }
      }
    }
    check(`s${SEED}: every bridge cell emits a deck at its own deck height`, bad === 0, `${bad} wrong`)
    check(`s${SEED}: the crossings emit deck`, deckCells > 0, `${deckCells}`)
    check(`s${SEED}: the crossings emit piers`, stoneCells > 0, `${stoneCells}`)
    void b
  }
}

// ── ★ THE CALLER'S y-GATE MUST NOT CLIP THE ARCH ────────────────────────────────────────────
// depth.ts early-outs on `y - h <= BRIDGE_REACH`. That gate was RIVER_DEPTH + 4 = 7 when the deck
// was flat; the arch wants 10. Walk the real corridor on both seeds and prove no bridge cell ever
// wants a voxel the gate would refuse — the derivation checked against worldgen, not against itself.
{
  for (const SEED of SEEDS) {
    const specs = bridgeSpecs(SEED)
    let worstUp = -Infinity, where = ''
    const seen = new Set<string>()
    for (let n = 0; n < STORY_NODES.length - 1; n++) {
      const a = STORY_NODES[n], b = STORY_NODES[n + 1]
      const dx = b.x - a.x, dz = b.z - a.z, steps = Math.ceil(Math.hypot(dx, dz))
      for (let st = 0; st <= steps; st++) {
        const bx = Math.round(a.x + (dx * st) / steps), bz = Math.round(a.z + (dz * st) / steps)
        for (let ox = -6; ox <= 6; ox++) for (let oz = -6; oz <= 6; oz++) {
          const x = bx + ox, z = bz + oz, k = `${x},${z}`
          if (seen.has(k)) continue
          seen.add(k)
          const c = bridgeAt(x, z, SEED)
          if (!c) continue
          const railY = Math.ceil(deckTopAt(specs[c.i], c.t)) - 1 + 1
          const up = railY - columnHeight(x, z, SEED)
          if (up > worstUp) { worstUp = up; where = `${specs[c.i].id} t=${c.t.toFixed(1)}` }
        }
      }
    }
    check(`s${SEED}: nothing reaches above the caller's y-gate`, worstUp <= BRIDGE_REACH,
      `wants ${worstUp}, gate allows ${BRIDGE_REACH} (${where})`)
  }
}

// ── ★★ PIER GEOMETRY: SYMMETRIC, AND A BENT HAS DAYLIGHT IN IT ──────────────────────────────
// Placing geometry across the deck by `|s|` produced a bent of `.D.DDD.` instead of `.D.D.D.` and a
// masonry pier visibly off-centre, because the ribbon's rasterised cells land on uneven offsets and
// a band of `|s|` catches two cells on one flank and none on the other. Everything is placed by row
// INDEX now, and these are the asserts that keep it that way — asymmetry is the tell.
{
  for (const SEED of SEEDS) {
    const specs = bridgeSpecs(SEED)
    const cells: Record<number, { x: number; z: number; t: number; idx: number; n: number }[]> = {}
    const seenP = new Set<string>()
    for (let n = 0; n < STORY_NODES.length - 1; n++) {
      const a = STORY_NODES[n], q = STORY_NODES[n + 1]
      const dx = q.x - a.x, dz = q.z - a.z, L = Math.hypot(dx, dz)
      for (let st = 0; st <= Math.ceil(L); st++) {
        const bx = Math.round(a.x + (dx * st) / L), bz = Math.round(a.z + (dz * st) / L)
        for (let o1 = -10; o1 <= 10; o1++) for (let o2 = -10; o2 <= 10; o2++) {
          const x = bx + o1, z = bz + o2, kk = `${x},${z}`
          if (seenP.has(kk)) continue
          seenP.add(kk)
          const c = bridgeAt(x, z, SEED)
          if (!c) continue
          ;(cells[c.i] ??= []).push({ x, z, t: c.t, idx: c.idx, n: c.n })
        }
      }
    }
    for (let i = 0; i < specs.length; i++) {
      const b = specs[i]
      if (!b.piers.length || !cells[i]) continue
      const pt = b.piers[Math.floor(b.piers.length / 2)]
      let bt = cells[i][0].t
      for (const c of cells[i]) if (Math.abs(c.t - pt) < Math.abs(bt - pt)) bt = c.t
      const row = cells[i].filter(c => Math.round(c.t) === Math.round(bt)).sort((a2, c2) => a2.idx - c2.idx)
      if (row.length < 5) continue
      const y = Math.ceil(deckTopAt(b, bt)) - 3     // well inside the pier, below the cap
      const solid = row.map(c => materialAt(c.x, y, c.z, SEED, columnHeight(c.x, c.z, SEED)) !== 0)
      let asym = 0
      for (let k = 0; k < row.length; k++) if (solid[k] !== solid[row.length - 1 - k]) asym++
      check(`s${SEED}/${b.id}: the pier is symmetric across the deck`, asym === 0,
        `${asym} mismatched pairs: ${solid.map(v => v ? '#' : '.').join('')}`)
      // A timber bent must have gaps; a masonry pier must not.
      const gaps = solid.slice(1, -1).filter(v => !v).length
      if (b.kind === 'viaduct') {
        check(`s${SEED}/${b.id}: a masonry pier is a solid mass`, gaps === 0,
          solid.map(v => v ? '#' : '.').join(''))
      } else {
        check(`s${SEED}/${b.id}: a timber bent has daylight between its posts`, gaps >= 2,
          solid.map(v => v ? '#' : '.').join(''))
      }
    }
  }
}

// ── ★★★ THROUGH THE REAL GENERATOR, NOT AROUND IT ────────────────────────────────────────────
// EVERY other assert in this file calls `bridgeVoxelAt` directly. The WORLD calls it through
// `materialAt`, behind a gate — and for one deploy that gate was still `roadAt`, written when the
// deck WAS the road. The ribbon is deliberately wider than the road, so the gate silently discarded
// **44% of the deck and 93% of every rail** while all 371 asserts stayed green. Two code paths, one
// of them tested; both internally consistent; disagreeing about what exists. That is the same trap
// as a headless probe reading source while the page runs a prebuilt worker.
//
// ⚠ So: ask the generator, in world coordinates, the question a walker asks. Never delete this in
// favour of the cheaper direct call — the cheaper call is exactly what could not see the bug.
{
  for (const SEED of SEEDS) {
    const specs = bridgeSpecs(SEED)
    let air = 0, kerb = 0, buried = 0, edges = 0, checked = 0
    const seenG = new Set<string>()
    for (let n = 0; n < STORY_NODES.length - 1; n++) {
      const a = STORY_NODES[n], q = STORY_NODES[n + 1]
      const dx = q.x - a.x, dz = q.z - a.z, L = Math.hypot(dx, dz)
      for (let st = 0; st <= Math.ceil(L); st++) {
        const bx = Math.round(a.x + (dx * st) / L), bz = Math.round(a.z + (dz * st) / L)
        for (let o1 = -10; o1 <= 10; o1++) for (let o2 = -10; o2 <= 10; o2++) {
          const x = bx + o1, z = bz + o2, kk = `${x},${z}`
          if (seenG.has(kk)) continue
          seenG.add(kk)
          const c = bridgeAt(x, z, SEED)
          if (!c) continue
          const b = specs[c.i]
          const yc = Math.ceil(deckTopAt(b, c.t)) - 1
          const h = columnHeight(x, z, SEED)
          checked++
          // A bridge cell must be STANDABLE in the world: deck, or solid ground already at that
          // height where the ribbon meets the bank. Never air — air is a step into the river.
          const m = materialAt(x, yc, z, SEED, h)
          if (m === 0 || !isSolid(m)) air++
          // ⚠ THE CONTINUOUS COURSE IS THE TOP RAIL AT yc + 2. `yc + 1` is deliberately gappy —
          // posts only — and asserting solidity there is how a railing gets "fixed" back into the
          // kerb it replaced. Count the rail, and count the daylight separately.
          // ⚠ THE RAILING IS NO LONGER VOXELS. It is `fence` pieces (see bridgeGenPiecesForCol),
          // so what must be true here is the OPPOSITE of what used to be: the bridge must emit
          // nothing above the deck. A block back at `yc + 1` is the kerb returning, and it would
          // bury the fence post the piece layer places in that cell.
          // ★ Ask the BRIDGE, not the world. `materialAt` also reports the bank's own ground where
          // the ribbon meets the abutment, and conflating the two turns a correct abutment into a
          // red — the same false positive the deck-hole assert produced. Terrain there is counted
          // separately and tolerated; a kerb is not tolerated at all.
          if (c.edge) {
            edges++
            const b2 = specs[c.i]
            if (bridgeVoxelAt(yc + 1, c, b2, 53, 53 | 0x0100, 1) !== 0) kerb++
            if (materialAt(x, yc + 1, z, SEED, h) !== 0) buried++
          }
        }
      }
    }
    check(`s${SEED}: every bridge cell is standable in the real generator`, air === 0,
      `${air} of ${checked} cells are AIR through materialAt`)
    check(`s${SEED}: the bridge emits no kerb where the railing goes`, kerb === 0,
      `${kerb} of ${edges} edge cells still carry a block above the deck`)
    check(`s${SEED}: few railing posts are buried in the abutment`, buried < edges * 0.05,
      `${buried} of ${edges} posts sit inside bank ground`)
  }
}

// ── ★★ THE RAILING IS PIECES, AND THE PIECE LAYER HAS ITS OWN WAYS TO GO WRONG ──────────────
{
  for (const SEED of SEEDS) {
    const specs = bridgeSpecs(SEED)
    // Sweep the whole world in column-sized tiles exactly as the host does, so this exercises
    // `bridgeGenPiecesForCol`'s bbox filter rather than the flat list behind it.
    const SIZE = 16
    const got = new Map<string, { x: number; y: number; z: number; pieceId: string }>()
    for (let cx = -180; cx <= -5; cx++) {
      for (let cz = -220; cz <= -40; cz++) {
        for (const g of bridgeGenPiecesForCol(cx, cz, SIZE, SEED)) {
          check(`s${SEED}: a piece is inside the column that claims it`,
            g.x >= cx * SIZE && g.x < cx * SIZE + SIZE && g.z >= cz * SIZE && g.z < cz * SIZE + SIZE, g.gen)
          if (got.has(g.gen)) check(`s${SEED}: no piece is emitted by two columns`, false, g.gen)
          got.set(g.gen, g)
        }
      }
    }
    check(`s${SEED}: the crossings carry railing pieces`, got.size > 100, `${got.size}`)
    let wrongPiece = 0, offDeck = 0
    for (const g of got.values()) {
      if (g.pieceId !== 'fence') wrongPiece++
      const c = bridgeAt(g.x, g.z, SEED)
      if (!c || !c.edge) { offDeck++; continue }
      // A post must stand ON the deck: the cell directly above the deck cell, never floating.
      if (g.y !== Math.ceil(deckTopAt(specs[c.i], c.t)) - 1 + 1) offDeck++
    }
    check(`s${SEED}: every railing piece is a fence`, wrongPiece === 0, `${wrongPiece} not fence`)
    // ★★★ NO POST MAY FLOAT. Pieces sit on the INTEGER grid; the arch climbs in HALF steps because
    // STEP_CAPTURE demands it. So on every half-slab cell a post placed at `yc + 1` began half a
    // block above the surface — 8 of 25 on one line, and that is precisely what Alex saw as
    // "distorted". The flank cells are full height now so the railing always has an integer surface.
    // ⚠ Ask the WORLD what is under the post, not the profile: this must fail if the deck stops
    // being full-height at the edge for any reason, including one nobody has thought of.
    let floating = 0, notFull = 0
    for (const g of got.values()) {
      const below = materialAt(g.x, g.y - 1, g.z, SEED, columnHeight(g.x, g.z, SEED))
      if (below === 0) floating++
      else if (isHalfMat(below)) notFull++
    }
    check(`s${SEED}: no railing post floats over air`, floating === 0, `${floating} posts with nothing under them`)
    check(`s${SEED}: no railing post stands on a half slab`, notFull === 0,
      `${notFull} posts half a block above their deck`)
    check(`s${SEED}: every railing post stands on the deck edge`, offDeck === 0, `${offDeck} misplaced`)
    // ★ ADJACENCY IS THE WHOLE MECHANISM: fence ARMS are derived per connected side, so a post
    // with no neighbour grows no rail and reads as a lone stake. Posts must run continuously.
    const at = new Set([...got.values()].map(g => `${g.x},${g.y},${g.z}`))
    let lonely = 0
    for (const g of got.values()) {
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) =>
        at.has(`${g.x + dx},${g.y},${g.z + dz}`) || at.has(`${g.x + dx},${g.y + 1},${g.z + dz}`) ||
        at.has(`${g.x + dx},${g.y - 1},${g.z + dz}`))
      if (!near) lonely++
    }
    check(`s${SEED}: railing posts connect to a neighbour`, lonely < got.size * 0.05,
      `${lonely} lone stakes of ${got.size}`)
    // Tombstones only work if the id regenerates identically.
    __clearBridgeCache()
    const again = new Set<string>()
    for (let cx = -180; cx <= -5; cx++) for (let cz = -220; cz <= -40; cz++)
      for (const g of bridgeGenPiecesForCol(cx, cz, SIZE, SEED)) again.add(g.gen)
    // Compare the id SETS, not their sizes: a mutation that reshapes every id keeps the count
    // identical, and a count assert waves it through (it did — caught by a mutation sweep).
    let drifted = 0
    for (const id of got.keys()) if (!again.has(id)) drifted++
    check(`s${SEED}: railing gen ids are stable across a rebuild`, drifted === 0 && again.size === got.size,
      `${drifted} ids changed, ${again.size} vs ${got.size}`)
    // ⚠ HONESTLY LABELLED: this proves determinism WITHIN a build, not stability ACROSS versions.
    // The id is keyed on the crossing and the world cell precisely so a geometry change cannot move
    // it — key it on anything derived (a deck height, a pier index) and the next GENERATOR_VERSION
    // silently orphans every tombstone a player has earned. Nothing here can catch that; the id's
    // SHAPE is the guard, which is why it is written out in the comment on `railPiecesFor`.
  }
}

// ── ★★★ THE LANDING — DOES A KEEPER WALK OFF THE DECK, OR MANTLE OFF IT? ────────────────────
// Alex, 2026-08-30, from play: *"i found alot of instances where they didnt land on the shore
// smoothly"*. Nothing in this oracle could see that: every assert above judges the deck against
// ITSELF (its own grid, its own grade, its own springing) and the defect lives in the JOIN between
// the deck and ground that no bridge code owns.
//
// ⚠ THIS IS THE AFFORDANCE, NOT THE MEMBERSHIP. The question a keeper asks is not "is this cell in
// the deck set" but "how far is the step", so it is measured through the world in world
// coordinates: walk the spine, take each crossing's outermost centreline cell, and step outward
// until the road reaches ground that is not water.
//
// ⚠⚠ AND "DRY" IS ASKED OF `materialAt`, NOT DERIVED. A column can sit below the water TABLE and
// carry no water at all when it lies outside the channel, so `h <= table` answers a different
// question and answers it wrongly on exactly these bank cells — it was the reason an earlier
// measurement reported 35 samples "ending over water" that were nothing of the kind.
for (const SEED of SEEDS) {
  const specs = bridgeSpecs(SEED)
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

  // ⚠ A CROSSING THIS WALK CANNOT SEE IS A HOLE IN THE GUARD, NOT A PASS. The probe this replaces
  // anchored its scan on `pierPos[0] ?? {x:0,z:0}`, so both SINGLE-BAY crossings — which have no
  // piers at all — were measured at the world origin and silently dropped, and one of them was a
  // real vault. Assert the coverage, or the next such hole reads as a clean run.
  check(`s${SEED}: every crossing is reachable from the spine`, line.size === specs.length,
    `walked ${line.size} of ${specs.length}`)

  let vaults = 0, landed = 0
  const worst: string[] = []
  for (let i = 0; i < specs.length; i++) {
    const b = specs[i]
    const cells = (line.get(i) ?? []).sort((p, q) => p.t - q.t)
    if (!cells.length) continue
    for (const [end, c0, sgn] of [['near', cells[0], -1], ['far', cells[cells.length - 1], +1]] as const) {
      const deck = deckTopAt(b, c0.t)
      let ground: number | null = null
      for (let k = 1; k <= 12 && ground === null; k++) {
        const nx = Math.floor(c0.x + 0.5 + c0.ux * sgn * k), nz = Math.floor(c0.z + 0.5 + c0.uz * sgn * k)
        if (bridgeAt(nx, nz, SEED)) continue
        const h = columnHeight(nx, nz, SEED)
        if (materialAt(nx, h, nz, SEED, h) !== MAT.WATER) ground = h
      }
      check(`s${SEED}/${b.id}: the ${end} end reaches dry ground`, ground !== null)
      if (ground === null) continue
      landed++
      // locomotion.ts: STEP_CAPTURE 0.55 walks 0.5 with no press; a full 1.0 stays a vault.
      if (Math.abs(ground - deck) > 0.5) { vaults++; worst.push(`${b.id} ${end} ${ground - deck > 0 ? '+' : ''}${ground - deck}`) }
    }
  }
  check(`s${SEED}: no crossing-end is a full-block step off the deck`, vaults === 0,
    `${vaults} of ${landed} — ${worst.join(' · ')}`)
}

// ── the survey is a pure function of the seed ────────────────────────────────────────────────
{
  const a = JSON.stringify(bridgeSpecs(1337))
  __clearBridgeCache()
  const b = JSON.stringify(bridgeSpecs(1337))
  check('the survey is deterministic across a cache clear', a === b)
  const c = JSON.stringify(bridgeSpecs(1))
  check('a different seed surveys a different world', a !== c)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
