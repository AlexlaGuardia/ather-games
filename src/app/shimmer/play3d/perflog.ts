'use client'
// Lag log — a ring buffer of "what took too long, and when".
//
// Built 2026-07-23 because a freeze appeared on station-menu interaction and reading a 4,000-line
// component to guess the cause is exactly the trap we keep falling into. Instead: measure. Two
// sources feed one buffer —
//
//   1. LONG TASKS (the star): PerformanceObserver('longtask') fires whenever the main thread is
//      blocked ≥50ms — which is the literal definition of a hitch. This catches freezes we never
//      thought to instrument, including ones in library or browser code, with zero marks in our own
//      source. If the answer is "a 300ms task fired the instant you opened the crafting table", this
//      is what says so.
//   2. MARKS: mark('label', fn) times a specific synchronous operation and logs it if it crosses a
//      threshold. Wrapped around the suspects (station open, craft, deposit, save) so a long task
//      can be ATTRIBUTED — "longtask 180ms" next to "craft 172ms" names the culprit.
//
// The buffer is a module singleton, not React state, so recording a hitch never causes a render
// (which would perturb the very thing we measure). The panel polls it.

export type PerfEntry = { t: number; label: string; ms: number; kind: 'longtask' | 'mark' }

const BUF: PerfEntry[] = []
const CAP = 40                 // keep the last N; a freeze is recent, we don't need history
let seq = 0                    // monotonic id so the panel can tell "new since last poll"

// A mark below this is background noise; the panel only cares about frame-threatening work.
const MARK_MIN_MS = 8
// Long tasks are already ≥50ms by spec; keep them all.

let started = false
let startClock = 0

/** Idempotent. Called once when play3d mounts. Safe on the server (no-ops without window). */
export function startPerfLog(): void {
  if (started || typeof window === 'undefined') return
  started = true
  startClock = performance.now()
  try {
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        // attribution container name is usually just "self"/"same-origin"; the ms is what matters
        push({ t: e.startTime, label: 'main-thread blocked', ms: e.duration, kind: 'longtask' })
      }
    })
    obs.observe({ entryTypes: ['longtask'] })
  } catch {
    // Firefox/Safari may not support 'longtask' — marks still work, we just lose the auto-catch.
  }
}

function push(e: PerfEntry): void {
  BUF.push(e)
  if (BUF.length > CAP) BUF.shift()
  seq++
}

/**
 * Time a synchronous operation and log it if it's slow enough to matter. Returns whatever fn
 * returns, so it wraps a call transparently:  const ok = mark('craft', () => craftItem(...))
 */
export function mark<T>(label: string, fn: () => T): T {
  if (typeof performance === 'undefined') return fn()
  const t0 = performance.now()
  try {
    return fn()
  } finally {
    const ms = performance.now() - t0
    if (ms >= MARK_MIN_MS) push({ t: t0, label, ms, kind: 'mark' })
  }
}

/** Log a duration measured elsewhere (e.g. the autosave flush already times itself). */
export function logPerf(label: string, ms: number): void {
  if (ms >= MARK_MIN_MS) push({ t: performance.now(), label, ms, kind: 'mark' })
}

/** Newest first, for the panel. Returns a copy — the buffer is never handed out by reference. */
export function readPerfLog(): PerfEntry[] {
  return BUF.slice().reverse()
}

/** Changes whenever anything was logged — lets the panel skip a re-render when nothing happened. */
export function perfSeq(): number {
  return seq
}

/** Seconds since the log started, for a readable relative timestamp in the panel. */
export function perfClockStart(): number {
  return startClock
}

export function clearPerfLog(): void {
  BUF.length = 0
  seq++
}
