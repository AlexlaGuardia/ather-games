// Run: npx tsx src/app/shimmer/voxel/bridges.test.ts
//
// The bridge geometry oracle. Everything here is measured against REAL generated crossings on two
// seeds, never against a hand-written fixture — a bridge is a thing worldgen finds, so a literal
// fixture would be a mirror of the survey and would agree with it while both went stale. That is
// the failure mode `merge.test.ts` hit today with a hardcoded column coordinate, and the one the
// PATTERNS entry calls a copy reading as corroboration.

import {
  bridgeSpecs, bridgeAt, deckTopAt, bridgeVoxelAt, __clearBridgeCache, BRIDGE_REACH, kindFor,
} from './bridges'
import { STORY_NODES } from './story-path'
import { columnHeight } from './height'

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
    let worst = 0
    for (let t = 0; t < b.span; t++) worst = Math.max(worst, Math.abs(deckTopAt(b, t + 1) - deckTopAt(b, t)))
    check(`s${SEED}/${b.id}: no deck step exceeds STEP_CAPTURE`, worst <= 0.5, `steepest ${worst}`)

    // A height between the halves is unrepresentable — there is no third slab.
    let offGrid = 0
    for (let t = 0; t <= b.span; t++) { const v = deckTopAt(b, t); if (Math.abs(v * 2 - Math.round(v * 2)) > 1e-9) offGrid++ }
    check(`s${SEED}/${b.id}: every deck height sits on the 0.5 grid`, offGrid === 0, `${offGrid} off-grid`)

    // ── the springing meets the bank ─────────────────────────────────────────────────────────
    // height.ts:368 pins the approach at table+1. The arch exists so clearance costs nothing at
    // the join; if either end lifts off that level, abutment ramps are owed and nobody built them.
    check(`s${SEED}/${b.id}: springs flush at the near bank`, deckTopAt(b, 0) === b.table + 1, `${deckTopAt(b, 0)} vs ${b.table + 1}`)
    check(`s${SEED}/${b.id}: springs flush at the far bank`, deckTopAt(b, b.span) === b.table + 1, `${deckTopAt(b, b.span)} vs ${b.table + 1}`)

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

    let railless = 0, walled = 0
    for (const [, r] of rows) {
      if (r.n >= 3 && r.edges < 2) railless++
      if (r.n < 3 && r.edges > 0) walled++
    }
    check(`s${SEED}: every walkable deck row is railed on both flanks`, railless === 0, `${railless} open rows of ${rows.size}`)
    check(`s${SEED}: no narrow row is walled shut by its own rail`, walled === 0, `${walled} walled rows`)
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
          // nothing is drawn in the deck cell's empty upper half when it is a slab
          if (top - yc < 1 && bridgeVoxelAt(yc, c, spec, DECK, DECK_HALF, STONE) !== DECK_HALF) bad++
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
