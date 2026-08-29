/**
 * The plot's crossing court — placement oracle.
 *
 * ★ WHY THIS FILE EXISTS, IN ONE SENTENCE: `voxel3d/gate.ts` derived a perfectly good position in
 * August and the world moved out from under it, and nothing said so for eight days. That arch now
 * stands inside the fold's hollow (§4 below measures it). A derived placement is a standing claim
 * about terrain the placer does not own, so it needs an assert with the same lifetime as the claim.
 *
 * Run: `npx tsx src/app/shimmer/voxel3d/crossings.test.ts` (repo convention — there is no vitest).
 */
import {
  courtAnchor, sockets, socketCells, socketLit, socketMaterial, courtFits, SOCKET_KINDS, SOCKET_PITCH,
  COURT_ARC, COURT_INSET, staleCourts, COURT_RADIUS, socketArcAngles, legacyRowSockets, courtClearCells,
  courtLevel, courtPlatformCells, isCourtMaterial, PLATFORM_MAT,
  courtHubCells, COURT_HUB_RADIUS, WEDGE_HALF, courtFloorClearCells,
  gateTowerCells, TOWER_HEIGHT, TOWER_BACK, LANDMARK_DIST, LANDMARK_ANGLE_DEG,
  COURT_MAX_HEIGHT, COURT_MAX_BACK, SOCKET_MAX_HEIGHT, landmarkHeight,
} from './crossings'
import { plotThreshold, plotHeight, insideCore, plotForTier, PLOT_TIERS, DEFAULT_PLOT } from '../voxel/plot'
import { PLOT_TRIGGER_RADIUS } from './seam'
import { MAT } from '../voxel/depth'
import { plant, emptyNet } from '../voxel/waymark'
import { MAX_MARKS } from '../voxel/waymark'

const SEEDS = [1, 7, 42, 555, 2026, 99, 314, 8675]

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) {
  if (cond) pass++
  else fails.push(label)
}

// ── 1. the two kinds, and the count ───────────────────────────────────────────────────────────
// ★ THE VOCABULARY IS THE ASSERT. Canon lets "gate" mean exactly one thing — a crossing OUT of the
// Ather — and every Ather destination is a PASSAGE. If a future edit adds an Ather socket typed
// 'gate' this goes red, which is the only mechanism watching: `npm run canon` checks names and
// rosters and explicitly does not check vocabulary.
//
// ⚠ THIS ASSERTED `waymark` UNTIL 2026-08-24 AND WAS GREEN THE WHOLE TIME — a working guard aimed
// one word off the ruled noun. The 08-24 travel ruling says *"it is one gate and N passages"* and
// separates the waymark (the mark you PLANT) from the passage (the crossing that runs to it). A
// guard cannot notice that its own vocabulary retired; only re-reading the ruling does.
ok(SOCKET_KINDS[0] === 'gate', 'socket 0 is the gate — Rune Hold, out of the Ather, Greg-given')
ok(SOCKET_KINDS.slice(1).every(k => k === 'passage'),
   'every socket after the first is a passage, never a gate')
ok(SOCKET_KINDS.filter(k => k === 'gate').length === 1,
   'exactly ONE gate — canon rules one home-gate per garden')
ok(SOCKET_KINDS.length === MAX_MARKS + 1,
   'the row holds the gate plus one socket per waymark the keeper may hold')

// ── 2. the court stands on the island, on every seed ──────────────────────────────────────────
// This is the guard the Glade arch never had.
for (const seed of SEEDS) {
  const fit = courtFits(seed, DEFAULT_PLOT)
  ok(fit.ok, `s${seed}: the court fits the plot` +
     (fit.ok ? '' : ` — ${fit.why}${fit.socket !== undefined ? ` at socket ${fit.socket}` : ''}`))

  const a = courtAnchor(seed, DEFAULT_PLOT)
  ok(a.y !== null, `s${seed}: the court's anchor column has ground under it`)

  for (const s of sockets(seed, DEFAULT_PLOT)) {
    const h = plotHeight(s.x, s.z, seed, DEFAULT_PLOT)
    ok(h !== null, `s${seed}: socket ${s.index} stands on ground`)
    ok(insideCore(s.x, s.z, seed, DEFAULT_PLOT), `s${seed}: socket ${s.index} is on the island`)
    if (h === null) continue
    // Every cell of every frame is on the island too — a 5-wide frame centred one block inside the
    // coast would hang its jamb over the drop, and the CENTRE passing is not evidence about the EDGE.
    for (const c of socketCells(s, h))
      ok(insideCore(c.x, c.z, seed, DEFAULT_PLOT),
         `s${seed}: socket ${s.index} frame cell (${c.x},${c.z}) is on the island`)
  }
}

// ── 3. it does not foul the fold-seam, which must stay unframed ───────────────────────────────
// ★ CANON, NOT TASTE: seam.ts — *"no gates" ⇒ NO FRAME, NO ARCH, NO LINTEL*. The court exists so the
// choosing has somewhere to be that is NOT the seam; a court that creeps onto it defeats its reason.
for (const seed of SEEDS) {
  const t = plotThreshold(seed, DEFAULT_PLOT)
  for (const s of sockets(seed, DEFAULT_PLOT)) {
    const d = Math.hypot(s.x - t.x, s.z - t.z)
    ok(d > PLOT_TRIGGER_RADIUS + 2,
       `s${seed}: socket ${s.index} clears the crossing trigger (${d.toFixed(1)} blocks out)`)
  }
  // ...and it is still WITHIN A WALK of the seam. The offset is deliberately small; if someone
  // widens it into "across the island" the design argument in the header quietly stops being true.
  const a = courtAnchor(seed, DEFAULT_PLOT)
  const walk = Math.hypot(a.x - t.x, a.z - t.z)
  ok(walk < 60, `s${seed}: the court shares the garden's door end (centre ${walk.toFixed(0)} blocks from the seam)`)
}

// ── 4. the Moonwell Glade arch — FIXED, and the exhibit that lived here is gone ───────────────
// ★ THIS SECTION WAS A PRINTED EXHIBIT reporting the arch as 20/20 fold-interior air across eight
// seeds, held open while Alex ruled. He ruled (the arch is the tutorial's one-way exit), the
// placement was repaired in `gate.ts`, and the exhibit's own else-branch said "§4 is stale, delete
// it" the moment it stopped being true. Deleted rather than left printing a resolved finding — a
// note that keeps announcing a fixed problem is how a board row outlives its fact.
//
// The guard now lives where the thing it guards lives: `gate.test.ts`, which asserts the arch clears
// both the fold's shell AND its mound, and — the part clearance alone cannot do — that it stands
// BETWEEN the fold and the glade. Nothing here needs to restate it.

// ── 5. sockets do not overlap each other ──────────────────────────────────────────────────────
// A 5-wide frame at pitch 8 leaves 3 clear blocks. Asserted by walking the actual cells rather than
// comparing the two constants, because comparing the constants would pass a pitch that is correct
// arithmetically and wrong once a frame's width is derived differently.
for (const seed of SEEDS) {
  const a = courtAnchor(seed, DEFAULT_PLOT)
  if (a.y === null) continue
  const seen = new Map<string, number>()
  let clash = 0
  for (const s of sockets(seed, DEFAULT_PLOT)) {
    const h = plotHeight(s.x, s.z, seed, DEFAULT_PLOT)
    if (h === null) continue
    for (const c of socketCells(s, h)) {
      const k = `${c.x},${c.y},${c.z}`
      const prev = seen.get(k)
      if (prev !== undefined && prev !== s.index) clash++
      seen.set(k, s.index)
    }
  }
  ok(clash === 0, `s${seed}: no two sockets share a cell (${clash} shared)`)
}
ok(SOCKET_PITCH >= 5, 'the pitch is at least a frame wide')

// ── 6. the derivation follows the plot rather than pinning a coordinate ───────────────────────
// ★ The Glade arch's real defect was not its number, it was that its number could not follow the
// world. Two different plots must get two different courts, or the derivation is decoration.
{
  const wide = { ...DEFAULT_PLOT, capRadius: DEFAULT_PLOT.capRadius + 60 }
  const a = courtAnchor(1, DEFAULT_PLOT), b = courtAnchor(1, wide)
  ok(a.x !== b.x || a.z !== b.z, 'growing the fold moves the court out with the coast')
  const off = { ...DEFAULT_PLOT, thresholdBearing: DEFAULT_PLOT.thresholdBearing + 1 }
  const c = courtAnchor(1, off)
  ok(c.x !== a.x || c.z !== a.z, 'moving the threshold takes the court with it')
  ok(COURT_ARC > 0, 'the court is offset from the seam, never on it')
  ok(COURT_INSET > 0, 'the court stands inside the coast, not on the wall')
}


// ── 7. the fold GROWS, and both consequences of that are asserted ─────────────────────────────
// ★ THE COURT'S SEPARATION FROM THE SEAM MUST NOT DRIFT WITH THE TIER. This started as a fixed
// ANGLE, which is a fixed fraction of the circumference and therefore a growing distance — 61 · 80
// · 100 blocks across the three tiers, each of them looking perfectly reasonable on its own. One
// tier could never have caught it; the assert has to span them.
// ⚠ MEASURED TO THE NEAREST SOCKET, NOT THE ROW'S CENTRE, because that is what COURT_ARC means and
// what a person standing at the door sees. Measuring the centre is how a court that reads as 18
// blocks out put an arch 6 blocks from the seam, inside the threshold mound on all 24 seed×tier
// combinations. The assert has to ask the question the constant answers.
for (const seed of SEEDS) {
  const seps: number[] = []
  for (let t = 0; t < PLOT_TIERS.length; t++) {
    const cfg = plotForTier(t, DEFAULT_PLOT)
    const th = plotThreshold(seed, cfg)
    seps.push(Math.min(...sockets(seed, cfg).map(s => Math.hypot(s.x - th.x, s.z - th.z))))
  }
  const spread = Math.max(...seps) - Math.min(...seps)
  ok(spread < 12,
     `s${seed}: the nearest socket keeps its distance from the seam as the fold grows ` +
     `(${seps.map(v => v.toFixed(0)).join(' · ')} blocks, spread ${spread.toFixed(0)})`)
  for (const sep of seps)
    ok(Math.abs(sep - COURT_ARC) < 5,
       `s${seed}: nearest socket ${sep.toFixed(1)} tracks COURT_ARC ${COURT_ARC}`)
}

/** Alex's ruling, 2026-08-23: *"near the tunnel passage to the wilds, maybe 15-20 blocks away."* */
const RULED_NEAR_MIN = 15, RULED_NEAR_MAX = 20

// ★ ALEX'S RULING, ASSERTED AS A RANGE RATHER THAN A VALUE (2026-08-23): *"near the tunnel passage
// to the wilds, maybe 15-20 blocks away."* Pinning one value would go red the first time anyone
// nudges the pitch; the ruling was a window and the assert is the window.
//
// ⚠⚠ THE RULED CEILING IS 20 AND THE BUILD MISSES IT — BY 0.2 SINCE 08-23, AND BY ~4 SINCE 08-27.
// This assert has now been asked to move twice, and moving it is the cheapest lie that turns a red
// green, so it does NOT get widened to wherever the geometry happens to land. Two separate claims,
// asserted separately:
//
//   1. `COURT_ARC` is honoured — the constant means what it says, whatever its value.
//   2. `COURT_ARC` is the SMALLEST value that clears the threshold mound. That is what keeps the
//      deviation from Alex's ruling at the minimum geometry forces, and it is what goes red if
//      somebody ever bumps this constant for convenience rather than for a measurement.
//
// Why it moved: on an arc the outermost socket TURNS to face the focus, so its frame reaches
// radially toward the mound instead of sweeping past it tangentially — swept across 8 seeds × 3
// tiers, 22 fouls on 7 combinations, 23 on 1, 24 on none. ⚠ THIS IS A LIVE DEVIATION FROM A RULING
// AND IT IS ALEX'S TO ACCEPT OR REJECT, not something to bury in a widened window. A tighter
// `COURT_RADIUS` buys some of it back at the cost of the half-circle reading as a huddle.
ok(COURT_ARC > RULED_NEAR_MAX,
   `⚠ RECORDED DEVIATION: COURT_ARC is ${COURT_ARC}, Alex ruled a ${RULED_NEAR_MIN}-${RULED_NEAR_MAX} ` +
   'window on 2026-08-23. Kept visible on purpose — if this ever goes green the deviation is gone ' +
   'and this assert should be deleted rather than inverted.')
for (const seed of SEEDS) {
  for (let t = 0; t < PLOT_TIERS.length; t++) {
    const cfg = plotForTier(t, DEFAULT_PLOT)
    const th = plotThreshold(seed, cfg)
    const near = Math.min(...sockets(seed, cfg).map(s => Math.hypot(s.x - th.x, s.z - th.z)))
    ok(near >= RULED_NEAR_MIN && near <= COURT_ARC + 1,
       `s${seed} t${t}: nearest socket is ${near.toFixed(1)} blocks from the seam ` +
       `(COURT_ARC=${COURT_ARC}; Alex ruled ${RULED_NEAR_MIN}-${RULED_NEAR_MAX}, the mound forces the gap)`)
  }
}

// ★ AND A COURT RAISED AT A SMALLER FOLD IS STILL STANDING. Placed voxels do not slide when a
// derived anchor does, so the host must be told where the old ones are or the keeper collects
// abandoned stone courts across their island.
for (const seed of SEEDS) {
  ok(staleCourts(seed, 0).length === 0, `s${seed}: a tier-0 keeper has no older court to clear`)
  for (let t = 1; t < PLOT_TIERS.length; t++) {
    const stale = staleCourts(seed, t)
    const here = courtAnchor(seed, plotForTier(t, DEFAULT_PLOT))
    ok(stale.length === t, `s${seed}: tier ${t} names all ${t} older court sites (${stale.length})`)
    ok(stale.every(({ anchor: a }) => a.x !== here.x || a.z !== here.z),
       `s${seed}: tier ${t} never lists the court that is supposed to be standing`)
    ok(stale.every(({ anchor: a }) => Math.hypot(a.x - here.x, a.z - here.z) > 8),
       `s${seed}: tier ${t} older courts are genuinely elsewhere, not a rounding wobble`)
  }
  // ⚠ THIS DOES NOT TEST THE CLAMP, AND PRETENDING IT DOES WOULD BE THE WORSE OPTION. Removing the
  // clamp leaves it green, because the same-column skip inside `staleCourts` collapses the extra
  // iterations anyway — two guards each covering for the other, so neither is provable while the
  // other stands. Both are labelled as such in the module. What this DOES assert is the observable
  // contract a caller depends on: a garbage tier out of a save file yields the top tier's answer.
  ok(staleCourts(seed, 99).length === PLOT_TIERS.length - 1, `s${seed}: an over-range tier reads as the top tier`)
  // the tier rides along, so the host never re-derives which fold each stale court belonged to
  for (let t = 1; t < PLOT_TIERS.length; t++)
    ok(staleCourts(seed, t).every((e, i) => e.tier === i),
       `s${seed}: tier ${t} stale entries carry their own tier index`)
}

// ── 5. the station DISPLAYS reach — every socket stands, and the lamp is what changes ─────────
// Canon 08-24: Greg pre-places the sockets, one lit on day one and the rest dark, and the station
// grants nothing. Two claims, and they fail in opposite directions: a socket that does not stand
// until it is earned cannot display anything, and a socket that lights before it is earned is the
// station GRANTING reach — the one thing canon says it must not do.
{
  const socks = sockets(SEEDS[0], DEFAULT_PLOT)
  const a = courtAnchor(SEEDS[0], DEFAULT_PLOT)
  ok(socks.length === MAX_MARKS + 1, `every socket is placed regardless of reach (${socks.length})`)

  // ★ THE ASSERT THAT ACTUALLY CATCHES THE OLD BEHAVIOUR. A dark socket's FRAME must be stone —
  // "unearned" used to mean air, i.e. no socket at all, and `sockets()` returning it in a list was
  // no evidence otherwise. Asked of the material, this goes red the moment dark means absent again.
  {
    const dark = socketCells(socks[MAX_MARKS], 100)
    const frame = dark.filter(c => !c.doorway)
    ok(frame.length > 0 && frame.every(c => socketMaterial(c, false) === MAT.CUT_STONE),
       `a DARK socket still stands in cut stone (${frame.length} frame cells)`)
    ok(dark.filter(c => c.doorway).every(c => socketMaterial(c, false) === MAT.AIR),
       'a dark socket is still walk-through — dark is not sealed')
    ok(socketMaterial(dark.find(c => c.lamp)!, false) === MAT.CUT_STONE,
       'a dark socket has plain stone where its lamp would be')
    ok(socketMaterial(dark.find(c => c.lamp)!, true) === MAT.MANA_LANTERN,
       'a lit socket carries the lantern — the one cell that differs')
  }

  // Exactly one lamp cell per socket, and it is in the frame rather than the doorway — a lamp in
  // the opening would be a block standing in the crossing you walk through.
  for (const sk of socks) {
    const cells = socketCells(sk, 100)
    const lamps = cells.filter(c => c.lamp)
    ok(lamps.length === 1, `socket ${sk.index} has exactly one lamp cell (${lamps.length})`)
    ok(lamps.every(c => !c.doorway), `socket ${sk.index}'s lamp is in the frame, not the doorway`)
    // ⚠ THIS ASSERTED `100 + 3` AND WAS A CONSTANT RESTATED, NOT A PROPERTY. It went red the moment
    // frames stopped being one height — which is the right outcome for the wrong reason: it was
    // measuring the old shape's arithmetic rather than what a lamp has to BE. What matters is that
    // the light sits on the topmost course, above the opening, whatever that course's number is.
    const top = Math.max(...cells.map(c => c.y))
    const doorTop = Math.max(...cells.filter(c => c.doorway).map(c => c.y))
    ok(lamps.every(c => c.y === top), `socket ${sk.index}'s lamp is on the topmost course`)
    ok(lamps.every(c => c.y > doorTop), `socket ${sk.index}'s lamp sits above the opening it lights`)
  }

  // Day one: the gate is lit and nothing else is.
  ok(socketLit(socks[0], 0), 'day one — the Rune Hold gate is lit, because Greg gives it')
  ok(socks.slice(1).every(sk => !socketLit(sk, 0)), 'day one — every passage is dark')

  // And reach lights them one at a time, in order, never ahead of itself.
  for (let held = 0; held <= MAX_MARKS; held++) {
    const lit = socks.filter(sk => socketLit(sk, held)).length
    ok(lit === held + 1, `holding ${held} waymark(s) lights ${held + 1} socket(s), got ${lit}`)
  }
  ok(!socketLit(socks[MAX_MARKS], MAX_MARKS - 1),
     'the last passage stays dark until its own waymark is planted — the station never grants reach')
}

// ── 6. the NET is what lights the station — the two modules through their composition ─────────
// ★ EVERY ASSERT ABOVE FEEDS `socketLit` A HAND-WRITTEN NUMBER, which tests the predicate and says
// nothing about the thing the game actually does: plant a waymark, and a lamp comes on. A number I
// typed cannot disagree with `plant()`; a net built by `plant()` can. Same reason the ruins oracle
// asserts through `placeSites` rather than around it — a module and its consumer separated by a
// gate, with the test on the wrong side of the gate, is a world that does not exist.
//
// ⚠ It is also the guard on the owner test-grant (`/waymark reach`): canon says the station GRANTS
// nothing and only displays reach, so the grant seeds the NET and lets the lamps follow. If anyone
// ever lights a socket without a mark behind it, this is what goes red.
{
  const socks = sockets(SEEDS[0], DEFAULT_PLOT)
  let net = emptyNet()
  ok(socks.filter(sk => socketLit(sk, net.marks.length)).length === 1,
     'an empty net lights exactly the gate — reach not yet earned')
  for (let i = 1; i <= MAX_MARKS; i++) {
    const r = plant(net, i * 10, 100, 0, `t${i}`)
    ok(!('refused' in r), `planting waymark ${i} is allowed under the cap`)
    if ('refused' in r) break
    net = r.net
    const lit = socks.filter(sk => socketLit(sk, net.marks.length)).length
    ok(lit === i + 1, `${i} planted waymark(s) light ${i + 1} sockets, got ${lit}`)
  }
  // And the cap holds from both ends: a fourth plant is refused, and no fifth lamp exists to light.
  const over = plant(net, 999, 100, 999, 'over')
  ok('refused' in over && over.refused === 'full', 'the cap refuses a fourth passage')
  ok(socks.filter(sk => socketLit(sk, 99)).length === socks.length,
     'no lamp exists beyond the sockets that are built — reach cannot outrun the row')
}

// ── ★★★ WHAT ALEX SAW, TURNED INTO ASSERTS (2026-08-27) ───────────────────────────────────────
// *"its currently just a straight line of half buried archs."* Both halves were true, both were
// canon drift, and **1,126 asserts were green the whole time** — this file measured distances,
// materials, fits and clearances, and never once asked what SHAPE the row was or whether it stood
// on the ground. Neither property had an assert because neither had ever been wrong on purpose.
// ⚠ Ask of a passing suite what it does not measure, not only what it measures.
{
  for (const seed of SEEDS) {
    for (let t = 0; t < PLOT_TIERS.length; t++) {
      const cfg = plotForTier(t, DEFAULT_PLOT)
      const a = courtAnchor(seed, cfg)
      if (a.y === null) continue
      const socks = sockets(seed, cfg)
      const th = plotThreshold(seed, cfg)

      // ── 1. IT STANDS ON THE GROUND ────────────────────────────────────────────────────────
      // `plotHeight` is the topmost SOLID block and the keeper stands at +1 (`plotThreshold`,
      // `plotStandY`). A frame based at the ground is buried by exactly one course, which is what
      // shipped: a 3-high doorway walkable at 2.
      for (const sk of socks) {
        const h = plotHeight(sk.x, sk.z, seed, cfg)
        if (h === null) continue
        const cells = socketCells(sk, h)
        const lowest = Math.min(...cells.map(c => c.y))
        ok(lowest === h + 1,
           `s${seed} t${t} socket ${sk.index}: the frame's first course is at ${lowest}, the ground is ${h} ` +
           `— it must start at ${h + 1} or the arch is buried and you duck through it`)
        const door = cells.filter(c => c.doorway)
        const doorLow = Math.min(...door.map(c => c.y)), doorHigh = Math.max(...door.map(c => c.y))
        ok(doorLow === h + 1,
           `s${seed} t${t} socket ${sk.index}: the doorway opens AT standing height (${doorLow} vs ${h + 1})`)
        ok(doorHigh - doorLow + 1 >= 3,
           `s${seed} t${t} socket ${sk.index}: the opening is ${doorHigh - doorLow + 1} blocks of walkable height`)
      }

      // ── 2. IT IS A HALF-CIRCLE, NOT A ROW ─────────────────────────────────────────────────
      // Canon: *"a low half-circle of sockets."* Equidistant from the focus is the property that
      // distinguishes an arc from a line, and it is the one a straight row cannot fake.
      const radii = socks.map(sk => Math.hypot(sk.x - a.x, sk.z - a.z))
      const spread = Math.max(...radii) - Math.min(...radii)
      ok(spread <= 1.5,
         `s${seed} t${t}: every socket is the same distance from the focus (spread ${spread.toFixed(2)}, ` +
         `radii ${radii.map(r => r.toFixed(1)).join('/')}) — a straight row's radii fan out`)

      // ⚠ AND EXPLICITLY NOT COLLINEAR, because "equidistant" alone is satisfiable by two points.
      // Cross-product area of the outermost triple: a line gives ~0.
      if (socks.length >= 3) {
        const [p0, p1, p2] = [socks[0], socks[1], socks[socks.length - 1]]
        const area = Math.abs((p1.x - p0.x) * (p2.z - p0.z) - (p2.x - p0.x) * (p1.z - p0.z))
        ok(area > 20,
           `s${seed} t${t}: the sockets are not collinear (twice-area ${area.toFixed(1)}) — ` +
           'the straight tangent row this replaced gives 0')
      }

      // ── 3. IT FACES THE THRESHOLD ─────────────────────────────────────────────────────────
      // Canon: *"facing the threshold."* Two claims: the arc OPENS toward the door (its apex is the
      // socket furthest from it, so you walk into the mouth), and each frame TURNS to face the
      // focus rather than sharing one bearing with its neighbours.
      const dTh = socks.map(sk => Math.hypot(sk.x - th.x, sk.z - th.z))
      ok(dTh[0] === Math.max(...dTh),
         `s${seed} t${t}: the gate at the apex is the furthest socket from the door ` +
         `(${dTh[0].toFixed(1)} vs max ${Math.max(...dTh).toFixed(1)}) — the keeper walks INTO the half-circle`)
      for (const sk of socks) {
        // Facing must point from the socket back at the focus.
        const want = Math.atan2(a.z - sk.z, a.x - sk.x)
        const diff = Math.abs(Math.atan2(Math.sin(sk.facing - want), Math.cos(sk.facing - want)))
        ok(diff < 0.2,
           `s${seed} t${t} socket ${sk.index}: its frame turns to face the focus (off by ${diff.toFixed(3)}rad)`)
      }
      const facings = new Set(socks.map(sk => sk.facing.toFixed(3)))
      ok(facings.size === socks.length,
         `s${seed} t${t}: every socket has its OWN facing (${facings.size} distinct of ${socks.length}) — ` +
         'one shared bearing is what made the old row read as a fence')

      // ── 4. THE GATE IS VISIBLY SINGULAR ───────────────────────────────────────────────────
      // Canon makes this load-bearing, not decorative: *"home-cost lives on the gate and nowhere
      // else… render it unlike its neighbours."* The lamp alone cannot carry it — a dark passage
      // and a lit gate differ by one cell, and the keeper is meant to read cost off the shape.
      {
        const gh = plotHeight(socks[0].x, socks[0].z, seed, cfg)
        const ph = plotHeight(socks[1].x, socks[1].z, seed, cfg)
        if (gh !== null && ph !== null) {
          const g = socketCells(socks[0], gh), pz = socketCells(socks[1], ph)
          const hOf = (cs: typeof g) => Math.max(...cs.map(c => c.y)) - Math.min(...cs.map(c => c.y)) + 1
          ok(hOf(g) > hOf(pz),
             `s${seed} t${t}: the gate stands taller than a passage (${hOf(g)} vs ${hOf(pz)})`)
          ok(g.length > pz.length,
             `s${seed} t${t}: the gate is a bigger build than a passage (${g.length} vs ${pz.length} cells)`)
          // ── ⚠⚠ MEASURE THE OPENING'S HEIGHT, NOT ITS VOXEL COUNT (corrected 2026-08-27) ────
          // This compared `gDoor.length > pDoor.length` and it went red on s555 t2 (16 vs 18) the
          // moment frames gained DEPTH — while the gate's opening was still structurally the
          // larger one (4 courses tall against a passage's 3). A frame is turned to an arbitrary
          // bearing, so `Math.round` collapses a different number of cells onto one voxel at every
          // heading; once a frame is 2-3 deep that noise is bigger than the difference being
          // asserted. **The count was a proxy for the shape and stopped tracking it.**
          // ★ So compare the thing canon actually cares about — how tall the way through is — and
          // compare it as a DERIVATION of the cells rather than as a tally of them. Verified
          // separately that the opening stays walkable at every bearing: the narrowest gate mouth
          // across 60 seeds x 3 tiers is 4 floor columns of 6 nominal, nowhere near a pinch.
          const doorHeightOf = (cs: typeof g) => {
            const d = cs.filter(c => c.doorway)
            return d.length === 0 ? 0 : Math.max(...d.map(c => c.y)) - Math.min(...d.map(c => c.y)) + 1
          }
          ok(doorHeightOf(g) > doorHeightOf(pz),
             `s${seed} t${t}: and you walk through a taller opening (${doorHeightOf(g)} vs ${doorHeightOf(pz)} courses)`)
          // ⚠ AND THE OPENING MUST STILL BE AN OPENING. A depth change is exactly what could seal a
          // doorway into a two-block-thick wall, and a keeper meets that as "the arch does nothing".
          const floorCols = (cs: typeof g) => {
            const base = Math.min(...cs.map(c => c.y))
            return new Set(cs.filter(c => c.doorway && c.y === base).map(c => `${c.x},${c.z}`)).size
          }
          ok(floorCols(g) >= 2 && floorCols(pz) >= 2,
             `s${seed} t${t}: both mouths are walkable at floor level (gate ${floorCols(g)}, passage ${floorCols(pz)} columns)`)
        }
      }

      // ── 5. THE MIGRATION SWEEP REACHES WHAT THE OLD CODE LAID ─────────────────────────────
      // A clear pass derived from the CURRENT geometry cannot find the PREVIOUS geometry, and the
      // previous geometry is the whole reason a clear pass exists. Two things it must cover: every
      // cell the new frame lays, and the buried course the retired one laid at ground level.
      for (const sk of socks) {
        const h = plotHeight(sk.x, sk.z, seed, cfg)
        if (h === null) continue
        const sweep = new Set(courtClearCells(sk, h).map(c => `${c.x},${c.y},${c.z}`))
        const missed = socketCells(sk, h).filter(c => !sweep.has(`${c.x},${c.y},${c.z}`))
        ok(missed.length === 0,
           `s${seed} t${t} socket ${sk.index}: the clear sweep covers every cell the frame lays (${missed.length} missed)`)
        ok(sweep.has(`${sk.x},${h},${sk.z}`) || courtClearCells(sk, h).some(c => c.y === h),
           `s${seed} t${t} socket ${sk.index}: the sweep reaches the pre-08-27 BURIED course at y=${h}`)
      }
    }
  }

  // ── 5d. ★★★ THE PLATFORM — the stones stand ON it, and the host has to be told the level ─────
// Alex: *"just a mess of stone blocks"*, then *"how can we do this so that the platform is a
// standalone object"*. The cause is measured, not guessed: the court's ground is `MAT.STONE` in
// 6760 of 6760 sampled columns and the frames are `MAT.CUT_STONE`, so grey stands on grey and the
// eye finds no edge. The dais is a third material with a footprint — the contrast IS the fix.
{
  for (const t of [1, 2, 3]) {
    const cfg = plotForTier(t)
    for (const seed of [1337, 555, 1000, 42]) {
      const level = courtLevel(seed, cfg)
      const socks = sockets(seed, cfg)
      if (level === null) continue
      const plat = courtPlatformCells(seed, cfg)
      const platKeys = new Set(plat.map(c => `${c.x},${c.y},${c.z}`))
      const platCols = new Set(plat.map(c => `${c.x},${c.z}`))

      // ── it is RAISED, or it is a floor and not a platform ───────────────────────────────────
      for (const sk of socks) {
        const g = plotHeight(sk.x, sk.z, seed, cfg)
        if (g === null) continue
        // ⚠ STRICTLY ABOVE, AND NOT `>= g + PLATFORM_RISE`. That was my first version and it is a
        // MIRROR of the constant it is checking: set `PLATFORM_RISE` to 0 and the assert happily
        // agrees that a platform level with the ground is proud of it. Mutation caught it only
        // because a *different* assert (stones off the edge) went red. Assert the property — a
        // platform a keeper cannot see a step up onto is a floor.
        ok(level > g,
           `s${seed} t${t}: the dais stands proud of socket ${sk.index}'s ground (level ${level} vs ground ${g})`)
      }

      // ── every stone stands ON it, not beside it ─────────────────────────────────────────────
      for (const sk of socks) {
        ok(platCols.has(`${sk.x},${sk.z}`),
           `s${seed} t${t}: socket ${sk.index} stands on the dais, not off its edge`)
      }

      // ── ★★★ AND THE HOST MUST PASS `courtLevel`, NOT PER-SOCKET GROUND ────────────────────
      // This is the whole wiring contract, and it is asserted rather than written in a comment
      // because getting it wrong is INVISIBLE: with today's per-socket call the frame's first
      // course lands ON the dais's top course instead of above it, so the stone is embedded in the
      // floor by one block. Measured on s1337 t2: **42 cells of stone occupying platform cells.**
      // Nothing errors, nothing renders empty, and a keeper just sees stones sunk into the plinth —
      // the same family as the half-buried arch Alex reported on 08-27, one level up.
      for (const sk of socks) {
        const right = socketCells(sk, level)
        const clash = right.filter(c => platKeys.has(`${c.x},${c.y},${c.z}`))
        ok(clash.length === 0,
           `s${seed} t${t}: socket ${sk.index} laid at courtLevel sits ON the dais, not in it (${clash.length} cells embedded)`)
        ok(Math.min(...right.map(c => c.y)) === level + 1,
           `s${seed} t${t}: socket ${sk.index}'s first course is the one above the dais surface`)
      }

      // ── the dais floors what it claims to floor ─────────────────────────────────────────────
      // ⚠ A SECTOR WITH HOLES IN IT IS NOT A FLOOR. Columns are filled from their own terrain up,
      // so a column that skipped would be a pit the keeper walks into — and at one course thick on
      // a flat shelf, "skipped" and "already at grade" look identical unless asked directly.
      const topCourse = plat.filter(c => c.y === level).length
      ok(topCourse === platCols.size,
         `s${seed} t${t}: every column of the dais reaches the surface (${topCourse} of ${platCols.size})`)

      // ── ⚠ IT MUST NOT PAVE THE FOLD DOOR ───────────────────────────────────────────────────
      // The seam is the one spot canon insists stays unbuilt, and the dais is much wider than a
      // frame — `courtFits` checks SOCKETS against the trigger and knew nothing about an apron.
      const thr = plotThreshold(seed, cfg)
      const nearest = Math.min(...plat.map(c => Math.hypot(c.x - thr.x, c.z - thr.z)))
      ok(nearest > PLOT_TRIGGER_RADIUS,
         `s${seed} t${t}: the dais clears the crossing trigger (${nearest.toFixed(1)} blocks out)`)

      // ── everything the court lays is something the host may sweep ───────────────────────────
      // ★ THE LOOP THAT ABANDONED ARCHITECTURE COMES THROUGH. A material the sweep does not
      // recognise is a structure that stands forever once the fold grows and the court moves.
      ok(isCourtMaterial(PLATFORM_MAT),
         `the dais material is one the court sweep will remove`)
      for (const sk of socks) {
        const mats = new Set(socketCells(sk, level).filter(c => !c.doorway).map(c => socketMaterial(c, true)))
        const stray = [...mats].filter(m => !isCourtMaterial(m))
        ok(stray.length === 0,
           `s${seed} t${t}: socket ${sk.index} lays only sweepable materials (${stray.join(',') || 'none stray'})`)
      }
    }
  }
}

// ── 5c. ★★★ THE HENGE — a frame has a SIDE, and you can still walk through it ────────────────
// Alex, 2026-08-27: *"i was thinking more of a stone hedge look."* In plan the frame already was a
// trilithon — two jamb columns carrying a lintel course — and it read as masonry because it was ONE
// BLOCK THICK. Depth is the change; these are the asserts that keep it.
//
// ⚠ EVERY ONE OF THESE MEASURES A PROPERTY, NOT A TALLY. `Math.round` collapses a bearing-dependent
// number of cells onto one voxel, so a cell COUNT is noise at this scale — that is exactly what put
// the gate's opening assert one seed from red when depth landed (16 vs 18, on a gate whose opening
// is structurally the taller one). Count-based asserts on rotated geometry go stale by arithmetic.
{
  const cfg = plotForTier(2)
  for (const seed of [1337, 555, 1000, 42, 90210]) {
    for (const sk of sockets(seed, cfg)) {
      const h = plotHeight(sk.x, sk.z, seed, cfg)
      if (h === null) continue
      const cells = socketCells(sk, h)

      // ── it has a side ──────────────────────────────────────────────────────────────────────
      // Measured as DISTINCT COLUMNS PER footprint position: a sheet occupies one (x,z) per point
      // across its span, a thick stone occupies more. Asked of the solid frame only — the doorway
      // is air and would answer for the hole rather than the stone.
      const solid = cells.filter(c => !c.doorway)
      const cols = new Set(solid.map(c => `${c.x},${c.z}`)).size
      const span = new Set(solid.map(c => `${c.x},${c.y},${c.z}`)).size
      ok(cols > new Set(solid.map(c => c.y)).size,
         `s${seed} socket ${sk.index}: the frame is thicker than a sheet (${cols} ground columns, ${span} cells)`)

      // ── ⚠⚠ AND IT IS STILL A DOORWAY, NOT A WALL ──────────────────────────────────────────
      // The single most likely way a depth change goes wrong: flag the front face as doorway and
      // leave the stone behind it solid. The keeper walks into the opening and stops, and every
      // other assert here stays green. So walk the opening back-to-front and require air the whole
      // way at the course a keeper's feet occupy.
      // ⚠⚠ MEASURED ALONG THE NORMAL, AND THE FIRST VERSION OF THIS WAS DECORATION. It asked "is
      // any cell both doorway and stone" and "are there >= 2 mouth columns" — and a mutation that
      // flagged only the FRONT face as doorway (leaving the stone behind it solid: the exact wall
      // bug) passed BOTH, because an unflagged cell is not a contradiction and a 3-wide mouth one
      // layer deep still has 3 columns. **A guard that survives the bug it was written for is the
      // shape this repo keeps paying for.** So compare the two DEPTHS: the way through must run as
      // deep as the stone is thick, or it is a wall with a niche in it.
      // ⚠ AND IT IS MEASURED DOWN THE CENTRE LINE, not by comparing projected layer COUNTS. My
      // second attempt did the latter and went red on the real gate: projecting a 7-wide frame onto
      // its normal spreads across more rounded layers than a 3-wide door does, so WIDTH confounded
      // a measurement that was supposed to be about DEPTH. Walking the centre column is immune to
      // that — it is one line of voxels, and it is literally the path the keeper takes.
      const footY = h + 1
      const nx = Math.cos(sk.facing), nz = Math.sin(sk.facing)
      const solidKeys = new Set(solid.map(c => `${c.x},${c.y},${c.z}`))
      const doorKeys = new Set(cells.filter(c => c.doorway).map(c => `${c.x},${c.y},${c.z}`))
      let openDepth = 0, sealedAt: number | null = null
      for (let d = 0; d > -8; d--) {
        const x = Math.round(sk.x + nx * d), z = Math.round(sk.z + nz * d)
        const key = `${x},${footY},${z}`
        if (!doorKeys.has(key) && !solidKeys.has(key)) break   // past the back of the frame
        if (solidKeys.has(key)) { sealedAt = d; break }
        openDepth++
      }
      ok(sealedAt === null,
         `s${seed} socket ${sk.index}: the centre line is open front to back — stone at depth ${sealedAt} would make it a wall`)
      ok(openDepth >= 2,
         `s${seed} socket ${sk.index}: and the way through is as deep as the stone (${openDepth} courses)`)
      const mouth = new Set(cells.filter(c => c.doorway && c.y === footY).map(c => `${c.x},${c.z}`))
      ok(mouth.size >= 2,
         `s${seed} socket ${sk.index}: the mouth is more than a one-cell slot (${mouth.size} columns)`)

      // ── exactly one lamp, whatever the depth ─────────────────────────────────────────────
      // ⚠ A lamp per depth layer would be N lanterns in one lintel, and `socketLit` drives them all
      // — so this would not read as a bug, it would read as a brighter socket.
      ok(cells.filter(c => c.lamp).length === 1,
         `s${seed} socket ${sk.index}: exactly one cell carries the light (${cells.filter(c => c.lamp).length})`)

      // ── no cell is laid twice ────────────────────────────────────────────────────────────
      // Harmless to the host, which writes the same block twice. NOT harmless to any assert that
      // counts, which is most of this file.
      const keys = new Set(cells.map(c => `${c.x},${c.y},${c.z}`))
      ok(keys.size === cells.length,
         `s${seed} socket ${sk.index}: no duplicate cells (${cells.length - keys.size} dupes)`)
    }
  }
}

// ── 5b. ★★★ NO TWO FRAMES MAY SHARE A CELL — the guard that turned a taste into a constraint ──
  // ⚠ NOTHING CHECKED THIS, at any point in this file's life, and it became reachable the moment the
  // gate grew: a 7-wide gate beside a 5-wide passage needs 6 blocks between centres and the arc's
  // spacing falls out of `COURT_RADIUS`. Priced it rather than guessing — the minimum `COURT_ARC`
  // that clears the threshold mound, against the closest two socket centres, at four radii:
  //
  //     radius  6 → arc 20 · centres 4.5 apart   ← inside Alex's ruled window, and the frames COLLIDE
  //     radius  7 → arc 22 · centres 5.4 apart   ← still collides with the widened gate
  //     radius  8 → arc 23 · centres 5.4 apart
  //     radius 10 → arc 25 · centres 7.3 apart   ← shipped
  //
  // ★ SO THE TWO NUMBERS ALEX WOULD WANT TO TUNE ARE COUPLED, and that is the useful finding: a
  // tighter arc buys back distance to the door (radius 6 lands the station *inside* the ruled 15-20)
  // and pays for it in overlapping arches. Without this assert the tempting move — shrink the radius
  // to honour the ruling — ships frames growing through each other, and nothing would have said so.
  for (const seed of SEEDS) {
    const cfg = plotForTier(0, DEFAULT_PLOT)
    const socks = sockets(seed, cfg)
    const seen = new Map<string, number>()
    let clash = 0, where = ''
    for (const sk of socks) {
      const h = plotHeight(sk.x, sk.z, seed, cfg)
      if (h === null) continue
      for (const c of socketCells(sk, h)) {
        const k = `${c.x},${c.y},${c.z}`
        const prev = seen.get(k)
        if (prev !== undefined && prev !== sk.index) { clash++; where ||= `${k} (sockets ${prev} and ${sk.index})` }
        else seen.set(k, sk.index)
      }
    }
    ok(clash === 0, `s${seed}: no two socket frames share a cell (${clash} shared, first at ${where})`)
  }

  // ── 6. THE RETIRED LAYOUT IS STILL A DIFFERENT LAYOUT ─────────────────────────────────────
  // ⚠ `legacyRowSockets` exists ONLY to name cells the retired code would have placed. The day it
  // agrees with `sockets()` it silently stops clearing anything, which is the failure mode of every
  // migration shim ever written: it keeps running and stops doing work.
  {
    const cfg = plotForTier(0, DEFAULT_PLOT)
    const now = sockets(1337, cfg), was = legacyRowSockets(1337, cfg)
    const moved = now.filter((sk, i) => sk.x !== was[i].x || sk.z !== was[i].z).length
    ok(moved === now.length,
       `every socket moved between the retired row and the arc (${moved} of ${now.length}) — ` +
       'a shim that agrees with its successor clears nothing')
  }

  // ── 7. THE ARC IS A HALF-CIRCLE AT ANY COUNT, not only at the shipped one ──────────────────
  for (const n of [1, 2, 3, 4, 5, 8]) {
    const angs = socketArcAngles(n)
    ok(angs.length === n, `socketArcAngles(${n}) returns ${angs.length} slots`)
    ok(angs[0] === 0, `socketArcAngles(${n}) puts the gate at the apex`)
    if (n > 1) {
      // ⚠ MY FIRST ASSERT HERE WAS WRONG, NOT THE CODE, and the distinction is worth keeping. It
      // demanded a full 180° SPAN, which an alternating layout only reaches at an odd count: with
      // four sockets the slots are 0, +45, −45, +90 — one left arc and two right. That is not a
      // defect, it is **canon's own table** (Centre gate · Left arc · Right arc 1 · Right arc 2),
      // which is asymmetric for the same reason. Asserting the symmetry I assumed would have forced
      // a fifth socket to satisfy a test rather than the world.
      //
      // The two properties that ARE the half-circle: the outermost socket reaches the mouth, and
      // nothing ever leaves the half.
      const reach = Math.max(...angs.map(Math.abs))
      ok(Math.abs(reach - Math.PI / 2) < 1e-9,
         `socketArcAngles(${n}) reaches the mouth of the half-circle (${reach.toFixed(4)} vs ${(Math.PI/2).toFixed(4)})`)
      ok(angs.every(x => Math.abs(x) <= Math.PI / 2 + 1e-9),
         `socketArcAngles(${n}) never leaves the half-circle`)
    }
  }
  ok(COURT_RADIUS > 0, `COURT_RADIUS is a real radius (${COURT_RADIUS})`)
}

// ── 5e. ★★★ THE HUB AND THE WEDGES — Alex: *"no real form … kinda looks garbled"* ────────────
// His diagnosis, and it was better than mine: four stones on a slab have no composition, so making
// each stone crisp would still leave four separate objects. A hub with a wedge out to each socket
// gives the eye somewhere to start. These asserts guard the properties that make it read.
{
  for (const t of [0, 1, 2]) {
    const cfg = plotForTier(t)
    for (const seed of [1337, 555, 1000, 42]) {
      const level = courtLevel(seed, cfg)
      if (level === null) continue
      const a = courtAnchor(seed, cfg)
      if (a.y === null) continue
      const hub = courtHubCells(seed, cfg)
      const keys = new Set(hub.map(c => `${c.x},${c.z}`))
      const deck = new Set(courtPlatformCells(seed, cfg).map(c => `${c.x},${c.z}`))
      const socks = sockets(seed, cfg)

      ok(hub.length > 0, `s${seed} t${t}: the court has a hub at all`)
      // One course, and the one that stands ON the deck rather than in it.
      ok(hub.every(c => c.y === level + 1),
         `s${seed} t${t}: every hub cell is the course above the dais surface`)

      // ── ⚠ NEVER OFF THE APRON, NEVER INSIDE A STONE ────────────────────────────────────────
      // ⚠ NOT `deck.has(...)`. That was this assert's first form and it went red against a CORRECT
      // hub: a column whose ground already sits at `level` is flush floor and gets no dais block,
      // so it is absent from the laid set while being perfectly solid to stand on. Membership of
      // the laid set was never the property — **is there something directly under this stone** is.
      // The tempting fix was to drop the assert; the right one was to ask the affordance.
      const floats = hub.filter(c => {
        if (deck.has(`${c.x},${c.z}`)) return false           // a dais block, top at `level`
        return plotHeight(c.x, c.z, seed, cfg) !== level      // or ground already flush at `level`
      })
      ok(floats.length === 0,
         `s${seed} t${t}: every hub cell rests on the court floor, none over air (${floats.length} floating)`)
      const inStone = new Set<string>()
      for (const sk of socks) for (const c of socketCells(sk, level)) inStone.add(`${c.x},${c.z}`)
      ok(hub.every(c => !inStone.has(`${c.x},${c.z}`)),
         `s${seed} t${t}: no hub cell fights a frame for its cell, or sills its doorway`)

      // ── ★★★ CONTIGUOUS, AND THIS IS THE WHOLE POINT OF THE FILE ───────────────────────────
      // The frames garble because `socketCells` steps a lattice and rounds, so a 40° facing lays a
      // diagonal staircase WITH GAPS. A wedge is rasterised by distance-to-segment instead, which
      // fills. If that ever regresses to sampling, the wedges become dotted lines and this is the
      // assert that notices — a picture would not, at a glance, and neither would a cell count.
      const seen = new Set<string>([`${a.x},${a.z}`])
      const queue = [[a.x, a.z] as [number, number]]
      while (queue.length) {
        const [x, z] = queue.pop()!
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const k = `${x+dx},${z+dz}`
          if (keys.has(k) && !seen.has(k)) { seen.add(k); queue.push([x+dx, z+dz]) }
        }
      }
      const orphans = hub.filter(c => !seen.has(`${c.x},${c.z}`)).length
      ok(orphans === 0,
         `s${seed} t${t}: every hub cell is 4-connected to the focus — no dotted wedge (${orphans} orphaned)`)

      // ── AND EACH WEDGE ACTUALLY REACHES ITS STONE. Alex ruled *"reach"*, so a wedge that stops
      // three blocks short is the thing he asked against — and it stops AT the frame, so the test
      // is adjacency to the frame's footprint, not overlap with it.
      for (const sk of socks) {
        const touches = [...keys].some(k => {
          const [x, z] = k.split(',').map(Number)
          return [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz]) => inStone.has(`${x+dx},${z+dz}`))
            && Math.hypot(x - sk.x, z - sk.z) < COURT_RADIUS
        })
        ok(touches, `s${seed} t${t}: socket ${sk.index}'s wedge reaches its stone`)
      }

      // ── ★ THE GATE IS VISIBLY SINGULAR, WHICH CANON ASKS FOR IN AS MANY WORDS ─────────────
      // `shimmer-geography.md`: *"render it unlike its neighbours"*. Asserted as a RELATION, not as
      // a number — a literal `gate === 2` would be the hand-kept mirror wearing a test's name, and
      // the relation is what canon actually requires.
      ok(WEDGE_HALF.gate > WEDGE_HALF.passage,
         `the home-gate's wedge is wider than a passage's (${WEDGE_HALF.gate} vs ${WEDGE_HALF.passage})`)

      // Everything it lays must be removable when the court moves.
      ok(isCourtMaterial(MAT.CUT_STONE), `the hub's material is one the court sweep will remove`)
      ok(COURT_HUB_RADIUS >= 1, `the hub is a real disc (${COURT_HUB_RADIUS})`)
    }
  }
}

// ── 5f. ★★★ EVERYTHING THE COURT LAYS, THE COURT CAN TAKE BACK ───────────────────────────────
// Alex, standing in his own plot: *"it almost looks as tho each pass is adding more stone brick
// blocks ontop of the previous attempt."* He was right and it was measurable — 262 of 695 cells on
// t0 sat outside every sweep, so each rev piled a floor on the last and nothing could remove any of
// it. This is the assert that had to exist, and note the SHAPE of it: not "does the sweep run", but
// **is the set of cells laid a SUBSET of the set that can be removed.** A guard asking whether a
// clear happened would have been green the whole time this was broken.
{
  for (const t of [0, 1, 2]) {
    const cfg = plotForTier(t)
    for (const seed of [1337, 555, 1000, 42]) {
      const level = courtLevel(seed, cfg)
      if (level === null) continue
      const laid = new Set<string>()
      for (const c of courtPlatformCells(seed, cfg)) laid.add(`${c.x},${c.y},${c.z}`)
      for (const c of courtHubCells(seed, cfg)) laid.add(`${c.x},${c.y},${c.z}`)
      // ★ THE TOWER JOINS THE LAID SET THE DAY IT IS BUILT, not the day someone notices twenty
      // orphan courses over a moved court. `court-wiring.test.ts` counts the write sites in the
      // host and fails until this line exists — which is how it got here.
      for (const c of gateTowerCells(seed, cfg)) laid.add(`${c.x},${c.y},${c.z}`)
      for (const sk of sockets(seed, cfg))
        for (const c of socketCells(sk, level)) laid.add(`${c.x},${c.y},${c.z}`)

      const clearable = new Set<string>()
      for (const c of courtFloorClearCells(seed, cfg)) clearable.add(`${c.x},${c.y},${c.z}`)
      for (const sk of sockets(seed, cfg)) {
        const h = plotHeight(sk.x, sk.z, seed, cfg)
        if (h === null) continue
        for (const c of courtClearCells(sk, h, level - h)) clearable.add(`${c.x},${c.y},${c.z}`)
      }
      const stuck = [...laid].filter(k => !clearable.has(k))
      ok(stuck.length === 0,
         `s${seed} t${t}: every cell the court lays can be swept again (${stuck.length} of ${laid.size} stuck)`)

      // ── ⚠ AND THE SLACK HAS TO BE FALSIFIABLE, OR IT IS A NUMBER NOBODY IS CHECKING ─────────
      // The subset assert above passed with `FLOOR_CLEAR_SLACK` mutated to 0, because it only ever
      // asks about TODAY's apron and today's apron fits without slack. Slack exists for a PREVIOUS,
      // WIDER apron — the case no fixture can contain, since that geometry is gone. So assert the
      // property that stands in for it: the sweep must reach FURTHER than the floor it is sweeping,
      // by enough that a margin widened up to the slack is still reachable tomorrow.
      const a2 = courtAnchor(seed, cfg)
      if (a2.y !== null) {
        const swept = courtFloorClearCells(seed, cfg)
        const outer = Math.max(...swept.map(c => Math.hypot(c.x - a2.x, c.z - a2.z)))
        const apron = Math.max(...courtPlatformCells(seed, cfg).map(c => Math.hypot(c.x - a2.x, c.z - a2.z)))
        ok(outer >= apron + 2,
           `s${seed} t${t}: the sweep reaches past the apron it clears (${outer.toFixed(1)} vs ${apron.toFixed(1)})`)
      }
    }
  }
}


// ── ★★★ THE GATE TOWER — "a landmark you steer by" (Alex, 2026-08-29) ─────────────────────────
// He said the station looked rough and asked for a 3D structure; it already was one, and what it
// actually lacked was HEIGHT. These asserts pin the three ways a twenty-course shaft on a rotated
// socket can go wrong, and all three have already happened to something in this file.
{
  // ⚠⚠ 1. THE SWEEP MUST BE ABLE TO RETIRE IT. This is the failure `courtClearCells`' own header
  // exists to prevent, and a tower makes it far worse than a frame did: stone the clear pass cannot
  // reach is architecture nobody can remove, and it would hang TWENTY COURSES in the air over a
  // plot whose fold has grown. Asserted per tier because the sweep is bounded by a LIFT the host
  // passes, and the tiers do not share a ground.
  for (const t of [0, 1, 2]) {
    const cfg = plotForTier(t)
    for (const seed of SEEDS) {
      const lvl = courtLevel(seed, cfg)
      const tower = gateTowerCells(seed, cfg)
      if (lvl === null || tower.length === 0) continue
      const gate = sockets(seed, cfg)[0]
      const gy = plotHeight(gate.x, gate.z, seed, cfg)
      if (gy === null) continue
      const swept = new Set(
        courtClearCells(gate, gy, lvl - gy).map(c => `${c.x},${c.y},${c.z}`))
      const missed = tower.filter(c => !swept.has(`${c.x},${c.y},${c.z}`))
      ok(missed.length === 0,
        `★★★ tier ${t} seed ${seed}: every tower cell is inside the clear sweep — ${missed.length} of ${tower.length} unreachable`)
    }
  }

  // ⚠⚠ 2. SOLID AT EVERY BEARING, WHICH IS WHY IT IS FILLED AND NOT SAMPLED. `socketCells` walks a
  // lattice and rounds; this file's own hub header measured that giving "a three-cell diagonal
  // staircase with gaps in it" at forty degrees. A frame survives that. A twenty-course shaft ships
  // as a column of holes. Every course must be a solid rectangle in its own (h, d) frame.
  for (const seed of SEEDS) {
    const cfg = plotForTier(1)
    const tower = gateTowerCells(seed, cfg)
    if (tower.length === 0) continue
    const byY = new Map<number, { x: number; z: number }[]>()
    for (const c of tower) {
      if (!byY.has(c.y)) byY.set(c.y, [])
      byY.get(c.y)!.push({ x: c.x, z: c.z })
    }
    let holed = 0
    for (const [, cells] of byY) {
      // A filled course has no interior gap: every cell inside the course's own bounding box that
      // lies between two occupied cells on the same row must itself be occupied.
      const occ = new Set(cells.map(c => `${c.x},${c.z}`))
      const xs = cells.map(c => c.x), zs = cells.map(c => c.z)
      for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
        const row = cells.filter(c => c.x === x).map(c => c.z)
        if (row.length === 0) continue
        for (let z = Math.min(...row); z <= Math.max(...row); z++) if (!occ.has(`${x},${z}`)) holed++
      }
    }
    ok(holed === 0, `★★ seed ${seed}: the tower is solid at its bearing — ${holed} interior holes`)
  }

  // ★ 3. IT NEVER REACHES INTO THE COURT'S WALK. `socketCells` records that extruding along +n once
  // turned a COURT_RADIUS of 10 into an 8-block court while the docstring still read 10. The tower
  // thickens BACKWARD; a cell in front of the frame face is that bug returning at twenty courses.
  for (const seed of SEEDS) {
    const cfg = plotForTier(1)
    const gate = sockets(seed, cfg)[0]
    const tower = gateTowerCells(seed, cfg)
    if (tower.length === 0) continue
    const nx = Math.cos(gate.facing), nz = Math.sin(gate.facing)
    const intruding = tower.filter(c => (c.x - gate.x) * nx + (c.z - gate.z) * nz > 0.5)
    ok(intruding.length === 0,
      `★ seed ${seed}: no tower cell reaches past the frame face into the walk — ${intruding.length} do`)
  }

  // ★ 4. IT STANDS ON THE LINTEL, NOT IN THE AIR AND NOT INSIDE THE DOORWAY.
  {
    const cfg = plotForTier(1)
    const lvl = courtLevel(2026, cfg)
    const tower = gateTowerCells(2026, cfg)
    if (lvl !== null && tower.length > 0) {
      const lo = Math.min(...tower.map(c => c.y))
      ok(lo === lvl + 1 + SOCKET_MAX_HEIGHT,
        `★ the shaft starts on the gate's top course (${lo} vs ${lvl + 1 + SOCKET_MAX_HEIGHT})`)
      ok(Math.max(...tower.map(c => c.y)) - lvl === COURT_MAX_HEIGHT,
        '★ and the court\'s stated max height is the height it actually reaches')
    }
  }

  // ★ 5. THE HEIGHT IS DERIVED FROM THE DRAW DISTANCE, NOT PICKED. If someone replaces the
  // derivation with a literal this goes red, which is the point: the day the default view ring
  // changes, a landmark sized against the old one silently stops being a landmark.
  // ⚠ WHAT THIS CANNOT SEE, STATED SO NOBODY READS IT AS MORE THAN IT IS: a literal equal to
  // today's derived value passes. Mutation-tested and confirmed — freezing TOWER_HEIGHT to 20 is
  // invisible here, because 20 is what the formula yields. The failure it DOES catch is the one
  // that matters: the default view ring moving while the tower stays behind.
  ok(TOWER_HEIGHT === landmarkHeight(LANDMARK_DIST, LANDMARK_ANGLE_DEG),
    '★ tower height tracks the angle at the draw distance')
  // So the derivation itself is guarded as a function, where it CAN fail.
  ok(landmarkHeight(96, 12) === 20 && landmarkHeight(192, 12) === 41,
    '★ landmarkHeight is the arc it claims to be — doubling the draw distance doubles the height')
  ok(landmarkHeight(96, 24) > landmarkHeight(96, 12) && landmarkHeight(0, 12) === 0,
    '★ and it is monotonic in the angle, with no height owed at no distance')
  ok(TOWER_HEIGHT > SOCKET_MAX_HEIGHT,
    `★ and it is the tall thing — ${TOWER_HEIGHT} courses over a ${SOCKET_MAX_HEIGHT}-course frame`)
  ok(COURT_MAX_BACK >= TOWER_BACK, '★ the clear sweep reaches as far back as the tower does')
}

console.log(`crossings: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
