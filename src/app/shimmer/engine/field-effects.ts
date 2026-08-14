// field-effects.ts — SYSTEM 1 of 3: the persistent area entity.
//
// ── WHY ────────────────────────────────────────────────────────────────────────
// A third of canon's unbuilt keeper moves are not projectiles at all — they are a PLACE that keeps
// being true for a while. Firewall is a wall of flame you throw between yourself and a threat;
// Healing Grove is a sanctuary that steadily restores everyone within. Neither is expressible as a
// bolt, which is exactly why they were the moves a gun cannot answer.
//
// So this module owns "a volume in the world, for a while". It is deliberately ignorant of THREE,
// of the player, and of enemies: it stores fields, expires them, and answers containment. The sim
// applies the consequences, so the rules stay provable headless.
//
// ── ★ MOVED play3d/ → engine/ 2026-08-14, AND GAINED A HEIGHT ────────────────────────────────────
// The voxel world is the one that ships, and it could not place a field at all — 11 canon casts said
// "not in this world yet". Porting it here (the shared spine, where the other 11 both-worlds systems
// live) is slice 2 of the plan `cast-dispatch.ts` already wrote down.
//
// ⚠ THE ONE THING THAT COULD NOT TRAVEL UNCHANGED IS THE SHAPE. A field used to be a CIRCLE, which
// in play3d's flat tile world is an infinitely tall column and nobody could tell. A voxel world has
// caves under the ground you are standing on and cliffs above it, so an infinite column means a
// Firewall on the surface burns a Hollow in the tunnel below it and eats a round fired from the
// ridge overhead. So a field is now a SLAB: a circle plus `y` and `height`.
//
// `y`/`height` are REQUIRED, not optional, and that is deliberate — the codebase's own lesson from
// the `book` parameter: an optional field would let every un-updated caller keep the old, wrong
// answer silently, whereas required means the compiler walks the call sites for me. `contains` stays
// 2D for the readers that genuinely are ground-plane (play3d's own), and `containsVolume` is the one
// the voxel host asks. Same data, two questions, neither one guessing.
//
// ── BOUNDARY ───────────────────────────────────────────────────────────────────
// WHAT a field does is canon (moves.md effect lines). Radius, duration, tick rate and damage are
// Jin's, and live on the move's CastSpec — never here. This module has no move names in it.

export interface FieldDef {
  /** the move that conjured it, for the HUD + debugging */
  moveId: string
  x: number
  z: number
  /**
   * Ground level of the slab — the surface the cast landed on, NOT the caster's eye. A field is a
   * thing standing on the ground; anchoring it to the camera would float it over a slope.
   */
  y: number
  /** world-unit radius */
  radius: number
  /** how tall the slab stands above `y`. See the height note in the header. */
  height: number
  /** seconds it persists */
  secs: number
  /** damage per tick applied to enemies inside (0 = harmless to them) */
  dps: number
  /** healing per tick applied to the player inside (0 = no restore) */
  hps: number
  /** does it stop projectiles crossing it? Firewall is cover; a grove is not. */
  stopsShots: boolean
}

/**
 * How tall a cast field stands, in world units. Head-height and a bit: a wall of flame you can see
 * over is not cover, and one you could step onto would be terrain. Jin's number, not canon's.
 */
export const FIELD_HEIGHT = 3.5

/**
 * How far BELOW its ground line a field still bites. Small and non-zero on purpose: terrain is not
 * flat, so a body standing in a one-block dip inside the radius is unambiguously in the fire.
 */
export const FIELD_UNDERBITE = 1

export interface Field extends FieldDef {
  /** monotonic id — stable for the render pool */
  id: number
  /** ms timestamp this field expires */
  until: number
  /** ms timestamp of the next effect tick */
  nextTick: number
}

/** one effect application per second — slow enough to read, fast enough to matter */
export const FIELD_TICK_MS = 1000

/** Fields are capped so a mashed key cannot unbounded-grow the pool or the render list. */
export const MAX_FIELDS = 8

let nextId = 1
/** test hook — keeps ids deterministic across oracle runs */
export function resetFieldIds(): void { nextId = 1 }

/**
 * Add a field. Returns the new list. If the cap is reached the OLDEST field is dropped, not the
 * new one — a player who just paid mana must always see their cast happen.
 */
export function spawnField(fields: Field[], def: FieldDef, now: number): Field[] {
  const f: Field = { ...def, id: nextId++, until: now + def.secs * 1000, nextTick: now + FIELD_TICK_MS }
  const kept = fields.length >= MAX_FIELDS ? fields.slice(1) : fields
  return [...kept, f]
}

/** Drop everything that has expired. */
export function expireFields(fields: Field[], now: number): Field[] {
  return fields.some((f) => f.until <= now) ? fields.filter((f) => f.until > now) : fields
}

/**
 * Is this point inside the field's FOOTPRINT? Flat/2D on purpose — play3d's ground plane is its whole
 * play surface, so its readers ask this and are right to. A world with verticality wants
 * `containsVolume` instead; see the header.
 */
export function contains(f: Field, x: number, z: number): boolean {
  const dx = x - f.x, dz = z - f.z
  return dx * dx + dz * dz <= f.radius * f.radius
}

/**
 * Is this point inside the field's SLAB — footprint AND height band? The question a voxel world has
 * to ask, because "inside the circle" and "in the fire" stop being the same sentence the moment
 * there is a cave under your feet.
 */
export function containsVolume(f: Field, x: number, y: number, z: number): boolean {
  if (!contains(f, x, z)) return false
  return y >= f.y - FIELD_UNDERBITE && y <= f.y + f.height
}

/** Every live field containing a point. */
export function fieldsAt(fields: Field[], x: number, z: number): Field[] {
  return fields.filter((f) => contains(f, x, z))
}

/** Every live field whose slab contains a point. The 3D sibling of `fieldsAt`. */
export function fieldsAtVolume(fields: Field[], x: number, y: number, z: number): Field[] {
  return fields.filter((f) => containsVolume(f, x, y, z))
}

/** Does a shot crossing this point get eaten? Firewall is cover; a healing grove is not. */
export function blocksShotAt(fields: Field[], x: number, z: number): boolean {
  return fields.some((f) => f.stopsShots && contains(f, x, z))
}

/**
 * The 3D sibling: does a round passing through this point get eaten? Cover has to be something you
 * can shoot OVER, or a Firewall in a valley would stop an arrow crossing the ridge above it.
 */
export function blocksShotAtVolume(fields: Field[], x: number, y: number, z: number): boolean {
  return fields.some((f) => f.stopsShots && containsVolume(f, x, y, z))
}

/**
 * Advance the clocks and report which fields fire an effect tick this frame.
 *
 * Returns the fields whose tick came due (their `nextTick` is rolled forward in the returned list),
 * so the caller applies dps/hps exactly once per FIELD_TICK_MS regardless of frame rate. A field
 * that misses many ticks (tab backgrounded) does NOT burst-apply them — it resyncs to now, because
 * a stack of retroactive damage on unpause is a bug wearing a feature's clothes.
 */
export function tickFields(fields: Field[], now: number): { fields: Field[]; fired: Field[] } {
  const live = expireFields(fields, now)
  const fired: Field[] = []
  const next = live.map((f) => {
    if (now < f.nextTick) return f
    fired.push(f)
    const behind = now - f.nextTick
    // resync rather than replay: skip whole missed intervals
    return { ...f, nextTick: now + FIELD_TICK_MS - (behind % FIELD_TICK_MS) }
  })
  return { fields: next, fired }
}
