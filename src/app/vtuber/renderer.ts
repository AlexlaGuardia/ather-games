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
  /**
   * The registered mouth set, keyed by shape name. When present the renderer draws these and
   * the legacy split-jaw is never reached.
   *
   * ★★★ THESE ARE FULL-FRAME AND ALREADY IN THE BASE ART'S COORDINATES, so drawing one is a
   * composite at 0,0 with no per-shape offset. The cutter baked the registration in, which
   * means there is nowhere for a second copy of those offsets to drift out of sync — the
   * hand-kept-mirror failure this codebase keeps re-learning.
   */
  visemes?: Record<string, CanvasImageSource>
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
  //
  // ⚠⚠⚠ THIS IS A WORKAROUND FOR ART THAT CANNOT DO WHAT IS BEING ASKED OF IT, AND THE
  // MEASUREMENT SAYS SO. `serberus`'s grin is a SOLID SLAB of teeth: luma straight down its
  // middle runs 230-240 unbroken from y=907 to y=991, with no separation between an upper and a
  // lower row anywhere. So `splitY` cuts through solid white, and translating the lower part
  // punches a rectangular hole in a bar rather than opening a mouth.
  //
  // A silhouette-following cavity was built and measured against this and came out WORSE than
  // the ellipse — the profile it follows is the split line itself across the whole centre,
  // because there are no tooth edges in there to find. That path is kept in the cutter
  // (`mouth.profile`) because it is the RIGHT construction for art that has real rows; it is
  // simply not reachable from a closed grin.
  //
  // ★★★ THE REAL FIX IS ART, NOT ARITHMETIC: a closed grin contains no interior, no lower lip
  // and no throat, so no rig can reveal one. Distinct mouth SHAPES are the only thing that makes
  // this read as speech rather than as a trapdoor.
  if (drop > 0.5) {
    ctx.save()
    mouthSpace()
    const inset = grinW * 0.06 + drop * 0.34
    const x0 = (meta.mouth.coreLeft + inset) * k
    const x1 = (meta.mouth.coreRight - inset) * k
    const y0 = meta.mouth.splitY * k
    const y1 = (meta.mouth.splitY + drop) * k
    const g = ctx.createLinearGradient(0, y0, 0, y1)
    g.addColorStop(0, '#050309')
    g.addColorStop(1, '#160d24')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2 + 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // ★★★ THE MOUTH SET IS THE REAL PATH. The legacy split-jaw below it exists only as a fallback
  // for an avatar with no viseme set, and it CANNOT work on `serberus`: that grin is one solid
  // slab of teeth with no upper/lower separation, so splitting it punches a hole in a bar. See
  // the cutter's header for the measurement.
  const vis = pose.viseme
  const vimgs = imgs.visemes
  const haveVisemes = !!(vis && vimgs && vimgs[vis.a] && vimgs[vis.b])

  /** Draw the current mouth representation once, at a global alpha multiplier. */
  const paintMouth = (mul: number) => {
    if (haveVisemes && vis && vimgs) {
      const ramp = 1 - vis.round
      // ⚠ Order matters only for the bloom pass to look right; all three are additive-ish
      // glowing shapes over shadow, so overlap reads as light rather than as a seam.
      const draws: [CanvasImageSource, number][] = [
        [vimgs[vis.a], (1 - vis.t) * ramp * mul],
        [vimgs[vis.b], vis.t * ramp * mul],
      ]
      if (vis.round > 0.001 && vimgs.round) draws.push([vimgs.round, vis.round * mul])
      for (const [img, alpha] of draws) {
        if (alpha <= 0.002) continue
        ctx.save()
        mouthSpace()
        ctx.globalAlpha = alpha
        ctx.drawImage(img, 0, 0, meta.w * k, meta.h * k)
        ctx.restore()
      }
      return
    }
    ctx.save()
    ctx.globalAlpha = mul
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
  // The recession, about the grin's own centre so it shrinks toward the middle of the face
  // rather than toward the canvas origin.
  const cx = (meta.mouth.coreLeft + meta.mouth.coreRight) / 2 * k
  ctx.translate(cx, meta.mouth.splitY * k)
  ctx.scale(pose.jawScale, pose.jawScale)
  ctx.translate(-cx, -meta.mouth.splitY * k)
  ctx.drawImage(imgs.mouth, 0, 0, meta.w * k, meta.h * k)
  ctx.restore()
  }


    ctx.restore()
  }

  paintMouth(1)

  // ── 3. bloom: the same mouth again, blurred and added ─────────────────────────────────────
  // ★ The mouth is a light source, so opening it must put more light on the scene. `pose.glow`
  // rides mouth openness for exactly this; a constant bloom makes a wide-open mouth read as a
  // stretched sticker rather than as something shining.
  const over = Math.max(0, pose.glow - 0.78)
  if (over > 0.001) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.filter = `blur(${(opts.bloom * (0.5 + over)).toFixed(1)}px)`
    paintMouth(Math.min(0.85, over * 0.9))
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
