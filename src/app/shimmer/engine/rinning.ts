// Rinning cast-and-catch — the fishing-analog skill's own feel, distinct from the
// hold-to-channel of forestry/prospecting. Cast a line into a pool, watch the water,
// resist the false nibbles, then hook the real bite in a short reaction window. Pure +
// time-based (pass timestamps), so the whole thing is testable without the DOM; the
// overlay just drives it with rAF.

export type RinPhase =
  | 'cast' // the line is still arcing out — no strike yet
  | 'waiting' // line's settled, no bite
  | 'nibble' // a tease — the bobber twitches but it's NOT the bite; striking here misses
  | 'bite' // it's on! hook it NOW
  | 'caught' // hooked in the window
  | 'gotaway' // missed — struck early/on a nibble, or let the window pass

export interface RinNibble { atMs: number; durMs: number } // a fake tell during the wait

export interface RinCast {
  startMs: number // when the cast began
  castMs: number // line-out time before the water settles (strike ignored until then)
  biteMs: number // delay from start until the real bite begins (> castMs)
  windowMs: number // how long the bite window stays open to react
  nibbles: RinNibble[] // 0–2 fake tells scattered through the wait
}

// a fresh cast: the line arcs out (~0.45s), the real bite lands ~1.15–3.55s in, react
// within ~0.78s. 0–2 nibbles tempt an itchy strike during the wait (a hit on one misses).
export function newCast(startMs: number, rng: () => number): RinCast {
  const castMs = 450
  const biteMs = castMs + 700 + rng() * 2400
  const windowMs = 780
  const n = rng() < 0.35 ? 0 : rng() < 0.8 ? 1 : 2
  const nibbles: RinNibble[] = []
  const span = biteMs - castMs - 650 // keep nibbles clear of the cast and the real bite
  for (let i = 0; i < n && span > 0; i++) {
    nibbles.push({ atMs: castMs + 300 + rng() * span, durMs: 150 + rng() * 90 })
  }
  return { startMs, castMs, biteMs, windowMs, nibbles }
}

export function phaseAt(c: RinCast, nowMs: number): Exclude<RinPhase, 'caught'> {
  const t = nowMs - c.startMs
  if (t < c.castMs) return 'cast'
  if (t < c.biteMs) {
    for (const nb of c.nibbles) if (t >= nb.atMs && t < nb.atMs + nb.durMs) return 'nibble'
    return 'waiting'
  }
  if (t < c.biteMs + c.windowMs) return 'bite'
  return 'gotaway' // the window passed without a hook
}

// the player strikes at nowMs: caught only during the real bite window; a strike during
// the cast, the wait, a nibble, or after the window lapses gets away.
export function hook(c: RinCast, nowMs: number): 'caught' | 'gotaway' {
  return phaseAt(c, nowMs) === 'bite' ? 'caught' : 'gotaway'
}

// how clean the hook was, 0..1 (1 = struck the instant the bite began). Drives the catch
// quality tier + the bonus-catch reward.
export function hookQuality(c: RinCast, nowMs: number): number {
  const into = nowMs - c.startMs - c.biteMs
  if (into < 0 || into > c.windowMs) return 0
  return 1 - into / c.windowMs
}

export type RinTier = 'clean' | 'good' | 'caught'
// a fast reaction = a clean hook (bonus catch); mid = good; a late scramble = a plain catch.
export function qualityTier(q: number): RinTier {
  return q > 0.7 ? 'clean' : q > 0.35 ? 'good' : 'caught'
}
