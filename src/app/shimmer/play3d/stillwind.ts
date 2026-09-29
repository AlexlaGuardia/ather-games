// stillwind.ts — THE STILLWIND on the edge. Lenna's colossus, the season-1 raid.
//
// ── CANON (athernyx `season-01-lenna.md` › The colossus; CANON_GAPS › the Stillwind raid) ─────────────
// Lenna is tidally locked: the day side is THE GLARE (it burns), the night side is THE RIME (it freezes), and
// life keeps to the band between. The Stillwind is the largest body the host raised, **raised from core-light, so
// it runs hot**: it walks the one line where it neither overheats nor freezes, **the edge between day and night**.
// **The fight is on the edge: step toward the Glare and you burn; step toward the Rime and you freeze.** The Lenn
// know it is coming when **the wind stalls**. Never the host; felling it is a deed (a title), not the outcome.
// Its look is RULED (athernyx f77d125) and drawn in `StillwindScene.tsx`: Lenna's wind given a body under the flood's black ooze.
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
  // ★ THE BALANCE PASS (Alex 09-29, playtest: "the middle is the only walkable ground… the boss walking right at you,
  // theres no choice but to take damage from it or step off the middle… a long one… maybe give the boss phases").
  // The band was ±1.6 of a 48-wide strip, the burn climbed 3/s per tile at once, and it swung with no tell: there was
  // nowhere to stand but in front of it. Now: a band you can sidestep in, a SHOULDER that costs a little (the choice),
  // then the steep edge; a swing you see coming; a sweep in phase 2 that makes you pick a side; and a shorter fight.
  safeHalf: 3.2,         // the keeper's safe band either side of the line (was 1.6)
  shoulder: 7,           // past the band and inside this, the edge only nips: room to dodge, at a small price
  shoulderBurn: 3,       // hp/s on the Glare shoulder
  shoulderFrost: 2,      // hp/s on the Rime shoulder (and a small slow)
  shoulderSlow: 0.1,
  burnPerTile: 4,        // hp/s per tile past the SHOULDER, toward the Glare
  burnMax: 40,
  frostPerTile: 3,       // hp/s per tile past the shoulder, toward the Rime (less, because it also slows)
  frostMax: 28,
  frostSlowPerTile: 0.05, // speed lost per tile into the Rime, past the shoulder
  frostSlowMax: 0.55,
  hp: 5200,              // was 8000: a long fight is fine, a long fight with no choices is not
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
  lineDmg: 0.15,         // on its line it barely takes a scratch (was 0.1)
  offDmg: 0.5,           // off the line but not yet open
  reach: 3.2,            // it strikes inside this
  strikeDmg: 32,
  strikeCd: 2.4,
  strikeCdLate: 1.6,     // phase 3: it swings faster
  windup: 0.75,          // ★ the swing's TELL: it stops and draws back this long; step out of reach and it misses
  // ── PHASE 2+: THE SWEEP. It turns the wind across the line: a stretch of the band is marked, then struck. Stay and
  // take it, or step onto a shoulder (burn or frost: your pick), or run clear along the band. A choice every time.
  sweepEvery: 11,        // seconds between sweeps in phase 2
  sweepEveryLate: 7,     // phase 3
  sweepTell: 1.4,        // marked this long before it lands
  sweepHalfZ: 6,         // the stretch of band it strikes, either side of where you stood
  sweepDmg: 40,
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
  /** keepers a run has already struck (co-op: once each a run) */
  ranOver?: number[]
  /** the swing's tell: seconds until it lands (0 = not swinging) */
  swingT?: number
  /** phase 2+: seconds until the next sweep is marked, and while marked, where (z) and how long until it lands */
  sweepIn?: number
  sweepZ?: number
  sweepT?: number
}

export function startStillwind(tune: StillwindTuning = STILLWIND_TUNING): StillwindState {
  return {
    hp: tune.hp, x: 0, z: tune.length * 0.8, heat: 0, cold: 0, mood: 'walk', moodT: 0,
    wind: 'blowing', windT: tune.stallEvery, runDir: -1, strikeT: 1, felled: false, elapsed: 0,
    swingT: 0, sweepIn: tune.sweepEvery, sweepZ: 0, sweepT: 0,
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
  const a = Math.abs(x)
  if (a <= tune.safeHalf) return { dps: 0, slow: 0, side: 'line' }
  // the shoulder: a nip, not a burn. Past it, the edge climbs as it always did
  const past = Math.max(0, a - tune.shoulder)
  if (x > 0) return { dps: Math.min(tune.burnMax, tune.shoulderBurn + past * tune.burnPerTile), slow: 0, side: 'glare' }
  return { dps: Math.min(tune.frostMax, tune.shoulderFrost + past * tune.frostPerTile), slow: Math.min(tune.frostSlowMax, tune.shoulderSlow + past * tune.frostSlowPerTile), side: 'rime' }
}

export interface StillwindStepOut {
  /** damage to the keeper this step (strikes, a run through them) — the edge's own burn/frost is `edgeHazard`, the host applies it */
  strike: number
  stalled?: boolean      // the wind just died (the tell)
  ran?: boolean          // it just started running the line
  opened?: boolean       // it just overheated
  froze?: boolean        // it just turned brittle
  windup?: boolean       // it just drew back to swing (the tell)
  sweepMarked?: boolean  // phase 2+: a stretch of the band was just marked
  swept?: boolean        // …and just struck
}

export function stepStillwind(s: StillwindState, dt: number, px: number, pz: number, tune: StillwindTuning = STILLWIND_TUNING): StillwindStepOut {
  const { strikes, target: _t, ...flags } = stepStillwindParty(s, dt, [{ x: px, z: pz }], tune)
  return { ...flags, strike: strikes[0] ?? 0 }
}

// ── CO-OP (09-29, THE SLACK TOGETHER): one Stillwind, up to three keepers. It goes after the NEAREST keeper, so one
// can lure it off the line while the others keep between and shoot (the Lenn's ethic, played by a party). A run
// strikes every keeper on the line where it passes, once each; a swing strikes the keeper it is after. No hp
// scaling by party size (GBOARD 09-24): three keepers fell it faster, and that is the reward for bringing friends.
export interface StillwindPartyOut extends Omit<StillwindStepOut, 'strike'> {
  /** damage to each keeper this step, in the order given */
  strikes: number[]
  /** who it is after (index into the keepers given), -1 with nobody there */
  target: number
}

/** Whoever it is closest to. Solo, that is always the one keeper. */
export function stillwindTarget(s: StillwindState, keepers: { x: number; z: number }[]): number {
  let best = -1, bd = Infinity
  keepers.forEach((k, i) => { const d = (k.x - s.x) ** 2 + (k.z - s.z) ** 2; if (d < bd) { bd = d; best = i } })
  return best
}

export function stepStillwindParty(s: StillwindState, dt: number, keepers: { x: number; z: number }[], tune: StillwindTuning = STILLWIND_TUNING): StillwindPartyOut {
  const out: StillwindPartyOut = { strikes: keepers.map(() => 0), target: -1 }
  if (s.felled || !keepers.length) return out
  const ti = stillwindTarget(s, keepers)
  out.target = ti
  const px = keepers[ti].x, pz = keepers[ti].z
  dt = Math.min(dt, 0.1)
  s.elapsed += dt
  s.strikeT = Math.max(0, s.strikeT - dt)
  const phase = stillwindPhase(s, tune)

  // the wind: blowing → stalled (the Lenn's tell) → it runs the line → blowing
  s.windT -= dt
  if (s.wind === 'blowing' && s.windT <= 0 && s.mood === 'walk') {
    s.wind = 'stalled'; s.windT = tune.stallSec; out.stalled = true
  } else if (s.wind === 'stalled' && s.windT <= 0) {
    s.wind = 'running'; s.windT = tune.runSec; s.runDir = pz >= s.z ? 1 : -1; s.x = 0; s.ranOver = []; out.ran = true
  } else if (s.wind === 'running' && s.windT <= 0) {
    s.wind = 'blowing'; s.windT = tune.stallEvery * (phase === 1 ? 1 : phase === 2 ? 0.75 : 0.55)
  }

  if (s.wind === 'running') {
    const was = s.z
    s.z = Math.max(0, Math.min(tune.length, s.z + s.runDir * tune.runSpeed * dt))
    const lo = Math.min(was, s.z) - tune.radius, hi = Math.max(was, s.z) + tune.radius
    // a run strikes whoever is on or near the line where it passes — once each a run. The first strike of a run
    // still waits on `strikeT` (a swing just before it), exactly as the solo fight always has.
    const hit = (s.ranOver ??= [])
    keepers.forEach((k, i) => {
      if (Math.abs(k.x) > tune.runHalf || k.z < lo || k.z > hi || hit.includes(i)) return
      if (!hit.length && s.strikeT > 0) return
      out.strikes[i] += tune.runDmg; hit.push(i); s.strikeT = tune.runSec
    })
    return out
  }

  // ── PHASE 2+: the sweep. Marked where the keeper it is after stands, then struck: everyone on the band in that
  // stretch takes it. Keepers on a shoulder (off the band) or clear along the band do not.
  if (phase >= 2 && s.mood !== 'open') {
    if ((s.sweepT ?? 0) > 0) {
      s.sweepT = Math.max(0, (s.sweepT ?? 0) - dt)
      if (s.sweepT === 0) {
        keepers.forEach((k, i) => { if (Math.abs(k.x) <= tune.safeHalf && Math.abs(k.z - (s.sweepZ ?? 0)) <= tune.sweepHalfZ) out.strikes[i] += tune.sweepDmg })
        out.swept = true
        s.sweepIn = phase === 3 ? tune.sweepEveryLate : tune.sweepEvery
      }
    } else {
      s.sweepIn = (s.sweepIn ?? tune.sweepEvery) - dt
      if (s.sweepIn <= 0) { s.sweepT = tune.sweepTell; s.sweepZ = pz; out.sweepMarked = true }
    }
  }

  // moods: overheated stands still and open; brittle crawls
  if (s.mood !== 'walk') {
    s.moodT -= dt
    if (s.moodT <= 0) { s.mood = 'walk'; s.heat = 0; s.cold = 0 }
  }
  if (s.mood === 'open') return out

  // ★ THE SWING HAS A TELL: while it draws back it stands still, and it lands only on a keeper still in reach
  if ((s.swingT ?? 0) > 0) {
    s.swingT = Math.max(0, (s.swingT ?? 0) - dt)
    if (s.swingT === 0) {
      if ((px - s.x) ** 2 + (pz - s.z) ** 2 <= (tune.reach + 0.3) ** 2) out.strikes[ti] += tune.strikeDmg
      s.strikeT = phase === 3 ? tune.strikeCdLate : tune.strikeCd
    }
    return out
  }

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

  // it draws back on what it reaches (the swing lands `windup` later, above)
  if ((px - s.x) ** 2 + (pz - s.z) ** 2 <= tune.reach ** 2 && s.strikeT <= 0) { s.swingT = tune.windup; out.windup = true }
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

// ── the arena as a zone ───────────────────────────────────────────────────────────────────────
// The strip is a generated grid (the Crucible / Breach precedent: no tilemap literal). A wall border, the
// strip inside it, and a way back at the near end on the line. Sim x = tile col − (halfWidth + 1); sim z = tile row − 1.
export const EDGE_ZONE = 'stillwind-edge'
const FLOOR = 98, WALL = 103, WARP = 14
export const EDGE_COLS = STILLWIND_TUNING.halfWidth * 2 + 3
export const EDGE_ROWS = STILLWIND_TUNING.length + 3
export const edgeToSim = (tx: number, tz: number) => ({ x: tx - (STILLWIND_TUNING.halfWidth + 1), z: tz - 1 })
export const simToEdge = (x: number, z: number) => ({ x: x + STILLWIND_TUNING.halfWidth + 1, z: z + 1 })
/** where a keeper arrives (on the line, near end) and the way back out (the line, the very end) */
export const EDGE_START = simToEdge(0, 6)
export const EDGE_EXIT = simToEdge(0, 0)
export function edgeGrid(): number[][] {
  const grid: number[][] = []
  for (let r = 0; r < EDGE_ROWS; r++) {
    const row: number[] = []
    for (let c = 0; c < EDGE_COLS; c++) {
      const border = r === 0 || r === EDGE_ROWS - 1 || c === 0 || c === EDGE_COLS - 1
      row.push(c === EDGE_EXIT.x && r === EDGE_EXIT.z ? WARP : border ? WALL : FLOOR)
    }
    grid.push(row)
  }
  return grid
}

// ── the deed (canon 09-26: felling it is a deed — a title on Lenna's archive page, never the outcome) ──
// Per keeper, like the road. How the title SHOWS is Jin's; its words are working copy until Lark/Alex.
export const DEED_KEY = 'ather:shimmer:stillwind-deed'
export const DEED_TITLE = 'Felled the Stillwind'
