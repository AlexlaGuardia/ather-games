// The profiler's oracle. Run: npx tsx src/app/shimmer/voxel3d/profile.test.ts
//
// ★ THE PROPERTY: **this instrument may never make a frame look accounted-for when it is not.**
// Every assert below is a way of asking that, because the failure mode of a profiler is not that it
// crashes — it is that it hands back a tidy breakdown of the 13% of the frame somebody remembered to
// wrap and says nothing about the other 87%.
import { createProfiler, snapshotText, WINDOW_MS, MAX_ZONES, OVERFLOW, UNACCOUNTED_ROW } from './profile'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

/** A clock we drive by hand, so a test never measures the test runner. */
const clock = () => { const c = { t: 0 }; return { c, now: () => c.t } }

// ── 1. ★★ MARKS PARTITION THE FRAME — the claim the whole file rests on ────────────────────────
{
  const { c, now } = clock()
  const p = createProfiler(now)
  p.enabled = true
  c.t = 100; p.mark('mesh')
  c.t = 104; p.mark('flora')
  c.t = 110; p.mark('light')
  c.t = 112; p.frameEnd(0.016)
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
  c3.c.t = WINDOW_MS + 1
  ok(one.publish()!.gpuMs === null,
    '★★ a single gpuFrame reports null — the window has been opened and not yet closed by a render')

  const c2 = clock()
  const bad = createProfiler(c2.now); bad.enabled = true
  bad.attach(mkGl(true, 999_000_000))            // driver says the timing is garbage
  bad.gpuFrame(); bad.gpuFrame(); bad.frameEnd(0.016)
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
  c.t = WINDOW_MS - 1
  ok(p.publish() === null, 'nothing is published before the window elapses')
  c.t = WINDOW_MS + 1
  ok(p.publish() !== null, 'and a window lands once it has')
  ok(p.publish() === null, 'and the window resets, so two reads of the same window cannot disagree')
}

if (fails.length) {
  console.log(`\n${fails.map(f => `  ✗ ${f}`).join('\n')}\n`)
  console.log(`❌ ${fails.length} failed, ${pass} passed`)
  process.exit(1)
}
console.log(`✅ the profiler reports what it did not measure — ${pass} passed`)
