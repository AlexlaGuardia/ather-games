// Rinning cast-and-catch — the fishing-analog skill's own feel, distinct from the
// hold-to-channel of forestry/prospecting. Cast a line into a pool (which locks the
// walker to the node), wait, then a `!` pops over the mote's head: strike during it to
// hook, strike early or let it lapse and it slips. Pure + time-based (pass timestamps),
// so it's testable without the DOM; the walker drives it from a tick loop.

export type RinPhase =
  | 'wait' // line's out, no bite yet — striking here is too early
  | 'bite' // the `!` is up — hook it NOW
  | 'gotaway' // the window lapsed without a hook

export interface RinCast {
  startMs: number // when the line went out (the cast/lock-in)
  biteMs: number // delay from start until the bite (the `!`) begins
  windowMs: number // how long the `!` stays up to react
}

// a fresh cast: the bite lands 0.9–3.0s after casting, react within ~1s (classic, generous).
export function newCast(startMs: number, rng: () => number): RinCast {
  return { startMs, biteMs: 900 + rng() * 2100, windowMs: 1000 }
}

export function phaseAt(c: RinCast, nowMs: number): RinPhase {
  const t = nowMs - c.startMs
  if (t < c.biteMs) return 'wait'
  if (t < c.biteMs + c.windowMs) return 'bite'
  return 'gotaway'
}

// the player strikes at nowMs: caught only while the `!` is up; too early (wait) or too
// late (window lapsed) and it slips the line.
export function hook(c: RinCast, nowMs: number): boolean {
  return phaseAt(c, nowMs) === 'bite'
}
