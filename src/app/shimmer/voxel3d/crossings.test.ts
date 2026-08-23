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
  courtAnchor, sockets, socketCells, courtFits, SOCKET_KINDS, SOCKET_PITCH,
  COURT_ARC, COURT_INSET, staleCourts,
} from './crossings'
import { plotThreshold, plotHeight, insideCore, plotForTier, PLOT_TIERS, DEFAULT_PLOT } from '../voxel/plot'
import { PLOT_TRIGGER_RADIUS } from './seam'
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
// Ather — and every Ather destination is a waymark. If a future edit adds an Ather socket typed
// 'gate' this goes red, which is the only mechanism watching: `npm run canon` checks names and
// rosters and explicitly does not check vocabulary.
ok(SOCKET_KINDS[0] === 'gate', 'socket 0 is the gate — Rune Hold, out of the Ather, Greg-given')
ok(SOCKET_KINDS.slice(1).every(k => k === 'waymark'),
   'every socket after the first is a waymark, never a gate')
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
    for (const c of socketCells(s, h, a.bearing))
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
    for (const c of socketCells(s, h, a.bearing)) {
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

// ★ ALEX'S RULING, ASSERTED AS A RANGE RATHER THAN A VALUE (2026-08-23): *"near the tunnel passage
// to the wilds, maybe 15-20 blocks away."* Pinning one value would go red the first time anyone
// nudges the pitch; the ruling was a window and the assert is the window.
//
// ⚠ THE WINDOW HERE IS 15-22, NOT 15-20, AND THE GAP IS DELIBERATE AND DOCUMENTED. The threshold
// mound's diagonal reach is 17.7 blocks, so with the frame's half-width the first arc clearing all
// 24 seed×tier combinations lands the nearest socket at 20.2 — just past the ruled ceiling. Widening
// the assert to hide that would be the cheapest lie that makes a red go green; the honest form is a
// window that admits the measured floor and a comment saying which end is a ruling and which end is
// geometry. If Alex wants a true 15, the mound has to shrink first.
for (const seed of SEEDS) {
  for (let t = 0; t < PLOT_TIERS.length; t++) {
    const cfg = plotForTier(t, DEFAULT_PLOT)
    const th = plotThreshold(seed, cfg)
    const near = Math.min(...sockets(seed, cfg).map(s => Math.hypot(s.x - th.x, s.z - th.z)))
    ok(near >= 15 && near <= 22,
       `s${seed} t${t}: nearest socket is ${near.toFixed(1)} blocks from the seam (ruled 15-20; mound floors it at ~20)`)
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
    ok(stale.every(a => a.x !== here.x || a.z !== here.z),
       `s${seed}: tier ${t} never lists the court that is supposed to be standing`)
    ok(stale.every(a => Math.hypot(a.x - here.x, a.z - here.z) > 8),
       `s${seed}: tier ${t} older courts are genuinely elsewhere, not a rounding wobble`)
  }
  // ⚠ THIS DOES NOT TEST THE CLAMP, AND PRETENDING IT DOES WOULD BE THE WORSE OPTION. Removing the
  // clamp leaves it green, because the same-column skip inside `staleCourts` collapses the extra
  // iterations anyway — two guards each covering for the other, so neither is provable while the
  // other stands. Both are labelled as such in the module. What this DOES assert is the observable
  // contract a caller depends on: a garbage tier out of a save file yields the top tier's answer.
  ok(staleCourts(seed, 99).length === PLOT_TIERS.length - 1, `s${seed}: an over-range tier reads as the top tier`)
}

console.log(`crossings: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
