// Puppet animation system
// Slices sprites into body parts with anchor points, animates via keyframe transforms
// Resolution-agnostic: works at 32x32 (overworld) and 96x96 (battle)
// At 32x32, stick to offsets/scale. At 96x96, rotation looks clean.

// --- Data Model ---

/** A rectangular region of a source sprite, with a pivot point */
export interface PuppetPart {
  id: string             // 'head', 'torso', 'left_arm', 'right_arm', 'left_leg', 'right_leg'
  x: number              // region top-left in source sprite (pixels)
  y: number
  w: number              // region dimensions
  h: number
  anchorX: number         // pivot point within region (pixels from top-left)
  anchorY: number
  parentId: string | null // null = root part (typically torso)
  attachX: number         // default offset from parent's anchor (pixels)
  attachY: number
  zOrder: number          // draw order — lower = behind
}

/** Per-part transform at a keyframe */
export interface PartTransform {
  offsetX?: number     // pixel delta from default position
  offsetY?: number
  rotation?: number    // degrees (keep small for pixel art — ±5° max at 32px)
  scaleX?: number      // 1.0 = normal
  scaleY?: number
}

/** A point in time with transforms for each part */
export interface PuppetKeyframe {
  tick: number                           // position in timeline (0-based)
  parts: Record<string, PartTransform>   // keyed by part id
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
}

/** A named animation sequence */
export interface PuppetAnimation {
  name: string         // 'idle', 'breathe', 'attack_windup', etc.
  duration: number     // total ticks (at 15 TPS)
  loop: boolean
  keyframes: PuppetKeyframe[]
}

/** Full puppet definition for a sprite */
export interface PuppetDef {
  sourceSize: number       // sprite dimensions (32 or 96)
  parts: PuppetPart[]
  animations: PuppetAnimation[]
}

/** Runtime state for a playing puppet animation */
export interface PuppetState {
  animName: string
  tick: number
  playing: boolean
}

// --- Easing ---

function easeValue(t: number, easing: PuppetKeyframe['easing']): number {
  switch (easing) {
    case 'linear': return t
    case 'ease-in': return t * t
    case 'ease-out': return 1 - (1 - t) * (1 - t)
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
  }
}

// --- Keyframe Interpolation ---

/** Find the two keyframes surrounding `tick` and interpolate transforms */
export function interpolateTransforms(
  anim: PuppetAnimation,
  tick: number,
  partIds: string[],
): Record<string, Required<PartTransform>> {
  const result: Record<string, Required<PartTransform>> = {}
  const identity: Required<PartTransform> = { offsetX: 0, offsetY: 0, rotation: 0, scaleX: 1, scaleY: 1 }

  if (anim.keyframes.length === 0) {
    for (const id of partIds) result[id] = { ...identity }
    return result
  }

  // Wrap tick for looping anims
  const t = anim.loop ? tick % anim.duration : Math.min(tick, anim.duration)

  // Sort keyframes by tick (should already be sorted, but be safe)
  const sorted = [...anim.keyframes].sort((a, b) => a.tick - b.tick)

  // Find surrounding keyframes
  let before = sorted[sorted.length - 1] // wrap-around default
  let after = sorted[0]
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].tick <= t) before = sorted[i]
    if (sorted[i].tick > t && after === sorted[0]) after = sorted[i]
  }

  // Better search: find exact bracket
  let foundAfter = false
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].tick <= t) {
      before = sorted[i]
    } else if (!foundAfter) {
      after = sorted[i]
      foundAfter = true
    }
  }

  // If no keyframe after, use first keyframe (loop wraparound) or clamp
  if (!foundAfter) {
    if (anim.loop) {
      after = sorted[0]
    } else {
      // Past last keyframe — hold
      for (const id of partIds) {
        const pt = before.parts[id]
        result[id] = {
          offsetX: pt?.offsetX ?? 0,
          offsetY: pt?.offsetY ?? 0,
          rotation: pt?.rotation ?? 0,
          scaleX: pt?.scaleX ?? 1,
          scaleY: pt?.scaleY ?? 1,
        }
      }
      return result
    }
  }

  // Calculate interpolation factor
  let span: number
  let progress: number
  if (before === after) {
    progress = 0
  } else if (after.tick > before.tick) {
    span = after.tick - before.tick
    progress = (t - before.tick) / span
  } else {
    // Wrap-around (loop): before is near end, after is near start
    span = (anim.duration - before.tick) + after.tick
    const elapsed = t >= before.tick ? t - before.tick : (anim.duration - before.tick) + t
    progress = elapsed / span
  }

  const easedProgress = easeValue(Math.max(0, Math.min(1, progress)), after.easing)

  for (const id of partIds) {
    const a = before.parts[id] ?? {}
    const b = after.parts[id] ?? {}
    result[id] = {
      offsetX: lerp(a.offsetX ?? 0, b.offsetX ?? 0, easedProgress),
      offsetY: lerp(a.offsetY ?? 0, b.offsetY ?? 0, easedProgress),
      rotation: lerp(a.rotation ?? 0, b.rotation ?? 0, easedProgress),
      scaleX: lerp(a.scaleX ?? 1, b.scaleX ?? 1, easedProgress),
      scaleY: lerp(a.scaleY ?? 1, b.scaleY ?? 1, easedProgress),
    }
  }

  return result
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// --- Part Pixel Extraction ---

/** Extract a rectangular region from a sprite's pixel data */
export function extractPartPixels(
  sourcePixels: Uint8Array,
  sourceSize: number,
  part: PuppetPart,
): Uint8Array {
  const out = new Uint8Array(part.w * part.h)
  for (let py = 0; py < part.h; py++) {
    for (let px = 0; px < part.w; px++) {
      const sx = part.x + px
      const sy = part.y + py
      if (sx >= 0 && sx < sourceSize && sy >= 0 && sy < sourceSize) {
        out[py * part.w + px] = sourcePixels[sy * sourceSize + sx]
      }
    }
  }
  return out
}

// --- Runtime Compositor ---

/** Render a puppet frame to a canvas, applying keyframe transforms */
export function renderPuppet(
  ctx: CanvasRenderingContext2D,
  sourcePixels: Uint8Array,
  palette: readonly string[],
  puppet: PuppetDef,
  anim: PuppetAnimation,
  tick: number,
  flipX: boolean = false,
): void {
  const partIds = puppet.parts.map(p => p.id)
  const transforms = interpolateTransforms(anim, tick, partIds)

  // Build part lookup
  const partMap = new Map<string, PuppetPart>()
  for (const part of puppet.parts) partMap.set(part.id, part)

  // Sort by z-order for draw order
  const sorted = [...puppet.parts].sort((a, b) => a.zOrder - b.zOrder)

  // Compute world positions recursively (parent chain)
  const worldPos = new Map<string, { x: number; y: number; rot: number }>()

  function resolvePosition(part: PuppetPart): { x: number; y: number; rot: number } {
    const cached = worldPos.get(part.id)
    if (cached) return cached

    const tf = transforms[part.id]
    const ox = tf?.offsetX ?? 0
    const oy = tf?.offsetY ?? 0
    const rot = tf?.rotation ?? 0

    let worldX: number, worldY: number, worldRot: number

    if (!part.parentId) {
      // Root part — position relative to sprite origin
      worldX = part.attachX + ox
      worldY = part.attachY + oy
      worldRot = rot
    } else {
      // Child part — offset from parent's anchor
      const parent = partMap.get(part.parentId)!
      const parentPos = resolvePosition(parent)

      // Rotate attachment offset by parent's rotation
      const rad = (parentPos.rot * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const ax = part.attachX + ox
      const ay = part.attachY + oy
      worldX = parentPos.x + ax * cos - ay * sin
      worldY = parentPos.y + ax * sin + ay * cos
      worldRot = parentPos.rot + rot
    }

    const pos = { x: worldX, y: worldY, rot: worldRot }
    worldPos.set(part.id, pos)
    return pos
  }

  // Resolve all positions
  for (const part of sorted) resolvePosition(part)

  // Draw each part
  const size = puppet.sourceSize
  for (const part of sorted) {
    const pos = worldPos.get(part.id)!
    const tf = transforms[part.id]
    const sx = tf?.scaleX ?? 1
    const sy = tf?.scaleY ?? 1

    // Extract part pixels
    const partPixels = extractPartPixels(sourcePixels, size, part)

    // Create part canvas
    const partCanvas = document.createElement('canvas')
    partCanvas.width = part.w
    partCanvas.height = part.h
    const pctx = partCanvas.getContext('2d')!
    drawPixels(pctx, partPixels, palette, part.w, part.h)

    // Draw with transforms
    ctx.save()

    // FlipX the entire puppet if needed
    if (flipX) {
      ctx.translate(size, 0)
      ctx.scale(-1, 1)
    }

    // Translate to world position (part's anchor in sprite space)
    ctx.translate(pos.x, pos.y)

    // Apply rotation around anchor
    if (pos.rot !== 0) {
      ctx.rotate((pos.rot * Math.PI) / 180)
    }

    // Apply scale around anchor
    if (sx !== 1 || sy !== 1) {
      ctx.scale(sx, sy)
    }

    // Draw part centered on anchor
    ctx.drawImage(partCanvas, -part.anchorX, -part.anchorY)

    ctx.restore()
  }
}

/** Draw palette-indexed pixels onto a canvas context */
function drawPixels(
  ctx: CanvasRenderingContext2D,
  pixels: Uint8Array,
  palette: readonly string[],
  w: number,
  h: number,
): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = pixels[y * w + x]
      if (idx === 0) continue
      ctx.fillStyle = palette[idx - 1]
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

// --- Compositor for Renderer integration ---

/** Render puppet to a standalone canvas (for use with Renderer.drawSprite) */
export function renderPuppetToCanvas(
  sourcePixels: Uint8Array,
  palette: readonly string[],
  puppet: PuppetDef,
  anim: PuppetAnimation,
  tick: number,
): HTMLCanvasElement {
  const size = puppet.sourceSize
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  renderPuppet(ctx, sourcePixels, palette, puppet, anim, tick)
  return canvas
}

// --- State Helpers ---

export function createPuppetState(animName: string): PuppetState {
  return { animName, tick: 0, playing: true }
}

export function advancePuppet(state: PuppetState, anim: PuppetAnimation): void {
  if (!state.playing) return
  state.tick++
  if (!anim.loop && state.tick >= anim.duration) {
    state.tick = anim.duration
    state.playing = false
  }
}

// --- Default Templates ---

/** Create a basic 4-part puppet for a bipedal sprite (head, torso, left arm, right arm) */
export function createBipedTemplate(spriteSize: number): PuppetDef {
  const half = Math.floor(spriteSize / 2)
  const quarter = Math.floor(spriteSize / 4)
  const eighth = Math.floor(spriteSize / 8)

  return {
    sourceSize: spriteSize,
    parts: [
      {
        id: 'torso',
        x: quarter, y: quarter,
        w: half, h: half,
        anchorX: Math.floor(half / 2), anchorY: 0,
        parentId: null,
        attachX: Math.floor(spriteSize / 2), attachY: Math.floor(spriteSize / 2),
        zOrder: 1,
      },
      {
        id: 'head',
        x: quarter, y: 0,
        w: half, h: quarter + eighth,
        anchorX: Math.floor(half / 2), anchorY: quarter + eighth,
        parentId: 'torso',
        attachX: 0, attachY: 0,
        zOrder: 2,
      },
      {
        id: 'left_arm',
        x: 0, y: quarter,
        w: quarter, h: half,
        anchorX: quarter, anchorY: eighth,
        parentId: 'torso',
        attachX: -Math.floor(half / 2), attachY: eighth,
        zOrder: 0,
      },
      {
        id: 'right_arm',
        x: spriteSize - quarter, y: quarter,
        w: quarter, h: half,
        anchorX: 0, anchorY: eighth,
        parentId: 'torso',
        attachX: Math.floor(half / 2), attachY: eighth,
        zOrder: 0,
      },
    ],
    animations: [
      {
        name: 'breathe',
        duration: 60, // 4 seconds at 15 TPS
        loop: true,
        keyframes: [
          {
            tick: 0,
            easing: 'ease-in-out',
            parts: {
              head: { offsetY: 0 },
              torso: { scaleY: 1 },
              left_arm: { rotation: 0 },
              right_arm: { rotation: 0 },
            },
          },
          {
            tick: 30,
            easing: 'ease-in-out',
            parts: {
              head: { offsetY: -1 },
              torso: { scaleY: 1.02 },
              left_arm: { rotation: -1 },
              right_arm: { rotation: 1 },
            },
          },
        ],
      },
    ],
  }
}
