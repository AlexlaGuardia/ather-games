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

import { wildsSeamAnchor, wildsSeamRibbon, plotSeamAnchor, seamNearness, PLOT_TRIGGER_RADIUS, createSeamShimmer } from './seam'
import { DEFAULT_BUBBLE, inPassage, inPassageVolume, shellRadiusAt, distFromAxis, bubbleCaveAt } from '../voxel/bubble'
import { WILDS_BUBBLE } from '../voxel/column'
import { DEFAULT_PLOT, plotThreshold, plotForTier, PLOT_TIERS, type PlotConfig } from '../voxel/plot'
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

// ── 5. ★ THE PLOT SEAM'S FOOTPRINT STAYS INSIDE ITS TRIGGER ───────────────────────────────────
// The rule is unchanged and the NUMBER moved (2026-08-18): what you can see must be what opens, so
// the drawn quad may never reach past the radius the host tests. It used to read a hardcoded `1.6`
// — a second copy of the host's own literal, which is precisely the pair that sealed Alex in his
// garden — and now asks `PLOT_TRIGGER_RADIUS`, the one definition both the host and the mesh use.
//
// ⚠ THIS ASSERT DOES NOT SAY THE SEAM SHOULD BE SMALL. That was the old header's claim and it was
// the wrong lesson: the seam is now a 14-block landmark drawn from 120 blocks out, because it is the
// keeper's only way out of a fold whose wall is ~1,900 blocks around. What must stay small is the
// gap between what is drawn AT THE GROUND and what the trigger accepts.
{
  for (const seed of SEEDS) {
    const a = plotSeamAnchor(seed)
    const t = plotThreshold(seed, DEFAULT_PLOT)
    let outside = 0
    for (const p of quadPoints(a)) {
      if (Math.hypot(p.x - (t.x + 0.5), p.z - (t.z + 0.5)) >= PLOT_TRIGGER_RADIUS) outside++
    }
    ok(outside === 0, `★ seed ${seed}: the plot seam's whole footprint is inside the panel's reach (${outside} outside)`)
    ok(a.y === t.y, `seed ${seed}: the plot seam stands on the threshold the keeper is set down on`)
  }
  ok(plotSeamAnchor(SEED).halfWidth < wildsSeamAnchor(SEED, WILDS_BUBBLE).halfWidth,
    '★ the two seams are different widths, because the two triggers are')
}

// ── 5b. ★★★ AND IT MUST HOLD AT EVERY TIER, ASSERTED THROUGH THE MESH THE WORLD ACTUALLY DRAWS ──
// Alex, 2026-08-27: *"when i got the first upgrade from greg to extend the fold.. the outer wall
// expanded and moved but the passage to the wilds stayed in the same spot and is unusable."*
//
// ⚠⚠ SECTION 5 ABOVE WAS GREEN THROUGHOUT, AND IT IS WORTH BEING PRECISE ABOUT WHY, BECAUSE THE
// SHAPE REPEATS. It compares `plotSeamAnchor(seed)` — default config — against
// `plotThreshold(seed, DEFAULT_PLOT)` — the same default config. Two derivations of ONE number,
// asked with the same argument: they agreed perfectly and were both about a fold the keeper had
// already outgrown. The assert was not wrong and it was not weak; it simply **did not constrain the
// tier axis**, and no amount of running it could have said so. Ask of any passing guard: what is
// the cheapest wrong answer that still satisfies it? Here it was *"freeze the door at r300."*
//
// ★★ AND IT ASSERTS THROUGH `createSeamShimmer`, NOT THROUGH `plotSeamAnchor`. The pure function
// was never broken — it takes a config and honours it. The defect was one dropped argument in the
// THREE shell (`plotSeamAnchor(seed)` with no cfg, positioned once at construction), so a test that
// stopped at the pure layer would have been testing a world that does not exist. What ships is a
// mesh with a `position`, so that is what gets read.
{
  const drift = (cfg: PlotConfig, mesh: { x: number; z: number }) => {
    const t = plotThreshold(SEED, cfg)
    return Math.hypot(mesh.x - (t.x + 0.5), mesh.z - (t.z + 0.5))
  }
  let tier = 0
  const pass = createSeamShimmer(SEED, WILDS_BUBBLE, () => plotForTier(tier))
  // The plot mesh is the second child; the Wilds ribbon carries no transform and sits at origin.
  const plotMesh = pass.group.children[1] as { position: { x: number; y: number; z: number } }

  for (let t = 0; t < PLOT_TIERS.length; t++) {
    tier = t
    const cfg = plotForTier(t)
    const th = plotThreshold(SEED, cfg)
    // Stand the keeper AT their own threshold, in the plot, and let the pass do what it does in the
    // world. A widening only ever reaches the mesh through `tick`.
    pass.tick(th.x + 0.5, th.y, th.z + 0.5, 1 / 60, 0, 'plot')
    const off = drift(cfg, plotMesh.position)
    ok(off < PLOT_TRIGGER_RADIUS,
      `★★ tier ${t} (r${PLOT_TIERS[t]}): the drawn door sits ${off.toFixed(1)} blocks from the ` +
      `threshold the host tests — the keeper walks to the shimmer and the crossing does not fire`)
    ok(plotMesh.position.y > 0,
      `tier ${t}: the plot seam mesh has been positioned at all`)
  }

  // ★ AND IT MUST TRACK A WIDENING THAT HAPPENS MID-SESSION, WHICH IS THE ONLY WAY IT EVER HAPPENS.
  // Greg widens the fold while the pass is already built and already ticking; a fix that only reads
  // the config at construction passes every assert above (each tier gets a fresh pass in a loop) and
  // still ships the bug. So: walk it back down and up again on the SAME pass.
  tier = 0
  pass.tick(0, 100, 0, 1 / 60, 0, 'plot')
  const backAtHome = drift(plotForTier(0), plotMesh.position)
  tier = PLOT_TIERS.length - 1
  pass.tick(0, 100, 0, 1 / 60, 0, 'plot')
  const afterWidening = drift(plotForTier(PLOT_TIERS.length - 1), plotMesh.position)
  ok(backAtHome < PLOT_TRIGGER_RADIUS && afterWidening < PLOT_TRIGGER_RADIUS,
    `★★ the door follows a fold that grows UNDER a live pass (r${PLOT_TIERS[0]}: ${backAtHome.toFixed(1)}, ` +
    `r${PLOT_TIERS[PLOT_TIERS.length - 1]}: ${afterWidening.toFixed(1)}) — the widening arrives mid-session or not at all`)

  // ⚠ THE NEGATIVE HALF, so the assert above cannot be satisfied by a door that never moves at ALL.
  // The tiers are 100 blocks apart; a mesh pinned anywhere fixed fails one of them by ~90.
  ok(Math.hypot(
    plotThreshold(SEED, plotForTier(0)).x - plotThreshold(SEED, plotForTier(PLOT_TIERS.length - 1)).x,
    plotThreshold(SEED, plotForTier(0)).z - plotThreshold(SEED, plotForTier(PLOT_TIERS.length - 1)).z,
  ) > PLOT_TRIGGER_RADIUS * 10,
    'the tiers put the threshold far enough apart that one fixed position cannot satisfy both')

  pass.dispose()
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

// ── 8. ★★ THE MOUTH OUT-MEASURES THE TRIGGER — THE PLOT'S RULE, NOT MY INVENTED ONE ───────────
//
// ⚠⚠ WHAT STOOD HERE ASSERTED THAT EVERY SEAM RIBBON POINT SITS INSIDE THE CAVE'S BORE, AND THAT
// RULE IS NOT THE GAME'S. `plot.ts` writes its own out loud — *"THE MOUTH MUST OUT-MEASURE THE
// TRIGGER, NOT MATCH IT"* — and sizes its bore against the trigger radius and the seam's HALF-WIDTH.
// Its seam is **14 tall standing in a 7-tall mouth**: double the overshoot, shipped, uncommented,
// because a drawn shimmer is a light effect and not a body that has to fit through a hole.
//
// ★ THE INVENTED RULE WAS FALSIFIABLE, WENT RED FOR A REAL REASON, AND WAS STILL WRONG. It came back
// red on all six seeds; the corners genuinely were inside cloud; and I reshaped the geometry until it
// passed — an 18 × 30 mouth in a 40-block mound, a cathedral doorway built to satisfy a contract
// nothing else in the build holds. **A red assert proves the code disagrees with the assert. It does
// not say which of the two is wrong.** Check a new invariant against whatever already solves the same
// problem — here, one file over, in a config comment — before reshaping anything to satisfy it.
//
// So what is asserted now is the claim the plot actually makes, and the one that has a player
// consequence: the keeper must not walk into cloud at the moment the crossing fires.
{
  const c = WILDS_BUBBLE.cave!
  // The mouth clears the trigger's width and the seam's half-width, with room — the plot's exact
  // reasoning: a bore cut to the numbers it must clear puts cloud where the crossing fires, so the
  // keeper hits the wall of their own doorway a pace before it takes them.
  const seamHalf = WILDS_BUBBLE.passageWidth * 0.85
  ok(c.boreHalfWidth > seamHalf, `the mouth is wider than the drawn seam (${c.boreHalfWidth} vs ${seamHalf})`)
  ok(c.boreHeight > WILDS_BUBBLE.passageHeight,
    `★ the mouth out-measures the crossing trigger's height (${c.boreHeight} vs ${WILDS_BUBBLE.passageHeight}) — ` +
    'a keeper the trigger accepts must not be standing in cloud')

  // And the part that is genuinely about the seam: its FOOT — the band a walking keeper meets — is
  // open. Overshoot above the mouth is allowed and expected, exactly as on the plot side.
  for (const seed of SEEDS) {
    const ribs = wildsSeamRibbon(seed, WILDS_BUBBLE)
    let buried = 0, sampled = 0
    for (const r of ribs) {
      for (let dy = 0; dy <= WILDS_BUBBLE.passageHeight; dy += 2) {
        sampled++
        if (bubbleCaveAt(Math.round(r.x), r.yb + dy, Math.round(r.z), seed, r.yb, WILDS_BUBBLE) === 'shell') buried++
      }
    }
    ok(sampled > 0 && buried === 0,
      `seed ${seed}: ${buried} of ${sampled} points in the crossing band stand inside the cave's cloud`)
  }

  // ★ AND THE LANDMARK CLAIM, WHICH IS THE ONE ALEX ASKED FOR AND THE ONLY REASON THE MOUND EXISTS.
  // `plot.ts`: *"`height` 15 IS ABOVE `wallHeight` 9 ON PURPOSE — that difference IS the landmark. A
  // mound that tops out level with the wall is a bump you find by walking into it."* Out here the
  // wall's height is not a config field, it is `topY` minus the ground at the door.
  {
    const ground = columnHeight(...(() => { const a = wildsSeamAnchor(SEED, WILDS_BUBBLE); return [Math.round(a.x), Math.round(a.z), SEED] as [number, number, number] })())
    const wallOverGround = WILDS_BUBBLE.topY - ground
    ok(c.height > wallOverGround,
      `★ the mound tops out ABOVE the wall (${c.height} vs ${wallOverGround} over the ground) — ` +
      'level with it is a bump you find by walking into it')
  }
}
