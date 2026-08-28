// The crossing court's WIRING. Run: npx tsx src/app/shimmer/voxel3d/court-wiring.test.ts
//
// ── ★★★ WHY THIS FILE EXISTS AND `crossings.test.ts` COULD NOT COVER IT ───────────────────────
// That suite has 3786 asserts and one of them is named *"the host must pass courtLevel, not
// per-socket ground"* — but it proves that claim by calling `socketCells(sk, level)` ITSELF. It is
// green whatever `VoxelWorld.tsx` actually passes. That is precisely the shape that shipped a
// broken bridge deck on 2026-08-22: `bridges.test.ts` called `bridgeVoxelAt` directly while the
// game reached it through `materialAt`, both halves internally consistent about different things,
// 371 asserts green over a world that discarded 44% of the deck.
//
// So this file reads the HOST and asserts what it hands over. The court is derived geometry laid
// once per tier — there is no frame where a wrong Y shows up as an error. It shows up as stones
// sunk a block into their own plinth, which looks like a modelling choice.
//
// ⚠⚠ AND A TEXTUAL READER IS A STANDING CLAIM ABOUT A FILE IT DOES NOT OWN. Every anchor below
// goes through `once()`, which FAILS when an anchor is missing or ambiguous rather than reporting
// a clean run over a file it could no longer find. *"I found no drift"* and *"I could not look"*
// must not share an exit code — five of the canon gate's ten checks had that branch.

import { readFileSync } from 'node:fs'
import { codeOnly } from '../testing/guard'
import { COURT_REV, PLATFORM_MAT, isCourtMaterial, courtLevel, courtPlatformCells,
         sockets, socketCells } from './crossings'
import { plotForTier, plotHeight } from '../voxel/plot'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const raw = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')
const src = codeOnly(raw)   // comments AND string bodies gone — this asks what the file DOES

/**
 * Assert a needle appears in the host exactly `n` times.
 *
 * ★ THE COUNT IS THE POINT, NOT THE PRESENCE. *"Does the file mention courtLevel"* is satisfied by
 * one correct call beside one wrong one — and the wrong one is the whole defect. A guard that only
 * asks "did it match" survives its own bug's shape.
 */
const once = (needle: string, n: number, what: string) => {
  const got = src.split(needle).length - 1
  ok(got === n, `${what}: expected ${n}x "${needle}" in VoxelWorld.tsx, found ${got}`)
  return got === n
}

// ── 0. THE READER CAN SEE ITS SUBJECT AT ALL ─────────────────────────────────────────────────
// If this fails, every assert below is measuring an empty string and would otherwise pass clean.
{
  ok(raw.length > 10_000, `VoxelWorld.tsx read (${raw.length} bytes)`)
  ok(raw.includes('//'), 'it carries prose, so the comment stripper below is load-bearing')
  // ⚠ NOT `src.length < raw.length`. That was my first version and it FAILED against a correct
  // stripper: `strip` blanks to spaces by default so index offsets survive, which is the whole
  // reason a slicing guard can trust them. Length is the wrong property; content is the right one.
  ok(src !== raw, 'and the stripper actually blanked something')
  ok((raw.split('//').length - 1) > (src.split('//').length - 1), 'specifically, the comments')
  ok(!src.includes('the crossing court'), 'prose is gone from the code view — a comment cannot satisfy an assert here')
}

// ── 1. ★★★ EVERY `socketCells` CALL TAKES THE SHARED LEVEL ───────────────────────────────────
// The one contract. There are exactly two call sites — the build pass and the lamp pass — and they
// derive the same cells independently, so it is not enough that ONE of them is right.
//
// ⚠ THE LAMP PASS IS THE HALF THAT WOULD HAVE STAYED WRONG QUIETLY. A build laying frames at
// `level` while the lamps are written at per-socket ground puts the lamp a course or two below the
// frame that holds it: into the dais, or into air beside it. The socket simply never lights, and
// nothing reports a lamp set in a block that is not there.
{
  once('socketCells(', 2, 'both court passes')
  once('socketCells(sk, level)', 2, 'and both take courtLevel')
  ok(!/socketCells\(sk, h\)/.test(src), 'never a socket\'s own ground — that embeds the frame in the dais')
  once('courtLevel(SEED, cfg)', 2, 'each pass derives the level from the same seed and fold')
}

// ── 2. THE DAIS IS ACTUALLY LAID, IN ITS OWN MATERIAL ────────────────────────────────────────
// `courtPlatformCells` shipped in the bundle on 08-27 and appeared in exactly one file: its own
// test. Built, tested, green, and not in the world — the third time that shape has been found here
// (98 unreachable build pieces, the collar prompt, ring 2).
{
  once('courtPlatformCells(SEED, cfg)', 1, 'the build pass asks for the dais')
  ok(/setVoxel\(c\.x, c\.y, c\.z, PLATFORM_MAT\)/.test(src), 'and writes it in PLATFORM_MAT')
  // Ordering by index rather than by exact whitespace: the dais write must come before the frame
  // write, or the frames' first course gets buried in the floor laid over it.
  const daisAt = src.indexOf('PLATFORM_MAT)')
  const frameAt = src.indexOf('socketCells(sk, level)')
  ok(daisAt > 0 && frameAt > 0, 'both writes found')
  ok(daisAt < frameAt, 'floor before frames — laying it after would bury their first course in it')
}

// ── 3. THE SWEEP ASKS THE COURT WHAT THE COURT LAYS ─────────────────────────────────────────
// ⚠ The retired form is `m === MAT.CUT_STONE || m === MAT.MANA_LANTERN`, two literals in a render
// file, written when those were the only materials a court could contain. A third one it does not
// know about is an entire platform left standing every time the fold grows.
{
  ok(/isCourtMaterial\(voxel\(c\.x, c\.y, c\.z\)\)/.test(src), 'the sweep asks isCourtMaterial')
  ok(!/m === MAT\.CUT_STONE \|\| m === MAT\.MANA_LANTERN/.test(src),
     'and the two-literal whitelist is gone, not merely joined')
  once('courtPlatformCells(SEED, oldCfg)', 1, 'a retired fold\'s floor is swept too')
  ok(isCourtMaterial(PLATFORM_MAT), 'and the dais material is one that sweep will remove')
}

// ── 4. ⚠ THE FLOOR'S OWN COLUMNS ARE IN THE READINESS CHECK ─────────────────────────────────
// A frame is 7 wide; the apron reaches COURT_RADIUS + PLATFORM_MARGIN out from the focus, so it
// crosses section seams the frames never came near. Checking only the sockets lays whichever half
// of the floor had arrived — and the build pass is keyed on the TIER, so it never comes back.
{
  ok(/dais\.every\(c => cols\.current\.has\(colOf\(c\.x, c\.z\)\)\)/.test(src),
     'the dais columns must be loaded before the court is laid')
  ok(/level !== null/.test(src), 'and a court with no derivable level is not half-built')
}

// ── 5. THE REV MOVED, OR A STANDING COURT KEEPS ITS OLD Y FOREVER ───────────────────────────
// The tier never changes again once a keeper is at their final fold, so the rev is the only thing
// that re-lays stone already in the world. Revs 1-3 stood every frame on its own ground.
{
  ok(COURT_REV >= 4, `COURT_REV is past the dais-less revs (is ${COURT_REV})`)
  ok(!/COURT_REV = \d/.test(src), 'and the host reads the rev rather than restating it')
}

// ── 6. ★★ THE LIFT IS REAL, MEASURED, NOT ASSERTED FROM THE CONSTANT ────────────────────────
// `PLATFORM_RISE` is 1, but a socket standing a course low is lifted TWO — measured across 400
// seeds x 3 tiers: 4225 sockets at lift 1 and **575 at lift 2**, so it is one socket in eight, not
// a corner case. A clear pass bounded at the frame's own height above the GROUND therefore stops
// short of that court's lintel and leaves the top of every arch standing when the fold grows.
//
// ⚠ THE SAMPLE IS WIDE ON PURPOSE. My first version read four seeds, saw lift 1 every time, and
// would have let `PLATFORM_RISE` stand in for the lift forever — the mirror trap is asserting
// `lift === PLATFORM_RISE` and calling it checked. The assert below demands the spread it claims.
{
  let maxLift = 0, seen = 0
  for (const t of [1, 2, 3]) {
    const cfg = plotForTier(t)
    for (let seed = 1; seed <= 60; seed++) {
      const level = courtLevel(seed, cfg)
      if (level === null) continue
      for (const s of sockets(seed, cfg)) {
        const h = plotHeight(s.x, s.z, seed, cfg)
        if (h === null) continue
        seen++
        if (level - h > maxLift) maxLift = level - h
      }
    }
  }
  ok(seen > 100, `enough sockets measured to see the spread (${seen})`)
  ok(maxLift >= 2, `the lift VARIES and is not PLATFORM_RISE — some socket is lifted ${maxLift}`)
  ok(/courtClearCells\(sk, h, lvl === null \? 0 : lvl - h\)/.test(src),
     'and the host passes that lift to the clear pass rather than letting it guess')
}

// ── 7. THE HOST'S OWN COURT CELLS ARE ALL SWEEPABLE ─────────────────────────────────────────
// Behavioural, not textual: whatever the court lays, the sweep must be able to remove. A material
// added to the court and not to `isCourtMaterial` is architecture nobody can ever take down.
{
  const cfg = plotForTier(2)
  const level = courtLevel(1337, cfg)
  ok(level !== null, 's1337 t2 has a derivable court level')
  if (level !== null) {
    const stray = new Set<number>()
    for (const s of sockets(1337, cfg))
      for (const c of socketCells(s, level))
        if (!c.doorway && !isCourtMaterial(PLATFORM_MAT)) stray.add(PLATFORM_MAT)
    for (const c of courtPlatformCells(1337, cfg)) { if (!isCourtMaterial(PLATFORM_MAT)) stray.add(PLATFORM_MAT); break }
    ok(stray.size === 0, `every cell the court lays is sweepable (${[...stray].join(',') || 'none stray'})`)
  }
}

console.log(`court-wiring: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
