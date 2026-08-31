#!/usr/bin/env python3
"""
CUT A VTUBER AVATAR INTO ITS ANIMATABLE LAYERS, AND EMIT WHERE THEY ARE.

★★ WHY THIS IS A SCRIPT AND NOT A ONE-OFF. The rig needs to know where the mouth's
pivot is, and a pivot is exactly the kind of number that gets measured once, pasted
into a source file, and then silently stops describing the art the day the art is
redrawn. PATTERNS 2026-08-22 calls that a hand-kept mirror: the copy and its source
agree perfectly and are both wrong. So this emits `avatar.json` ALONGSIDE the pixels
and the rig reads it. Re-run the script, the anchors move with the art.

★★ WHY A LUMA THRESHOLD IS ENOUGH FOR THE MOUTH, AND ONLY THE MOUTH. Measured on the
first avatar: the grin is 23,279 px in ONE connected component and 88% of every pixel
above luma 190 in the frame. That is not a lucky threshold, it is a property of the
design — the face is in shadow, so the mouth is the only lit thing on it. A future
avatar without that property must supply its own mask, and this script says so loudly
rather than emitting a confident wrong cut.

⚠ THE FIGURE DOES NOT SEPARATE FROM THE BACKDROP AND THIS SCRIPT DOES NOT PRETEND TO.
Measured: hood interior luma 18.4 / purple-cast 20.3 against backdrop 12.1 / 18.5.
They overlap because the figure is LIT BY the backdrop. Every threshold tried flagged
78-96% of the frame. A cutout needs a real segmentation pass or a hand mask; asking
this script for one gets you a refusal, not a guess.

Run: python3 scripts/vtuber-layers.py <source.png> [--out public/vtuber] [--name default]
"""
import sys, json, os
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

# The mouth is found as the largest bright connected component. These are the dials.
CORE_LUMA   = 190   # a pixel this bright is mouth core
GLOW_LUMA   = 55    # ...and this bright, adjacent to core, is its bloom
CORE_GROW   = 4     # px, so the cut does not slice the teeth's own edge
GLOW_GROW   = 26    # px, how far the bloom is allowed to reach
FILL_RING   = 18    # px ring outside the mouth, sampled to fill the hole it leaves
FEATHER     = 10    # px of the fill that gets blurred, so the patch has no seam

# A mouth that is not overwhelmingly the brightest thing in frame means the avatar
# does not have the shadowed-face property this cut relies on. Refuse rather than guess.
MIN_DOMINANCE = 0.55


def luma(a):
    return 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]


def _profile(grin: np.ndarray, split: float, step: int = 2) -> dict:
    """Per-column bottom edge of the upper row and top edge of the lower row.

    ⚠ Columns where either row has no lit pixel are emitted as null and the renderer skips
    them. Interpolating across a gap would draw cavity where there are no teeth to bound it,
    which at the crescent's tapering ends is exactly where it would show.
    """
    ys, xs = np.nonzero(grin)
    x0, x1 = int(xs.min()), int(xs.max())
    si = int(round(split))
    upper, lower = [], []
    for x in range(x0, x1 + 1, step):
        col = np.nonzero(grin[:, x])[0]
        up = col[col < si]
        lo = col[col >= si]
        upper.append(int(up.max()) if up.size else None)
        lower.append(int(lo.min()) if lo.size else None)
    return {"x0": x0, "step": step, "upperBottom": upper, "lowerTop": lower}


def cut(src: Path, out: Path, name: str):
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    H, W, _ = a.shape
    L = luma(a)

    core = L >= CORE_LUMA
    if not core.any():
        sys.exit(f"REFUSED: nothing in {src.name} is brighter than luma {CORE_LUMA}. "
                 "This cut needs a lit mouth on a shadowed face.")

    lab, n = ndimage.label(core)
    sizes = ndimage.sum(core, lab, range(1, n + 1))
    biggest = int(np.argmax(sizes))
    dominance = sizes[biggest] / core.sum()
    if dominance < MIN_DOMINANCE:
        sys.exit(
            f"REFUSED: the largest bright region is only {dominance:.0%} of the bright pixels "
            f"({n} regions above luma {CORE_LUMA}). This avatar's mouth is not the only lit thing "
            "on it, so a luma cut would take scenery with it. Supply a hand mask instead.")

    grin = lab == (biggest + 1)

    # The LAYER is the teeth plus the light they throw. Grow into the glow, but only
    # where there is actually light, or the dilation eats flat shadow and the layer
    # arrives with a dark square around it.
    halo = ndimage.binary_dilation(grin, iterations=GLOW_GROW) & (L >= GLOW_LUMA)
    mouth = ndimage.binary_dilation(grin, iterations=CORE_GROW) | halo

    # ── layer: the mouth, alpha feathered along its own falloff ─────────────────────
    alpha = np.clip((L - GLOW_LUMA) / 120.0, 0, 1) * mouth
    # ⚠ ZERO THE COLOUR WHERE THE ALPHA IS ZERO. Keeping the original RGB under fully
    # transparent pixels changes nothing on screen and costs a great deal on the wire: the
    # layer is ~97% transparent, and leaving the face's real colours in there gave PNG a
    # full-detail image to compress instead of a flat field. 2.5MB -> a fraction of it, for
    # bytes that can never be drawn.
    rgb = a * (alpha > 0)[:, :, None]
    Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA") \
         .save(out / f"{name}-mouth.png", optimize=True)

    # ── layer: the face with the mouth gone ─────────────────────────────────────────
    # Nothing has to be reconstructed here: what was behind the grin is shadow. Sample
    # the ring just outside it and blur the patch in so there is no seam.
    base = a.copy()
    ring = ndimage.binary_dilation(mouth, iterations=FILL_RING) & ~mouth
    fill = a[ring].mean(axis=0)
    base[mouth] = fill
    blurred = np.asarray(
        Image.fromarray(base.astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))
    ).astype(np.float32)
    soft = ndimage.binary_dilation(mouth, iterations=FEATHER)
    base[soft] = blurred[soft]
    Image.fromarray(base.astype(np.uint8)).save(out / f"{name}-base.png")

    # ── the metadata the rig reads instead of restating ─────────────────────────────
    ys, xs = np.nonzero(mouth)
    gys, gxs = np.nonzero(grin)
    meta = {
        "name": name,
        "source": src.name,
        "w": W, "h": H,
        "mouth": {
            # Pivot at the TOP-CENTRE of the grin on purpose: a jaw drops, it does not
            # inflate from its middle. Scaling this crescent about its centre grows it
            # up into the nose, which is instantly wrong to look at.
            "pivotX": float((gxs.min() + gxs.max()) / 2),
            "pivotY": float(gys.min()),
            # ★★★ WHERE THE JAW HINGES. The first renderer SCALED this crescent vertically to
            # open the mouth, and the result was unmistakable once photographed: the TEETH
            # stretched. A jaw does not stretch, it drops — the upper row holds still, the lower
            # row travels down, and a dark cavity opens between them. So the layer is split here
            # and the two halves are driven separately. 0.55 gives the upper row the larger
            # share, which is how a grin is actually proportioned.
            "splitY": float(gys.min() + (gys.max() - gys.min()) * 0.55),
            "coreTop": float(gys.min()),
            "coreBottom": float(gys.max()),
            "coreLeft": float(gxs.min()),
            "coreRight": float(gxs.max()),
            "box": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
            # ★★★ THE GRIN'S OWN SILHOUETTE, PER COLUMN. The first cavity was a plain ellipse,
            # and against a CURVED crescent it read as a grey lozenge pasted over the teeth —
            # the worst thing in the frame at any zoom. A mouth's interior is bounded by the
            # actual edges of the teeth, so those edges are measured: for every column, the
            # lowest lit pixel of the upper row and the highest lit pixel of the lower row.
            # The renderer fills between them, so the cavity follows the art rather than
            # approximating it.
            "profile": _profile(grin, float(gys.min() + (gys.max() - gys.min()) * 0.55)),
            "corePx": int(grin.sum()),
            "layerPx": int(mouth.sum()),
            "dominance": round(float(dominance), 4),
        },
        # Where a pair of eye glows would sit if the rig is asked to draw them. Derived
        # from the mouth, not typed: eyes ride above it by roughly the grin's own width.
        # ★★★ THE GRIN'S OWN SILHOUETTE, PER COLUMN. The first cavity was a plain ellipse, and
        # against a CURVED crescent it read as a grey lozenge pasted over the teeth — the single
        # worst thing in the frame at any zoom. A mouth's interior is bounded by the actual edges
        # of the teeth, so those edges are measured here: for every column, the lowest lit pixel
        # of the upper row and the highest lit pixel of the lower row. The renderer fills between
        # them, so the cavity follows the art instead of approximating it.
        "eyes": {
            "leftX":  float(gxs.min() + (gxs.max() - gxs.min()) * 0.22),
            "rightX": float(gxs.min() + (gxs.max() - gxs.min()) * 0.78),
            "y":      float(gys.min() - (gxs.max() - gxs.min()) * 0.42),
            "r":      float((gxs.max() - gxs.min()) * 0.085),
        },
        "cut": {"coreLuma": CORE_LUMA, "glowLuma": GLOW_LUMA,
                "coreGrow": CORE_GROW, "glowGrow": GLOW_GROW},
    }
    (out / f"{name}.json").write_text(json.dumps(meta, indent=2))

    print(f"✅ {name}: grin {meta['mouth']['corePx']}px core / {meta['mouth']['layerPx']}px "
          f"with bloom · {dominance:.0%} of bright pixels · pivot "
          f"({meta['mouth']['pivotX']:.0f}, {meta['mouth']['pivotY']:.0f}) of {W}x{H}")
    print(f"   wrote {name}-base.png · {name}-mouth.png · {name}.json  ->  {out}")


if __name__ == "__main__":
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    if not args:
        sys.exit(__doc__)
    flags = {a.split("=")[0]: (a.split("=")[1] if "=" in a else True) for a in sys.argv[1:] if a.startswith("--")}
    out = Path(flags.get("--out", "public/vtuber"))
    out.mkdir(parents=True, exist_ok=True)
    cut(Path(args[0]), out, str(flags.get("--name", "default")))
