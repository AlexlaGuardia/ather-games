// Run: npx tsx src/app/shimmer/voxel/cluster.test.ts
//
// ── ★★ WHAT THIS SUITE IS FOR, AND IT IS NOT THE ARITHMETIC ─────────────────────────────────────
// Every ⛔ in `CANON/game/shimmer-geography.md` › GARDEN CLUSTERS is a prediction about what a
// build would get wrong, and canon says so out loud: *"one keeper doing the folding is the single
// fact most likely to be built as a landlord"*, *"an empty quarter reads as unfolded, never as
// grey — this is the guard most likely to ship wrong."* Those are the asserts below.
//
// ★ AND TWO OF THEM ARE ALEX'S, FROM LOOKING AT THE FIRST CUT. *"The amount of land they lose is
// too much"* is now **the whole-fold guard** — a quarter's ground must equal a solo plot's, block
// for block, so no future tidy-up can reintroduce a clip. *"Tier 1 and 0 get valleys that connect
// them to the middle and to adjacent gardens"* is now **the flood fill** — at every combination of
// tiers, every keeper must be able to WALK to the Green. Neither is checkable by eye on a picture
// that is 4.6 blocks to the pixel, which is exactly why they are here.

import { readFileSync } from 'node:fs'
import {
  DEFAULT_CLUSTER, NO_SLOTS, QUARTERS, QUARTER_SIGN, RIM_PAIRS, MIN_GREEN, MIN_OFFSET,
  clusterAt, clusterReach, cornersGiven, foldAt, greenQuadrant, inFold, inGreen, inGreenSquare,
  inRim, inSpoke, isCluster, isGround, joinAt, quarterCentre, quarterLocal, quarterPlot,
  signIn, takeBackCorner,
  type ClusterConfig, type ClusterKeeper, type QuarterId,
} from './cluster'
import { PLOT_TIERS, plotForTier, edgeAt, DEFAULT_PLOT } from './plot'

let pass = 0, fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++ } else { fail++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const K = (seed: number, tier: number): ClusterKeeper => ({ seed, tier })
const withSlots = (s: Partial<Record<QuarterId, ClusterKeeper | null>>): ClusterConfig =>
  ({ ...DEFAULT_CLUSTER, slots: { ...NO_SLOTS, ...s } })
const SEED: Record<QuarterId, number> = { ne: 1, nw: 7, sw: 42, se: 555 }
const allAt = (tiers: Partial<Record<QuarterId, number>>): ClusterConfig =>
  withSlots(Object.fromEntries(QUARTERS.filter(q => tiers[q] !== undefined)
    .map(q => [q, K(SEED[q], tiers[q]!)])))

const FOUR = allAt({ ne: 2, nw: 1, sw: 0, se: 2 })
const TWO = allAt({ ne: 2, sw: 0 })

function* lattice(cfg: ClusterConfig, step = 17) {
  const r = Math.ceil(clusterReach(cfg))
  for (let x = -r; x <= r; x += step) for (let z = -r; z <= r; z += step) yield [x, z] as const
}

console.log('⛔ nobody loses an inch of their own fold (Alex, on the first cut)')
{
  // THE CLIP IS GONE AND THIS IS THE GUARD THAT KEEPS IT GONE. A quarter's ground must be a whole
  // plot — the same island a solo keeper would stand on, translated. Anything that trims a fold to
  // make the packing tidier fails here, which is the point: the first cut was tidy and took ground.
  for (const tier of [0, 1, 2]) {
    const cfg = allAt({ ne: tier, nw: tier, sw: tier, se: tier })
    for (const q of QUARTERS) {
      const c = quarterCentre(q, cfg), plot = plotForTier(tier)
      let missing = 0, checked = 0
      for (let i = 0; i < 1500; i++) {
        const a = (i / 1500) * Math.PI * 2, r = (i % 61) / 61 * plot.capRadius
        const lx = Math.cos(a) * r, lz = Math.sin(a) * r
        if (Math.hypot(lx, lz) > edgeAt(lx, lz, SEED[q], plot)) continue   // outside the solo island
        checked++
        // Inside a solo plot => must be this keeper's ground in the cluster. The ONE lawful
        // exception is the Green, which canon says they gave.
        const part = clusterAt(c.x + lx, c.z + lz, cfg).part
        if (part !== 'quarter' && part !== 'green') missing++
      }
      check(`tier ${tier} ${q}: the whole solo island is still theirs`, missing === 0 && checked > 400,
        `${missing} lost of ${checked}`)
    }
  }
  // And two folds can NEVER occupy the same column — the reason `offset` is bounded from below.
  let doubled = 0
  for (const [x, z] of lattice(allAt({ ne: 2, nw: 2, sw: 2, se: 2 }), 13)) {
    const cfg = allAt({ ne: 2, nw: 2, sw: 2, se: 2 })
    if (QUARTERS.filter(q => inFold(x, z, q, cfg)).length > 1) doubled++
  }
  check('two keepers never own the same column', doubled === 0, `${doubled} columns`)
  check('offset is at or past the tightest lawful spacing', DEFAULT_CLUSTER.offset >= MIN_OFFSET(),
    `${DEFAULT_CLUSTER.offset} vs ${MIN_OFFSET()}`)
}

console.log('⛔ every keeper can WALK to the Green, at every tier (Alex: the valleys)')
{
  // ★ THE FLOOD FILL IS THE WHOLE POINT OF THE JOINS, AND IT IS THE ONLY HONEST INSTRUMENT FOR IT.
  // "Is it connected" is not a property of any one column, so no per-column assert can see it — the
  // first cut passed a diagonal-contact check at every tier and still left a tier-0 keeper looking
  // at a Green across open Ather, because the check only ever probed ONE quarter's diagonal.
  const STEP = 20
  function reachedFromGreen(cfg: ClusterConfig): Set<string> {
    const r = Math.ceil(clusterReach(cfg))
    const key = (x: number, z: number) => `${x},${z}`
    const seen = new Set<string>()
    const stack: [number, number][] = [[0, 0]]
    while (stack.length) {
      const [x, z] = stack.pop()!
      if (Math.abs(x) > r || Math.abs(z) > r) continue
      const k = key(x, z)
      if (seen.has(k) || !isGround(x, z, cfg)) continue
      seen.add(k)
      stack.push([x + STEP, z], [x - STEP, z], [x, z + STEP], [x, z - STEP])
    }
    return seen
  }
  const tiers = [0, 1, 2]
  let combos = 0
  const stranded: string[] = []
  for (const a of tiers) for (const b of tiers) for (const c of tiers) for (const d of tiers) {
    const cfg = allAt({ ne: a, nw: b, sw: c, se: d })
    const seen = reachedFromGreen(cfg)
    combos++
    for (const q of QUARTERS) {
      const ctr = quarterCentre(q, cfg)
      const gx = Math.round(ctr.x / STEP) * STEP, gz = Math.round(ctr.z / STEP) * STEP
      if (!seen.has(`${gx},${gz}`)) stranded.push(`${a}${b}${c}${d}:${q}`)
    }
  }
  check(`every keeper reaches the Green in all ${combos} tier combinations`,
    combos === 81 && stranded.length === 0, stranded.slice(0, 6).join(' '))

  // ★ AND THE JOINS ARE EXACTLY AS LONG AS THE GAP — the property that makes Alex's "tier 1 and 0
  // get valleys" fall out of the geometry instead of being a case in the code. Measured as the
  // ground a spoke ADDS (lane ground that is neither the fold nor the Green): it must shrink as the
  // fold grows into it, and all but vanish at max tier.
  const added = (tier: number) => {
    const cfg = allAt({ ne: tier, nw: tier, sw: tier, se: tier })
    let n = 0
    for (const [x, z] of lattice(cfg, 13))
      for (const q of QUARTERS)
        if (inSpoke(x, z, q, cfg) && !inFold(x, z, q, cfg) && !inGreenSquare(x, z, cfg)) n++
    return n
  }
  const [a0, a1, a2] = [added(0), added(1), added(2)]
  check('a spoke is real ground at tier 0', a0 > 100, `${a0} columns`)
  check('it shrinks as the fold grows into it', a0 > a1 && a1 > a2, `${a0} > ${a1} > ${a2}`)
  // ⚠ NOT ZERO AT MAX TIER, AND THE REASON IS THE SAME ONE THE FLOOD FILL FOUND. The Green is a
  // SQUARE: a max fold covers its CORNER but not the last blocks beside its EDGE off the diagonal,
  // so a few columns of lane still bridge that wedge. The first version of this assert demanded
  // zero and failed honestly on two columns — which are two columns of walkway doing their job.
  check('at max tier it is a threshold, not a road', a2 < a0 / 20, `${a2} vs ${a0}`)
}

console.log('the middle is whole from the moment it exists')
{
  // ⚠⚠ THIS BLOCK ASSERTS THE OPPOSITE OF WHAT IT ASSERTED THIS MORNING, ON PURPOSE. The 09-23
  // amendment ruled the Green "as big as the corners given" — two keepers, half a Green — and Alex
  // overturned it the same day looking at the render: "the middle should stay whole regardless."
  // The overturn is filed in CANON_GAPS.md. If a later reader finds this suite disagreeing with
  // that paragraph, the suite is the newer fact and the canon file is the one waiting to catch up.
  const cell = 5
  const CENTRES: number[] = []
  for (let v = -DEFAULT_CLUSTER.green + cell / 2; v < DEFAULT_CLUSTER.green; v += cell) CENTRES.push(v)
  const area = (cfg: ClusterConfig) => {
    let n = 0
    for (const x of CENTRES) for (const z of CENTRES) if (inGreen(x, z, cfg)) n++
    return n
  }
  const whole = CENTRES.length * CENTRES.length
  check('four corners given = a whole Green', area(allAt({ ne: 0, nw: 0, sw: 0, se: 0 })) === whole)
  for (const given of [2, 3, 4]) {
    const cfg = withSlots(Object.fromEntries(QUARTERS.slice(0, given).map(q => [q, K(SEED[q], 0)])))
    check(`${given} keepers still get the WHOLE middle`, area(cfg) === whole,
      `${area(cfg)} of ${whole}`)
  }
  // ⛔ But it is the MIDDLE that is whole, not the cluster: below two there is no cluster and no
  // Green at all. One keeper alone is a plot, and a plot has no middle.
  check('one keeper has no Green', area(allAt({ ne: 0 })) === 0)
  check('no keepers, no Green', area(withSlots({})) === 0)

  // ⚠ AND THE ONE ENTRY POINT MUST ACTUALLY REPORT IT. Every assert above reads `inGreen` directly,
  // so deleting the Green's branch from `clusterAt` left the FIRST version of this suite green —
  // the middle stopped existing for the only function a renderer calls and nothing said so.
  let reported = 0, expected = 0
  for (const x of CENTRES) for (const z of CENTRES) {
    if (inGreen(x, z, FOUR)) expected++
    if (clusterAt(x, z, FOUR).part === 'green') reported++
  }
  check('clusterAt reports the Green it is standing on', reported === expected && expected > 0,
    `${reported} vs ${expected}`)
  // ★ An absent friend's quadrant is still ATTRIBUTED, because the table set for them has to be set
  // somewhere — canon's "an open slot shows as a place set at its table, never a Vacant sign".
  const open = clusterAt(-40, -40, allAt({ ne: 2, nw: 1, se: 2 }))
  check('an absent friend\'s quadrant is Green, and still named as theirs',
    open.part === 'green' && open.quarter === 'sw' && open.keeper === null)

  // ⛔ Reserved coast: no fold's ground is ever generated inside the Green's square.
  let carved = 0
  for (const cfg of [FOUR, allAt({ ne: 2, nw: 2, sw: 2, se: 2 })])
    for (const x of CENTRES) for (const z of CENTRES)
      if (clusterAt(x, z, cfg).part === 'quarter') carved++
  check('no fold is ever generated inside the Green', carved === 0, `${carved} columns`)
  check('the Green is big enough to be made of corners somebody had',
    DEFAULT_CLUSTER.green >= MIN_GREEN(DEFAULT_CLUSTER),
    `${DEFAULT_CLUSTER.green} vs ${MIN_GREEN(DEFAULT_CLUSTER).toFixed(1)}`)
  const maxed = allAt({ ne: 2, nw: 2, sw: 2, se: 2 })
  for (const q of QUARTERS) {
    const s2 = QUARTER_SIGN[q]
    const l = quarterLocal(s2.sx * (DEFAULT_CLUSTER.green - 1), s2.sz * (DEFAULT_CLUSTER.green - 1), q, maxed)
    check(`${q}: a max fold's coast would have covered its corner`,
      Math.hypot(l.x, l.z) <= edgeAt(l.x, l.z, SEED[q], plotForTier(2)))
  }
}

console.log('⛔ an empty quarter reads as UNFOLDED, never grey')
{
  // Canon's "guard most likely to ship wrong". The defence is that NOTHING is generated: no fold,
  // no Green corner, no spoke, and no rim to it — so there is nothing for a renderer to drain.
  const cfg = TWO // nw and se are open
  for (const q of ['nw', 'se'] as const) {
    const c = quarterCentre(q, cfg)
    let ground = 0
    for (let i = 0; i < 4000; i++) {
      const a = (i / 4000) * Math.PI * 2, r = (i % 97) / 97 * 520
      if (clusterAt(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, cfg).part === 'quarter') ground++
    }
    check(`${q}: an open slot grows no fold`, ground === 0, `${ground} columns`)
    check(`${q}: an open slot has no spoke`, !inSpoke(c.x * 0.7, c.z * 0.7, q, cfg))
    // ⛔ AND NO DOOR. A threshold to a quarter nobody has taken is a way out of a place that is not
    // there. Asserted against `clusterAt` over the whole quadrant rather than against the slot map,
    // because the slot map is what a doorway bug would already agree with — the first version of
    // this checked `clusterThresholds().length` and a mutation that handed every quadrant a door
    // sailed straight past it.
    let doors = 0
    for (let i = 0; i < 1200; i++) {
      const a2 = (i / 1200) * Math.PI * 2, r = (i % 53) / 53 * 620
      if (clusterAt(c.x + Math.cos(a2) * r, c.z + Math.sin(a2) * r, cfg).part === 'door') doors++
    }
    check(`${q}: an open slot has no door`, doors === 0, `${doors} columns`)
    // ★ The MIDDLE is the exception and the only one: it is whole regardless, so the quadrant that
    // would have been theirs is Green and waiting. Everything outward of it is absence.
    check(`${q}: but the middle is still whole over their quadrant`,
      inGreen(QUARTER_SIGN[q].sx * 40, QUARTER_SIGN[q].sz * 40, cfg))
  }
  // ⛔ A rim needs BOTH ends — a lane to a quarter nobody has taken is ground leading nowhere.
  for (const [a, b] of RIM_PAIRS) {
    const live = cfg.slots[a] !== null && cfg.slots[b] !== null
    const mid = QUARTER_SIGN[a].sx === QUARTER_SIGN[b].sx
      ? { x: QUARTER_SIGN[a].sx * cfg.offset, z: 0 }
      : { x: 0, z: QUARTER_SIGN[a].sz * cfg.offset }
    check(`rim ${a}-${b} exists only if both are in`, inRim(mid.x, mid.z, a, b, cfg) === live)
  }
  // The diagonals are NOT adjacent: they meet at the Green, which is what a middle is for.
  check('no rim runs corner to corner', !RIM_PAIRS.some(([a, b]) =>
    QUARTER_SIGN[a].sx !== QUARTER_SIGN[b].sx && QUARTER_SIGN[a].sz !== QUARTER_SIGN[b].sz))
}

console.log('folded once, it holds')
{
  const base = allAt({ ne: 2, nw: 1, sw: 0, se: 2 })
  // A quiet keeper's fold sits exactly as it was. Only their OWN ground is asserted here: the Green
  // and the lanes are shared by construction, and a lane appearing when a friend arrives is the
  // system working.
  for (const v of [allAt({ ne: 2 }), allAt({ ne: 2, nw: 1 }), allAt({ ne: 2, sw: 0, se: 2 })]) {
    let moved = 0
    for (const [x, z] of lattice(base, 13))
      if (inFold(x, z, 'ne', base) !== inFold(x, z, 'ne', v)) moved++
    check(`ne's own ground is unchanged by who else is in (${cornersGiven(v)} in)`, moved === 0,
      `${moved} columns`)
  }
  // The frame is made once: a fourth signing in takes no ground from anyone.
  const three = allAt({ ne: 2, nw: 1, sw: 0 })
  const four = signIn(three, 'se', K(SEED.se, 2), ['ne', 'nw', 'sw'])!
  let lost = 0, gained = 0
  for (const [x, z] of lattice(four, 13)) {
    const a = clusterAt(x, z, three).part, b = clusterAt(x, z, four).part
    if (a === 'quarter' && b !== 'quarter') lost++
    if (b === 'join' && a === 'ather') gained++
  }
  check('a fourth signing in takes no ground from anyone', lost === 0, `${lost} columns`)
  check('and the ways to them appear', gained > 0, 'no new lane — the rim is not being built')
}

console.log('a keeper may take back their own corner')
{
  const after = takeBackCorner(FOUR, 'nw')
  check('the corner comes back', cornersGiven(after) === 3 && after.slots.nw === null)
  let others = 0
  for (const [x, z] of lattice(FOUR, 13))
    for (const q of ['ne', 'sw', 'se'] as const)
      if (inFold(x, z, q, FOUR) !== inFold(x, z, q, after)) others++
  check('nobody else\'s plot changes', others === 0, `${others} columns`)
  const cell = 5, cs: number[] = []
  for (let v = -FOUR.green + cell / 2; v < FOUR.green; v += cell) cs.push(v)
  const greenCells = (c: ClusterConfig) => cs.flatMap(x => cs.filter(z => inGreen(x, z, c)).map(z => `${x},${z}`))
  // ⚠ THE GREEN NO LONGER SHRINKS, AND THIS ASSERT IS THE INVERSE OF THIS MORNING'S. Canon's
  // amendment had the middle shrink by exactly the withdrawn corner; Alex overturned it — "the
  // middle should stay whole regardless" — so what a keeper takes back is their FOLD's membership,
  // and the middle the folding made stays made.
  check('the middle does not shrink when a corner comes back',
    greenCells(after).length === greenCells(FOUR).length && greenCells(FOUR).length > 0)
  // ⛔ It goes only when there is no cluster left to have a middle.
  const oneLeft = takeBackCorner(takeBackCorner(takeBackCorner(FOUR, 'nw'), 'sw'), 'se')
  check('below two keepers there is no middle at all',
    !isCluster(oneLeft) && greenCells(oneLeft).length === 0)
}

console.log('⛔ joining: unanimous consent, and no rune, no level, no craft')
{
  const two = allAt({ ne: 2, nw: 1 })
  check('a slot cannot be filled without everyone already in', signIn(two, 'sw', K(9, 0), ['ne']) === null)
  check('you cannot give away someone else\'s corner', signIn(two, 'sw', K(9, 0), ['nw']) === null)
  check('unanimous consent fills it', signIn(two, 'sw', K(9, 0), ['ne', 'nw'])!.slots.sw !== null)
  check('an occupied slot is not on offer', signIn(two, 'ne', K(9, 0), ['ne', 'nw']) === null)
  const behind = signIn(two, 'sw', K(9, 0), ['ne', 'nw'])
  check('a tier-0 friend joins a cluster of grown keepers', behind!.slots.sw!.tier === 0)
  check('signIn asks for a keeper and consent, nothing else', signIn.length === 4)
  check('one keeper is not a cluster', !isCluster(allAt({ ne: 0 })))
  check('two is a cluster', isCluster(two))
}

console.log('⛔ no title, no folder, no presence — the landlord guards')
{
  // Canon: "a name for the role is the thing that would invite the ownership every guard forbids."
  // Asserted against the SOURCE, because an absence claim needs an instrument that sees the subject.
  const src = readFileSync(new URL('./cluster.ts', import.meta.url), 'utf8')
  const fields = [...src.matchAll(/^\s{2}(\w+)[?]?:/gm)].map(m => m[1].toLowerCase())
  const banned = ['folder', 'owner', 'leader', 'founder', 'head', 'host', 'admin', 'rank', 'title']
  const minted = fields.filter(f => banned.includes(f))
  check('no field mints a name for the role', minted.length === 0, minted.join(', '))
  const live = fields.filter(f => ['present', 'online', 'active', 'lastseen', 'away', 'idle'].includes(f))
  check('the geometry has no presence input', live.length === 0, live.join(', '))
  check('a keeper in a slot is a seed and a tier, nothing more',
    Object.keys(K(1, 0)).sort().join(',') === 'seed,tier')
  // ⚠ AND THE PLACEHOLDER MUST STAY A PLACEHOLDER. `valley` is canon already — the Rebirth Valleys
  // (game/shimmer-geography.md > The Greyfields, 08-13). Minting it here for a lane between two
  // gardens is the basin/prime collision a third time, so the word may not appear as an identifier
  // until the Magii seat rules the name.
  const idents = [...src.matchAll(/\b(?:const|let|function|type|interface|export const)\s+(\w+)/g)].map(m => m[1])
  check('the build does not mint `valley` as a name',
    !idents.some(i => /valley/i.test(i)), idents.filter(i => /valley/i.test(i)).join(', '))
}

console.log('one cloud wall, because a cluster is one fold')
{
  // ⚠⚠ WALKED DENSELY, BECAUSE THE FIRST VERSION OF THIS GUARD WAS BLIND. `wallWidth` is 2 and it
  // sampled a step-5 lattice, so a mutation that deleted the wall rule outright left the suite
  // green with the mutation provably applied. A ring two blocks thick has to be measured in halves.
  const cfg = FOUR
  let walls = 0, sealed = 0, holes = 0
  for (const q of QUARTERS) {
    const k = cfg.slots[q]
    if (!k) continue
    const c = quarterCentre(q, cfg), plot = plotForTier(k.tier)
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * Math.PI * 2
      const dx = Math.cos(a), dz = Math.sin(a)
      const e = edgeAt(dx * 100, dz * 100, k.seed, plot)
      let sawWall = false, sawGroundPast = false
      for (let r = e - 1; r <= e + plot.wallWidth + 3; r += 0.5) {
        const p = clusterAt(c.x + dx * r, c.z + dz * r, cfg).part
        // ⚠ A DOOR CLOSES A BEARING TOO, AND THIS GUARD SAID OTHERWISE FOR ONE COMMIT. When the four
        // thresholds landed it reported 38 bearings "open to the void" — every one of them a
        // doorway, which is an opening by design. What makes a door safe is not that it is walled
        // but that it has a SOLID BACK: `plot.ts` stops the bore at the coast because running it
        // further is "a literal hole in the fold's shell". That is a material fact at a particular
        // height, so it is guarded where it can be measured — `cluster-column.test.ts` › "no door
        // bores through to the void" — and not by counting parts in a plan.
        if (p === 'wall' || p === 'door') sawWall = true
        if (r > e + plot.wallWidth && (p === 'quarter' || p === 'green' || p === 'join')) sawGroundPast = true
      }
      walls += sawWall ? 1 : 0
      // ⚠ THE PER-BEARING FORM OF THIS WAS TOO STRICT AND FAILED HONESTLY. A bearing that leaves
      // down a lane still crosses the lane's own SIDE wall further out, so "this bearing saw a
      // wall" says nothing. The claim that actually matters — that a wall never sits on top of
      // ground somebody can stand on — is per COLUMN, and is asserted below. What stays here is
      // the safety half: no bearing may leave the fold open to the void.
      if (!sawWall && !sawGroundPast && !isGround(c.x + dx * (e + 1), c.z + dz * (e + 1), cfg)) holes++
    }
  }
  // Ground is never overwritten by cloud, and every ground column reports as ground.
  let overwritten = 0, mislabelled = 0, seen = 0
  for (const [x, z] of lattice(cfg, 11)) {
    const part = clusterAt(x, z, cfg).part, ground = isGround(x, z, cfg)
    seen++
    if (part === 'wall' && ground) overwritten++
    if (ground && !(part === 'quarter' || part === 'green' || part === 'join')) mislabelled++
  }
  check('no wall is ever generated on top of ground', overwritten === 0, `${overwritten} of ${seen}`)
  check('every walkable column reports as ground', mislabelled === 0, `${mislabelled} of ${seen}`)
  check('the coast IS walled where it meets the Ather', walls > 1000, `${walls} bearings`)
  check('no bearing leaves the fold open to the void', holes === 0, `${holes} bearings`)
  // A lane is fold ground too, so its sides are walled — that is what stops a keeper walking off it.
  const small = allAt({ ne: 0, nw: 0, sw: 0, se: 0 })
  for (let z = 0; z < 400; z += 1) {
    const x = small.offset
    if (clusterAt(x, z, small).part !== 'join') continue
    const side = clusterAt(x + small.joinHalfWidth + 1, z, small).part
    if (side === 'wall') sealed++
  }
  check('a lane\'s sides are walled', sealed > 50, `${sealed} samples`)
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass}/${pass + fail} passed${fail ? `, ${fail} failed` : ''}`)
process.exit(fail === 0 ? 0 : 1)
