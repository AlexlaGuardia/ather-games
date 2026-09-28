// stillwind.ts — THE STILLWIND on the edge. Lenna's colossus, the season-1 raid.
//
// ── CANON (athernyx `season-01-lenna.md` › The colossus; CANON_GAPS › the Stillwind raid) ─────────────
// Lenna is tidally locked: the day side is THE GLARE (it burns), the night side is THE RIME (it freezes), and
// life keeps to the band between. The Stillwind is the largest body the host raised, **raised from core-light, so
// it runs hot**: it walks the one line where it neither overheats nor freezes, **the edge between day and night**.
// **The fight is on the edge: step toward the Glare and you burn; step toward the Rime and you freeze.** The Lenn
// know it is coming when **the wind stalls**. Never the host; felling it is a deed (a title), not the outcome.
// ⚠ TBD-CANON: its look (CANON_GAPS 09-28, "the Stillwind's look"). Nothing here describes it.
//
// ── WHAT'S MINE (Alex 09-28: "draw it off its line") ──────────────────────────────────────────
// It cannot comfortably leave the line either, so the keeper beats it by DRAWING IT OFF: it follows you, and the
// further it is dragged toward the Glare the hotter it runs, toward the Rime the colder. Overheated, it stops and
// opens up; frozen, it slows and turns brittle. On its line it barely takes a scratch. Every opening is paid for:
// to lure it off, the keeper stands in the burn or the frost. The tell is the Lenn's: the wind stops, then it
// runs the line. A skill check, not an HP sponge; no HP scaling by party size (GBOARD 09-24).
//
// Pure step function, no THREE.js, no React (same split as `puppet-guards.ts` / `hold.ts`).
// Coordinates: the line is x = 0; x > 0 is toward the Glare, x < 0 toward the Rime; z runs along the band.

export const STILLWIND_TUNING = {
  halfWidth: 24,         // the strip, x ∈ [-halfWidth, halfWidth]
  length: 160,           // z ∈ [0, length]
  safeHalf: 1.6,         // the keeper's safe band either side of the line
  burnPerTile: 3,        // hp/s per tile past the safe band, toward the Glare
  burnMax: 40,
  frostPerTile: 2,       // hp/s per tile past the safe band, toward the Rime (less, because it also slows)
  frostMax: 28,
  frostSlowPerTile: 0.05, // speed lost per tile into the Rime
  frostSlowMax: 0.55,
  hp: 8000,
  speed: 3.4,            // it walks toward the keeper
  lure: 0.75,            // how far it follows the keeper off its line (share of the keeper's x)
  comfort: 0.6,          // how hard it eases back toward the line (1/s)
  heatRate: 0.09,        // heat per second per tile off the line, Glare side (1 = overheated)
  coldRate: 0.09,
  coolRate: 0.35,        // heat/cold lost per second back on its line
  offTiles: 0.8,         // inside this it counts as on its line
  openSec: 5,            // overheated: stopped, open
  openDmg: 3,            // damage taken while overheated (× a hit)
  brittleSec: 6,         // frozen: slowed, brittle
  brittleDmg: 2,
  brittleSpeed: 0.45,
  lineDmg: 0.1,          // on its line it barely takes a scratch
  offDmg: 0.5,           // off the line but not yet open
  reach: 3.2,            // it strikes inside this
  strikeDmg: 32,
  strikeCd: 2.4,
  stallEvery: 14,        // seconds between the wind stalling
  stallSec: 2.6,         // the tell: the wind is gone this long, then it runs the line
  runSpeed: 16,          // running the line (along z, on x = 0)
  runSec: 1.6,
  runHalf: 2.4,          // a run strikes anything this close to the line
  runDmg: 55,
  radius: 2.2,           // its body, for rounds and spacing
  // keep between (the Lenn's whole ethic): on the line, unhurt a moment, the keeper's shield mends. It is what makes
  // a lure affordable — when the Stillwind is open or brittle you are back on the line shooting, and mending
  lineMend: 20,          // shield/s
  mendAfter: 1.5,        // seconds unhurt before it starts
} as const
export type StillwindTuning = typeof STILLWIND_TUNING

/** blowing → stalled (the tell) → running (the line) → blowing. Overheated / brittle interrupt the walk. */
export type WindPhase = 'blowing' | 'stalled' | 'running'
export type StillwindMood = 'walk' | 'open' | 'brittle'

export interface StillwindState {
  hp: number
  x: number; z: number
  heat: number           // 0..1, Glare side
  cold: number           // 0..1, Rime side
  mood: StillwindMood
  moodT: number
  wind: WindPhase
  windT: number          // seconds left in stalled/running, or until the next stall
  runDir: number         // +1 / -1 along z while running
  strikeT: number
  felled: boolean
  elapsed: number
}

export function startStillwind(tune: StillwindTuning = STILLWIND_TUNING): StillwindState {
  return {
    hp: tune.hp, x: 0, z: tune.length * 0.8, heat: 0, cold: 0, mood: 'walk', moodT: 0,
    wind: 'blowing', windT: tune.stallEvery, runDir: -1, strikeT: 1, felled: false, elapsed: 0,
  }
}

/** Phase by what is left of it: later phases stall sooner and walk faster. */
export function stillwindPhase(s: StillwindState, tune: StillwindTuning = STILLWIND_TUNING): 1 | 2 | 3 {
  const f = s.hp / tune.hp
  return f > 2 / 3 ? 1 : f > 1 / 3 ? 2 : 3
}

/** Shield the line gives back per second: on the safe band and unhurt for `mendAfter` seconds. */
export const lineMend = (x: number, sinceHurt: number, tune: StillwindTuning = STILLWIND_TUNING): number =>
  Math.abs(x) <= tune.safeHalf && sinceHurt >= tune.mendAfter ? tune.lineMend : 0

/** What the edge does to a keeper standing at x: burn toward the Glare, frost (and a slow) toward the Rime. */
export function edgeHazard(x: number, tune: StillwindTuning = STILLWIND_TUNING): { dps: number; slow: number; side: 'line' | 'glare' | 'rime' } {
  const past = Math.abs(x) - tune.safeHalf
  if (past <= 0) return { dps: 0, slow: 0, side: 'line' }
  if (x > 0) return { dps: Math.min(tune.burnMax, past * tune.burnPerTile), slow: 0, side: 'glare' }
  return { dps: Math.min(tune.frostMax, past * tune.frostPerTile), slow: Math.min(tune.frostSlowMax, past * tune.frostSlowPerTile), side: 'rime' }
}

export interface StillwindStepOut {
  /** damage to the keeper this step (strikes, a run through them) — the edge's own burn/frost is `edgeHazard`, the host applies it */
  strike: number
  stalled?: boolean      // the wind just died (the tell)
  ran?: boolean          // it just started running the line
  opened?: boolean       // it just overheated
  froze?: boolean        // it just turned brittle
}

export function stepStillwind(s: StillwindState, dt: number, px: number, pz: number, tune: StillwindTuning = STILLWIND_TUNING): StillwindStepOut {
  const out: StillwindStepOut = { strike: 0 }
  if (s.felled) return out
  dt = Math.min(dt, 0.1)
  s.elapsed += dt
  s.strikeT = Math.max(0, s.strikeT - dt)
  const phase = stillwindPhase(s, tune)

  // the wind: blowing → stalled (the Lenn's tell) → it runs the line → blowing
  s.windT -= dt
  if (s.wind === 'blowing' && s.windT <= 0 && s.mood === 'walk') {
    s.wind = 'stalled'; s.windT = tune.stallSec; out.stalled = true
  } else if (s.wind === 'stalled' && s.windT <= 0) {
    s.wind = 'running'; s.windT = tune.runSec; s.runDir = pz >= s.z ? 1 : -1; s.x = 0; out.ran = true
  } else if (s.wind === 'running' && s.windT <= 0) {
    s.wind = 'blowing'; s.windT = tune.stallEvery * (phase === 1 ? 1 : phase === 2 ? 0.75 : 0.55)
  }

  if (s.wind === 'running') {
    const was = s.z
    s.z = Math.max(0, Math.min(tune.length, s.z + s.runDir * tune.runSpeed * dt))
    const lo = Math.min(was, s.z) - tune.radius, hi = Math.max(was, s.z) + tune.radius
    // a run strikes whoever is on or near the line where it passes — once a run (strikeT guards it)
    if (Math.abs(px) <= tune.runHalf && pz >= lo && pz <= hi && s.strikeT <= 0) { out.strike += tune.runDmg; s.strikeT = tune.runSec }
    return out
  }

  // moods: overheated stands still and open; brittle crawls
  if (s.mood !== 'walk') {
    s.moodT -= dt
    if (s.moodT <= 0) { s.mood = 'walk'; s.heat = 0; s.cold = 0 }
  }
  if (s.mood === 'open') return out

  // the walk: toward the keeper along the band, following them off its line only so far, easing back
  const speed = tune.speed * (phase === 3 ? 1.25 : 1) * (s.mood === 'brittle' ? tune.brittleSpeed : 1)
  const dz = pz - s.z
  const stepZ = Math.sign(dz) * Math.min(Math.abs(dz), speed * dt)
  s.z = Math.max(0, Math.min(tune.length, s.z + stepZ))
  const want = px * tune.lure
  s.x += (want - s.x) * Math.min(1, speed * 0.5 * dt)
  s.x += (0 - s.x) * Math.min(1, tune.comfort * dt)
  s.x = Math.max(-tune.halfWidth, Math.min(tune.halfWidth, s.x))

  // off its line it runs hot (Glare side) or cold (Rime side); on it, it settles
  const off = Math.abs(s.x) - tune.offTiles
  if (off > 0 && s.mood === 'walk') {
    if (s.x > 0) s.heat = Math.min(1, s.heat + tune.heatRate * off * dt)
    else s.cold = Math.min(1, s.cold + tune.coldRate * off * dt)
  } else {
    s.heat = Math.max(0, s.heat - tune.coolRate * dt)
    s.cold = Math.max(0, s.cold - tune.coolRate * dt)
  }
  if (s.heat >= 1 && s.mood === 'walk') { s.mood = 'open'; s.moodT = tune.openSec; out.opened = true; return out }
  if (s.cold >= 1 && s.mood === 'walk') { s.mood = 'brittle'; s.moodT = tune.brittleSec; out.froze = true }

  // it strikes what it reaches
  if ((px - s.x) ** 2 + (pz - s.z) ** 2 <= tune.reach ** 2 && s.strikeT <= 0) { out.strike += tune.strikeDmg; s.strikeT = tune.strikeCd }
  return out
}

/** How much of a hit lands, by where it stands: open ×3, brittle ×2, off its line ×0.5, on its line ×0.1. */
export function stillwindTakes(s: StillwindState, tune: StillwindTuning = STILLWIND_TUNING): number {
  if (s.mood === 'open') return tune.openDmg
  if (s.mood === 'brittle') return tune.brittleDmg
  return Math.abs(s.x) > tune.offTiles ? tune.offDmg : tune.lineDmg
}

/** A round or a cast lands. Returns what it actually took, and whether that felled it. */
export function hitStillwind(s: StillwindState, dmg: number, tune: StillwindTuning = STILLWIND_TUNING): { took: number; felled: boolean } {
  if (s.felled) return { took: 0, felled: false }
  const took = dmg * stillwindTakes(s, tune)
  s.hp = Math.max(0, s.hp - took)
  if (s.hp <= 0) { s.felled = true; return { took, felled: true } }
  return { took, felled: false }
}
