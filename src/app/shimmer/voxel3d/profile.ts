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
  /** Frames in the window — a window of 1 makes every mean above a single sample, so say so. */
  frames: number
}

export interface Profiler {
  enabled: boolean
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

export function createProfiler(now: () => number = () => performance.now()): Profiler {
  let enabled = false
  let gl: WebGL2RenderingContext | null = null
  let ext: any = null
  let gpuStatus = 'not attached'

  const acc = new Map<string, number>()
  let open: string | null = null
  let openAt = 0
  let frames = 0, time = 0, worst = 0, windowAt = now()
  /** GPU query objects still in flight, oldest first. Results are a frame or two behind. */
  const inflight: WebGLQuery[] = []
  let gpuNs = 0, gpuSamples = 0
  let querying = false

  const closeOpen = (t: number) => {
    if (open === null) return
    acc.set(open, (acc.get(open) ?? 0) + (t - openAt))
    open = null
  }

  return {
    get enabled() { return enabled },
    set enabled(v: boolean) {
      if (v === enabled) return
      enabled = v
      // ⚠ A STALE WINDOW MUST NOT SURVIVE THE TOGGLE. Re-enabling with `openAt` left over from
      // minutes ago would attribute the whole idle gap to whichever zone happened to be open.
      acc.clear(); open = null; frames = 0; time = 0; worst = 0; windowAt = now()
      gpuNs = 0; gpuSamples = 0
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

    mark(zone) {
      if (!enabled) return
      const t = now()
      closeOpen(t)
      // ⚠ ONE BUCKET, AND ITS NAME IS A CONSTANT. The first cut wrote `overflow:${acc.size}`, which
      // mints a FRESH name on every overflowing mark — so the guard against unbounded growth was
      // itself unbounded, and the cap it was enforcing never bound anything. Caught by the assert
      // that counts rows rather than by the one that checks a row exists.
      const name = acc.has(zone) || acc.size < MAX_ZONES ? zone : OVERFLOW
      open = name
      openAt = t
    },

    frameEnd(dtRaw) {
      if (!enabled) return
      closeOpen(now())
      frames++
      time += dtRaw
      if (dtRaw > worst) worst = dtRaw
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
      inflight.push(q)
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
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT)
      while (inflight.length) {
        const head = inflight[0]
        if (!gl.getQueryParameter(head, gl.QUERY_RESULT_AVAILABLE)) break
        inflight.shift()
        if (!disjoint) { gpuNs += gl.getQueryParameter(head, gl.QUERY_RESULT); gpuSamples++ }
        gl.deleteQuery(head)
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
      const out: FrameProfile = {
        fps: Math.round(frames / (time || 1e-9)),
        ms, worst: worst * 1000, gpuMs: gpuSamples ? gpuNs / gpuSamples / 1e6 : null,
        zones, measured,
        // ⚠ AGAINST WALL CLOCK, NEVER AGAINST THE ZONE SUM. Deriving the total from the parts is how
        // a profiler comes to believe it saw the whole frame.
        unaccounted: ms - measured,
        frames,
      }
      acc.clear(); frames = 0; time = 0; worst = 0; windowAt = t
      gpuNs = 0; gpuSamples = 0
      return out
    },
  }
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
    : `gpu time  ${n(p.gpuMs)} ms of the ${n(p.ms)} ms frame  ·  ${n((p.gpuMs / p.ms) * 100, 0)}%`)
  L.push(`scene     ${ctx.cols} col · ${ctx.meshes} mesh · ${ctx.draws} draws · ${Math.round(ctx.tris / 1000)}k tris · geo ${ctx.geometries} · prog ${ctx.programs}`)
  L.push('')
  // ★ The remainder is already IN `zones` and sorted among them, so it can lead the table when it
  // deserves to. No special-casing here, which is the point — it is not a footnote to be forgotten.
  for (const z of p.zones) L.push(`  ${n(z.ms, 2).padStart(7)} ms  ${n(z.pct, 0).padStart(3)}%  ${z.name}`)
  L.push(`  ${'-'.repeat(7)}`)
  L.push(`  ${n(p.measured, 2).padStart(7)} ms  ${n(ms100(p.measured, p.ms), 0).padStart(3)}%  = wrapped zones only`)
  return L.join('\n')
}

const ms100 = (part: number, whole: number): number => whole > 0 ? (part / whole) * 100 : 0
