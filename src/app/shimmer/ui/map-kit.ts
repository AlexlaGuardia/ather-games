// THE MAP KIT — the drawing both sides' maps share (2026-11-14, Alex: one map home for Athernyx and the Ather,
// "with a toggle just like the game would have"). Lifted out of `voxel3d/VoxelMap.tsx`, where every piece below
// was built and argued for; the comments travelled with the code so the reasons are still next to it.
//
//   drawCloud    the unknown, laid over a finished map from a walked-cells stencil (style per side)
//   drawDoor     the ring: "this is the way through" — one symbol for one thing, on every surface
//   drawDoorPinned  the same ring held on a minimap's rim with a chevron when it is off the crop
//   drawKeeper   you: a dot with a view-cone (heading is a CANVAS rotation, see its note)
//
// ★ PURE 2D CANVAS. No react, no three, no world: a host owns its plate and its coordinates and calls these.
import { isSeen, type Seen } from '../voxel3d/discovery'

/**
 * The door, marked.
 *
 * ★ THE ONE THING A KEEPER OPENS THIS MAP FOR. The fold's only way out is a seam in a wall that is
 * ~1,900 blocks around at the top tier; the whole reason the map is worth fixing is so nobody has to
 * walk the perimeter looking for it again.
 */
/**
 * ── ★★ THE DOOR, ON THE COUNTRY'S MAP TOO (2026-08-19) ─────────────────────────────────────────
 * Alex: *"maybe with a marker on the map as well."* The Wilds map had exactly one mark on it — the
 * keeper — so the fold's passage was findable only by walking a 6.3km wall until the shimmer
 * appeared. This is the same ring the fold's own map wears for its threshold, on purpose: **one
 * symbol for one thing.** A keeper who learns the ring inside their garden reads it instantly out in
 * the country, and both rings mean the same sentence — *this is the way through*.
 *
 * ⚠ IT IS NOT GATED ON HAVING FOUND IT. Canon puts the build's job plainly (`bubble.ts` ›
 * `passageBearing`): *"a single opening in a 6.3km circumference is undiscoverable by exploration,
 * so the build must put the player's arrival AT it rather than hoping they find it."* A fog-of-war
 * rule that hid your own front door until you stumbled on it would be that sentence inverted.
 */
export function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const r = Math.max(4, scale * 1.6)
  ctx.save()
  ctx.strokeStyle = '#ffe9b0'; ctx.lineWidth = Math.max(1.5, scale * 0.35)
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = 'rgba(255,233,176,0.35)'
  ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

/**
 * ── ★★ THE MINIMAP HAD THE RING AND STILL COULD NOT POINT HOME (2026-08-19) ─────────────────────
 * Alex, asking for the door to be marked a second time: *"add a marker on the map to help find
 * it."* It already was — the ring shipped that morning and draws on all four surfaces. **The bug is
 * that the minimap is a WINDOW, not a map.** `MINI_REACH` is 240 blocks and the fold is 600 across,
 * so from most of the garden the door is simply outside the crop and the ring is drawn into the
 * void beyond the canvas edge, where it is not merely small — it does not exist. The one surface a
 * keeper actually navigates by is the one that goes blank exactly when they are lost.
 *
 * ★ SO AN OFF-WINDOW MARK IS PINNED TO THE RIM AND POINTS. **Same ring, never a second symbol** —
 * this file's own rule, *"one symbol for one thing"* — with a chevron added outside it to say *it
 * is this way, further*. A different glyph for "off-map door" would make the keeper learn two marks
 * for one door, and the whole reason the ring reads instantly out in the Wilds is that it is the
 * mark they already know from home.
 *
 * ⚠ THE CHEVRON CARRIES "FURTHER", NOT A DIMMER RING — and the first cut got that backwards. A rim
 * mark states a DIRECTION and cannot state a distance, so it must read differently from an on-window
 * one; I did that by drawing it at 70%, which is correct reasoning applied to the wrong channel. On
 * a **148px** minimap a 5px ring at 70% is not "a softer statement", it is a smudge you do not
 * notice — so the mark that exists for the keeper who is lost was the one that disappeared. The
 * ring now draws at full strength and the CHEVRON is the whole difference: a ring alone means
 * *there it is*, a ring with a barb pointing off-map means *that way, keep going*. Shape carries
 * meaning at any size; opacity does not.
 */
export function drawDoorPinned(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number,
                        w: number, h: number) {
  // ⚠ ROOM FOR THE BARB, not just the ring — pinned at `r` the chevron hangs off the canvas and the
  // one element that says "further" is the one that gets clipped away.
  const pad = Math.max(12, scale * 3.4)
  const cx = Math.min(Math.max(x, pad), w - pad)
  const cy = Math.min(Math.max(y, pad), h - pad)
  if (cx === x && cy === y) { drawDoor(ctx, x, y, scale); return }
  const dx = x - w / 2, dy = y - h / 2
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len
  const r = Math.max(4, scale * 1.6)
  ctx.save()
  // ⚠ A DARK SEAT UNDER THE MARK. The fold's plate is pale green and its wall is near-white cloud;
  // a thin gold ring laid straight on either is a ring you have to already know is there. Same rule
  // the game-UI note states for text over canvas — nothing sits raw on a scene.
  ctx.fillStyle = 'rgba(8,6,20,0.55)'
  ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.fill()
  drawDoor(ctx, cx, cy, scale)
  // The chevron sits OUTSIDE the ring, on the line to the real thing.
  const t = Math.max(4, scale * 1.3)
  ctx.fillStyle = '#ffe9b0'
  ctx.beginPath()
  ctx.moveTo(cx + ux * (r + 2 + t), cy + uy * (r + 2 + t))
  ctx.lineTo(cx + ux * (r + 2) - uy * t * 0.75, cy + uy * (r + 2) + ux * t * 0.75)
  ctx.lineTo(cx + ux * (r + 2) + uy * t * 0.75, cy + uy * (r + 2) - ux * t * 0.75)
  ctx.closePath(); ctx.fill()
  ctx.restore()
}

export const CLOUD = '#e9edf8'          // canon: soft, pale, faintly glowing
export const DEEP = '#080614'           // the star-flecked void beyond the walls
const WALL_GLOW = 0.5

/**
 * ★ HOW THE UNKNOWN LOOKS IS A PROPERTY OF THE SIDE, NOT OF THE MAP (2026-11-14, the one-map-two-sides ask).
 * In the Ather unwalked ground IS cloud, literally (canon, above), so the voxel world's fog is the cloud-ocean.
 * The waking world has no cloud-ocean: there the unknown is what it is on any real map, paper nobody has inked
 * yet. Same stencil, same blur, same "here is what I know" edge; only the colours and the stars change. One
 * kit, so both sides read as ONE map, and each side's unknown is still its own.
 */
export interface CloudStyle { deep: string; cloud: string; glow: number; stars: boolean
  /** How the frontier glow meets the unknown: 'lighter' piles up as glowing wool (cloud), 'multiply' bleeds as ink (paper). */
  blend?: GlobalCompositeOperation }
export const ATHER_CLOUD: CloudStyle = { deep: DEEP, cloud: CLOUD, glow: WALL_GLOW, stars: true }
/** Athernyx: unexplored = bare parchment, its edge a faint sepia bleed where the ink stops. */
export const PARCHMENT: CloudStyle = { deep: '#e6d9b8', cloud: '#8a6a44', glow: 0.55, stars: false, blend: 'multiply' }
const BLUR_WALL = 3.4            // × cell px — how far the glow reaches into the deep
const BLUR_EDGE = 1.15           // × cell px — how soft the walked edge is

// Scratch canvases are module-level and reused: the minimap redraws every time the keeper crosses
// a cell or turns, and building three canvases per redraw is a steady allocation drip for a whole
// session. Same rule `render-audit.test.ts` enforces for GPU objects, applied to 2D.
const scratch: Record<string, HTMLCanvasElement> = {}
function buf(name: string, w: number, h: number): CanvasRenderingContext2D {
  let c = scratch[name]
  if (!c) { c = document.createElement('canvas'); scratch[name] = c }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
  const ctx = c.getContext('2d')!
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, w, h)
  return ctx
}

/** One pixel per cell, white where walked. Cached on `rev` — `see()` mutates in place, so without a
 *  change counter this rebuilds thousands of cells per redraw to produce an identical image. */
let maskRev = -1, maskFor: Seen | null = null
function seenMask(seen: Seen): HTMLCanvasElement {
  if (maskFor === seen && maskRev === seen.rev) return scratch.mask
  const mc = buf('mask', seen.cw, seen.ch)
  mc.fillStyle = '#fff'
  for (let y = 0; y < seen.ch; y++) for (let x = 0; x < seen.cw; x++) if (isSeen(seen, x, y)) mc.fillRect(x, y, 1, 1)
  maskFor = seen; maskRev = seen.rev
  return scratch.mask
}

/** Deterministic stars over the deep — the same unexplored ocean carries the same stars every time
 *  the map is opened. A field that reshuffled per open would read as static, and the void is a
 *  PLACE the keeper has not been, not an effect. */
function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) {
  const n = Math.round((w * h) / (2600 * scale))
  for (let i = 0; i < n; i++) {
    const a = Math.sin(i * 12.9898) * 43758.5453
    const b = Math.sin(i * 78.233) * 43758.5453
    const c = Math.sin(i * 39.425) * 43758.5453
    ctx.fillStyle = `rgba(226,232,255,${(0.25 + (c - Math.floor(c)) * 0.55).toFixed(3)})`
    ctx.fillRect((a - Math.floor(a)) * w, (b - Math.floor(b)) * h, scale, scale)
  }
}

/** Lay the cloud over everything unwalked. Call LAST — it paints over the finished map, so markers
 *  and labels never have to know what is hidden. `ox/oy` shift the stencil for a cropped view. */
export function drawCloud(ctx: CanvasRenderingContext2D, seen: Seen, cellPx: number, ox = 0, oy = 0, style: CloudStyle = ATHER_CLOUD) {
  const w = ctx.canvas.width, h = ctx.canvas.height
  const mask = seenMask(seen)
  const mw = seen.cw * cellPx, mh = seen.ch * cellPx

  const lc = buf('cloud', w, h)
  lc.fillStyle = style.deep
  lc.fillRect(0, 0, w, h)
  if (style.stars) drawStars(lc, w, h, Math.max(1, cellPx * 0.12))

  // the wall: the stencil tinted cloud-pale, blurred wide and ADDED, so neighbouring frontiers pile
  // up like heaped wool instead of flat-topping at one alpha
  const tc = buf('tint', w, h)
  tc.imageSmoothingEnabled = true
  tc.drawImage(mask, ox, oy, mw, mh)
  tc.globalCompositeOperation = 'source-in'
  tc.fillStyle = style.cloud
  tc.fillRect(0, 0, w, h)
  lc.save()
  lc.globalCompositeOperation = style.blend ?? 'lighter'
  lc.globalAlpha = style.glow
  lc.filter = `blur(${(cellPx * BLUR_WALL).toFixed(1)}px)`
  lc.drawImage(scratch.tint, 0, 0)
  lc.restore()

  // punch the walked ground clear, tightly — this edge is what reads as "here is what I know"
  lc.save()
  lc.globalCompositeOperation = 'destination-out'
  lc.filter = `blur(${(cellPx * BLUR_EDGE).toFixed(1)}px)`
  lc.imageSmoothingEnabled = true
  lc.drawImage(mask, ox, oy, mw, mh)
  lc.restore()

  ctx.drawImage(scratch.cloud, 0, 0)
}

/**
 * The keeper: a dot with a view-cone.
 *
 * ★ `heading` is a CANVAS ROTATION from `screenHeading`, not a world yaw — and the cone is drawn
 * along +x so that rotation is the whole transform. The first cut drew the cone pointing UP and
 * rotated by `-yaw`, which is two conventions fighting: it came out exactly 180° backwards, and
 * every single-axis spot check you would think to write still passed. See `map-heading.test.ts`.
 */

export function drawKeeper(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, r: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(heading)
  ctx.fillStyle = 'rgba(232,88,74,0.30)'
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 5, -0.5, 0.5); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#ff6b5a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.restore()
}
