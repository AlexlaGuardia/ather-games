// Run: npx tsx src/app/shimmer/voxel/bridges.test.ts
//
// The bridge geometry oracle. Everything here is measured against REAL generated crossings on two
// seeds, never against a hand-written fixture — a bridge is a thing worldgen finds, so a literal
// fixture would be a mirror of the survey and would agree with it while both went stale. That is
// the failure mode `merge.test.ts` hit today with a hardcoded column coordinate, and the one the
// PATTERNS entry calls a copy reading as corroboration.

import {
  bridgeSpecs, bridgeAt, deckTopAt, bridgeVoxelAt, __clearBridgeCache, BRIDGE_REACH,
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

    // ★ A SHORT CROSSING GETS NO PIER, and that is the span-type behaviour arriving for free rather
    // than through a branch. A plank over a creek does not stand on masonry.
    if (b.span < 10) check(`s${SEED}/${b.id}: a creek span carries no pier`, b.piers.length === 0, `${b.piers.length}`)
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
