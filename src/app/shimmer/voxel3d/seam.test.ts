// Seam oracle. Run: npx tsx src/app/shimmer/voxel3d/seam.test.ts
//
// ★ WHAT THIS FILE IS FOR, IN ONE LINE: **the shimmer must never promise a door the trigger will
// not open.** Everything else here is scaffolding around that.
//
// The look is Alex's to judge and no test can hold an opinion about it. But a seam is not only a
// look — it is a claim, made in pixels, about where a mechanic fires. Get the placement wrong by a
// block and the keeper walks into their own front door and nothing happens: no throw, no log, no
// symptom except a player deciding the game is broken. So every assert below is written against the
// REAL predicates (`inPassageVolume`, `plotThreshold`) rather than against copies of their numbers,
// which is what makes a future retune of `passageWidth` show up here instead of in a playtest.

import { wildsSeamAnchor, wildsSeamRibbon, plotSeamAnchor, seamNearness } from './seam'
import { DEFAULT_BUBBLE, inPassage, inPassageVolume, shellRadiusAt, distFromAxis } from '../voxel/bubble'
import { WILDS_BUBBLE } from '../voxel/column'
import { DEFAULT_PLOT, plotThreshold } from '../voxel/plot'
import { columnHeight } from '../voxel/height'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const SEEDS = [1337, 9001, 42, 777771, 6, 2026]

process.on('exit', () => {
  if (fails.length) {
    console.error(`❌ ${fails.length} failed (${pass} passed)`)
    for (const f of fails) console.error('  - ' + f)
    process.exitCode = 1
  } else {
    console.log(`✅ the door is drawn where the door opens — ${pass} passed`)
  }
})

/** Every corner and edge-midpoint of a drawn quad, in world coords. The thing a keeper can SEE. */
function quadPoints(a: { x: number; z: number; y: number; bearing: number; halfWidth: number; height: number }) {
  // Tangential unit vector: the quad's own +X, perpendicular to its outward normal.
  const tx = Math.sin(a.bearing), tz = -Math.cos(a.bearing)
  const out: { x: number; y: number; z: number }[] = []
  for (const s of [-1, -0.5, 0, 0.5, 1]) {
    for (const f of [0, 0.5, 0.999]) {
      out.push({ x: a.x + tx * a.halfWidth * s, y: a.y + a.height * f, z: a.z + tz * a.halfWidth * s })
    }
  }
  return out
}

// ── 1. ★★ THE HONESTY RULE — every drawn point of the Wilds seam is inside the live trigger ─────
// Asserted per seed against the RIBBON THAT SHIPS, because `shellRadiusAt` wobbles per world: a
// placement that holds on the dev seed and not the next is exactly the bug that would ship. This is
// the assert that failed the first (flat) implementation on 2 of 6 seeds and forced the curve.
{
  for (const seed of SEEDS) {
    let outside = 0, checked = 0
    for (const r of wildsSeamRibbon(seed, WILDS_BUBBLE)) {
      const h = columnHeight(Math.floor(r.x), Math.floor(r.z), seed)
      // Bottom, middle and just under the top — the whole strip of air the keeper can see.
      for (const y of [r.yb, (r.yb + r.yt) / 2, r.yt - 0.01]) {
        checked++
        if (!inPassageVolume(r.x, Math.max(y, h), r.z, seed, h, WILDS_BUBBLE)) outside++
      }
    }
    ok(outside === 0 && checked > 0,
      `★★ seed ${seed}: every drawn point of the seam is inside the crossing volume (${outside}/${checked} outside)`)
  }
}

// ── 2. AND THE MARGIN IS REAL, NOT ZERO ────────────────────────────────────────────────────────
// ⚠ Assert 1 alone is VACUOUS-ADJACENT: a seam drawn exactly at the trigger's edge passes it, and
// then one float of rounding on some future retune walks off the end. This is the assert that says
// the slack exists — there must be trigger left over on both flanks that the shimmer does NOT claim.
{
  const ribs = wildsSeamRibbon(SEED, WILDS_BUBBLE)
  const bearingOf = (r: { x: number; z: number }) =>
    Math.atan2(r.z - WILDS_BUBBLE.cz, r.x - WILDS_BUBBLE.cx)
  const ends = [bearingOf(ribs[0]), bearingOf(ribs[ribs.length - 1])]
  for (const b of ends) {
    // One tenth of the doorway further out than the ribbon reaches: still a legal crossing.
    const over = WILDS_BUBBLE.passageBearing + (b - WILDS_BUBBLE.passageBearing) * 1.1
    const d = WILDS_BUBBLE.radius
    ok(inPassage(Math.cos(over) * d, Math.sin(over) * d, WILDS_BUBBLE),
      '★ the crossing still fires past the drawn edge — the seam under-promises')
  }
  const a = wildsSeamAnchor(SEED, WILDS_BUBBLE)
  ok(a.halfWidth < WILDS_BUBBLE.passageWidth, 'the drawn width is narrower than the passage')
  ok(a.height < WILDS_BUBBLE.passageHeight, 'the drawn height is shorter than the passage')
}

// ── 3. THE SEAM STANDS ON THE GROUND, CLEAR OF THE WALL — EVERY RIB, NOT JUST THE MIDDLE ───────
// Two failures with the same silhouette from outside: a rib buried in the shell (invisible — reads
// as "the feature did not ship") and one floating in the air (reads as the hole in the wall canon
// forbids, arrived at by accident). Per-rib is the point: the middle one was never the problem.
{
  for (const seed of SEEDS) {
    let buried = 0, adrift = 0, floating = 0
    for (const rib of wildsSeamRibbon(seed, WILDS_BUBBLE)) {
      const r = shellRadiusAt(rib.x, rib.z, seed, WILDS_BUBBLE)
      const d = distFromAxis(rib.x, rib.z, WILDS_BUBBLE)
      if (d < r + WILDS_BUBBLE.thickness) buried++
      if (d >= r + WILDS_BUBBLE.thickness + 1) adrift++
      if (rib.yb !== columnHeight(Math.floor(rib.x), Math.floor(rib.z), seed)) floating++
    }
    ok(buried === 0, `seed ${seed}: no rib is sunk inside the wall (${buried})`)
    ok(adrift === 0, `seed ${seed}: no rib has drifted out of the trigger's reach (${adrift})`)
    ok(floating === 0, `★ seed ${seed}: every rib's foot is the ground at its own column (${floating} floating)`)
  }
}

// ── 3b. ★ THE RIBBON IS CURVED AND STEPPED, WHICH IS THE WHOLE FIX ─────────────────────────────
// ⚠ Written because asserts 1 and 3 both pass for a flat ribbon on a lucky seed. If a future
// "simplification" collapses this back to one plane, or levels the foot, these go red immediately.
{
  const ribs = wildsSeamRibbon(SEED, WILDS_BUBBLE)
  const radii = ribs.map(r => distFromAxis(r.x, r.z, WILDS_BUBBLE))
  ok(new Set(radii.map(v => v.toFixed(4))).size > 1,
    '★ the ribbon follows the wall — its ribs do not share one radius')
  let uneven = 0
  for (const seed of SEEDS) {
    const feet = wildsSeamRibbon(seed, WILDS_BUBBLE).map(r => r.yb)
    if (new Set(feet).size > 1) uneven++
  }
  ok(uneven > 0, '★ and it follows the ground — on some world the door sits on a slope')
}

// ── 4. IT IS ON THE BEARING, AND IT MOVES WITH THE WORLD ───────────────────────────────────────
// The anchor is derived (`shellRadiusAt`), never stored. If two seeds ever agree to the block, the
// derivation has been quietly replaced by a constant — which is the failure `plotThreshold`'s own
// header describes, arriving from the render side.
{
  ok(inPassage(wildsSeamAnchor(SEED, WILDS_BUBBLE).x, wildsSeamAnchor(SEED, WILDS_BUBBLE).z, WILDS_BUBBLE),
    'the seam sits in the passage, on the bearing')
  const radii = SEEDS.map(s => Math.hypot(wildsSeamAnchor(s, WILDS_BUBBLE).x - WILDS_BUBBLE.cx, wildsSeamAnchor(s, WILDS_BUBBLE).z - WILDS_BUBBLE.cz))
  ok(new Set(radii.map(r => r.toFixed(3))).size > 1,
    '★ the anchor is derived from the shell — different worlds put the door in different places')
}

// ── 5. ★ THE PLOT SIDE IS NARROW BECAUSE ITS TRIGGER IS ────────────────────────────────────────
// The host opens the waymark panel within 1.6 blocks of the threshold. A seam drawn to the Wilds'
// width here would be a 12-block shimmer around a 3-block door — the same lie as assert 1, on the
// side the keeper stands in every session.
{
  for (const seed of SEEDS) {
    const a = plotSeamAnchor(seed)
    const t = plotThreshold(seed, DEFAULT_PLOT)
    let outside = 0
    for (const p of quadPoints(a)) {
      if (Math.hypot(p.x - (t.x + 0.5), p.z - (t.z + 0.5)) >= 1.6) outside++
    }
    ok(outside === 0, `★ seed ${seed}: the plot seam's whole footprint is inside the panel's reach (${outside} outside)`)
    ok(a.y === t.y, `seed ${seed}: the plot seam stands on the threshold the keeper is set down on`)
  }
  ok(plotSeamAnchor(SEED).halfWidth < wildsSeamAnchor(SEED, WILDS_BUBBLE).halfWidth,
    '★ the two seams are different widths, because the two triggers are')
}

// ── 6. THE PARTING ANSWERS THE KEEPER ──────────────────────────────────────────────────────────
// ⚠ WRITTEN TO REFUSE A CONSTANT. `uNear` fixed at either end still satisfies "between 0 and 1" and
// would ship a seam that never opens (or never shuts) with the trigger working perfectly — the kind
// of nothing-happened bug that gets blamed on the mechanic.
{
  ok(seamNearness(100, 22, 2.5) === 0, 'far off, the fold lies flat')
  ok(seamNearness(1, 22, 2.5) === 1, 'at the door, the parting is fully open')
  ok(seamNearness(22, 22, 2.5) === 0 && seamNearness(2.5, 22, 2.5) === 1, 'and it is exact at both ends')
  const walk = [20, 16, 12, 8, 5, 3].map(d => seamNearness(d, 22, 2.5))
  ok(walk.every((v, i) => i === 0 || v > walk[i - 1]), '★ it opens monotonically as the keeper walks in')
  ok(walk.some(v => v > 0.05 && v < 0.95), '★ ...through real intermediate states, not a switch at the threshold')
  ok(seamNearness(30, 22, 2.5) === 0 && seamNearness(0, 22, 2.5) === 1, 'and it clamps outside its band')
}

// ── 7. ★★ THE SEAM IS DRAWN AT THE LIVE DOOR, NOT AT THE DEFAULT ONE ───────────────────────────
// The one that would have shipped silently. `DEFAULT_BUBBLE` puts the passage at bearing 0;
// `WILDS_BUBBLE` aims it at the glade (≈ -1.80 rad) because the shell is only wired with that one.
// Both are legal `BubbleConfig`s and a defaulted parameter would have picked the wrong one without
// a type error, a throw, or a symptom short of walking 3km of identical wall. So: prove the config
// is genuinely obeyed, and prove the two answers are nowhere near each other.
{
  const live = wildsSeamAnchor(SEED, WILDS_BUBBLE)
  const dflt = wildsSeamAnchor(SEED, DEFAULT_BUBBLE)
  ok(Math.hypot(live.x - dflt.x, live.z - dflt.z) > 100,
    '★★ the two configs put the door in genuinely different places — this is a real fork, not a nuance')
  ok(!inPassage(live.x, live.z, DEFAULT_BUBBLE),
    '★ the live seam is NOT in the default config\'s doorway')
  ok(!inPassage(dflt.x, dflt.z, WILDS_BUBBLE),
    '★ ...and the default\'s doorway is plain unbroken wall in the world that ships')
  ok(Math.abs(live.bearing - WILDS_BUBBLE.passageBearing) < 1e-9,
    'the anchor takes its bearing from the config it was handed')
}
