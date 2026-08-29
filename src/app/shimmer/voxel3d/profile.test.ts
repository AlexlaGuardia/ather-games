// The profiler's oracle. Run: npx tsx src/app/shimmer/voxel3d/profile.test.ts
//
// ★ THE PROPERTY: **this instrument may never make a frame look accounted-for when it is not.**
// Every assert below is a way of asking that, because the failure mode of a profiler is not that it
// crashes — it is that it hands back a tidy breakdown of the 13% of the frame somebody remembered to
// wrap and says nothing about the other 87%.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Profiler } from './profile'
import { createProfiler, snapshotText, gpuTrusted, GPU_COVERAGE_MIN, WINDOW_MS, MAX_ZONES, OVERFLOW, UNACCOUNTED_ROW, PROLOGUE_ROW, TAIL_ROW } from './profile'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

/** A clock we drive by hand, so a test never measures the test runner. */
const clock = () => { const c = { t: 0 }; return { c, now: () => c.t } }

/**
 * Hand the profiler the NEXT frame's delta — which is what ACCOUNTS the frame just closed.
 *
 * ★★ `dtRaw` always describes the PREVIOUS frame (r3f takes its delta at the top of the callback and
 * renders after every subscriber), so a frame's zones are folded into the window only when the
 * FOLLOWING frame ends. That was already true in partition mode and is true in both modes since
 * 2026-08-29 — the un-partitioned branch used to pair a frame's zones with its predecessor's
 * duration, which is the two-frames-spliced defect block 9 exists for, and it published parts that
 * outran the whole (a 240ms frame after a 16ms one read `measured 193.00 of a 16.00 ms frame`).
 *
 * ⚠ So a ONE-FRAME test publishes nothing at all, and that is the contract: the first frame's dt
 * reaches back before the profiler was watching, so nothing can be said about its parts.
 */
const accountFrame = (p: Profiler, dt: number) => p.frameEnd(dt)

// ── 1. ★★ MARKS PARTITION THE FRAME — the claim the whole file rests on ────────────────────────
{
  const { c, now } = clock()
  const p = createProfiler(now)
  p.enabled = true
  c.t = 100; p.mark('mesh')
  c.t = 104; p.mark('flora')
  c.t = 110; p.mark('light')
  c.t = 112; p.frameEnd(0.016)
  accountFrame(p, 0.016)   // the frame above is accounted by the NEXT frame's delta
  c.t = 100 + WINDOW_MS + 1
  const w = p.publish()!
  ok(!!w, 'a window is published once the interval has passed')
  const byName = Object.fromEntries(w.zones.map(z => [z.name, z.ms]))
  ok(byName.mesh === 4 && byName.flora === 6 && byName.light === 2,
    `each zone runs from its own mark to the next (mesh ${byName.mesh}, flora ${byName.flora}, light ${byName.light})`)
  ok(w.measured === 12, `★ measured is the span from first mark to frameEnd, exactly (${w.measured})`)
  ok(w.zones.filter(z => !z.unaccounted)[0].name === 'flora', 'real zones come back largest first')
}

// ── 2. ★★★ UNACCOUNTED IS AGAINST THE WALL CLOCK, NOT AGAINST THE ZONE SUM ─────────────────────
// The one that stops this being a liar. A 16ms frame with 3ms of wrapped work has 13ms nobody is
// watching, and the panel has to say so.
{
  const { c, now } = clock()
  const p = createProfiler(now)
  p.enabled = true
  c.t = 0; p.mark('a')
  c.t = 3; p.frameEnd(0.016)           // 16ms of wall clock, 3ms of it wrapped
  accountFrame(p, 0.016)
  c.t = WINDOW_MS + 1
  const w = p.publish()!
  ok(near(w.ms, 16, 0.001), `★ seconds in, milliseconds out — a 0.016s frame reads as ${w.ms.toFixed(3)} ms`)
  ok(w.measured === 3, 'measured counts only what was wrapped')
  ok(near(w.unaccounted, 13, 0.001), `★★★ 13ms is reported as UNACCOUNTED rather than absorbed (${w.unaccounted.toFixed(3)})`)
  ok(near(w.zones.find(z => z.name === 'a')!.pct, 3 / 16 * 100, 0.001),
    'a zone is a percentage OF THE FRAME, not of the measured part')
  const txt = snapshotText(w, {
    space: 'plot', x: 1, y: 2, z: 3, viewRadius: 6, cols: 1, meshes: 1, draws: 1, tris: 1,
    geometries: 1, programs: 1, gpuStatus: 'ok',
  })
  ok(/UNACCOUNTED/.test(txt), '★★ and the text always prints it')
  ok(w.zones.some(z => z.unaccounted) && w.zones.length === 2,
    'the remainder is one of the rows, not a separate footnote')
  ok(/HOME PLOT \(fold\)/.test(txt),
    '★★ and says WHERE it was taken — the reading that has no place attached is the one that cost 08-22')
}

// ── 3. ★★ A FRAME WITH NO ZONES AT ALL IS 100% UNACCOUNTED, NOT 100% ACCOUNTED ─────────────────
// The vacuous direction. Nobody wraps anything, `measured` is 0, and an implementation that derives
// the total from the parts would report a perfectly healthy fully-explained frame.
{
  const { c, now } = clock()
  const p = createProfiler(now)
  p.enabled = true
  p.frameEnd(0.020)
  accountFrame(p, 0.020)
  c.t = WINDOW_MS + 1
  const w = p.publish()!
  ok(w.measured === 0 && near(w.unaccounted, 20, 0.001),
    `★★ an uninstrumented frame is entirely unaccounted (measured ${w.measured}, unaccounted ${w.unaccounted.toFixed(2)})`)
  ok(w.zones.length === 1 && w.zones[0].unaccounted === true && near(w.zones[0].pct, 100, 0.001),
    '★★★ and it is a ROW at 100%, not an empty table — a breakdown of nothing must not read as a healthy frame')
}

// ── 3b. ★★★ THE REMAINDER CAN TAKE THE TOP ROW, AND MUST WHEN IT IS THE BIGGEST THING ─────────
// The failure this instrument exists to prevent, stated as a test: six wrapped zones and one huge
// unwatched cost. A profiler that sorts only its own zones names `mesh` and is confidently wrong.
{
  const { c, now } = clock()
  const p = createProfiler(now)
  p.enabled = true
  c.t = 0; p.mark('mesh'); c.t = 3; p.mark('flora'); c.t = 4; p.frameEnd(0.030)
  accountFrame(p, 0.030)
  c.t = WINDOW_MS + 1
  const w = p.publish()!
  ok(w.zones[0].unaccounted === true,
    `★★★ 26ms nobody wrapped outranks a 3ms zone somebody did (top row: ${w.zones[0].name})`)
  const txt = snapshotText(w, {
    space: 'plot', x: 0, y: 0, z: 0, viewRadius: 6, cols: 0, meshes: 0, draws: 0, tris: 0,
    geometries: 0, programs: 0, gpuStatus: 'ok',
  })
  // ⚠ `%  mesh`, not `mesh` — the scene line above the table contains the word "mesh" as a counter
  // label, so a bare search finds that and the assert passes for the wrong reason.
  ok(txt.indexOf(UNACCOUNTED_ROW) < txt.indexOf('%  mesh'),
    '★★ and it leads the printed table — a gap read as a footnote gets read as rounding')
}

// ── 4. ★★★ A MISSING GPU TIMER IS null, AND NEVER 0 ────────────────────────────────────────────
// 0 reads as "the GPU is idle, so this is cpu-bound" — a confident answer to the exact question
// being asked, in the direction that gets acted on.
{
  const { c, now } = clock()
  const p = createProfiler(now)
  p.enabled = true
  p.attach({ getExtension: () => null } as unknown as WebGL2RenderingContext)
  ok(p.gpuStatus !== 'ok', `the status says why (${p.gpuStatus})`)
  p.gpuFrame(); p.gpuFrame()
  p.frameEnd(0.016)
  accountFrame(p, 0.016)
  c.t = WINDOW_MS + 1
  const w = p.publish()!
  ok(w.gpuMs === null, '★★★ gpuMs is null with no extension')
  const txt = snapshotText(w, {
    space: 'wilds', x: 0, y: 0, z: 0, viewRadius: 6, cols: 0, meshes: 0, draws: 0, tris: 0,
    geometries: 0, programs: 0, gpuStatus: p.gpuStatus,
  })
  ok(/UNAVAILABLE/.test(txt) && /cannot say whether/.test(txt),
    '★★ and the text refuses to imply an answer it does not have')
}

// ── 5. ★ A DISJOINT SAMPLE IS DISCARDED, NOT AVERAGED IN ───────────────────────────────────────
{
  const { c, now } = clock()
  const mkGl = (disjoint: boolean, ns: number) => {
    const EXT = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }
    return {
      getExtension: () => EXT,
      createQuery: () => ({} as WebGLQuery),
      beginQuery: () => {}, endQuery: () => {},
      getParameter: () => disjoint,
      getQueryParameter: (_q: unknown, what: unknown) => what === 'AVAIL' ? true : ns,
      QUERY_RESULT_AVAILABLE: 'AVAIL', QUERY_RESULT: 'RESULT',
      deleteQuery: () => {},
    } as unknown as WebGL2RenderingContext
  }
  const good = createProfiler(now); good.enabled = true
  good.attach(mkGl(false, 4_000_000))            // 4ms in nanoseconds
  // ★ Driven through the SUPPORTED call, twice — `gpuFrame` closes the previous frame's query and
  // opens the next, so one call can never produce a sample and two must.
  good.gpuFrame(); good.gpuFrame(); good.frameEnd(0.016)
  accountFrame(good, 0.016)
  c.t = WINDOW_MS + 1
  ok(near(good.publish()!.gpuMs!, 4, 0.001), '★ a clean sample comes back in ms')

  // ★★ ONE `gpuFrame` CANNOT PRODUCE A SAMPLE, and pinning that is what stops the two-call version
  // creeping back. A begin/end pair inside a single frame callback measures the game's JS and not
  // its drawing, because r3f renders after every callback has run — it would report a nearly idle
  // GPU, which is a confident wrong answer to the one question the field exists to settle.
  const c3 = clock()
  const one = createProfiler(c3.now); one.enabled = true
  one.attach(mkGl(false, 4_000_000))
  one.gpuFrame(); one.frameEnd(0.016)
  accountFrame(one, 0.016)
  c3.c.t = WINDOW_MS + 1
  ok(one.publish()!.gpuMs === null,
    '★★ a single gpuFrame reports null — the window has been opened and not yet closed by a render')

  const c2 = clock()
  const bad = createProfiler(c2.now); bad.enabled = true
  bad.attach(mkGl(true, 999_000_000))            // driver says the timing is garbage
  bad.gpuFrame(); bad.gpuFrame(); bad.frameEnd(0.016)
  accountFrame(bad, 0.016)
  c2.c.t = WINDOW_MS + 1
  ok(bad.publish()!.gpuMs === null,
    '★ a DISJOINT frame is thrown away and reports null, not a garbage number')
}

// ── 6. OFF COSTS NOTHING, AND THE TOGGLE DOES NOT CARRY A STALE WINDOW ─────────────────────────
{
  const { c, now } = clock()
  const p = createProfiler(now)
  c.t = 0; p.mark('x'); c.t = 5; p.frameEnd(0.016)
  ok(p.publish() === null, 'a disabled profiler records nothing and publishes nothing')

  p.enabled = true
  c.t = 10; p.mark('y')
  // ⚠ The keeper walks away for a minute with the panel open, then it is toggled off and on.
  c.t = 60_000; p.enabled = false; p.enabled = true
  c.t = 60_001; p.mark('z'); c.t = 60_003; p.frameEnd(0.016)
  accountFrame(p, 0.016)
  c.t = 60_003 + WINDOW_MS + 1
  const w = p.publish()!
  const real = w.zones.filter(z => !z.unaccounted)
  ok(real.length === 1 && real[0].name === 'z' && real[0].ms === 2,
    `★ re-enabling starts clean — the 60s idle gap is not attributed to whichever zone was open (${JSON.stringify(w.zones)})`)
}

// ── 7. ★ AN UNBOUNDED ZONE NAME CANNOT GROW THE MAP — the profiler must not become the leak ────
{
  const { c, now } = clock()
  const p = createProfiler(now)
  p.enabled = true
  for (let i = 0; i < MAX_ZONES + 40; i++) { c.t = i; p.mark(`chunk-${i}`) }
  c.t = MAX_ZONES + 41; p.frameEnd(0.016)
  accountFrame(p, 0.016)
  c.t += WINDOW_MS + 1
  const w = p.publish()!
  // MAX_ZONES real names + one overflow bucket + the unaccounted row.
  ok(w.zones.length <= MAX_ZONES + 2,
    `★ distinct zone names are capped (${w.zones.length} rows for ${MAX_ZONES + 40} names)`)
  ok(w.zones.filter(z => z.name === OVERFLOW).length === 1,
    `★★ and the overflow is ONE named bucket — a per-mark overflow name makes the cap unbounded, which is what the first cut did (${w.zones.filter(z => z.name === OVERFLOW).length} rows)`)
  // first mark at t=0, last at t=MAX_ZONES+39, frameEnd at t=MAX_ZONES+41 → the span is +41.
  ok(w.measured === MAX_ZONES + 41,
    `★ and nothing is lost to the cap — every marked millisecond is still in the total (${w.measured})`)
}

// ── 8. PUBLISH IS RATE-LIMITED — an instrument that re-renders the HUD every frame moves the number
{
  const { c, now } = clock()
  const p = createProfiler(now)
  p.enabled = true
  p.frameEnd(0.016)
  accountFrame(p, 0.016)
  c.t = WINDOW_MS - 1
  ok(p.publish() === null, 'nothing is published before the window elapses')
  c.t = WINDOW_MS + 1
  ok(p.publish() !== null, 'and a window lands once it has')
  ok(p.publish() === null, 'and the window resets, so two reads of the same window cannot disagree')
}

// ── 7. ★★★ THE GPU SHARE IS WITHHELD WHEN THE TIMER DID NOT COVER THE WINDOW ───────────────────
// The bug this exists for, measured on a real machine 2026-08-23: **470.0 ms gpu against a 428.4 ms
// frame — 110%**. `ms` averages over `frames`, `gpuMs` over the samples that survived, and the file
// printed their ratio as a clean fraction. The absurd number got questioned; the plausible one
// (`62%`) would not have, and both are biased the same way.
{
  const EXT = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }
  const mkGl = () => ({
    getExtension: () => EXT,
    createQuery: () => ({} as WebGLQuery),
    beginQuery: () => {}, endQuery: () => {},
    getParameter: () => false,
    getQueryParameter: (_q: unknown, what: unknown) => what === 'AVAIL' ? true : 4_000_000,
    QUERY_RESULT_AVAILABLE: 'AVAIL', QUERY_RESULT: 'RESULT',
    deleteQuery: () => {},
  } as unknown as WebGL2RenderingContext)

  const ctx = {
    space: 'plot' as const, x: 0, y: 0, z: 0, viewRadius: 12,
    cols: 1, meshes: 1, draws: 1, tris: 1, geometries: 1, programs: 1, gpuStatus: 'ok',
  }

  // ── thin coverage: 10 frames, one timed sample ──────────────────────────────────────────────
  const { c, now } = clock()
  const thin = createProfiler(now); thin.enabled = true
  thin.attach(mkGl())
  thin.gpuFrame(); thin.gpuFrame()                 // exactly one sample lands
  for (let i = 0; i < 11; i++) thin.frameEnd(0.016)   // 11 driven, 10 counted — the first is never counted
  c.t = WINDOW_MS + 1
  const tw = thin.publish()!
  ok(tw.frames === 10, 'the window counted every frame')
  ok(tw.gpuSamples === 1, '★ gpuSamples is PUBLISHED, so the second denominator is visible at all')
  ok(tw.gpuMs !== null, '★ the raw gpu ms survives — it is the SHARE that is unsafe, not the mean')
  ok(!gpuTrusted(tw), `★★ coverage 1/10 is below ${GPU_COVERAGE_MIN} so the ratio is not trusted`)
  const thinText = snapshotText(tw, ctx)
  ok(/WITHHELD/.test(thinText), '★★★ and the TEXT withholds the share rather than printing it')
  ok(/1 of 10 frames timed/.test(thinText), '★★ and says how thin the coverage was, not just that it failed')
  ok(!/frame  ·  \d+%/.test(thinText), '★★★ no percentage of the frame is printed anywhere on that line')

  // ── full coverage: the percentage is allowed back ───────────────────────────────────────────
  const c2 = clock()
  const full = createProfiler(c2.now); full.enabled = true
  full.attach(mkGl())
  full.gpuFrame()
  for (let i = 0; i < 11; i++) { full.gpuFrame(); full.frameEnd(0.016) }
  c2.c.t = WINDOW_MS + 1
  const fw = full.publish()!
  ok(fw.gpuSamples >= fw.frames * GPU_COVERAGE_MIN,
    '★ a window where every frame was timed reaches full coverage')
  ok(gpuTrusted(fw), '★★ and IS trusted — the guard is not simply always-false')
  ok(/of the .* ms frame/.test(snapshotText(fw, ctx)),
    '★★ so the share of the frame is printed when it is actually comparable')

  // ⚠ A missing extension must still read as UNAVAILABLE, never as "withheld" — they are different
  // claims and collapsing them would hide a dead timer behind a coverage excuse.
  const c3 = clock()
  const none = createProfiler(c3.now); none.enabled = true
  none.frameEnd(0.016)
  accountFrame(none, 0.016)
  c3.c.t = WINDOW_MS + 1
  const nw = none.publish()!
  ok(nw.gpuMs === null && !gpuTrusted(nw), 'no extension: gpuMs null and not trusted')
  ok(/UNAVAILABLE/.test(snapshotText(nw, ctx)) && !/WITHHELD/.test(snapshotText(nw, ctx)),
    '★★ a MISSING timer says UNAVAILABLE, not WITHHELD — different claims, different words')
}

// ── 8. ★★★ THE WORST FRAME HAS PARTS ──────────────────────────────────────────────────────────
// `worst` was a duration with no parts — the exact defect this file exists to fix, one level down.
// Measured on Alex's GPU 2026-08-23: p50 16.6ms with a 292ms max, 39.4% of wall clock lost. The
// window means could not see it and `worst` could see THAT it happened but not WHAT it was.
{
  const { c, now } = clock()
  const p = createProfiler(now); p.enabled = true

  // three clean frames, then one catastrophic one whose cost is all in 'ticks'
  for (let i = 0; i < 3; i++) {
    p.mark('ticks'); c.t += 1
    p.mark('render'); c.t += 2
    p.frameEnd(0.016)
  }
  p.mark('ticks'); c.t += 240          // the stall, inside a wrapped zone
  p.mark('render'); c.t += 2
  // ⚠ THIS frameEnd's delta describes the PREVIOUS, clean frame — it is the NEXT one that carries
  // the stall's 250ms. Writing `frameEnd(0.250)` here would hand the stall frame's parts to a
  // duration r3f never measured for it, which is the two-frames-spliced defect block 9 is about.
  p.frameEnd(0.016)
  const stallAt = c.t
  accountFrame(p, 0.250)
  c.t = stallAt + WINDOW_MS + 1
  const w = p.publish()!

  ok(w.worstZones.length > 0, 'the worst frame publishes a breakdown at all')
  const top = w.worstZones[0]
  ok(top.name === 'ticks', `★★★ the worst frame names its own top zone (got ${top.name})`)
  ok(near(top.ms, 240, 2), `★★ and its cost is the STALL's, not the window mean's (${top.ms.toFixed(1)}ms)`)
  ok(w.zones.find(z => z.name === 'ticks')!.ms < 100,
    '★★ while the WINDOW mean for the same zone stays small — the two must not be the same number')
  // ★ `worstAt` is stamped when the stall frame is ACCOUNTED — i.e. at the frameEnd that carries its
  // delta, one frame later. It is documented as meaningful only when DIFFED against another
  // window's, and this pins which of the two frameEnds it belongs to.
  ok(w.worstAt === stallAt, `★ worstAt stamps the stall frame's accounting (${w.worstAt} vs ${stallAt})`)

  // ★ the worst frame carries its OWN unaccounted remainder, against its OWN duration
  const un = w.worstZones.find(z => z.unaccounted)!
  ok(!!un, 'the worst frame has an unaccounted row of its own')
  ok(near(w.worstZones.reduce((s, z) => s + z.ms, 0), w.worst, 1),
    '★★★ and the worst frame’s rows PARTITION the worst frame, not the window')

  // ⚠ THE STALL OUTSIDE EVERY MARK — the reading that rules out all wrapped zones at once, and
  // the one the real capture may well produce. It must be visible, not silently absent.
  const c2 = clock()
  const q = createProfiler(c2.now); q.enabled = true
  q.mark('ticks'); c2.c.t += 1
  q.frameEnd(0.016)
  c2.c.t += 300                        // the freeze happens with NO zone open
  q.mark('ticks'); c2.c.t += 1
  q.frameEnd(0.300)
  c2.c.t += WINDOW_MS + 1
  const w2 = q.publish()!
  const lead = w2.worstZones[0]
  ok(lead.unaccounted === true,
    '★★★ a stall no mark covers leads the worst frame as UNACCOUNTED — that IS the answer')
  ok(lead.ms > 250, `★★ and carries the stall's real size (${lead.ms.toFixed(0)}ms)`)

  // ★ a healthy window does not print the worst-frame table — noise trains people to skip it
  const c3 = clock()
  const h = createProfiler(c3.now); h.enabled = true
  for (let i = 0; i < 5; i++) { h.mark('ticks'); c3.c.t += 2; h.frameEnd(0.016) }
  c3.c.t += WINDOW_MS + 1
  const hw = h.publish()!
  const ctx = { space: 'plot' as const, x: 0, y: 0, z: 0, viewRadius: 12,
    cols: 1, meshes: 1, draws: 1, tris: 1, geometries: 1, programs: 1, gpuStatus: 'ok' }
  ok(!/worst frame —/.test(snapshotText(hw, ctx)), '★ a healthy window prints no worst-frame table')
  ok(/worst frame —/.test(snapshotText(w, ctx)), '★★ and a stalling one does')
}

// ── 9. ★★★ THE WORST FRAME'S PARTS AND THE WORST FRAME'S DURATION MUST BE THE SAME FRAME ───────
// The defect this section exists to catch, read off the HOST'S OWN SOURCE rather than assumed
// (`@react-three/fiber` `update()`, dist/events-*.esm.js):
//
//     delta = state.clock.getDelta()        // ← taken at the TOP of the frame
//     for (subscribers) subscription(state, delta)   // ← our useFrame, marks, frameEnd(delta)
//     state.gl.render(scene, camera)        // ← THE RENDER SUBMIT HAPPENS AFTER frameEnd
//
// So the `dtRaw` handed to frame N+1 spans `callbackStart(N) → callbackStart(N+1)`: it contains
// frame **N**'s callback and frame **N**'s render submit, and contains none of frame N+1's work.
// Pairing it with frame N+1's zone map splices two frames into one reading — which is the exact
// defect `frameEnd` already documents one level up ("the LAST frame's parts wearing the worst
// frame's duration") surviving inside its own fix.
//
// ⚠⚠ AND IT FAILS IN THE DIRECTION THAT READS AS A FINDING. A stall inside `gl.render()` bills the
// NEXT frame, whose callback is innocent, so the panel prints `100% UNACCOUNTED, every zone 0.00` —
// which reads as "this rules out every wrapped zone at once" and actually means "these are a
// different frame's parts". Alex's 2026-08-23 capture is exactly that shape.
{
  /** Drives the profiler the way r3f drives it. Every duration in ms; `render` is post-frameEnd. */
  const r3f = (p: ReturnType<typeof createProfiler>, c: { t: number },
               frames: { prologue: number; zones: [string, number][]; render: number }[]) => {
    let prevStart: number | null = null
    for (const f of frames) {
      const callbackAt = c.t
      const dt = prevStart === null ? 0.016 : (callbackAt - prevStart) / 1000
      p.frameStart()
      c.t += f.prologue
      for (const [name, ms] of f.zones) { p.mark(name); c.t += ms }
      p.frameEnd(dt)
      c.t += f.render
      prevStart = callbackAt
    }
  }

  const { c, now } = clock()
  const p = createProfiler(now)
  p.enabled = true
  r3f(p, c, [
    // frame 1: a normal callback, then a 200ms RENDER SUBMIT — the buffer-upload shape.
    { prologue: 1, zones: [['ticks', 10]], render: 200 },
    // frame 2: an ordinary cheap callback. Its dtRaw is 211ms and none of that is its own.
    { prologue: 0.1, zones: [['ticks', 0.1]], render: 5 },
    { prologue: 0.1, zones: [['ticks', 10]], render: 6 },
  ])
  c.t += WINDOW_MS + 1
  const w = p.publish()!

  ok(near(w.worst, 211, 0.5), `the 200ms submit surfaces as the worst frame (${w.worst.toFixed(1)}ms)`)
  const top = w.worstZones[0]
  ok(!(top.unaccounted && top.ms > 200),
    `★★★ the worst frame does not report 100% UNACCOUNTED for a stall it can account for (got ${top.name} ${top.ms.toFixed(1)}ms)`)
  const ticks = w.worstZones.find(z => z.name === 'ticks')
  ok(!!ticks && near(ticks.ms, 10, 0.5),
    `★★★ the worst frame's zones are the frame whose callback its dt CONTAINS (ticks ${ticks?.ms.toFixed(2)}, want 10)`)

  // ★★ AND THE STALL LANDS ON A ROW THAT SAYS WHERE IT WAS. `after frameEnd` is where a geometry
  // upload at first draw lives — the difference between "nobody wrapped this" and "this is outside
  // our callback entirely", which are different investigations.
  const tail = w.worstZones.find(z => z.name === TAIL_ROW)
  ok(!!tail && near(tail.ms, 200, 0.5),
    `★★★ the 200ms render submit is named, not left as a remainder (${tail?.ms.toFixed(1)}ms)`)
  const pro = w.worstZones.find(z => z.name === PROLOGUE_ROW)
  ok(!!pro && near(pro.ms, 1, 0.5), `★ and the unwrapped prologue is its own row (${pro?.ms.toFixed(2)}ms)`)

  // ★★★ THE PARTITION IS EXACT, WHICH IS THE CLAIM THE TWO NEW ROWS BUY. A leftover remainder here
  // is not rounding — it is a wiring error, and the assert is what keeps the row honest.
  const un = w.worstZones.find(z => z.unaccounted)!
  ok(near(un.ms, 0, 0.01), `★★★ nothing is left unaccounted once the frame divides exactly (${un.ms.toFixed(3)}ms)`)
  ok(near(w.worstZones.reduce((s, z) => s + z.ms, 0), w.worst, 0.01),
    'the worst frame’s rows still sum to the worst frame')
  ok(near(w.unaccounted, 0, 0.01),
    `★★ and the WINDOW divides exactly too, so its remainder is a wiring check (${w.unaccounted.toFixed(3)})`)
  ok(w.partitioned === true, 'a host that stamps frameStart reports partitioned')

  // ⚠ THE FIRST FRAME IS NOT COUNTED — its dt reaches back before we were watching.
  ok(w.frames === 2, `★ only attributable frames are counted (${w.frames} of 3 driven)`)

  // ── ★★★ FAIL-CLOSED: NO `frameStart`, NO INVENTED ROWS ──────────────────────────────────────
  // The wrong way for this to degrade is two plausible rows derived from a timestamp nobody took.
  const c2 = clock()
  const q = createProfiler(c2.now); q.enabled = true
  for (let i = 0; i < 3; i++) { q.mark('ticks'); c2.c.t += 4; q.frameEnd(0.016); c2.c.t += 12 }
  c2.c.t += WINDOW_MS + 1
  const w2 = q.publish()!
  ok(w2.partitioned === false, '★★★ a host that never stamps frameStart says so')
  ok(!w2.zones.some(z => z.name === TAIL_ROW || z.name === PROLOGUE_ROW),
    '★★★ and invents neither row rather than deriving them from a stamp it never took')
  ok(near(w2.zones.find(z => z.name === 'ticks')!.ms, 4, 0.01),
    `★ the fallback still reports what it did measure (${w2.zones.find(z => z.name === 'ticks')!.ms.toFixed(2)}ms)`)
  ok(w2.unaccounted > 10, '★ with the undivided remainder intact, as before')
}

// ── 10. ★★ THE WORST FRAME'S OWN GPU TIME — the row that splits `after frameEnd` in two ────────
// A 215ms stall that is real GPU work and a 215ms stall waiting on an idle GPU land in the SAME
// row. Only a per-frame timing separates them, and a window mean cannot supply one.
{
  // A fake WebGL2 whose queries land one frame late, exactly as a driver's do.
  const mkGl = (opts: { disjoint?: boolean; ns?: (seq: number) => number } = {}) => {
    let made = 0
    const landed: any[] = []
    return {
      QUERY_RESULT_AVAILABLE: 'avail', QUERY_RESULT: 'res',
      getExtension: (n: string) =>
        n === 'EXT_disjoint_timer_query_webgl2' ? { TIME_ELAPSED_EXT: 'te', GPU_DISJOINT_EXT: 'dj' } : null,
      createQuery: () => ({ id: ++made }),
      beginQuery: (_t: string, q: any) => { q.begun = true },
      endQuery: () => { landed.push(true) },
      // ⚠ A query is available only once a LATER frame has ended — results are a frame or two
      // behind, and a fake that answers instantly would never exercise `pending`.
      getQueryParameter: (q: any, what: string) =>
        what === 'avail' ? landed.length > q.id : (opts.ns ?? ((s: number) => s * 1e6))(q.id),
      getParameter: (_p: string) => !!opts.disjoint,
      deleteQuery: () => {},
    } as unknown as WebGL2RenderingContext
  }

  const { c, now } = clock()
  const p = createProfiler(now)
  p.attach(mkGl({ ns: (seq) => (seq === 1 ? 12 : 3) * 1e6 }))   // frame 1's span cost 12ms of GPU
  p.enabled = true
  let prevStart: number | null = null
  for (const f of [{ zones: 2, render: 200 }, { zones: 1, render: 5 }, { zones: 1, render: 5 },
                   { zones: 1, render: 5 }, { zones: 1, render: 5 }]) {
    const at = c.t
    const dt = prevStart === null ? 0.016 : (at - prevStart) / 1000
    p.gpuFrame(); p.frameStart()
    p.mark('ticks'); c.t += f.zones
    p.frameEnd(dt)
    c.t += f.render
    prevStart = at
  }
  c.t += WINDOW_MS + 1
  const w = p.publish()!
  ok(near(w.worst, 202, 1), `the render submit is the worst frame (${w.worst.toFixed(1)}ms)`)
  ok(w.worstGpuStatus === 'ok', `★★★ the worst frame's own GPU timing lands (${w.worstGpuStatus})`)
  ok(near(w.worstGpuMs!, 12, 0.01),
    `★★★ and it is THAT frame's 12ms, not the window's mean (${w.worstGpuMs?.toFixed(2)})`)
  ok(w.gpuMs !== null && w.gpuMs < 12,
    `★★ while the window mean stays lower — the two must not be the same number (${w.gpuMs?.toFixed(2)})`)
  ok(w.worstGpuMs! < w.worst / 2,
    '★★★ so a stall can be read as "the GPU was not busy" — the claim the whole capture turns on')

  // ⚠ DROPPED IS NOT PENDING. A disjoint driver throws the timing away, most likely on exactly the
  // frame worth measuring; a reader told "pending" would re-capture forever.
  const c2 = clock()
  const d = createProfiler(c2.now)
  d.attach(mkGl({ disjoint: true }))
  d.enabled = true
  let ps: number | null = null
  for (let i = 0; i < 4; i++) {
    const at = c2.c.t
    const dt = ps === null ? 0.016 : (at - ps) / 1000
    d.gpuFrame(); d.frameStart(); d.mark('ticks'); c2.c.t += 2; d.frameEnd(dt)
    c2.c.t += i === 0 ? 200 : 5
    ps = at
  }
  c2.c.t += WINDOW_MS + 1
  const wd = d.publish()!
  ok(wd.worstGpuStatus === 'dropped', `★★★ a disjoint timing says DROPPED (${wd.worstGpuStatus})`)
  ok(wd.worstGpuMs === null, '★★ and carries no number, rather than a zero that reads as an idle GPU')

  // ★ No extension at all outranks both — nothing was pending and nothing was dropped.
  const c3 = clock()
  const n3 = createProfiler(c3.now)
  n3.attach({ getExtension: () => null } as unknown as WebGL2RenderingContext)
  n3.enabled = true
  n3.frameStart(); n3.mark('t'); c3.c.t += 2; n3.frameEnd(0.016)
  c3.c.t += 16
  n3.frameStart(); n3.mark('t'); c3.c.t += 2; n3.frameEnd(0.018)
  c3.c.t += WINDOW_MS + 1
  ok(n3.publish()!.worstGpuStatus === 'unavailable',
    '★★ a missing extension reports unavailable, never pending')
}

// ── 12. ★★ A GPU-BOUND READING MUST STATE ITS PIXEL COUNT ──────────────────────────────────────
// The fold's first trusted reading was `gpu 14.6ms of a 16.7ms frame · 88%` at 125 draws and 19k
// triangles — a triangle count an integrated GPU should not notice, which puts the cost per-PIXEL.
// The experiment that settles that is to draw fewer pixels and look again, and **it is meaningless
// unless both readings say how many pixels they drew.** Same law as `space` being required: a
// reading that does not say where it was taken is not evidence.
{
  const { c, now } = clock()
  const p = createProfiler(now)
  p.enabled = true
  p.frameStart(); p.mark('a'); c.t += 3; p.frameEnd(0.016)
  c.t += 13
  p.frameStart(); p.mark('a'); c.t += 3; p.frameEnd(0.016)
  c.t += WINDOW_MS + 1
  const w = p.publish()!
  const base = { space: 'plot' as const, x: 0, y: 0, z: 0, viewRadius: 12, cols: 503, meshes: 500,
    draws: 125, tris: 19000, geometries: 230, programs: 10, gpuStatus: 'ok' }

  const withPx = snapshotText(w, { ...base, pixels: { w: 2560, h: 1440, dpr: 1.25 } })
  ok(/2560x1440 device px/.test(withPx), '★★ the raster line names the real drawing buffer')
  ok(/3\.69 Mpx/.test(withPx),
    `★★★ and prints megapixels DERIVED, so nobody multiplies two numbers by hand (${withPx.split('\n').find(l => l.includes('raster'))})`)
  ok(/dpr 1\.25/.test(withPx), '★ with the ratio it was resolved at — OS display scaling is invisible otherwise')

  // ⚠ ABSENT MUST STAY ABSENT. A caller that cannot ask the drawing buffer must not get a made-up
  // line: a raster figure derived from nothing is worse than no raster figure, because it will be
  // compared against a real one.
  ok(!/raster/.test(snapshotText(w, base)),
    '★★★ a caller with no pixel count prints NO raster line rather than a guessed one')
}

// ── 11. ★★★ ONE ZONE NAME, ONE PLACE — the defect that hid 70% of a frame ──────────────────────
// `mark` names a ZONE, not a place, and `acc` keys on the name. So the same name marked in two
// unrelated regions sums them into ONE row, and **the table cannot say that it did.** `world:ticks`
// was marked twice — the creature simulation ~500 lines above the growth clocks — and published
// ~10.7ms of a clean 16ms frame as a single number covering a Hollow spawn sweep, collared patrols,
// a foe loop, a guard tick, pots and saplings. That is this file's own "one total has no parts"
// thesis reappearing one level down, inside a row rather than inside a frame.
//
// ⚠ THE READER IS A TEXTUAL SCAN OF A FILE IT DOES NOT OWN, WHICH FAILS SILENTLY BY DEFAULT. So it
// asserts it found a plausible NUMBER of marks before judging them — a regex that matches nothing
// reports "no duplicates" and is indistinguishable from a clean sweep. And it strips line comments
// first: this codebase has already been bitten by a header quoting its own marker, handing every
// reader a second match inside the prose (canon gate, 08-22).
{
  const host = join(__dirname, 'VoxelWorld.tsx')
  const raw = readFileSync(host, 'utf8')
  // ⚠ Comments stripped BEFORE matching — see above. A doc that names a mark must not become one.
  const code = raw.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  const marks = [...code.matchAll(/prof\.current\.mark\('([^']+)'\)/g)].map(m => m[1])

  ok(marks.length >= 12,
    `★★★ BLIND CHECK: the scan found ${marks.length} marks in VoxelWorld.tsx — under 12 means the ` +
    'reader has lost its subject and its verdict is worthless, not clean')

  const seen = new Map<string, number>()
  for (const m of marks) seen.set(m, (seen.get(m) ?? 0) + 1)

  // ★★★ A REPEATED MARK IS LEGITIMATE **ONLY** AS A SUB-ZONE BRACKET, AND THE RULE IS DERIVED FROM
  // THE NAME RATHER THAN FROM A LIST (2026-08-23, and this guard caught its own author to get here).
  // Marks are FLAT: to measure a slice inside a zone you open `world:spawn/light`, do the work, then
  // RE-OPEN `world:spawn`. So the parent legitimately appears more than once — while `world:ticks`
  // marked in two unrelated regions 500 lines apart was the original silent-sum bug.
  //
  // ⚠ THE CHEAP FIX WAS TO EXEMPT THE PARENT, AND IT WOULD HAVE DISARMED THE GUARD. A hand-kept
  // "these may repeat" list is the exemption shape this codebase has paid for four times. Instead the
  // relationship is spelled INTO the zone name — `X/sub` declares its parent — so a new sub-zone is
  // covered the day it is written and a genuine duplicate is still caught.
  const subsOf = (parent: string) => [...seen.keys()].filter(k => k.startsWith(`${parent}/`))
  const dupes = [...seen.entries()].filter(([n, c]) => c > 1 && subsOf(n).length === 0)
  ok(dupes.length === 0,
    `★★★ a zone name repeats only to close a sub-zone — two unrelated regions sharing a name ` +
    `silently sum into one row (offenders: ${dupes.map(([n, c]) => `${n} x${c}`).join(', ') || 'none'})`)

  // ★★ AND THE ARITHMETIC IS EXACT: a parent is opened ONCE and re-opened ONCE PER SUB-ZONE. A
  // missing re-open bills the rest of the frame to the sub-zone; a spare one is a stray mark.
  for (const [name, count] of seen) {
    const subs = subsOf(name)
    if (!subs.length) continue
    const wantParent = 1 + subs.reduce((n, s) => n + (seen.get(s) ?? 0), 0)
    ok(count === wantParent,
      `★★★ ${name} is opened once and re-opened once per sub-zone (${count}, want ${wantParent} ` +
      `for ${subs.join(', ')}) — a missing re-open bills the rest of the frame to the sub-zone`)
  }

  // ★ AND THE SPLIT ITSELF, NAMED. If someone folds these back into one row the row goes big and
  // mute again, which is precisely the state that survived two sessions of investigation.
  for (const z of ['world:spawn', 'world:patrols', 'world:foes', 'world:hollows', 'world:growth']) {
    ok(seen.has(z), `★★ the creature/growth split survives: ${z} is still its own zone`)
  }
  ok(!seen.has('world:ticks'),
    '★★★ and `world:ticks` is gone rather than kept beside its own replacements')
}

// ── 13. ★★★ A FRAME'S PARTS AND A FRAME'S DURATION, IN THE **UN-PARTITIONED** BRANCH ───────────
// Block 9 fixed this for the partition path. The fall-back path kept the defect, and it is the
// reading Alex hit on the UHD 630: `249%` with a NEGATIVE UNACCOUNTED. `dtRaw` describes the
// PREVIOUS frame in BOTH modes — nothing about a callback stamp changes what r3f's delta measures —
// so pairing it with the CURRENT frame's zone map makes an expensive frame report parts that outrun
// the whole. ⚠ It fails toward a FINDING: a percentage over 100 and a negative remainder read as a
// double-counting profiler, which is what the first diagnosis of this bug said, and it is not.
{
  const { c, now } = clock()
  const p = createProfiler(now); p.enabled = true    // ⚠ no frameStart anywhere: fall-back mode

  // one cheap frame, then a 240ms one — the shape of the frame that mounts the panel on a UHD 630
  c.t += 2; p.mark('world'); c.t += 6; p.frameEnd(0.016)
  p.mark('world'); c.t += 240; p.frameEnd(0.016)     // its delta describes the CHEAP frame above
  const stallAt = c.t
  accountFrame(p, 0.240)                             // ★ and THIS delta is the stall frame's
  c.t = stallAt + WINDOW_MS + 1
  const w = p.publish()!

  ok(w.unaccounted >= -0.001,
    `★★★ the remainder is never negative — parts that outrun the frame mean two frames were spliced (${w.unaccounted.toFixed(2)}ms)`)
  ok(w.measured <= w.ms + 0.001,
    `★★★ and the wrapped zones cannot exceed the frame they are a share OF (${((w.measured / w.ms) * 100).toFixed(0)}% of the frame)`)
  ok(!w.zones.some(z => z.pct > 100.001),
    `★★ so no row reads over 100% (worst row ${Math.max(...w.zones.map(z => z.pct)).toFixed(0)}%)`)
  ok(near(w.worst, 240, 1) && near(w.worstZones.find(z => z.name === 'world')!.ms, 240, 1),
    `★★★ and the stall frame's 240ms of 'world' is billed to the 240ms frame, not to the 16ms one ` +
    `(worst ${w.worst.toFixed(1)}ms, world ${w.worstZones.find(z => z.name === 'world')?.ms.toFixed(1)}ms)`)
  ok(!w.worstZones.some(z => z.unaccounted && z.ms < -0.001),
    'the worst frame\'s remainder is not negative either')

  // ★★ AND THE FIRST FRAME IS NOT COUNTED, IN EITHER MODE. Its delta reaches back before the
  // profiler was watching, so nothing can be said about its parts — counting it is exactly the
  // splice above. The fall-back branch used to count it; partition mode already refused to.
  const c2 = clock()
  const one = createProfiler(c2.now); one.enabled = true
  one.mark('world'); c2.c.t += 8; one.frameEnd(0.016)
  c2.c.t += WINDOW_MS + 1
  ok(one.publish() === null,
    '★★ a single un-partitioned frame publishes NOTHING rather than a reading built on a foreign delta')
}

// ── 14. ★★★ `partitioned` DESCRIBES THE WINDOW, NOT THE INSTRUMENT AT PUBLISH TIME ─────────────
// The field exists so a reader can tell "the stall was outside every mark" from "this host never
// stamped a frame start". It was read off `partitionOn` when the window closed — a different
// question. A window whose only counted frame had NO stamp still reported `true`, because by then
// the host was stamping again, so `snapshotText`'s note stayed silent on precisely the reading that
// needed it. ⚠ A missing measurement that reports itself as taken is this file's whole subject.
{
  const { c, now } = clock()
  const p = createProfiler(now); p.enabled = true

  // frame 1: NO frameStart (the toggle frame, before the host order was fixed)
  c.t += 2; p.mark('world'); c.t += 20; p.frameEnd(0.016)
  // frame 2 onward: stamped normally — the profiler is partitioning happily by publish time
  p.frameStart(); c.t += 2; p.mark('world'); c.t += 6; p.frameEnd(0.022)
  const at = c.t
  c.t = at + WINDOW_MS + 1
  const w = p.publish()!

  ok(w.partitioned === false,
    '★★★ one undivided frame makes the WINDOW undivided — fail-closed, not "whatever the instrument is doing now"')
  const ctx = { space: 'plot' as const, x: 0, y: 0, z: 0, viewRadius: 12,
    cols: 1, meshes: 1, draws: 1, tris: 1, geometries: 1, programs: 1, gpuStatus: 'ok' }
  ok(/remainder is UNDIVIDED/.test(snapshotText(w, ctx)),
    '★★ and the note prints, so the reader is told the split was never taken')
  ok(!w.zones.some(z => z.name === PROLOGUE_ROW || z.name === TAIL_ROW),
    '★★ with no prologue/tail rows derived from a stamp nobody took')
  // ★★★ AND THE WORST FRAME'S OWN TABLE ANSWERS FOR ITSELF. The worst frame here is the undivided
  // one, inside a profiler that is partitioning by the time the window closes. Keying its rows on
  // the instrument hands it a prologue and a tail reading `0.00` — a measurement that was never
  // taken, printed as one that came back empty, which is the more convincing of the two lies.
  ok(!w.worstZones.some(z => z.name === PROLOGUE_ROW || z.name === TAIL_ROW),
    `★★★ an undivided worst frame gets no 0.00 prologue/tail rows (${w.worstZones.map(z => z.name.split(' (')[0]).join(', ')})`)

  // ★ AND IT IS NOT SIMPLY ALWAYS-FALSE — a fully stamped window still says true.
  const c2 = clock()
  const q = createProfiler(c2.now); q.enabled = true
  for (let i = 0; i < 4; i++) { q.frameStart(); c2.c.t += 2; q.mark('world'); c2.c.t += 6; q.frameEnd(0.016) }
  c2.c.t += WINDOW_MS + 1
  ok(q.publish()!.partitioned === true, '★ a window where every counted frame stamped reports partitioned')
}

// ── 15. ★★ PUBLISHING MID-CALLBACK MUST NOT EAT THE FRAME BEING MEASURED ───────────────────────
// The host calls `publish()` from the MIDDLE of its frame callback (`VoxelWorld.tsx`, between the
// `hud` and `save` marks) because the snapshot quotes scene facts that only exist inside the frame.
// `publish` cleared `frameAcc` with the window totals — but `frameAcc` is PER-FRAME state, so one
// frame per window reached the next window carrying its prologue and tail and none of its zones.
// ⚠ That inflates UNACCOUNTED by a whole frame's marked work and dilutes every zone mean, in the
// direction that reads as "nobody wrapped this" — an honest-looking gap that was measurement loss.
{
  const { c, now } = clock()
  const p = createProfiler(now); p.enabled = true
  // ★ The host calls `publish()` EVERY frame and lets it rate-limit itself, so the window lands from
  // inside whichever callback happens to be running when the interval elapses. Driven that way here
  // rather than by jumping the clock — idle time the delta never saw is not a frame, and a test that
  // invents one measures its own fixture.
  const wins: NonNullable<ReturnType<typeof p.publish>>[] = []
  for (let i = 0; i < 40; i++) {
    p.frameStart(); c.t += 2
    // ⚠ TWO zones before the publish, not one, and that is what makes this fixture able to see the
    // bug at all: a zone reaches `frameAcc` only when the NEXT mark closes it, so with a single
    // open zone the map is still EMPTY at publish time and clearing it is invisible. The host has
    // ten closed zones sitting there when it publishes, with `hud` still open.
    p.mark('world'); c.t += 4
    p.mark('hud'); c.t += 2
    const win = p.publish()           // ← mid-callback, exactly where the host calls it
    if (win) wins.push(win)
    p.mark('save'); c.t += 1
    p.frameEnd(0.016)
    c.t += 7                          // tail — 2 + 4 + 2 + 1 + 7 = the 16ms the delta reports
  }
  ok(wins.length >= 2, `★ BLIND CHECK: ${wins.length} windows landed mid-callback — under 2 and this proves nothing`)
  const w = wins[wins.length - 1]

  ok(w.zones.find(z => z.name === 'world')!.ms === 4,
    `★★★ every counted frame contributed its zones — the frame that published is not a hole (world ${w.zones.find(z => z.name === 'world')!.ms}ms, expected 4)`)
  ok(w.zones.find(z => z.name === 'hud')!.ms === 2,
    '★★ including the zone that was still OPEN when publish was called')
  ok(w.zones.find(z => z.name === 'save')!.ms === 1,
    '★★ including the marks that came AFTER the publish call')
  ok(near(w.unaccounted, 0, 0.001),
    `★★★ and the frame still divides exactly, so the remainder stays a wiring check (${w.unaccounted.toFixed(3)}ms)`)
}

// ── 16. ★★ THE HOST GATES BEFORE IT STAMPS — the order that manufactured the whole bug ─────────
// Every profiler entry point returns on `enabled` first. With `prof.current.enabled = ...` placed
// BELOW `frameStart()`, the frame that switches the panel on ran its marks and its `frameEnd` and
// **not** its callback stamp — one un-partitioned frame at the head of every session, and the most
// expensive frame in the run. `profile.ts` now attributes such a frame correctly anyway; this asserts
// the host stops minting them. ⚠ A textual reader of a file it does not own fails silently, so it
// proves it found each anchor EXACTLY ONCE before judging their order (canon gate, 08-22).
{
  const raw = readFileSync(join(__dirname, 'VoxelWorld.tsx'), 'utf8')
  const code = raw.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  const enabledAt = [...code.matchAll(/prof\.current\.enabled = /g)].map(m => m.index!)
  const startAt = [...code.matchAll(/prof\.current\.frameStart\(\)/g)].map(m => m.index!)
  ok(enabledAt.length === 1 && startAt.length === 1,
    `★★★ BLIND CHECK: one \`enabled =\` (${enabledAt.length}) and one \`frameStart()\` (${startAt.length}) — ` +
    'any other count means this reader has lost its subject and its verdict is worthless')
  ok(enabledAt.length === 1 && startAt.length === 1 && enabledAt[0] < startAt[0],
    '★★★ the host sets `enabled` BEFORE `frameStart()`, so the frame that turns the panel on is stamped like any other')
}

// ── 17. ★★ A FRAME WITH NO QUERY MUST NOT BORROW ANOTHER FRAME'S GPU TIME ──────────────────────
// The zone-attribution bug of 2026-08-29, one field over. `gpuEnd` returns early when there is
// nothing open — and it used to leave `closedSeq` holding the PREVIOUS frame's query id, so
// `frameEnd`'s `worstSeq = closedSeq` tagged the stall with a query spanning a different interval.
// Reachable whenever `gpuBegin` could not open one (`createQuery` returning null, a context loss
// between the two halves), which is likeliest on exactly the flaky-timer machines this field exists
// to answer about. ⚠ The wrong answer is a plausible millisecond figure on the one row a reader
// uses to decide "blocked in the driver" vs "waiting on a busy GPU" — opposite fixes.
{
  // ⚠ A query lands one frame LATE, exactly as a driver's does — the same fake shape block 10 uses.
  // A fake that answers instantly drains the query before `frameEnd` can name it, so the worst
  // frame reads `pending` in every case and the positive control below is what caught that.
  let failNext = false
  const mkGl = () => {
    let made = 0
    const landed: unknown[] = []
    return {
      QUERY_RESULT_AVAILABLE: 'avail', QUERY_RESULT: 'res',
      getExtension: (n: string) =>
        n === 'EXT_disjoint_timer_query_webgl2' ? { TIME_ELAPSED_EXT: 'te', GPU_DISJOINT_EXT: 'dj' } : null,
      // ★ each query carries a DISTINCT timing, so a mis-tag is a visible wrong number rather than
      // a coincidence that reads as correct.
      createQuery: () => (failNext ? ((failNext = false), null) : { id: ++made }),
      beginQuery: () => {}, endQuery: () => { landed.push(true) },
      getQueryParameter: (q: { id: number }, what: string) =>
        what === 'avail' ? landed.length > q.id : q.id * 7e6,
      getParameter: () => false,
      deleteQuery: () => {},
    } as unknown as WebGL2RenderingContext
  }

  const { c, now } = clock()
  const p = createProfiler(now); p.enabled = true
  p.attach(mkGl())
  const frame = (dt: number, fail = false) => {
    failNext = fail
    p.gpuFrame(); p.frameStart(); c.t += 2
    p.mark('world'); c.t += 6
    p.frameEnd(dt)
    c.t += 8
  }
  frame(0.016)
  frame(0.016)
  frame(0.016, true)     // ⚠ no query opened for the interval that follows
  frame(0.300)           // ← the stall. Its query never existed.
  frame(0.016)           // drains whatever landed
  frame(0.016)
  c.t += WINDOW_MS + 1
  const w = p.publish()!

  ok(near(w.worst, 300, 1), `★ the stall is the worst frame (${w.worst.toFixed(0)}ms)`)
  ok(w.worstGpuMs === null,
    `★★★ a frame whose query was never opened reports NO gpu time, rather than the previous frame's (${w.worstGpuMs}ms)`)
  ok(w.worstGpuStatus === 'pending',
    `★★ and withholds it as pending — a missing measurement reported as missing (${w.worstGpuStatus})`)
  const ctx = { space: 'plot' as const, x: 0, y: 0, z: 0, viewRadius: 12,
    cols: 1, meshes: 1, draws: 1, tris: 1, geometries: 1, programs: 1, gpuStatus: 'ok' }
  ok(!/gpu on THIS frame  \d/.test(snapshotText(w, ctx)),
    '★★ so the printed table names no gpu figure for that frame at all')

  // ★ AND IT IS NOT SIMPLY ALWAYS-NULL — an uninterrupted run still tags its stall.
  const c2 = clock()
  const q = createProfiler(c2.now); q.enabled = true
  q.attach(mkGl())
  const frame2 = (dt: number) => {
    q.gpuFrame(); q.frameStart(); c2.c.t += 2
    q.mark('world'); c2.c.t += 6
    q.frameEnd(dt)
    c2.c.t += 8
  }
  frame2(0.016); frame2(0.016); frame2(0.300); frame2(0.016); frame2(0.016)
  c2.c.t += WINDOW_MS + 1
  const w2 = q.publish()!
  ok(w2.worstGpuMs !== null && w2.worstGpuStatus === 'ok',
    `★★ a stall whose query DID open still gets its own gpu timing (${w2.worstGpuMs}ms, ${w2.worstGpuStatus})`)
}

// ── ★★★ THE HEAP DELTA — THE LINE THAT SPLITS GC FROM BUFFER UPLOAD (2026-08-29) ───────────────
// `worstGpuMs` separates a busy GPU from a blocked main thread. It cannot say WHY the main thread
// was blocked, and the two candidates want opposite fixes. This asserts the field is honest about
// being unmeasurable, because that is the failure mode that would matter here: node has no
// `performance.memory`, so if `null` and `0.0` shared a rendering, every reading taken off a
// non-Chrome host would say "flat — NOT a collection" about a measurement nobody took.
{
  const c = clock()
  const p = createProfiler(c.now); p.enabled = true
  const frame = (dt: number) => { p.frameStart(); c.c.t += 2; p.mark('world'); c.c.t += 6; p.frameEnd(dt); c.c.t += 8 }
  frame(0.016); frame(0.016); frame(0.300); frame(0.016)
  c.c.t += WINDOW_MS + 1
  const w = p.publish()!

  ok(w.worstHeapMb === null,
    `★★ where the host exposes no heap API the delta is NULL, never 0 (${w.worstHeapMb})`)
  const ctx = { space: 'plot' as const, x: 0, y: 0, z: 0, viewRadius: 12,
    cols: 1, meshes: 1, draws: 1, tris: 1, geometries: 1, programs: 1, gpuStatus: 'ok' }
  const txt = snapshotText(w, ctx)
  ok(/js heap on THIS frame  unavailable/.test(txt),
    '★★★ and the table SAYS it is unavailable rather than printing a flat 0.0 MB')
  ok(!/NOT a collection/.test(txt),
    '★★★ so an unmeasured heap can never render as the sentence that EXONERATES GC — the whole point')
}

if (fails.length) {
  console.log(`\n${fails.map(f => `  ✗ ${f}`).join('\n')}\n`)
  console.log(`❌ ${fails.length} failed, ${pass} passed`)
  process.exit(1)
}
console.log(`✅ the profiler reports what it did not measure — ${pass} passed`)
