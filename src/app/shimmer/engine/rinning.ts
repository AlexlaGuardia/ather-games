// Rinning cast-and-catch — the fishing-analog skill's own feel, distinct from the
// hold-to-channel of forestry/prospecting. Cast a line into a pool, wait for the
// bite, then hook it in a short reaction window. Pure + time-based (pass timestamps),
// so the whole thing is testable without the DOM; the overlay just drives it with rAF.

export type RinPhase =
  | 'waiting' // line's out, no bite yet
  | 'bite' // it's on! hook it NOW
  | 'caught' // hooked in the window
  | 'gotaway' // missed — struck early, or let the window pass

export interface RinCast {
  startMs: number // when the line went out
  biteMs: number // delay from start until the bite begins
  windowMs: number // how long the bite window stays open to react
}

// a fresh cast: the bite lands 0.9–3.0s after casting, react within ~0.85s.
export function newCast(startMs: number, rng: () => number): RinCast {
  return { startMs, biteMs: 900 + rng() * 2100, windowMs: 850 }
}

export function phaseAt(c: RinCast, nowMs: number): Extract<RinPhase, 'waiting' | 'bite' | 'gotaway'> {
  const t = nowMs - c.startMs
  if (t < c.biteMs) return 'waiting'
  if (t < c.biteMs + c.windowMs) return 'bite'
  return 'gotaway' // the window passed without a hook
}

// the player strikes at nowMs: caught only during the bite window; too early or too
// late and it gets away.
export function hook(c: RinCast, nowMs: number): 'caught' | 'gotaway' {
  return phaseAt(c, nowMs) === 'bite' ? 'caught' : 'gotaway'
}

// how clean the hook was, 0..1 (1 = struck the instant the bite began). Drives a
// "clean catch" quality read — an early strike in the window scores higher.
export function hookQuality(c: RinCast, nowMs: number): number {
  const into = nowMs - c.startMs - c.biteMs
  if (into < 0 || into > c.windowMs) return 0
  return 1 - into / c.windowMs
}
