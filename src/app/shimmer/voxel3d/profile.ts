// Where a frame actually goes — the instrument for "it feels slow in here".
//
// ★ PURE-ish. No react, no three. Takes a WebGL2 context only to ask it for GPU timings, and works
// without one. Wired by `VoxelWorld.tsx`; everything it needs is passed in.
//
// ── ★★★ WHY THE FRAME METER WAS NOT ENOUGH, AND WHY THIS IS NOT A SECOND COPY OF IT ─────────────
// `PerfSample` (fps / ms / worst) is a good instrument and stays exactly as it is. It answers *is
// this slow* and it cannot answer *what is slow* — one total has no parts. Alex reports a STEADY low
// rate in the home plot on a desktop GPU, which is the case where the total tells you least: a
// steady 30fps is equally consistent with the JS frame doing too much and with the GPU doing too
// much, and `dt` cannot separate those two because it measures neither.
//
// ── ★★★ THE RULE THIS FILE IS BUILT AROUND: IT MUST REPORT WHAT IT DID NOT MEASURE ──────────────
// A profiler that knows six zones will always blame the biggest of the six. If the zones sum to 4ms
// of a 30ms frame, the honest reading is *"we are not watching 26ms of this frame"* and the
// dishonest one is a tidy bar chart of the 4. **Naming the biggest of what you happened to
// instrument is the exemption shape** — a silent promise that someone is watching the rest — and
// this codebase has paid for that promise four times in a week (a canon-drift `_scale` strip, a
// rinning skip, a hand-kept mirror, a guard with one door).
//
// So `unaccounted` is a first-class field, it is computed against WALL-CLOCK frame time rather than
// against the sum of the zones, and `snapshotText` prints it whether or not it is large. It is not
// an error — the render submit, the browser's own compositing and any GPU wait all live there
// legitimately — but it is never allowed to be invisible.
//
// ── ★★ ZONES ARE MARKS, NOT begin/end PAIRS, AND THAT IS A CORRECTNESS DECISION ─────────────────
// `mark(z)` means *from here until the next mark, the time belongs to z*. One call per boundary.
// Three things fall out of that shape and all three are the reason for it:
//   · a mismatched pair cannot exist, because there is no pair to mismatch;
//   · nesting cannot exist, so no zone can silently double-count its children;
//   · the zones are a PARTITION of the marked span by construction, so `measured` is a real sum and
//     `unaccounted` is a real remainder rather than two numbers that happen to be near each other.
// A `wrap(zone, fn)` API reads nicer and was rejected: it allocates a closure per zone per frame,
// which is GC pressure inside the thing being measured.
//
// ⚠ COSTS NOTHING WHEN OFF. Every entry point returns on a boolean first. The frame meter's own
// header already makes this point — *"an instrument that changes what it measures"* — and a
// profiler is that hazard with teeth, since it is called several times per frame rather than once.

/** One published window. Every duration is in MILLISECONDS, per frame, averaged over the window. */
export interface FrameProfile {
  fps: number
  /** Mean wall-clock frame time. The total everything else is measured against. */
  ms: number
  /** Longest single frame in the window. */
  worst: number
  /**
   * Mean GPU time per frame, or **null when the driver will not tell us**.
   *
   * ⚠⚠ NULL IS NOT ZERO AND THE DISTINCTION IS THE WHOLE POINT OF THE FIELD. A missing timer
   * extension reported as `0` reads as *"the GPU is idle, so this is CPU-bound"* — a confident wrong
   * answer, and wrong in the direction that gets acted on. Every consumer must render null as
   * "unavailable" and must never sum it into anything.
   */
  gpuMs: number | null
  /**
   * How many frames in this window actually yielded a GPU timing.
   *
   * ★★★ THIS IS PUBLISHED BECAUSE `gpuMs` AND `ms` HAVE DIFFERENT DENOMINATORS, AND WITHOUT IT THE
   * BIAS IS UNOBSERVABLE FROM ANY READING (world lane, 2026-08-23). `ms` averages over `frames`;
   * `gpuMs` averages over the samples that survived — a query dropped as disjoint or landing late
   * never reaches it. Printing their ratio as a clean fraction of the frame is therefore a division
   * of two means taken over different populations, and it measured **110%** on a real machine
   * (470.0 ms gpu against a 428.4 ms frame).
   *
   * ⚠ THE DANGEROUS OUTPUT IS THE PLAUSIBLE PERCENTAGE, NOT THE ABSURD ONE. 110% gets questioned;
   * `62%` does not, and both are biased the same way — worst on exactly the machines where the
   * timer extension is flaky, which are the ones you most want a straight answer about. `frames`
   * was already a field for precisely this reason; the file was applying its own honesty rule to
   * one denominator and not the other.
   */
  gpuSamples: number
  /**
   * Mean ms per zone, largest first — **and the unaccounted remainder is one of the rows.**
   *
   * ★★★ IT SORTS AGAINST THE REAL ZONES ON PURPOSE (hub, 2026-08-22). Printing the gap as a
   * trailing footnote makes it read as rounding; making it compete for the top row makes it get
   * investigated. If nobody wrapped the expensive thing, the honest output is `UNACCOUNTED` sitting
   * at the top of the list, which is exactly the reading this instrument exists to produce and
   * exactly the one a tidy breakdown of six wrapped zones would hide.
   */
  zones: { name: string; ms: number; pct: number; unaccounted?: boolean }[]
  /** Sum of the zones. */
  measured: number
  /**
   * `ms - measured`. Render submit, compositing, GPU wait, and anything nobody wrapped. Also present
   * as a row in `zones`.
   *
   * ⚠ CAN GO NEGATIVE, AND THAT IS INFORMATION RATHER THAN A BUG TO CLAMP AWAY: it means the marked
   * span outran the frame, i.e. a `mark` is straddling a frame boundary and some zone is being paid
   * twice. Clamping it to zero would hide a broken wiring behind a plausible number.
   */
  unaccounted: number
  /**
   * The zone breakdown **of the single worst frame in the window** — same shape as `zones`,
   * including its own UNACCOUNTED row, and measured against that frame alone.
   *
   * ★★★ `worst` WAS A TOTAL WITH NO PARTS, WHICH IS THE EXACT DEFECT THIS FILE EXISTS TO FIX,
   * REAPPEARING INSIDE ITS OWN FIELD (2026-08-23). The header argues that `PerfSample` can say
   * *is this slow* and never *what is slow* because one total has no parts — and then published
   * `worst` as one total with no parts. Measured on Alex's GPU the same evening: walking cost
   * 39.4% of wall clock to ~240ms stalls at a ~600ms period while the MEAN frame stayed 16.6ms.
   * The window means could not see it (a quarter-second freeze averaged into nineteen clean
   * frames), and `worst` could see that it happened while being unable to say what it was.
   *
   * ⚠ AN UNACCOUNTED ROW LEADING **HERE** IS A REAL FINDING, NOT THE EXPECTED READING. For the
   * window means, a leading remainder is normal — render submit sits outside the marked span by
   * construction. For ONE catastrophic frame it says the stall happened somewhere no mark covers,
   * which rules out every wrapped zone at once. That is the answer, not a gap in the answer.
   */
  worstZones: FrameProfile['zones']
  /**
   * When the worst frame ENDED, on the profiler's own clock (ms).
   *
   * ★★★ ATTRIBUTION ALONE CAN NAME A ZONE AND STILL BE WRONG ABOUT THE MECHANISM (root-ef's catch,
   * 2026-08-23). `worstZones` says what was inside ONE stall. It cannot say whether the stalls in
   * successive windows are the same recurring event or several different events being averaged
   * into one story — and those want different fixes. Diffing this across consecutive windows tests
   * the stall against a fixed period: a ~600ms lattice implicates a clock-driven sweep, scattered
   * gaps implicate whatever the player happened to be doing.
   *
   * ⚠ Zero when no frame has landed yet. It is a profiler-relative stamp, not wall clock, and is
   * only meaningful DIFFED against another window's — never as an absolute.
   */
  worstAt: number
  /**
   * GPU time for **the worst frame alone**, or null when the driver would not say.
   *
   * ★★★ THIS IS THE MEASUREMENT THAT SPLITS THE ONE ROW THAT MATTERS, AND A WINDOW MEAN CANNOT
   * STAND IN FOR IT. A stall of a quarter second lands entirely in `TAIL_ROW`, and two opposite
   * causes land there identically: a main thread blocked inside the driver (a geometry upload at
   * first draw under ANGLE/D3D11) and a main thread idle waiting on a GPU that is genuinely busy.
   * `gpuMs` averages a freeze together with nineteen clean frames, so it answers neither — the same
   * p50-vs-mean argument this whole instrument rests on, one field further in.
   *
   * ⚠ THE QUERY THAT MEASURES IT IS THE ONE OPENED IN THE **PREVIOUS** CALLBACK, because a GPU
   * query spans `callbackStart(N) → callbackStart(N+1)`, which is exactly the interval `dtRaw` for
   * frame N+1 reports. Tagging queries by sequence is the only way to pull one back out of a mean.
   */
  worstGpuMs: number | null
  /**
   * Why `worstGpuMs` is null, as a value rather than as an absence.
   *
   * ⚠⚠ `pending` AND `dropped` ARE DIFFERENT CLAIMS AND MUST NOT SHARE A RENDERING. `pending` means
   * the query had not landed when the window published and the next window may well carry it;
   * `dropped` means the driver flagged the timing disjoint and threw it away — **which is most
   * likely to happen on exactly the catastrophic frame you are trying to measure**. A reader who
   * cannot tell those apart will keep re-capturing a reading that can never arrive.
   */
  worstGpuStatus: 'ok' | 'pending' | 'dropped' | 'unavailable'
  /**
   * Did the host call `frameStart`, so that `PROLOGUE_ROW` and `TAIL_ROW` could be measured?
   *
   * ★ FALSE IS THE FAIL-CLOSED STATE, NOT A DEGRADED ONE. Without a callback-start stamp the
   * partition cannot be computed at all, and the honest output is the old undivided `UNACCOUNTED`
   * row plus a panel that says the split is unavailable — never two plausible rows derived from a
   * timestamp nobody took. A wrapper that widened a union and left its consumers quietly stale cost
   * this codebase a day on 08-23; a consumer that reads this flag cannot be quietly stale.
   */
  partitioned: boolean
  /** Frames in the window — a window of 1 makes every mean above a single sample, so say so. */
  frames: number
}

export interface Profiler {
  enabled: boolean
  /**
   * ★★ FIRST LINE OF THE FRAME CALLBACK, BEFORE ANY WORK. Stamps when the host handed us the frame.
   *
   * Without it the profiler knows when marks happened and never knows when the CALLBACK began, so
   * it cannot tell the work above the first mark apart from the render submit that preceded it —
   * and those are the two halves of the remainder that want completely different investigations.
   * Optional by design: skip it and every reading falls back to one undivided `UNACCOUNTED` row
   * with `partitioned: false` saying so out loud.
   */
  frameStart(): void
  /** Open a zone. Time runs to the next `mark` or to `frameEnd`. Flat by construction. */
  mark(zone: string): void
  /** Close the open zone and account one frame. `dtRaw` — never a clamped dt. */
  frameEnd(dtRaw: number): void
  /** A window if one is due (~4x/second), else null. */
  publish(): FrameProfile | null
  /**
   * ★★ THE ONLY GPU CALL A CALLER SHOULD MAKE. Put it at the TOP of the frame callback, once.
   *
   * ⚠⚠ IT IS ONE CALL BECAUSE TWO WOULD BE MISPLACED, AND MISPLACED IN THE DIRECTION THAT LIES.
   * The obvious wiring is `gpuBegin()` at the top of the frame callback and `gpuEnd()` at the
   * bottom — and r3f renders AFTER every `useFrame` callback has run, so that window contains the
   * game's JS and almost none of its drawing. It would report a GPU that is nearly idle, which is a
   * confident answer to the exact question this field exists to settle ("cpu-bound or gpu-bound?")
   * and the wrong one. `gpuFrame` closes the PREVIOUS frame's query and opens the next in the same
   * breath, so the measured window always spans a real render and there is no second call site to
   * put in the wrong place.
   */
  gpuFrame(): void
  /** @internal — `gpuFrame` is the supported entry point. Exposed so the oracle can drive halves. */
  gpuBegin(): void
  /** @internal */
  gpuEnd(): void
  /** Attach a WebGL2 context. Called once the renderer exists; safe to call repeatedly. */
  attach(gl: WebGL2RenderingContext | null): void
  /** Why `gpuMs` is null, for the panel to print instead of a number. */
  gpuStatus: string
}

/** How often a window is published. Four a second is readable and does not re-render the HUD hot. */
export const WINDOW_MS = 250

/**
 * ⚠ A CEILING ON DISTINCT ZONE NAMES. A `mark` built from a template literal (a chunk key, an entity
 * id) would grow this map without bound and turn the profiler into the leak it was added to find.
 * Past the cap, new names fold into `overflow:` so the total stays honest and the cause is visible.
 */
export const MAX_ZONES = 24

/** Where every zone past the cap goes. One constant bucket — see `mark`. */
export const OVERFLOW = 'overflow (zone-name cap hit)'

/** The remainder's row name. It is a row, not a footnote — see `FrameProfile.zones`. */
export const UNACCOUNTED_ROW = 'UNACCOUNTED (render submit · compositing · gpu wait · unwrapped)'

/**
 * The part of the callback that ran BEFORE the first `mark` — the frame meter, the weapon tick, the
 * cast. `frameEnd`'s own comment already said this lands in UNACCOUNTED "correctly"; it is more
 * useful named, because it is the half of the remainder we could have wrapped and did not.
 */
export const PROLOGUE_ROW = 'prologue (callback, before the first mark)'

/**
 * ★★★ THE ROW THE STALL ACTUALLY LIVES IN, AND THE REASON THIS FILE GREW A `frameStart`.
 *
 * From `frameEnd` to the NEXT callback's start. Read off the host's own source rather than assumed
 * (`@react-three/fiber` `update()`): `delta` is taken at the top of the frame, every `useFrame`
 * subscriber runs, and **`gl.render(scene, camera)` is called after all of them**. So everything
 * three.js does — render submit, geometry and texture upload at first draw, shader compile — plus
 * the browser's compositing and the wait for the next rAF, happens after our last mark and before
 * the next frame's first one.
 *
 * ⚠ IT IS A LOCATION, NOT A CAUSE, and the candidates inside it want opposite fixes (a main thread
 * blocked in the driver vs a main thread idle waiting on the GPU). `worstGpuMs` is what separates
 * those two: real GPU work on the stalling frame means the former, ~a normal frame's worth means
 * the latter.
 */
export const TAIL_ROW = 'after frameEnd (render submit · present · idle)'

export function createProfiler(now: () => number = () => performance.now()): Profiler {
  let enabled = false
  let gl: WebGL2RenderingContext | null = null
  let ext: any = null
  let gpuStatus = 'not attached'

  const acc = new Map<string, number>()
  /**
   * Distinct zone names seen this window — the ceiling `MAX_ZONES` actually enforces.
   *
   * ⚠ IT CANNOT BE `acc.size` ANY MORE. `acc` is now written once per FRAME rather than once per
   * mark, so during the first frame of a window it is empty and every templated name would clear
   * the cap — the guard against unbounded growth going quiet for exactly the frame that could mint
   * a name per chunk. Cleared with the window, same as `acc` was.
   */
  const names = new Set<string>()
  /**
   * The CURRENT frame's zones, cleared every `frameEnd`, and the winner copied into `worstAcc`.
   *
   * ★ TWO MAPS RATHER THAN A PER-FRAME ARRAY OF SAMPLES. Keeping every frame's breakdown and
   * picking the max at publish would be simpler to read and allocates per frame inside the thing
   * being measured — the same objection that killed the `wrap(zone, fn)` API in the header. These
   * two maps are written in place, hold the same handful of keys for the life of the profiler, and
   * the copy happens only when a new worst actually appears.
   */
  const frameAcc = new Map<string, number>()
  const worstAcc = new Map<string, number>()
  /**
   * The PREVIOUS frame's zones, and the reason this file has three maps instead of two.
   *
   * ★★★ `dtRaw` FOR FRAME N+1 DESCRIBES FRAME N. Taken from the host's own source rather than
   * assumed (`@react-three/fiber` `update()`): `delta = clock.getDelta()` runs at the TOP of the
   * frame, then every `useFrame` subscriber, then `gl.render(...)`. So the interval it reports is
   * `callbackStart(N) → callbackStart(N+1)` — frame N's callback plus frame N's render submit, and
   * none of frame N+1's work. Pairing it with the map of the frame that happens to be closing is
   * the two-frames-spliced-into-one-reading defect `frameEnd` documents below, surviving inside its
   * own fix, and it fails toward a FINDING: a stall inside `gl.render()` bills a frame whose
   * callback is innocent, so the panel prints `100% UNACCOUNTED, every zone 0.00` and a reader
   * concludes it has ruled out every wrapped zone at once.
   */
  const prevAcc = new Map<string, number>()
  let open: string | null = null
  let openAt = 0
  let frames = 0, time = 0, worst = 0, worstAt = 0, windowAt = now()
  /** Callback start (`frameStart`), first `mark`, and the last `frameEnd`. -1 = not stamped yet. */
  let callbackAt = -1, firstMarkAt = -1, endAt = -1
  /** Frame N's unwrapped prologue, carried to frame N+1's `frameEnd` where its dt is reported. */
  let prevPrologue = 0
  /** Is there a previous frame to attribute the incoming dt to? False for the first frame only. */
  let prevReady = false
  /** Did the host stamp a callback start, so prologue/tail are real? See `FrameProfile.partitioned`. */
  let partitionOn = false
  let worstPrologue = 0, worstTail = 0
  /** GPU queries still in flight, oldest first, each tagged with the frame it spans. */
  const inflight: { q: WebGLQuery; seq: number }[] = []
  let gpuNs = 0, gpuSamples = 0
  let querying = false
  /** Monotonic query id. `beganSeq` is the open one; `closedSeq` the one `gpuEnd` just closed. */
  let seq = 0, beganSeq = -1, closedSeq = -1
  /** The query spanning the worst frame, and its result once it lands. */
  let worstSeq = -1, worstGpuNs: number | null = null
  let worstGpuState: FrameProfile['worstGpuStatus'] = 'pending'

  /**
   * ★ WRITES THE FRAME MAP ONLY. It used to write the window total here as well, which becomes a
   * DOUBLE COUNT the moment `frameEnd` folds an attributed frame in — the window would carry every
   * zone twice while the frame breakdown stayed correct, i.e. a bias visible in exactly one of the
   * two tables. One accumulation site, in `frameEnd`, for both modes.
   */
  const closeOpen = (t: number) => {
    if (open === null) return
    const d = t - openAt
    frameAcc.set(open, (frameAcc.get(open) ?? 0) + d)
    open = null
  }

  return {
    get enabled() { return enabled },
    set enabled(v: boolean) {
      if (v === enabled) return
      enabled = v
      // ⚠ A STALE WINDOW MUST NOT SURVIVE THE TOGGLE. Re-enabling with `openAt` left over from
      // minutes ago would attribute the whole idle gap to whichever zone happened to be open.
      acc.clear(); frameAcc.clear(); worstAcc.clear(); prevAcc.clear(); names.clear()
      open = null; frames = 0; time = 0; worst = 0; worstAt = 0; windowAt = now()
      gpuNs = 0; gpuSamples = 0
      // ⚠ THE ATTRIBUTION CHAIN RESETS TOO. `prevReady` left true across a toggle would hand the
      // first frame back a previous frame from minutes ago, which is the same stale-window bug this
      // setter already guards for `openAt` — one link further along.
      callbackAt = -1; firstMarkAt = -1; endAt = -1
      prevPrologue = 0; prevReady = false; partitionOn = false
      worstPrologue = 0; worstTail = 0
      worstSeq = -1; worstGpuNs = null; worstGpuState = 'pending'
    },
    get gpuStatus() { return gpuStatus },

    attach(g) {
      if (g === gl) return
      gl = g
      ext = null
      if (!g) { gpuStatus = 'not attached'; return }
      // Chrome exposes this only with a flag on some platforms, and drops it on context loss.
      ext = g.getExtension('EXT_disjoint_timer_query_webgl2')
      gpuStatus = ext ? 'ok' : 'EXT_disjoint_timer_query_webgl2 unavailable'
    },

    frameStart() {
      if (!enabled) return
      callbackAt = now()
      firstMarkAt = -1
      partitionOn = true
    },

    mark(zone) {
      if (!enabled) return
      const t = now()
      if (firstMarkAt < 0) firstMarkAt = t
      closeOpen(t)
      // ⚠ ONE BUCKET, AND ITS NAME IS A CONSTANT. The first cut wrote `overflow:${acc.size}`, which
      // mints a FRESH name on every overflowing mark — so the guard against unbounded growth was
      // itself unbounded, and the cap it was enforcing never bound anything. Caught by the assert
      // that counts rows rather than by the one that checks a row exists.
      const name = names.has(zone) || names.size < MAX_ZONES ? zone : OVERFLOW
      names.add(name)
      open = name
      openAt = t
    },

    frameEnd(dtRaw) {
      if (!enabled) return
      const t = now()
      closeOpen(t)

      // ── ★★★ WHICH FRAME DOES THIS `dtRaw` DESCRIBE? ────────────────────────────────────────
      // Not this one. See `prevAcc` above for the host source. In PARTITION mode the incoming dt is
      // attributed to the previous frame and divides EXACTLY, with no remainder to argue about:
      //
      //     dt(N+1) = callbackStart(N+1) − callbackStart(N)
      //             = [ prologue(N) ]  +  [ marked zones of N ]  +  [ frameEnd(N) → callbackStart(N+1) ]
      //                unwrapped top       what we instrumented      render submit · present · idle
      //
      // ⚠ SO THE FIRST FRAME AFTER `enabled` IS NOT COUNTED AT ALL. Its dt reaches back before we
      // were watching, so nothing can be said about its parts — and counting a frame whose
      // breakdown is unknown is precisely the "tidy breakdown of the 13% we wrapped" this file
      // exists to refuse. One frame of a ~15-frame window, dropped loudly here rather than folded
      // silently into the means.
      if (partitionOn) {
        const prologue = firstMarkAt >= 0 ? firstMarkAt - callbackAt : t - callbackAt
        if (prevReady) {
          const tail = callbackAt - endAt
          frames++
          time += dtRaw
          for (const [k, v] of prevAcc) acc.set(k, (acc.get(k) ?? 0) + v)
          acc.set(PROLOGUE_ROW, (acc.get(PROLOGUE_ROW) ?? 0) + prevPrologue)
          acc.set(TAIL_ROW, (acc.get(TAIL_ROW) ?? 0) + tail)
          // ⚠ THE COPY HAPPENS BEFORE THE ROLL AND ONLY ON A NEW WORST. Snapshotting at publish
          // instead would hand back the LAST frame's parts wearing the worst frame's duration —
          // two frames spliced into one reading, which is the shape that corroborates a wrong
          // answer. That is also the defect the attribution above fixes, one level up.
          if (dtRaw > worst) {
            worst = dtRaw
            worstAt = t
            worstAcc.clear()
            for (const [k, v] of prevAcc) worstAcc.set(k, v)
            worstPrologue = prevPrologue
            worstTail = tail
            // The query spanning this dt is the one `gpuFrame` closed at the top of THIS callback.
            worstSeq = closedSeq
            worstGpuNs = null
            worstGpuState = 'pending'
          }
        }
        // Roll: this frame becomes the one the NEXT dt describes.
        prevAcc.clear()
        for (const [k, v] of frameAcc) prevAcc.set(k, v)
        prevPrologue = prologue
        endAt = t
        prevReady = true
      } else {
        // ★ FALL-BACK, AND IT IS THE OLD BEHAVIOUR VERBATIM. No `frameStart` means no callback-start
        // stamp, so prologue and tail cannot be computed and must not be guessed. `partitioned`
        // goes out false and the panel says the split is unavailable — a missing measurement
        // reported as missing, never as two plausible rows derived from a timestamp nobody took.
        frames++
        time += dtRaw
        for (const [k, v] of frameAcc) acc.set(k, (acc.get(k) ?? 0) + v)
        if (dtRaw > worst) {
          worst = dtRaw
          worstAt = t
          worstAcc.clear()
          for (const [k, v] of frameAcc) worstAcc.set(k, v)
          worstPrologue = 0
          worstTail = 0
          worstSeq = closedSeq
          worstGpuNs = null
          worstGpuState = 'pending'
        }
      }
      frameAcc.clear()
    },

    gpuFrame() {
      // end-then-begin: the window that just closed is the one containing the last render.
      this.gpuEnd()
      this.gpuBegin()
    },

    gpuBegin() {
      if (!enabled || !gl || !ext || querying) return
      const q = gl.createQuery()
      if (!q) return
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
      beganSeq = ++seq
      inflight.push({ q, seq: beganSeq })
      querying = true
    },

    /** @internal — reachable for the oracle; callers use `gpuFrame`. */
    gpuEnd() {
      if (!querying || !gl || !ext) return
      gl.endQuery(ext.TIME_ELAPSED_EXT)
      querying = false
      // Drain whatever has landed. ⚠ A DISJOINT frame is thrown away rather than recorded — the
      // driver is telling us the timing is garbage (a clock change, a context switch), and a garbage
      // nanosecond count averaged in is worse than one fewer sample.
      closedSeq = beganSeq
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT)
      while (inflight.length) {
        const head = inflight[0]
        if (!gl.getQueryParameter(head.q, gl.QUERY_RESULT_AVAILABLE)) break
        inflight.shift()
        if (!disjoint) {
          const ns = gl.getQueryParameter(head.q, gl.QUERY_RESULT)
          gpuNs += ns; gpuSamples++
          // ★ THE ONE SAMPLE THAT IS NOT ALLOWED TO DISSOLVE INTO THE MEAN. See `worstGpuMs`.
          if (head.seq === worstSeq) { worstGpuNs = ns; worstGpuState = 'ok' }
        } else if (head.seq === worstSeq) {
          // ⚠ SAY DROPPED, NEVER PENDING. The driver threw this timing away, and a stall is exactly
          // when it is most likely to — so a reader told "pending" would re-capture forever waiting
          // for a number that can never arrive.
          worstGpuState = 'dropped'
        }
        gl.deleteQuery(head.q)
      }
    },

    publish() {
      if (!enabled || !frames) return null
      const t = now()
      if (t - windowAt < WINDOW_MS) return null
      // ⚠ SECONDS IN, MILLISECONDS OUT — `dtRaw` is r3f's delta and arrives in SECONDS, while every
      // zone is a `performance.now()` delta in MILLISECONDS. Without this ×1000 the total reads
      // ~0.016 against zones of ~4, so `unaccounted` goes hugely NEGATIVE and the panel reports that
      // the zones account for 25,000% of the frame. It would look like a units bug, which it is, but
      // the version that ships is the one where a plausible-looking number is off by a thousand.
      const ms = (time / frames) * 1000
      const zones: FrameProfile['zones'] = [...acc.entries()]
        .map(([name, total]) => ({ name, ms: total / frames, pct: 0 }))
      // ⚠ `measured` is summed BEFORE the remainder row joins the list, or it would count itself.
      const measured = zones.reduce((s, z) => s + z.ms, 0)
      zones.push({ name: UNACCOUNTED_ROW, ms: ms - measured, pct: 0, unaccounted: true })
      zones.sort((a, b) => b.ms - a.ms)
      for (const z of zones) z.pct = ms > 0 ? (z.ms / ms) * 100 : 0
      // ★ The worst frame's own partition, against ITS duration — never against the window mean.
      const worstMs = worst * 1000
      const worstZones: FrameProfile['zones'] = [...worstAcc.entries()]
        .map(([name, z]) => ({ name, ms: z, pct: 0 }))
      // ★ In partition mode the worst frame's two unwrapped halves are rows of its table too, so a
      // stall lands on the row that says WHERE it was rather than on a remainder that says only
      // that nobody wrapped it.
      if (partitionOn) {
        worstZones.push({ name: PROLOGUE_ROW, ms: worstPrologue, pct: 0 })
        worstZones.push({ name: TAIL_ROW, ms: worstTail, pct: 0 })
      }
      const worstMeasured = worstZones.reduce((sum, z) => sum + z.ms, 0)
      worstZones.push({ name: UNACCOUNTED_ROW, ms: worstMs - worstMeasured, pct: 0, unaccounted: true })
      worstZones.sort((a, b) => b.ms - a.ms)
      for (const z of worstZones) z.pct = worstMs > 0 ? (z.ms / worstMs) * 100 : 0
      const out: FrameProfile = {
        fps: Math.round(frames / (time || 1e-9)),
        ms, worst: worst * 1000, gpuMs: gpuSamples ? gpuNs / gpuSamples / 1e6 : null,
        gpuSamples,
        zones, measured, worstZones, worstAt,
        worstGpuMs: worstGpuNs === null ? null : worstGpuNs / 1e6,
        // ⚠ THE EXTENSION'S ABSENCE OUTRANKS EVERY OTHER STATE. Without a timer nothing was ever
        // pending and nothing was dropped; saying otherwise sends a reader hunting a driver quirk
        // that is really a missing extension.
        worstGpuStatus: !ext ? 'unavailable' : worstGpuState,
        partitioned: partitionOn,
        // ⚠ AGAINST WALL CLOCK, NEVER AGAINST THE ZONE SUM. Deriving the total from the parts is how
        // a profiler comes to believe it saw the whole frame.
        unaccounted: ms - measured,
        frames,
      }
      acc.clear(); frameAcc.clear(); worstAcc.clear(); names.clear()
      frames = 0; time = 0; worst = 0; worstAt = 0; windowAt = t
      gpuNs = 0; gpuSamples = 0
      // ⚠ `prevAcc` / `prevReady` / `endAt` SURVIVE THE WINDOW ON PURPOSE. They are the attribution
      // chain, not window totals — clearing them would make the first frame of every window
      // unattributable and quietly drop four frames a second.
      worstPrologue = 0; worstTail = 0
      worstSeq = -1; worstGpuNs = null; worstGpuState = 'pending'
      return out
    },
  }
}

/**
 * How much of the window the GPU timer actually covered before its mean may be compared to `ms`.
 *
 * ★ ONE PREDICATE, ASKED BY EVERY CONSUMER — never restated. `snapshotText` and the in-game panel
 * both print this ratio, and a rule copied into two renderers is a hand-kept mirror: the copies
 * agree with each other while both drift from the thing they describe. Ask this; do not re-derive
 * the threshold at the call site.
 */
export const GPU_COVERAGE_MIN = 0.9

/**
 * Is `gpuMs` comparable to `ms` — i.e. did nearly every frame in the window yield a timing?
 *
 * ⚠ FALSE DOES NOT MEAN THE GPU NUMBER IS WRONG. The raw millisecond figure is still the honest
 * mean of the samples that landed; it is the SHARE OF THE FRAME that becomes meaningless, because
 * the two means no longer describe the same set of frames. So consumers withhold the percentage
 * and keep the ms, rather than hiding both.
 */
export function gpuTrusted(p: FrameProfile): boolean {
  return p.gpuMs !== null && p.gpuSamples >= p.frames * GPU_COVERAGE_MIN
}

/**
 * The reading, as text a keeper can copy out and paste to whoever is fixing it.
 *
 * ★ IT CARRIES ITS OWN CONTEXT, and that is not padding. A frame time with no place attached is the
 * mistake that cost 2026-08-22: `/goto garden` lands at the fold's DOOR rather than inside it, and
 * an afternoon of measurements labelled plot-vs-wilds compared two Wilds locations. Every one of
 * them was internally consistent. **A reading has to say where it was taken or it is not evidence**,
 * so `space` is required rather than optional, and it comes from the host's own `space` ref rather
 * than from `biomeAt` — which answers with a CONTINENT biome for fold coordinates and is exactly
 * what made the wrong readings look right.
 */
/**
 * A row name short enough for the in-game panel, for the two rows whose full names are sentences.
 *
 * ★ ONE DEFINITION, ASKED BY THE PANEL — never a second table of labels beside the constants. A
 * panel keeping its own copy is a hand-kept mirror: it agrees with itself while drifting from the
 * rows it describes, and renames the day a constant changes without anything going red. Unknown
 * names pass through, so a new zone is never silently unlabelled.
 */
export function shortRowLabel(name: string): string {
  if (name === UNACCOUNTED_ROW) return 'UNACCOUNTED'
  if (name === PROLOGUE_ROW) return 'prologue (pre-mark)'
  if (name === TAIL_ROW) return 'after frameEnd (submit·present)'
  return name
}

export function snapshotText(p: FrameProfile, ctx: {
  space: 'wilds' | 'plot'
  x: number; y: number; z: number
  viewRadius: number
  cols: number; meshes: number; draws: number; tris: number; geometries: number; programs: number
  gpuStatus: string
  renderer?: string
}): string {
  const n = (v: number, d = 1) => v.toFixed(d)
  const L: string[] = []
  L.push(`shimmer frame profile — ${ctx.space === 'plot' ? 'HOME PLOT (fold)' : 'wilds'}`)
  L.push(`at ${Math.round(ctx.x)},${Math.round(ctx.y)},${Math.round(ctx.z)}  ·  view radius ${ctx.viewRadius}`)
  if (ctx.renderer) L.push(`gpu ${ctx.renderer}`)
  L.push(`${p.fps} fps  ·  ${n(p.ms)} ms mean  ·  ${n(p.worst)} ms worst  ·  ${p.frames} frames in window`)
  L.push(p.gpuMs === null
    // ⚠ Says WHY, so a reader cannot mistake a missing timer for an idle GPU.
    ? `gpu time  UNAVAILABLE (${ctx.gpuStatus}) — cannot say whether this is cpu- or gpu-bound`
    // ★★ THE MS SURVIVES, THE PERCENTAGE DOES NOT — and it says how thin the coverage was rather
    // than going quiet, so a reader can tell a flaky timer from a missing one.
    : !gpuTrusted(p)
      ? `gpu time  ${n(p.gpuMs)} ms  ·  share of frame WITHHELD (only ${p.gpuSamples} of ${p.frames} frames timed)`
      : `gpu time  ${n(p.gpuMs)} ms of the ${n(p.ms)} ms frame  ·  ${n((p.gpuMs / p.ms) * 100, 0)}%`)
  L.push(`scene     ${ctx.cols} col · ${ctx.meshes} mesh · ${ctx.draws} draws · ${Math.round(ctx.tris / 1000)}k tris · geo ${ctx.geometries} · prog ${ctx.programs}`)
  L.push('')
  // ★ The remainder is already IN `zones` and sorted among them, so it can lead the table when it
  // deserves to. No special-casing here, which is the point — it is not a footnote to be forgotten.
  for (const z of p.zones) L.push(`  ${n(z.ms, 2).padStart(7)} ms  ${n(z.pct, 0).padStart(3)}%  ${z.name}`)
  L.push(`  ${'-'.repeat(7)}`)
  L.push(`  ${n(p.measured, 2).padStart(7)} ms  ${n(ms100(p.measured, p.ms), 0).padStart(3)}%  = wrapped zones only`)
  // ★★ THE WORST FRAME GETS ITS OWN TABLE. A mean cannot describe a stall: a 240ms freeze averaged
  // into nineteen clean frames reads as a mildly slow game, which is the reading that sent two
  // sessions after the wrong thing. Only printed when the worst frame is meaningfully off the mean,
  // because on a healthy run it is noise and a table nobody needs trains people to skip the section.
  if (p.worst > p.ms * 2 && p.worstZones.length) {
    L.push('')
    L.push(`worst frame — ${n(p.worst)} ms, against a ${n(p.ms)} ms mean  ·  at t=${n(p.worstAt, 0)} ms:`)
    // ★★★ THE LINE THAT SPLITS `after frameEnd` IN TWO. A quarter-second stall reads identically
    // whether the main thread was blocked inside the driver or idle waiting on a busy GPU, and
    // those want opposite fixes. This is that frame's OWN timing, never the window mean.
    L.push(p.worstGpuMs !== null
      ? `  gpu on THIS frame  ${n(p.worstGpuMs)} ms of ${n(p.worst)} ms  ·  ${n((p.worstGpuMs / p.worst) * 100, 0)}%`
      : p.worstGpuStatus === 'dropped'
        // ⚠ Distinct from `pending` on purpose: this number is never coming, so stop re-capturing.
        ? `  gpu on THIS frame  DROPPED — the driver flagged the timing disjoint, which a stall makes likely`
        : p.worstGpuStatus === 'pending'
          ? `  gpu on THIS frame  pending — the query had not landed when the window closed; the next one may carry it`
          : `  gpu on THIS frame  UNAVAILABLE (${ctx.gpuStatus})`)
    for (const z of p.worstZones) L.push(`  ${n(z.ms, 2).padStart(7)} ms  ${n(z.pct, 0).padStart(3)}%  ${z.name}`)
  }
  // ⚠ SAY WHEN THE SPLIT IS NOT AVAILABLE. Without it a reader sees one undivided UNACCOUNTED row
  // and cannot tell "the stall was outside every mark" from "this host never stamped a frame start".
  if (!p.partitioned) {
    L.push('')
    L.push('note: frameStart() was never called, so the remainder is UNDIVIDED — the render submit')
    L.push('      and the callback prologue cannot be told apart in this reading.')
  }
  return L.join('\n')
}

const ms100 = (part: number, whole: number): number => whole > 0 ? (part / whole) * 100 : 0
