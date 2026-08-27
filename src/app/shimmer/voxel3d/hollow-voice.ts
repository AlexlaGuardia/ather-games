// WHAT THE NIGHT SOUNDS LIKE — the cadence, direction and loudness of a Hollow's movement.
//
// ★ PURE. No WebAudio, no DOM, no THREE. This decides WHEN a body makes a sound and WHAT that
// sound should be shaped like; `hollow-sfx.ts` is the thin shell that actually makes it. Split that
// way because the interesting part is arithmetic — which side of you a thing is on, and how much
// warning you get — and arithmetic can have an oracle where a noise cannot.
//
// ── ★★ ALEX RULED THE FIX, 2026-08-27 ───────────────────────────────────────────────────────────
// *"as long as the enemy is visible and slowly creeps up behind the player its fine once we add
// sound and give the stalker footsteps or a distinct movement sound it wont feel so bad."*
//
// The complaint it answers: he was struck by something he never saw. The stalker approaches only
// from the blind spot, is a small dark cone at night, and withdraws while watched — and NOTHING
// told him to turn. voxel3d had no audio path at all, so the first signal of a 14-damage hit (the
// heaviest in the game) arrived AFTER it landed. `HOLLOW_FORMS` prices that damage on the keeper
// being able to deny it by turning round; this file is what makes turning round a decision.
//
// ★ SO DIRECTION IS THE WHOLE DELIVERABLE, NOT ATMOSPHERE. A footstep that does not say WHICH WAY
// is a jump-scare with extra steps. Every emission carries a pan and a muffle, and both are derived
// from the bearing to the listener's own facing — the same `atan2(dz, dx)` convention `hollowStep`,
// `stepFoe` and the plot ring already use.
//
// ⚠ BEHIND AND IN FRONT SOUND THE SAME IN STEREO, and that is the one thing this must not get
// wrong, because behind is the entire point. Panning alone puts a thing at your 4 o'clock and your
// 8 o'clock in the same place. So `muffle` rises toward the rear and the shell darkens the tone
// with it — the cheap, standard stand-in for the head shadowing your own ears. A keeper should be
// able to tell "behind me" from "ahead of me" with their eyes shut, and that is testable below.
//
// ⚠ THE HOUSE STYLE IS PROCEDURAL AND ASSET-FREE (`play3d/gather-fx.ts`, `rin-fx.ts`, and the
// `nolmir/sfx-lab` page). Nothing here names a file to load: a step is a shaped burst of noise, so
// there is no download, no licence and no 404. Keep it that way.

/** A body that can be heard. Only what the sound needs — never a `HollowState` import. */
export interface Voice {
  id: string
  x: number
  z: number
  /** Which voice to use. The stalker gets its own, per Alex's ruling. */
  form: 'warden' | 'stalker' | 'caster'
  /** Blocks per second it is actually covering right now — a standing body makes no footfall. */
  speed: number
}

/** Where the keeper is and which way they face. Same shape the plot ring uses. */
export interface Ear { x: number; z: number; yaw: number }

/** One sound to make this frame. The shell reads these and nothing else. */
export interface Emission {
  id: string
  form: Voice['form']
  /** 0..1. Distance falloff only — the shell owns the master level. */
  gain: number
  /** -1 hard left, +1 hard right. */
  pan: number
  /** 0 dead ahead, 1 directly behind. Drives the low-pass that separates front from rear. */
  muffle: number
}

export interface VoiceDials {
  /** Past this many blocks a body is silent. */
  range: number
  /** Seconds between footfalls at 1 block/sec — divided by speed, so faster feet tick faster. */
  strideAt1: number
  /** Slower than this and a body is treated as standing still: no footfall at all. */
  moveFloor: number
  /** Ceiling on emissions per second across ALL bodies, so a pack of four is a rhythm not a wall. */
  maxPerSec: number
}

/**
 * ⚠ `maxPerSec` 7 DOES THROTTLE A FULL PACK, MEASURED: `PACK_MAX` is 4 and four stalkers demand
 * about 8 footfalls a second, so a legal pack loses roughly a quarter of them. That is deliberate
 * and it is fine — 7 a second still tells a keeper where the danger is — but it is written down
 * because the obvious "improvement" is to raise the ceiling until nothing is ever dropped, which
 * trades the one property that matters (a rhythm, not a wall) for a number nobody was asking for.
 * The nearest body is exempt, so the thing about to hit you is never the one thrown away.
 *
 * ⚠ `range` 26 IS SIZED OFF `PLAYER_EXCLUSION` (24), NOT PICKED. A Hollow forms at least 24 blocks
 * away — *"it forms out of sight, never in your lap"* — so a range any shorter than that means the
 * first sound a keeper ever hears is one already inside the exclusion zone, closing. 26 gives a
 * couple of blocks of approach before the footfalls begin, which is the warning the whole feature
 * exists to provide. ⚠ If `PLAYER_EXCLUSION` moves, this is wrong and nothing will say so.
 */
export const DEFAULT_VOICE: VoiceDials = {
  range: 26, strideAt1: 1.9, moveFloor: 0.35, maxPerSec: 7,
}

/**
 * Per-body stride phase plus the emission budget, owned by the caller and handed back in.
 *
 * ⚠ THE BUDGET IS A TOKEN BUCKET AND IT HAS TO BE, because a rate below one-per-frame CANNOT be
 * expressed per frame. The first cut computed `round(maxPerSec * dt)` each frame: at 60fps that is
 * `round(0.117)` = 0, floored to 1, so a "ceiling" of 7 a second admitted 60 — the guard was
 * arithmetically incapable of ever binding. Caught by the oracle, which is the only reason it is
 * not still in here reading like a limit.
 */
export interface VoiceClock {
  phase: Record<string, number>
  tokens: number
}

export const newVoiceClock = (): VoiceClock => ({ phase: {}, tokens: 0 })

/** Emissions the bucket may hold in reserve. A pack arriving together should be allowed a flurry;
 *  what must not happen is a sustained wall. */
const BURST = 2

/** Bearing of (x, z) relative to the way the ear is facing, in (-pi, pi]. */
function offAxis(e: Ear, x: number, z: number): number {
  let off = Math.atan2(z - e.z, x - e.x) - e.yaw
  while (off > Math.PI) off -= Math.PI * 2
  while (off < -Math.PI) off += Math.PI * 2
  return off
}

/**
 * How loud a body at `dist` is. Linear to zero at `range`, squared so the last few blocks of
 * approach are the loud ones — a flat falloff makes a thing 20 blocks off as attention-grabbing as
 * one at 3, and then the cue means nothing.
 */
export function loudness(dist: number, d: VoiceDials = DEFAULT_VOICE): number {
  if (dist >= d.range) return 0
  const t = 1 - dist / d.range
  return t * t
}

/**
 * Advance every body's stride and return what should be heard this frame.
 *
 * ⚠ THE CLOCK IS MUTATED AND THE RETURN IS FRESH. The caller owns the clock across frames; that is
 * deliberate, so this stays a function of its inputs rather than a module with a memory, and so a
 * test can drive a hundred frames without a reset ritual.
 *
 * ★ A STANDING BODY IS SILENT. `moveFloor` exists because the stalker's own design has it stop and
 * withdraw — a footfall from something that is not walking is the cue lying about what it is doing,
 * and a lying cue is worse than no cue for exactly the reason this whole feature was written.
 */
export function stepVoices(
  clock: VoiceClock,
  bodies: readonly Voice[],
  ear: Ear,
  dt: number,
  d: VoiceDials = DEFAULT_VOICE,
): Emission[] {
  const out: Emission[] = []
  if (dt <= 0) return out
  // Nearest first, so when the per-second ceiling bites it drops the FAR ones. The thing about to
  // hit you must never be the thing that got cut for a body 25 blocks away.
  const ranked = bodies
    .map(b => ({ b, dist: Math.hypot(b.x - ear.x, b.z - ear.z) }))
    .sort((p, q) => p.dist - q.dist)
  clock.tokens = Math.min(BURST, clock.tokens + d.maxPerSec * dt)
  /**
   * The one body that may always be heard: the closest that is both audible and actually walking.
   * Resolved by IDENTITY here, once, so the exemption is worth one body's cadence rather than one
   * emission per frame — see the note at the token check below.
   */
  const exemptId = ranked.find(r => loudness(r.dist, d) > 0 && r.b.speed >= d.moveFloor)?.b.id ?? null
  for (const { b, dist } of ranked) {
    const gain = loudness(dist, d)
    if (gain <= 0) { delete clock.phase[b.id]; continue }
    if (b.speed < d.moveFloor) { clock.phase[b.id] = 0; continue }
    const stride = d.strideAt1 / b.speed
    const phase = (clock.phase[b.id] ?? Math.random() * stride) + dt
    if (phase < stride) { clock.phase[b.id] = phase; continue }
    clock.phase[b.id] = phase - stride
    // ★★ THE NEAREST BODY IS NEVER RATE-LIMITED, and ranking alone was NOT enough to guarantee it.
    // A pack drains the bucket continuously while the close one only fires every half second, so it
    // kept arriving to an empty bucket and lost 3 of its 8 footfalls — first in the queue and still
    // starved. The ceiling exists to stop a WALL of noise, and one body's footsteps are not a wall.
    //
    // ⚠⚠ THE EXEMPTION IS PINNED TO ONE BODY'S ID, NOT TO "THE FIRST TO FIRE THIS FRAME", AND THE
    // DIFFERENCE IS A FACTOR OF SIXTY. Written the second way it grants one free emission per
    // FRAME — 60 a second on a 60fps client — so with twelve bodies the ceiling admitted 92 of the
    // 96 it exists to cut, while every ceiling assert still passed because a pack of four never
    // reached the bound. A guard defeated by the exemption written to protect it.
    if (b.id !== exemptId && clock.tokens < 1) continue   // its foot fell, but the night is full
    clock.tokens = Math.max(0, clock.tokens - 1)
    const off = offAxis(ear, b.x, b.z)
    out.push({
      id: b.id,
      form: b.form,
      gain,
      pan: Math.sin(off),
      // 0 dead ahead, 1 directly behind — a straight remap of the bearing, so it is monotonic and
      // a keeper can learn it. `cos` alone would make 90° left and 90° right differ from each other.
      muffle: (1 - Math.cos(off)) / 2,
    })
  }
  return out
}
