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
import { GATE_X, GATE_Z, gateCells } from './gate'
import { bubbleMaterialAt } from '../voxel/bubble'
import { WILDS_BUBBLE } from '../voxel/column'
import { columnHeight } from '../voxel/height'

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
  ok(walk < 140, `s${seed}: the court shares the garden's door end (${walk.toFixed(0)} blocks from the seam)`)
}

// ── 4. the Moonwell Glade arch, RECORDED NOT SWALLOWED ────────────────────────────────────────
// ★ NOT A FAILURE — A STANDING EXHIBIT. `gate.ts` derives its arch as 300 blocks from the glade
// toward origin, which was right on 2026-08-08 and expired on 08-15 when the fold was carved at
// origin with radius 500. Whether that arch moves outward, is retired in favour of the cave door
// that superseded it, or the fold gets a carve-out is ALEX'S placement call, and whether the arch
// still exists as a landmark at all is a Magii question. So this prints rather than fails.
//
// ⚠ IT MEASURES AGAINST `WILDS_BUBBLE`, NOT `DEFAULT_BUBBLE`. The live bubble's passageBearing is
// derived from the glade (`column.ts`); the default's is 0. Probing the default puts the door at
// (504,0) instead of (-116,-492) and reports the arch as 682 blocks away on the far side of the
// world — a clean, confident, entirely wrong finding. That is the wrong-door trap `bubble.test.ts`
// already records once, and it caught this file's author before it caught anyone else.
{
  const buried: string[] = []
  for (const seed of SEEDS) {
    const baseY = columnHeight(GATE_X, GATE_Z, seed)
    const cells = gateCells(baseY)
    // ⚠ `h` IS THE FIFTH PARAMETER AND SKIPPING IT IS SILENT UNDER tsx. The signature is
    // (x, y, z, seed, h, cfg). Passing the config in `h`'s slot type-checks nowhere and RUNS
    // anyway, with `cfg` quietly defaulting to DEFAULT_BUBBLE — so the measurement answers about
    // the wrong bubble while looking exactly like the right one. It produced the same 20/20 here,
    // which is worse than a wrong number: agreement by luck reads as corroboration. tsc caught it;
    // the three runs before tsc did not.
    const inFold = cells.filter(c =>
      bubbleMaterialAt(c.x, c.y, c.z, seed, columnHeight(c.x, c.z, seed), WILDS_BUBBLE) !== null)
    if (inFold.length > 0) buried.push(`s${seed}: ${inFold.length}/${cells.length}`)
  }
  if (buried.length > 0) {
    console.log(`\nℹ️  KNOWN, AWAITING ALEX — the Moonwell Glade arch (gate.ts) stands in the fold's hollow.`)
    console.log(`   arch (${GATE_X},${GATE_Z}) is r=${Math.hypot(GATE_X, GATE_Z).toFixed(0)} from the fold's centre; the shell is at ~501.`)
    console.log(`   cells claimed as fold interior: ${buried.join(' · ')}`)
    console.log(`   → relocate outward · retire in favour of the cave door · carve the fold. Alex's call; Magii's if it retires.\n`)
  } else {
    // If this ever stops being true, the exhibit above is stale prose and must go.
    console.log('\nℹ️  the Moonwell Glade arch is clear of the fold — §4 is stale, delete it.\n')
  }
}

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
for (const seed of SEEDS) {
  const seps: number[] = []
  for (let t = 0; t < PLOT_TIERS.length; t++) {
    const cfg = plotForTier(t, DEFAULT_PLOT)
    const a = courtAnchor(seed, cfg), th = plotThreshold(seed, cfg)
    seps.push(Math.hypot(a.x - th.x, a.z - th.z))
  }
  const spread = Math.max(...seps) - Math.min(...seps)
  ok(spread < 12,
     `s${seed}: the court keeps its distance from the seam as the fold grows ` +
     `(${seps.map(v => v.toFixed(0)).join(' · ')} blocks, spread ${spread.toFixed(0)})`)
  // ...and it is still the distance the constant claims.
  for (const sep of seps)
    ok(Math.abs(sep - COURT_ARC) < 14, `s${seed}: separation ${sep.toFixed(0)} tracks COURT_ARC ${COURT_ARC}`)
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
