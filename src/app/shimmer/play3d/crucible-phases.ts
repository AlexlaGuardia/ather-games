// crucible-phases.ts — the Crucible match clock: which floor is open, which is sealing, which is
// depressurising. A PURE FUNCTION OF ELAPSED SECONDS, nothing else.
//
// Same discipline as the burrow patrols: no ticking state, no setInterval owning the truth. The
// renderer, the HUD countdown and the pressure damage each call `crucibleAt(elapsed)` and derive
// the same answer independently, so they cannot disagree and a reconnecting client is instantly
// correct. Determinism is the whole point — a match clock that drifts per-client is unshippable.
//
// ── CANON (game/pyramid-zero.md § The Tournament Flow) ─────────────────────────
// 20 entrances × 3 challengers = 60, teams of three. Three floors, then the Vault:
//   L1 **The City**   — four chambers, ruined-city look. A glyph is the only light; "when the glyph
//                       fades you will be released". Mana bell, lights up. 5 min, then airlocks
//                       close and pressure drops. Traverse UP.
//   L2 **The Dawn**   — one massive open area, permanent almost-daybreak. 5 more minutes on airlocks.
//   L3 **The Throne** — palace arena, the Three Puppet Guards. Seamless ascent, no load screens.
//                       Second bell marks the final five minutes.
//   **The Vault**     — Lazerin, the prizes. NOT a combat floor.
//
// ⚠ THE MATCH SHAPE IS AN OPEN CANON GAP (CANON_GAPS.md, 2026-08-03). Level 1's voice says "only the
// last team standing may proceed", which read literally leaves ONE squad above the ground floor and
// deletes PvP on L2/L3 — contradicting both later sections, which speak of *players* plural. This
// module implements the **timed-ascent** reading: you go up if you survive AND climb before the
// airlocks seal, and the hazard does the eliminating. If Magii rules the literal reading instead,
// the fix is here and it is small: gate ascent on squads-remaining rather than on the clock.
//
// Numbers below are BUILD-SIDE (mine, per SHIMMER-CANON-BOUNDARY) — but canon writes 5 minutes a
// floor, so they start there. Everything tunable lives in TUNING; nothing reads a literal elsewhere.

export type LevelPhase =
  | 'pending'   // not yet reached — airlocks above are still shut
  | 'open'      // released, fighting, the way up is open
  | 'sealing'   // final warning window — the airlocks are cycling shut
  | 'sealed'    // shut. pressure dropping. no ascent from this floor.

export type MatchPhase = 'glyph' | 'running' | 'vault' | 'over'

export interface CrucibleLevel {
  id: 'city' | 'dawn' | 'throne'
  ordinal: 1 | 2 | 3
  name: string
  /** how long this floor stays passable, in seconds (canon: 5 minutes) */
  openSec: number
  /** canon marks bells; the HUD/audio layer keys its cue off this */
  bell?: 'mana' | 'second'
  /** L3 holds the Three Puppet Guards (constructs in the shapes of Laz's old guards) */
  guards?: boolean
}

// ── TUNING — every timing in the match lives here ──────────────────────────────
// Canon writes 5 minutes per floor. Playtest against it with a controller in hand before changing
// any of these; a change here is a change to the ruled figure and should be deliberate.
export const TUNING = {
  /** the glyph hold before Level 1 releases ("when the glyph fades you will be released") */
  glyphSec: 20,
  /** ruled floor duration */
  floorSec: 300,
  /** the tail of a floor's window spent in 'sealing' — a WARNING, not extra time.
   *  Carved out of floorSec so the floor still lasts exactly the canon 5 minutes. */
  warnSec: 45,
  /** how long the Vault stays open once the last floor closes */
  vaultSec: 120,
  /** pressure damage per second once a floor is sealed — canon: "slowly killing" */
  pressureDps: 4,
  /** pressure ramps to full over this long, so a sealed floor is escapable for a beat */
  pressureRampSec: 15,
} as const

export const CRUCIBLE_LEVELS: CrucibleLevel[] = [
  { id: 'city',   ordinal: 1, name: 'The City',   openSec: TUNING.floorSec, bell: 'mana' },
  { id: 'dawn',   ordinal: 2, name: 'The Dawn',   openSec: TUNING.floorSec },
  { id: 'throne', ordinal: 3, name: 'The Throne', openSec: TUNING.floorSec, bell: 'second', guards: true },
]

export type LevelId = CrucibleLevel['id']

/** Absolute second each floor opens and shuts. Floors run back to back after the glyph hold. */
export interface LevelWindow { level: CrucibleLevel; startSec: number; endSec: number }

export const LEVEL_WINDOWS: LevelWindow[] = (() => {
  const out: LevelWindow[] = []
  let t = TUNING.glyphSec
  for (const level of CRUCIBLE_LEVELS) {
    out.push({ level, startSec: t, endSec: t + level.openSec })
    t += level.openSec
  }
  return out
})()

/** When the last floor shuts — the Vault opens here. */
export const MATCH_END_SEC = LEVEL_WINDOWS[LEVEL_WINDOWS.length - 1].endSec
export const VAULT_END_SEC = MATCH_END_SEC + TUNING.vaultSec

export interface LevelState {
  level: CrucibleLevel
  phase: LevelPhase
  /** seconds until this floor's phase changes; 0 once sealed (nothing further happens) */
  endsIn: number
  /** pressure damage per second on this floor right now (0 until sealed, then ramps) */
  pressureDps: number
}

export interface CrucibleState {
  elapsed: number
  matchPhase: MatchPhase
  levels: LevelState[]
  /** the floor currently passable, or null during the glyph hold / after the last seals */
  activeLevel: CrucibleLevel | null
  /** seconds until the NEXT thing happens anywhere in the match — what the HUD counts down */
  nextEventIn: number
}

const clamp0 = (n: number) => (n > 0 ? n : 0)

function phaseFor(w: LevelWindow, elapsed: number): { phase: LevelPhase; endsIn: number } {
  if (elapsed < w.startSec) return { phase: 'pending', endsIn: w.startSec - elapsed }
  const sealingAt = w.endSec - TUNING.warnSec
  if (elapsed < sealingAt) return { phase: 'open', endsIn: sealingAt - elapsed }
  if (elapsed < w.endSec) return { phase: 'sealing', endsIn: w.endSec - elapsed }
  return { phase: 'sealed', endsIn: 0 }
}

/** Pressure on a sealed floor, ramped so being caught is a scramble and not an instant death. */
function pressureFor(w: LevelWindow, elapsed: number): number {
  if (elapsed < w.endSec) return 0
  const since = elapsed - w.endSec
  const ramp = TUNING.pressureRampSec > 0 ? Math.min(1, since / TUNING.pressureRampSec) : 1
  return TUNING.pressureDps * ramp
}

/** THE function. Everything else in the match derives from this. */
export function crucibleAt(elapsed: number): CrucibleState {
  const t = clamp0(elapsed)
  const levels: LevelState[] = LEVEL_WINDOWS.map((w) => {
    const { phase, endsIn } = phaseFor(w, t)
    return { level: w.level, phase, endsIn, pressureDps: pressureFor(w, t) }
  })

  const matchPhase: MatchPhase =
    t < TUNING.glyphSec ? 'glyph'
    : t < MATCH_END_SEC ? 'running'
    : t < VAULT_END_SEC ? 'vault'
    : 'over'

  const active = levels.find((l) => l.phase === 'open' || l.phase === 'sealing')?.level ?? null

  // the soonest upcoming transition anywhere — glyph fade, a seal, the vault closing
  const upcoming = levels.filter((l) => l.endsIn > 0).map((l) => l.endsIn)
  if (matchPhase === 'vault') upcoming.push(VAULT_END_SEC - t)
  const nextEventIn = upcoming.length ? Math.min(...upcoming) : 0

  return { elapsed: t, matchPhase, levels, activeLevel: active, nextEventIn }
}

// ── derived helpers — never recompute a phase by hand, ask these ───────────────

export function levelStateAt(id: LevelId, elapsed: number): LevelState {
  const s = crucibleAt(elapsed)
  const found = s.levels.find((l) => l.level.id === id)
  if (!found) throw new Error(`crucible: unknown level '${id}'`)
  return found
}

/**
 * Can a squad still climb off this floor? False once the airlocks shut — which IS the elimination
 * under the timed-ascent reading. (If canon rules the literal "last team standing", this is the
 * one function that changes: it would also require being the last squad alive on the floor.)
 */
export function canAscendFrom(id: LevelId, elapsed: number): boolean {
  const p = levelStateAt(id, elapsed).phase
  return p === 'open' || p === 'sealing'
}

/** Damage per second a player on this floor is taking from the pressure drop. */
export function pressureDpsOn(id: LevelId, elapsed: number): number {
  return levelStateAt(id, elapsed).pressureDps
}

/** The bell (if any) that fires at this instant — the audio/HUD cue layer polls this. */
export function bellAt(elapsed: number, prevElapsed: number): 'mana' | 'second' | null {
  for (const w of LEVEL_WINDOWS) {
    if (!w.level.bell) continue
    if (prevElapsed < w.startSec && elapsed >= w.startSec) return w.level.bell
  }
  return null
}
