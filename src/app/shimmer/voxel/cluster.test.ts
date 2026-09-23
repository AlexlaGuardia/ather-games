// Run: npx tsx src/app/shimmer/voxel/cluster.test.ts
//
// ── ★★ WHAT THIS SUITE IS FOR, AND IT IS NOT THE ARITHMETIC ─────────────────────────────────────
// Every ⛔ in `CANON/game/shimmer-geography.md` › GARDEN CLUSTERS is a prediction about what a
// build would get wrong, and canon says so out loud: *"one keeper doing the folding is the single
// fact most likely to be built as a landlord"*, *"an empty quarter reads as unfolded, never as
// grey — this is the guard most likely to ship wrong."* Those are the asserts below. The geometry
// is checked too, but the geometry is the part a render would catch; a landlord and a greyed-out
// friend-shaped hole are the parts that would ship looking fine.
//
// ⚠ Two of these guards are about something NOT being there (no title, no presence). An absence
// claim needs a stronger instrument than a presence claim (PATTERNS › `verify-the-instrument`), so
// they are written against the module's actual exported surface and its source text rather than
// against a memory of having decided it.

import { readFileSync } from 'node:fs'
import {
  DEFAULT_CLUSTER, NO_SLOTS, QUARTERS, QUARTER_SIGN, MAX_OFFSET_FOR_REACH,
  clusterAt, clusterReach, cornersGiven, inGreen, inGreenSquare, isCluster, isGround,
  quarterFor, quarterLocal, quarterPlot, signIn, takeBackCorner,
  type ClusterConfig, type ClusterKeeper, type QuarterId,
} from './cluster'
import { PLOT_TIERS, plotForTier, edgeAt } from './plot'

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++ } else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const K = (seed: number, tier: number): ClusterKeeper => ({ seed, tier })
const withSlots = (s: Partial<Record<QuarterId, ClusterKeeper | null>>): ClusterConfig =>
  ({ ...DEFAULT_CLUSTER, slots: { ...NO_SLOTS, ...s } })

/** A cluster of four at mixed tiers — the general case most asserts run against. */
const FOUR = withSlots({ ne: K(1, 2), nw: K(7, 1), sw: K(42, 0), se: K(555, 2) })
const TWO = withSlots({ ne: K(1, 2), sw: K(42, 0) })

/** A coarse lattice over the whole cluster, dense enough to find a hole and cheap enough to run. */
function* lattice(cfg: ClusterConfig, step = 11) {
  const r = Math.ceil(clusterReach(cfg))
  for (let x = -r; x <= r; x += step) for (let z = -r; z <= r; z += step) yield [x, z] as const
}

console.log('the grid — every column has exactly one owner')
{
  // Totality is what makes "the border between quarters stays real" arithmetic instead of etiquette.
  let wrong = 0
  for (const [x, z] of lattice(FOUR, 7)) {
    const q = quarterFor(x, z)
    const s = QUARTER_SIGN[q]
    // The owning cell must be the one whose signs the column agrees with (axes go north/east).
    const okX = s.sx === 1 ? x >= 0 : x < 0
    const okZ = s.sz === 1 ? z >= 0 : z < 0
    if (!okX || !okZ) wrong++
  }
  check('the cell is the one whose signs the column agrees with', wrong === 0, `${wrong} columns`)
  check('four cells, no more', new Set(QUARTERS).size === 4)

  // A quarter's ground never leaves its own cell — so two keepers' folds cannot overlap at all.
  let escaped = 0
  for (const [x, z] of lattice(FOUR, 7)) {
    const c = clusterAt(x, z, FOUR)
    if (c.part !== 'ather' && c.quarter !== quarterFor(x, z)) escaped++
  }
  check('no quarter generates ground outside its own cell', escaped === 0, `${escaped} columns`)

  // The local frame is the quarter's own plot space: its centre is the origin there.
  for (const q of QUARTERS) {
    const s = QUARTER_SIGN[q]
    const l = quarterLocal(s.sx * DEFAULT_CLUSTER.offset, s.sz * DEFAULT_CLUSTER.offset, q, DEFAULT_CLUSTER)
    check(`${q}: its centre is the origin of its own plot space`, l.x === 0 && l.z === 0)
  }
}

console.log('the Green — as big as the friendship')
{
  // ★ Canon: "two keepers make half a Green; a fourth joining completes it."
  // ⚠ SAMPLE CELL CENTRES, NOT CELL CORNERS. A lattice that starts at `-green` puts its first row
  // exactly ON the square's edge (which `inGreenSquare` excludes) and its middle row exactly on the
  // axis, so the sample is asymmetric and an exact quarter is unreachable — the first cut of this
  // suite read that as the module carving ground out of the Green. The instrument was wrong, not
  // the subject; centres are symmetric, strictly inside, and divide by four exactly.
  const cell = 3
  const CENTRES: number[] = []
  for (let v = -DEFAULT_CLUSTER.green + cell / 2; v < DEFAULT_CLUSTER.green; v += cell) CENTRES.push(v)
  const area = (cfg: ClusterConfig) => {
    let n = 0
    for (const x of CENTRES) for (const z of CENTRES) if (inGreen(x, z, cfg)) n++
    return n
  }
  const full = area(withSlots({ ne: K(1, 0), nw: K(2, 0), sw: K(3, 0), se: K(4, 0) }))
  check('four corners given = a whole Green', full > 0)
  for (const given of [1, 2, 3, 4]) {
    const cfg = withSlots(Object.fromEntries(QUARTERS.slice(0, given).map(q => [q, K(1, 0)])))
    const frac = area(cfg) / full
    check(`${given} corner(s) given = ${given}/4 of the Green`, Math.abs(frac - given / 4) < 0.02,
      `got ${frac.toFixed(3)}`)
  }
  check('no corners given = no Green at all', area(withSlots({})) === 0)

  // ⛔ The Green is reserved coast: a fold grows TOWARD it, never through it. Inside the square a
  // column is the Green or it is nothing — it is never somebody's buildable ground.
  let carved = 0
  for (const cfg of [FOUR, TWO])
    for (const x of CENTRES) for (const z of CENTRES)
      if (clusterAt(x, z, cfg).part === 'quarter') carved++
  check('no quarter ground is ever generated inside the Green square', carved === 0, `${carved} columns`)

  // ⚠ AND THE ONE ENTRY POINT MUST ACTUALLY REPORT IT. Every assert above reads `inGreen`
  // directly, so deleting the Green's branch from `clusterAt` altogether left the suite green —
  // the middle simply stopped existing for the only function a renderer calls, and nothing said
  // so. Same shape as the wall ring: the predicate was tested, the PATH through it was not.
  let reported = 0, expected = 0
  for (const x of CENTRES) for (const z of CENTRES) {
    if (inGreen(x, z, FOUR)) expected++
    if (clusterAt(x, z, FOUR).part === 'green') reported++
  }
  check('clusterAt reports the Green it is standing on', reported === expected && expected > 0,
    `${reported} reported vs ${expected} expected`)

  // It is centred on the shared corner — the one point every cell touches.
  check('the Green is centred on the shared corner', inGreenSquare(0, 0, FOUR)
    && !inGreenSquare(FOUR.green, 0, FOUR) && !inGreenSquare(0, FOUR.green, FOUR))
}

console.log('⛔ an empty quarter reads as UNFOLDED, never grey')
{
  // Canon's "guard most likely to ship wrong". The whole defence is that nothing is generated:
  // an open slot yields `ather` at every column in its cell, so there is no ground for a renderer
  // to drain the colour out of.
  const cfg = TWO // nw and se are open
  for (const q of ['nw', 'se'] as const) {
    let ground = 0
    const s = QUARTER_SIGN[q]
    for (let i = 0; i < 4000; i++) {
      // Sample that cell's disc, including well inside where a fold would certainly be.
      const a = (i / 4000) * Math.PI * 2
      const r = (i % 97) / 97 * 480
      const x = s.sx * cfg.offset + Math.cos(a) * r
      const z = s.sz * cfg.offset + Math.sin(a) * r
      if (quarterFor(x, z) !== q) continue
      const c = clusterAt(x, z, cfg)
      if (c.part !== 'ather') ground++
    }
    check(`${q}: an open slot generates nothing at all`, ground === 0, `${ground} columns of ground`)
  }
  // And the corner it never gave is not the Green either, and not the neighbours' to build on.
  check('an ungiven corner is not Green', !inGreen(-20, 20, TWO) && !inGreen(20, -20, TWO))
  check('an ungiven corner is not anybody else\'s ground',
    clusterAt(-20, 20, TWO).part === 'ather' && clusterAt(20, -20, TWO).part === 'ather')
  // ⚠ The one thing a renderer could still get wrong is inheriting a "quarter" id and tinting it.
  // The id is answered for an open cell on purpose (a UI needs to know WHICH slot is open), so the
  // keeper must be null there and nothing else may imply a body.
  const open = clusterAt(-20, 480, TWO)
  check('an open cell reports its id but no keeper', open.quarter === 'nw' && open.keeper === null)
}

console.log('folded once, it holds')
{
  // A quiet keeper's quarter sits exactly as it was. The geometry is a function of the SLOTS, so
  // there is no mechanism by which anyone else's state can touch it. Flip every other slot and
  // the ne quarter must not move one block.
  const base = withSlots({ ne: K(1, 2), nw: K(7, 1), sw: K(42, 0), se: K(555, 2) })
  const variants: ClusterConfig[] = [
    withSlots({ ne: K(1, 2) }),
    withSlots({ ne: K(1, 2), nw: K(7, 1) }),
    withSlots({ ne: K(1, 2), sw: K(42, 0), se: K(555, 2) }),
  ]
  for (const v of variants) {
    let moved = 0
    for (const [x, z] of lattice(base, 7)) {
      if (quarterFor(x, z) !== 'ne') continue
      if (inGreenSquare(x, z, base)) continue // the Green is the one thing that IS a function of the others
      if (clusterAt(x, z, base).part !== clusterAt(x, z, v).part) moved++
    }
    check(`ne is unchanged by who else is in (${cornersGiven(v)} in)`, moved === 0, `${moved} columns`)
  }

  // ★ And the frame is made ONCE: a fourth signing in changes nothing that was already there.
  const three = withSlots({ ne: K(1, 2), nw: K(7, 1), sw: K(42, 0) })
  const four = signIn(three, 'se', K(555, 2), ['ne', 'nw', 'sw'])!
  let changed = 0, cloudLifted = 0
  for (const [x, z] of lattice(four, 7)) {
    if (quarterFor(x, z) === 'se') continue
    const a = clusterAt(x, z, three).part, b = clusterAt(x, z, four).part
    if (a === b) continue
    // ⚖ THE ONE THING THAT MAY CHANGE IS CLOUD, and it may only ever LIFT. A wall stood where the
    // fold met the Ather; the fourth keeper's ground is now behind it, so it is not an edge of the
    // world any more. Canon's claim is about ground — "nobody's plot changes, no ground is lost" —
    // and a wall that dissolves because a friend arrived is that claim holding, not breaking. What
    // would break it is ground appearing or vanishing, which is what this counts.
    if (a === 'wall' && b === 'ather') { cloudLifted++; continue }
    changed++
  }
  check('a fourth signing in takes no ground from anyone', changed === 0, `${changed} columns`)
  check('and the only change is cloud lifting where the new ground meets theirs', cloudLifted > 0,
    'nothing lifted — either the probe is blind or the quarters never meet')
}

console.log('a keeper may take back their own corner')
{
  const after = takeBackCorner(FOUR, 'nw')
  check('the corner comes back', cornersGiven(after) === 3 && after.slots.nw === null)
  // ⚖ "It is the unmaking of exactly one thing." Nobody's plot changes and no other ground is lost.
  let others = 0
  for (const [x, z] of lattice(FOUR, 7)) {
    if (quarterFor(x, z) === 'nw') continue
    if (clusterAt(x, z, FOUR).part !== clusterAt(x, z, after).part) others++
  }
  check('no other quarter changes by one block', others === 0, `${others} columns`)
  // The Green shrinks by exactly that corner — a quarter of it, not a ring off all four sides.
  const step = 3
  const centres: number[] = []
  for (let v = -FOUR.green + step / 2; v < FOUR.green; v += step) centres.push(v)
  const greenCells = (cfg: ClusterConfig) => {
    const out: string[] = []
    for (const x of centres) for (const z of centres) if (inGreen(x, z, cfg)) out.push(`${x},${z}`)
    return out
  }
  const before = new Set(greenCells(FOUR))
  const lost = greenCells(FOUR).filter(k => !new Set(greenCells(after)).has(k))
  check('the Green shrinks by exactly the given corner',
    lost.length > 0 && lost.every(k => quarterFor(Number(k.split(',')[0]), Number(k.split(',')[1])) === 'nw')
    && lost.length === before.size / 4, `lost ${lost.length} of ${before.size}`)
  // The world never unfolds a cluster; only a keeper gives back. Nothing in the module may remove
  // a keeper on anyone else's behalf.
  check('the module offers no way to remove somebody else',
    // `takeBackCorner` is the only unmaking, and it names the quarter doing the giving.
    typeof takeBackCorner === 'function' && takeBackCorner.length === 2)
}

console.log('⛔ joining: unanimous consent, and no rune, no level, no craft')
{
  const two = withSlots({ ne: K(1, 2), nw: K(7, 1) })
  check('a slot cannot be filled without everyone already in', signIn(two, 'sw', K(9, 0), ['ne']) === null)
  check('you cannot give away someone else\'s corner', signIn(two, 'sw', K(9, 0), ['nw']) === null)
  check('unanimous consent fills it', signIn(two, 'sw', K(9, 0), ['ne', 'nw'])!.slots.sw !== null)
  check('an occupied slot is not on offer', signIn(two, 'ne', K(9, 0), ['ne', 'nw']) === null)
  // ★ A friend far behind can still be folded in — joining a made frame is signing, not folding.
  const behind = signIn(two, 'sw', K(9, 0), ['ne', 'nw'])
  check('a tier-0 friend joins a cluster of tier-2 keepers', behind !== null && behind.slots.sw!.tier === 0)
  // The signature takes no rune, level or craft, and there is nothing to pass one in as.
  check('signIn asks for a keeper and consent, nothing else', signIn.length === 4)
  // A cluster starts at TWO; one keeper alone is a plot, not a deficient cluster.
  check('one keeper is not a cluster', !isCluster(withSlots({ ne: K(1, 0) })))
  check('two is a cluster', isCluster(two))
}

console.log('⛔ no title, no folder, no presence — the landlord guards')
{
  // Canon: "THERE IS NO TITLE, and the absence is deliberate… a name for the role is the thing
  // that would invite the ownership every guard above forbids." The cheapest defence is not to
  // mint one, so this asserts the word is absent from the MODEL — read off the source, because an
  // absence claim needs an instrument that can actually see the whole subject.
  const src = readFileSync(new URL('./cluster.ts', import.meta.url), 'utf8')
  // Field declarations only: prose may (and does) discuss why these words are banned.
  const fields = [...src.matchAll(/^\s{2}(\w+)[?]?:/gm)].map(m => m[1].toLowerCase())
  const banned = ['folder', 'owner', 'leader', 'founder', 'head', 'host', 'admin', 'rank', 'title']
  const minted = fields.filter(f => banned.includes(f))
  check('no field mints a name for the role', minted.length === 0, minted.join(', '))
  // And no presence/liveness input anywhere — "folded once, holds" has to be unimplementable-away.
  const live = fields.filter(f => ['present', 'online', 'active', 'lastseen', 'away', 'idle'].includes(f))
  check('the geometry has no presence input', live.length === 0, live.join(', '))
  // The keeper record itself is two facts, and neither is a status.
  check('a keeper in a slot is a seed and a tier, nothing more',
    Object.keys(K(1, 0)).sort().join(',') === 'seed,tier')
}

console.log('the fold — coast, wall, and the middle filling in')
{
  // The wall rings the OUTER coast only. A cloud wall on the border between two quarters would be
  // a door with a lock built out of weather; canon says a cluster is one place.
  //
  // ⚠⚠ THIS IS WALKED RADIALLY AT HALF-BLOCK STEPS AND THE FIRST CUT OF IT WAS BLIND. It sampled
  // the same step-5 lattice as everything above — and `wallWidth` is **2**, so a ring two blocks
  // thick sits in the gaps between samples. Deleting the inner-border cut from `inWallRing`
  // outright left the suite 50/50 GREEN: the mutation applied (the anchor was asserted) and the
  // instrument could not see its subject. The bearings that matter are the ones pointing at the
  // shared corner, so they are walked directly rather than hoped for.
  let inner = 0, innerSeen = 0
  for (const q of QUARTERS) {
    const s = QUARTER_SIGN[q]
    const plot = quarterPlot(q, FOUR)!
    // Sweep only the bearings that genuinely point back at the shared corner — the ones canon
    // forbids a wall on. (The two flanking arcs face a NEIGHBOUR and are a different question,
    // asked below.)
    for (let i = 1; i < 90; i++) {
      const a = Math.PI + (i / 90) * (Math.PI / 2)
      const dx = Math.cos(a) * s.sx, dz = Math.sin(a) * s.sz
      for (let r = plot.capRadius * 0.6; r <= plot.capRadius + plot.wallWidth + 2; r += 0.5) {
        const x = s.sx * FOUR.offset + dx * r, z = s.sz * FOUR.offset + dz * r
        if (quarterFor(x, z) !== q) continue
        innerSeen++
        if (clusterAt(x, z, FOUR).part === 'wall') inner++
      }
    }
  }
  check('the inward bearings were actually walked', innerSeen > 20000, `${innerSeen} samples`)
  check('no wall stands between a keeper and the Green', inner === 0, `${inner} columns`)

  // ⛔ And no wall between two keepers' ground. Walk the borders where both folds reach, densely:
  // the ring is 2 blocks thick, so this is measured in half-blocks or it measures nothing.
  // ⚠ MIRROR THE AXIS THE BORDER RUNS ON, not always x. The first cut of this mirrored x for both
  // borders, so a column beside the z=0 border was compared against one near the ORIGIN — i.e.
  // against the Green — and reported five walls standing between keepers that do not exist.
  const maxedAll = withSlots({ ne: K(1, 2), nw: K(7, 2), sw: K(42, 2), se: K(555, 2) })
  let between = 0, walls = 0
  for (let v = 1; v < 700; v += 0.5) {
    for (const [x, z] of [[0.5, v], [-0.5, v], [0.5, -v], [-0.5, -v]] as const) {
      if (clusterAt(x, z, maxedAll).part !== 'wall') continue
      walls++
      if (isGround(-x, z, maxedAll)) between++          // border x = 0: mirror x
    }
    for (const [x, z] of [[v, 0.5], [v, -0.5], [-v, 0.5], [-v, -0.5]] as const) {
      if (clusterAt(x, z, maxedAll).part !== 'wall') continue
      walls++
      if (isGround(x, -z, maxedAll)) between++          // border z = 0: mirror z
    }
  }
  check('no wall stands between two keepers\' ground', between === 0, `${between} of ${walls} border walls`)

  // There IS a wall, on the outside — otherwise every assert above passes for the wrong reason.
  let outer = 0
  for (const q of QUARTERS) {
    const s = QUARTER_SIGN[q]
    const plot = quarterPlot(q, FOUR)!
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * (Math.PI / 2)
      const dx = Math.cos(a) * s.sx, dz = Math.sin(a) * s.sz
      for (let r = plot.capRadius * 0.6; r <= plot.capRadius + plot.wallWidth + 2; r += 0.5) {
        const x = s.sx * FOUR.offset + dx * r, z = s.sz * FOUR.offset + dz * r
        if (clusterAt(x, z, FOUR).part === 'wall') outer++
      }
    }
  }
  check('the outer coast is walled', outer > 500, `${outer} columns`)

  // ★ THE MIDDLE FILLS IN AS THE FOUR GROW. The diagonal contact holds at every tier (so a cluster
  // formed on day one is walkable), and the Green's outer corners are reached as folds grow.
  const g = DEFAULT_CLUSTER.green, o = DEFAULT_CLUSTER.offset
  for (const tier of [0, 1, 2]) {
    const cfg = withSlots({ ne: K(1, tier), nw: K(7, tier), sw: K(42, tier), se: K(555, tier) })
    const justOut = clusterAt(g + 1, g + 1, cfg)
    check(`tier ${tier}: the quarter meets the Green on the diagonal`, justOut.part === 'quarter',
      `got ${justOut.part}`)
  }
  const maxed = withSlots({ ne: K(1, 2), nw: K(7, 2), sw: K(42, 2), se: K(555, 2) })
  check('at max tier the Green\'s outer corner is held too', clusterAt(g + 1, 1, maxed).part === 'quarter')

  // ⚠ THE BOUND ON `offset`: past it a MAX fold can never reach the shared corner and the cluster
  // could never close. This is the assert that stops the number being nudged into a dead shape.
  check('offset is inside the reach of a max fold', o <= MAX_OFFSET_FOR_REACH(DEFAULT_CLUSTER.base),
    `offset ${o} vs bound ${MAX_OFFSET_FOR_REACH(DEFAULT_CLUSTER.base).toFixed(1)}`)
  // And the coast each quarter draws is its OWN — same seed in, same island as a solo plot.
  const q = quarterPlot('ne', FOUR)!
  const solo = plotForTier(2)
  check('a quarter is the keeper\'s own fold at their own tier', q.capRadius === solo.capRadius
    && q.capRadius === PLOT_TIERS[2])
  const l = quarterLocal(o + 100, o + 40, 'ne', DEFAULT_CLUSTER)
  check('the coast is drawn on the keeper\'s own seed in their own space',
    edgeAt(l.x, l.z, 1, q) === edgeAt(100, 40, 1, solo))

  // The reach a renderer has to be ready for tracks the widest slot, not the tier cap.
  check('an early cluster is a smaller subject than a maxed one',
    clusterReach(withSlots({ ne: K(1, 0), nw: K(2, 0) })) < clusterReach(maxed))
  check('an empty frame reaches only as far as the Green', clusterReach(withSlots({})) === DEFAULT_CLUSTER.green)
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass}/${pass + fail} passed${fail ? `, ${fail} failed` : ''}`)
process.exit(fail === 0 ? 0 : 1)
