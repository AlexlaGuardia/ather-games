// creature-atlas.ts — the painted 32×32 spirits, laid out for a billboard.
//
// ★ THREE-FREE ON PURPOSE, like `mist-roster.ts` and `mist-difficulty.ts` beside it. Everything that
// can be wrong here — which frame faces you, where a frame sits in the sheet, whether a mirrored
// profile reads as the same animal — is arithmetic, and arithmetic belongs somewhere `npx tsx` can
// interrogate it. The THREE wrapper is a thin shell over this and owns no decisions.
//
// ── ★★ THESE ARE PLACEHOLDERS AND THE INTERFACE IS THE POINT (Alex ruled 2026-08-26) ─────────────
// *"billboard them, but these will only be placeholders for the future 3D models."* So the job here
// is not to make billboards good — it is to make them **cheap to delete**. Everything a caller
// touches is `CreatureBody` (`voxel3d/creature-billboard.ts`), and a modelled implementation
// satisfies the same three members. When the models arrive, the swap is one factory and no call
// site moves. ⚠ Nothing outside that interface may learn that a spirit is currently a flat quad —
// the day something branches on `isSprite`, the placeholder has grown roots.
//
// ── ★ WHY THE ART NEEDED NOTHING PAINTING-SIDE ───────────────────────────────────────────────────
// All ten species canon's mist rosters name are already painted at 32×32 (`sprites/*.ts`), and they
// are already DIRECTIONAL — `down`/`up`/`right`, with left as right mirrored. That format exists
// because a top-down 2D overworld needed it; it happens to be exactly what a camera-facing quad
// needs, so the work lands here for free. **The art debt for spirits was always zero.**
//
// ── ⚠ ONE SHEET PER SPECIES, BUILT ONCE — NOT ONE TEXTURE PER BODY ───────────────────────────────
// Same reasoning `mist-pass.ts` gives for its four element materials, and it matters more here:
// Alex's desktop is an Intel UHD 630 where a texture upload stalls the MAIN THREAD. A patrol of
// three plus a mist resident must not be four uploads of the same rabbit.

import type { SpriteAnim } from '../sprites/sprite-data'

/** The three painted directions. `left` is `right`, mirrored — it is never painted separately. */
export const DIRS = ['down', 'up', 'right'] as const
export type Dir = typeof DIRS[number]

/** The two poses a body in the world is ever in. The sprite files paint both per direction. */
export const POSES = ['idle', 'walk'] as const
export type Pose = typeof POSES[number]

/**
 * ★ THE KEY CONTRACT, READ OFF THE SHIPPED FILES RATHER THAN ASSUMED — and the first version of this
 * module assumed `down` and got an empty atlas for its trouble. `sprites/derive.ts` emits
 * `down_idle` / `up_walk` / … from `deriveSprites`, so the key is `${dir}_${pose}`. Every species
 * goes through that same helper, which is why one convention covers all ten; `creature-atlas.test.ts`
 * asserts that for each of the ten by name, so a species that ever stops using `deriveSprites` fails
 * here instead of rendering an invisible animal.
 */
export const animKey = (dir: Dir, pose: Pose): string => `${dir}_${pose}`

export interface CreatureArt {
  /** The species' raw sprite record, exactly as `sprites/<name>.ts` exports it. */
  anims: Record<string, SpriteAnim>
  /** Palette: index v paints `palette[v - 1]`; 0 is transparent. */
  palette: readonly string[]
}

/**
 * The animation for a direction+pose, with a documented fallback chain.
 *
 * ⚠ FALLS BACK RATHER THAN RETURNING NOTHING, and the order is deliberate: the exact key, then the
 * same direction standing still, then the generic `idle` every species has. An empty billboard reads
 * as a MISSING CREATURE and gets filed as a bug in the encounter; a spirit standing still when it
 * should be walking is wrong in a way a player forgives and a developer can see.
 */
export function animFor(art: CreatureArt, dir: Dir, pose: Pose): SpriteAnim | null {
  const tries = [animKey(dir, pose), animKey(dir, 'idle'), 'idle']
  for (const k of tries) { const a = art.anims[k]; if (a?.frames?.length) return a }
  return null
}

/** Which painted frame answers a viewer, and whether it is drawn mirrored. */
export interface Facing { dir: Dir; mirror: boolean }

/**
 * Pick the painted direction for a body facing `bodyYaw` seen from `viewerYaw`, both radians,
 * both measured the same way (atan2(dz, dx) in world space).
 *
 * ★ THE ANGLE THAT MATTERS IS THE DIFFERENCE, NEVER EITHER ALONE. A body walking north seen from
 * the north shows its face; the same body seen from the south shows its back. Only `viewer - body`
 * decides, which is also why this needs no camera and stays testable.
 *
 * ⚠ FOUR SECTORS, NOT EIGHT, AND THAT IS A KNOWN COST. The art is painted at three directions plus
 * a mirror, so a spirit circled at close range POPS between quadrants — Doom painted eight for
 * exactly this reason. Four more angles per species is real painting and Alex's call; this function
 * is written so raising `DIRS` is the only change (the sector count derives from the boundaries
 * below, it is not spelled twice).
 */
export function facingFor(bodyYaw: number, viewerYaw: number): Facing {
  // Normalise the relative angle into [-PI, PI).
  let a = viewerYaw - bodyYaw
  a = Math.atan2(Math.sin(a), Math.cos(a))
  const q = Math.PI / 4
  if (a >= -q && a < q) return { dir: 'down', mirror: false }        // viewer in front → its face
  if (a >= q && a < 3 * q) return { dir: 'right', mirror: false }    // viewer to one side
  if (a < -q && a >= -3 * q) return { dir: 'right', mirror: true }   // the other side, mirrored
  return { dir: 'up', mirror: false }                                // viewer behind → its back
}

export interface AtlasCell { dir: Dir; pose: Pose; frame: number; x: number; y: number }

export interface CreatureAtlas {
  /** RGBA, `edge * edge` px per cell, `cols * rows` cells. */
  pixels: Uint8Array
  width: number
  height: number
  edge: number
  cols: number
  rows: number
  cells: AtlasCell[]
  /** Cell index for a direction+pose+frame, or -1. */
  index(dir: Dir, pose: Pose, frame: number): number
  /** How many frames that direction+pose resolves to (0 if nothing does). */
  frames(dir: Dir, pose: Pose): number
}

/**
 * Convert one palette-indexed frame to RGBA at `edge`.
 *
 * ★ DERIVES THE SOURCE EDGE FROM THE BUFFER, exactly as `tex/item-icon.ts`'s `flatIconPixels` does,
 * and for the same reason it documents: several sprites are smaller art sitting in a bigger buffer,
 * and anything assuming 32 renders them at quarter scale in the corner. This is a deliberate
 * re-derivation rather than an import: that module is the ITEM-ICON layer and reaching into it from
 * the creature layer would couple two things that only happen to share a pixel format today.
 *
 * ⚠ AN UNKNOWN PALETTE ENTRY DRAWS NOTHING RATHER THAN BLACK — same rule, same reason: a hole is
 * visible, a black pixel silently joins the outline.
 *
 * ★ NO MIRRORED COPY IS BAKED. `Facing.mirror` is answered at draw time by flipping the quad, which
 * is free; baking a second set of cells would double every sheet to say nothing new.
 */
function blit(
  frame: Uint8Array, rgb: ([number, number, number] | null)[],
  out: Uint8Array, outW: number, ox: number, oy: number, edge: number,
): void {
  const src = Math.round(Math.sqrt(frame.length)) || 32
  for (let y = 0; y < edge; y++) {
    const sy = Math.min(src - 1, ((y * src) / edge) | 0)
    for (let x = 0; x < edge; x++) {
      const sx = Math.min(src - 1, ((x * src) / edge) | 0)
      const v = frame[sy * src + sx]
      if (v === 0) continue
      const c = rgb[v - 1]
      if (!c) continue
      const di = ((oy + y) * outW + (ox + x)) * 4
      out[di] = c[0]; out[di + 1] = c[1]; out[di + 2] = c[2]; out[di + 3] = 255
    }
  }
}

function hexRGB(hex: string): [number, number, number] | null {
  const h = hex.trim().replace('#', '')
  if (h.length !== 6 && h.length !== 3) return null
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(f, 16)
  return Number.isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Lay every frame of every direction+pose into ONE sheet.
 *
 * Rows are `DIRS x POSES` in a fixed order, columns are frames, so a caller may compute a UV offset
 * arithmetically instead of consulting `cells`. ★ A row that resolves to nothing STILL OCCUPIES ITS
 * ROW — the row index must stay equal to its position in the fixed order, or one unpainted pose
 * silently shifts every later row up and each creature wears the next one's animation.
 */
export function buildCreatureAtlas(art: CreatureArt, edge = 32): CreatureAtlas {
  const rgb = art.palette.map(hexRGB)
  const slots: { dir: Dir; pose: Pose; anim: SpriteAnim | null }[] = []
  for (const dir of DIRS) for (const pose of POSES) slots.push({ dir, pose, anim: animFor(art, dir, pose) })

  const cols = Math.max(1, ...slots.map(s => s.anim?.frames.length ?? 0))
  const rows = slots.length
  const width = cols * edge, height = rows * edge
  const pixels = new Uint8Array(width * height * 4)
  const cells: AtlasCell[] = []

  slots.forEach(({ dir, pose, anim }, r) => {
    if (!anim) return
    anim.frames.forEach((f, c) => {
      blit(f, rgb, pixels, width, c * edge, r * edge, edge)
      cells.push({ dir, pose, frame: c, x: c * edge, y: r * edge })
    })
  })

  const index = (dir: Dir, pose: Pose, frame: number): number =>
    cells.findIndex(c => c.dir === dir && c.pose === pose && c.frame === frame)
  const frames = (dir: Dir, pose: Pose): number => animFor(art, dir, pose)?.frames.length ?? 0
  return { pixels, width, height, edge, cols, rows, cells, index, frames }
}

/** Which frame is showing at `nowMs`. Resolution (and its fallback) lives in `animFor`. */
export function frameAt(art: CreatureArt, dir: Dir, pose: Pose, nowMs: number): { dir: Dir; frame: number } {
  const anim = animFor(art, dir, pose)
  const use = dir
  if (!anim || !anim.frames.length) return { dir: use, frame: 0 }
  const n = anim.frames.length
  if (n === 1) return { dir: use, frame: 0 }
  // 15 TPS is the rate unit the sprite files are authored in (`SpriteAnim.rate`).
  const TICK_MS = 1000 / 15
  if (anim.durations && anim.durations.length === n) {
    const total = anim.durations.reduce((a, b) => a + b, 0) * TICK_MS
    let t = ((nowMs % total) + total) % total
    for (let i = 0; i < n; i++) {
      const d = anim.durations[i] * TICK_MS
      if (t < d) return { dir: use, frame: i }
      t -= d
    }
    return { dir: use, frame: n - 1 }
  }
  const hold = Math.max(1, anim.rate) * TICK_MS
  return { dir: use, frame: Math.floor(((nowMs % (hold * n)) + hold * n) % (hold * n) / hold) % n }
}
