/**
 * THE COMPOSITOR. FOUR DRAWS, IN AN ORDER THAT MATTERS.
 *
 * ★ SEPARATED FROM THE PAGE SO THE DRAW ORDER IS READABLE IN ONE PLACE. The bloom pass has to
 * come after the mouth and before the eyes, and that is the kind of fact that becomes invisible
 * once it is spread through a component's render body.
 *
 * ⚠ THE ART IS DRAWN WITH OVERSCAN. Head motion translates the whole picture; without a margin
 * the shift walks the art's own edge into frame and the avatar appears to slide off a card that
 * is meant to contain it. `OVERSCAN` must exceed the largest offset `rig()` can produce, which
 * is HEAD_SHIFT (0.018 of width) plus the breath — so 1.05 has roughly 2x headroom, and the
 * guard asserts the relationship rather than the number.
 */
import type { AvatarMeta, RigPose } from './rig'

export const OVERSCAN = 1.05

export interface AvatarImages {
  base: CanvasImageSource
  mouth: CanvasImageSource
}

export interface DrawOptions {
  /** Paint an opaque backdrop first. OBS wants this false so the page composites over the game. */
  opaque: boolean
  /** Bloom radius in canvas px at the mouth's brightest. */
  bloom: number
}

export const DEFAULT_DRAW: DrawOptions = { opaque: true, bloom: 26 }

/**
 * Draw one frame. `pose` comes from `rig()`; nothing here re-derives a transform.
 *
 * ★★ THE MOUTH IS DRAWN FROM A FULL-FRAME LAYER, NOT A SPRITE AT A POSITION. The cutter emits
 * the mouth on a transparent canvas of the ORIGINAL dimensions, so the layer already knows where
 * it belongs and the only transform needed is the scale about its pivot. Cropping it to its own
 * bounding box would mean carrying the box's origin as a second source of truth for the same
 * fact — the hand-kept-mirror shape PATTERNS keeps finding.
 */
export function draw(
  ctx: CanvasRenderingContext2D,
  imgs: AvatarImages,
  meta: AvatarMeta,
  pose: RigPose,
  opts: DrawOptions = DEFAULT_DRAW,
) {
  const { width: W, height: H } = ctx.canvas

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.filter = 'none'
  ctx.clearRect(0, 0, W, H)
  if (opts.opaque) {
    ctx.fillStyle = '#07060c'
    ctx.fillRect(0, 0, W, H)
  }

  // Art space -> canvas, contain-fit with overscan, centred.
  const k = Math.max(W / meta.w, H / meta.h) * OVERSCAN
  const ox = (W - meta.w * k) / 2
  const oy = (H - meta.h * k) / 2

  const place = (p: { x: number; y: number; rotate: number }) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.translate(W / 2, H / 2)
    ctx.rotate(p.rotate)
    ctx.translate(-W / 2, -H / 2)
    ctx.translate(ox + p.x * k, oy + p.y * k)
  }

  // ── 1. the face, mouth already removed by the cutter ──────────────────────────────────────
  place(pose.base)
  ctx.drawImage(imgs.base, 0, 0, meta.w * k, meta.h * k)

  // ── 2. the mouth: a fixed upper row, a dropping lower row, a dark cavity between ──────────
  //
  // ★★★ THE ORDER AND THE CLIPS ARE THE WHOLE TRICK. One flat grin layer is drawn TWICE, each
  // time clipped to one side of `mouth.splitY`, with only the lower draw translated. That is
  // what makes a rigid set of teeth open a mouth instead of stretching into one. The cavity is
  // filled first so both rows overlay its edge, and the bloom pass afterwards rims it in light,
  // which is what sells a glowing mouth as a light source with a hole in it.
  const grinW = meta.mouth.coreRight - meta.mouth.coreLeft
  const drop = pose.jawDrop

  // Put the canvas into "mouth space": placed, tilted, and widened about the grin's own pivot.
  const mouthSpace = () => {
    place(pose.mouth)
    ctx.translate(meta.mouth.pivotX * k, meta.mouth.pivotY * k)
    ctx.scale(pose.mouth.scaleX, 1)
    ctx.translate(-meta.mouth.pivotX * k, -meta.mouth.pivotY * k)
  }

  // the cavity — only once the jaw has actually parted
  if (drop > 0.5) {
    ctx.save()
    mouthSpace()
    // The crescent tapers toward its corners, so a straight band would poke out past the teeth
    // at both ends. Inset grows with the drop because the further the jaw falls the narrower
    // the opening's ends become.
    const inset = grinW * 0.06 + drop * 0.34
    const x0 = (meta.mouth.coreLeft + inset) * k
    const x1 = (meta.mouth.coreRight - inset) * k
    const y0 = meta.mouth.splitY * k
    const y1 = (meta.mouth.splitY + drop) * k
    ctx.fillStyle = '#0d0714'
    ctx.beginPath()
    ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2 + 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // ⚠⚠ A SHUT MOUTH IS DRAWN IN ONE PIECE, AND THAT IS NOT AN OPTIMISATION. Two adjacent clips
  // across a layer with soft alpha do not meet cleanly — the antialiased edges of the two bands
  // leave a visible hairline THROUGH THE TEETH, which is on screen the entire time the avatar is
  // not talking, i.e. most of a stream. Splitting only once the jaw has actually parted puts the
  // seam exactly where a real mouth already has one.
  if (drop <= 0.5) {
    ctx.save()
    mouthSpace()
    ctx.drawImage(imgs.mouth, 0, 0, meta.w * k, meta.h * k)
    ctx.restore()
  } else {
  // the upper row, which never moves
  ctx.save()
  mouthSpace()
  ctx.beginPath()
  ctx.rect(0, 0, meta.w * k, meta.mouth.splitY * k)
  ctx.clip()
  ctx.drawImage(imgs.mouth, 0, 0, meta.w * k, meta.h * k)
  ctx.restore()

  // the lower row, which travels
  // ⚠ THE CLIP IS BUILT BEFORE THE TRANSLATE ON PURPOSE. `clip()` freezes the path in device
  // space under the transform current at that moment, so clipping to where the teeth WILL LAND
  // and then translating into it is what keeps the band and its contents aligned. Clipping
  // after the translate bands the wrong stripe of the face.
  ctx.save()
  mouthSpace()
  ctx.beginPath()
  ctx.rect(0, (meta.mouth.splitY + drop) * k, meta.w * k, meta.h * k)
  ctx.clip()
  ctx.translate(0, drop * k)
  ctx.drawImage(imgs.mouth, 0, 0, meta.w * k, meta.h * k)
  ctx.restore()
  }

  // ── 3. bloom: the whole grin again, blurred and added ─────────────────────────────────────
  // ★ The mouth is a light source, so opening it must put more light on the scene. `pose.glow`
  // rides mouth openness for exactly this; a constant bloom makes a wide-open mouth read as a
  // stretched sticker rather than as something shining.
  const over = Math.max(0, pose.glow - 0.78)
  if (over > 0.001) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = Math.min(0.85, over * 0.9)
    ctx.filter = `blur(${(opts.bloom * (0.5 + over)).toFixed(1)}px)`
    mouthSpace()
    ctx.drawImage(imgs.mouth, 0, 0, meta.w * k, meta.h * k)
    ctx.restore()
    ctx.filter = 'none'
  }

  // ── 4. the hood's eyes, if they are switched on ───────────────────────────────────────────
  if (pose.eyes) {
    const e = pose.eyes
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.translate(W / 2, H / 2)
    ctx.rotate(pose.base.rotate)
    ctx.translate(-W / 2, -H / 2)
    ctx.translate(ox, oy)
    ctx.globalCompositeOperation = 'lighter'
    for (const cx of [e.leftX, e.rightX]) {
      // ry can legitimately reach 0 on a full blink; a zero-radius gradient throws in some
      // engines and draws a dot in others, so the lid closing all the way is a skip, not a draw.
      if (e.ry * k < 0.5) continue
      const g = ctx.createRadialGradient(cx * k, e.y * k, 0, cx * k, e.y * k, e.rx * k * 2.4)
      g.addColorStop(0, `rgba(226, 208, 255, ${(e.opacity).toFixed(3)})`)
      g.addColorStop(0.35, `rgba(168, 122, 255, ${(e.opacity * 0.45).toFixed(3)})`)
      g.addColorStop(1, 'rgba(120, 80, 220, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(cx * k, e.y * k, e.rx * k * 2.4, e.ry * k * 2.4, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
}
