#!/usr/bin/env python3
"""
CUT AND REGISTER A MOUTH SET INTO THE BASE ART'S OWN COORDINATES.

★★★ REGISTRATION IS NOT FREE AND MEASURING IS THE ONLY WAY TO KNOW. The five edits came back
at identical pixel dimensions, which LOOKS like alignment and is not: centre-x spread was 32px
(tolerable) but `wide` sat 125px HIGHER than the rest, because the editor moved the whole mouth
up rather than dropping the jaw. Swapping to it would jump the mouth on Alex's face mid-word.
Eyeballing the contact sheet would have shipped that.

★★ THE ANCHOR IS THE TOP OF THE UPPER TEETH, AND THAT IS AN ANATOMICAL CHOICE, NOT A CONVENIENCE.
When a mouth opens, the upper row stays put and the jaw drops. So every shape is pinned by its
topmost lit pixel and its horizontal centre; a shape that is genuinely taller then extends DOWN,
which is what opening looks like. Anchoring on the centroid instead would slide the upper teeth
up as the mouth opened - the same melting read the split-jaw rig had.

★★ ONE SCALE FOR THE WHOLE SET, TAKEN FROM `closed`. Normalising each shape to its own width
would destroy the differences that make them a set: `round` is narrower ON PURPOSE. So `closed`
(which should match the original grin) fixes the scale and every other shape inherits it.

Output is a full-frame RGBA per shape in the SOURCE art's coordinates, so the renderer picks one
and draws it at 0,0 with no transform - the positioning is baked, and there is nowhere for a
second copy of these numbers to drift.

Run: python3 scripts/vtuber-visemes-cut.py <indir> [--name serberus] [--out public/vtuber/visemes]
"""
import sys, json, pathlib
import numpy as np
from PIL import Image
from scipy import ndimage

ORDER = ["closed", "ajar", "mid", "wide", "round"]
CORE_LUMA, GLOW_LUMA = 190, 55
# Once a mouth is open the rows are SEPARATE components, so taking only the largest - which is
# what the single-grin cutter does - would silently drop the lower teeth. Keep every component
# above this share of the biggest.
COMPONENT_FLOOR = 0.03


def luma(a):
    return 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]


def mouth_mask(path: pathlib.Path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    L = luma(a)
    core = L >= CORE_LUMA
    if not core.any():
        sys.exit(f"REFUSED: {path.name} has nothing above luma {CORE_LUMA}")
    lab, n = ndimage.label(core)
    sizes = ndimage.sum(core, lab, range(1, n + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * COMPONENT_FLOOR]
    sel = np.isin(lab, keep)
    halo = ndimage.binary_dilation(sel, iterations=22) & (L >= GLOW_LUMA)
    full = ndimage.binary_dilation(sel, iterations=3) | halo
    alpha = np.clip((L - GLOW_LUMA) / 120.0, 0, 1) * full
    return a, alpha, sel


def main(indir: pathlib.Path, name: str, outdir: pathlib.Path):
    meta = json.loads((pathlib.Path("public/vtuber") / f"{name}.json").read_text())
    M, W, H = meta["mouth"], meta["w"], meta["h"]
    tgt_cx = (M["coreLeft"] + M["coreRight"]) / 2
    tgt_top = M["coreTop"]
    tgt_w = M["coreRight"] - M["coreLeft"]

    cuts = {}
    for s in ORDER:
        p = indir / f"viseme-{s}.png"
        if not p.exists():
            sys.exit(f"REFUSED: missing {p} - the set must be complete or the rig has a hole in its ramp")
        a, alpha, sel = mouth_mask(p)
        ys, xs = np.nonzero(sel)
        w = float(xs.max() - xs.min()); h = float(ys.max() - ys.min())
        cuts[s] = dict(rgb=a, alpha=alpha,
                       cx=float(xs.mean()), top=float(ys.min()), w=w, h=h,
                       # ★★ HOLLOWNESS, NOT HEIGHT. The first version derived openness from the
                       # shape's HEIGHT and could not tell `closed` from `ajar` at all - both
                       # measured 128.2px, because a parted mouth has the same outer extent as a
                       # shut one. What actually changes is how much of that extent is DARK. So
                       # openness is the fraction of the bounding box that is NOT lit, which
                       # ramps cleanly: fill 0.41 shut -> 0.16 wide open.
                       fill=float(sel.sum()) / max(1.0, w * h))

    # ONE scale, from `closed`.
    scale = tgt_w / cuts["closed"]["w"]
    outdir.mkdir(parents=True, exist_ok=True)
    report = {"name": name, "w": W, "h": H, "scale": round(scale, 5), "shapes": {}}

    for s in ORDER:
        c = cuts[s]
        rgba = np.dstack([c["rgb"] * (c["alpha"] > 0)[:, :, None], c["alpha"] * 255]).astype(np.uint8)
        im = Image.fromarray(rgba, "RGBA")
        nw, nh = max(1, int(round(im.width * scale))), max(1, int(round(im.height * scale)))
        im = im.resize((nw, nh), Image.LANCZOS)
        # anchor in the RESIZED image, then translate so it lands on the original grin's anchor
        dx = int(round(tgt_cx - c["cx"] * scale))
        dy = int(round(tgt_top - c["top"] * scale))
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        canvas.alpha_composite(im, (dx, dy)) if (dx >= 0 and dy >= 0) else canvas.paste(im, (dx, dy), im)
        out = outdir / f"{name}-{s}.png"
        canvas.save(out, optimize=True)
        # ★★ RECORD THE ANCHOR WE ACTUALLY ACHIEVED, not the one we aimed at. A guard can then
        # assert the set is registered instead of trusting that this script did its job — and
        # the day someone re-rolls one shape and forgets to re-cut, it goes red.
        acx = c["cx"] * scale + dx
        atop = c["top"] * scale + dy
        report["shapes"][s] = {
            "file": out.name,
            "anchorX": round(acx, 2),
            "anchorTop": round(atop, 2),
            "widthPx": round(c["w"] * scale, 1),
            "heightPx": round(c["h"] * scale, 1),
            "openness": None,
        }
        print(f"  {s:7s} scaled {scale:.3f}  offset ({dx:+5d},{dy:+5d})  "
              f"w {c['w']*scale:6.1f}  h {c['h']*scale:6.1f}  -> {out.name} ({out.stat().st_size/1000:.0f}K)")

    # ★ THE RAMP IS DERIVED FROM THE ART, NOT TYPED. Hand-assigning 0/0.25/0.5/1.0 would be a
    # second copy of a fact the pixels already carry, and it would go stale the first time a
    # shape is re-rolled. `closed` pins 0 and `wide` pins 1; everything else lands where its own
    # hollowness puts it.
    f_shut, f_open = cuts["closed"]["fill"], cuts["wide"]["fill"]
    span = f_shut - f_open
    if span <= 0:
        sys.exit("REFUSED: `wide` is not hollower than `closed` - the set is not an openness ramp")
    for s in ORDER:
        report["shapes"][s]["fill"] = round(cuts[s]["fill"], 4)
        report["shapes"][s]["openness"] = round(max(0.0, min(1.0, (f_shut - cuts[s]["fill"]) / span)), 4)
    # `round` is a pucker, not a point on the openness ramp - it is selected by narrowness.
    report["shapes"]["round"]["openness"] = None
    report["ramp"] = [s for s in ORDER if report["shapes"][s]["openness"] is not None]
    axs = [report["shapes"][s]["anchorX"] for s in ORDER]
    ats = [report["shapes"][s]["anchorTop"] for s in ORDER]
    report["registration"] = {
        "anchorXSpread": round(max(axs) - min(axs), 2),
        "anchorTopSpread": round(max(ats) - min(ats), 2),
    }
    print(f"registration: centre-x spread {report['registration']['anchorXSpread']}px, "
          f"top spread {report['registration']['anchorTopSpread']}px  (of {W}x{H})")
    (outdir / f"{name}-visemes.json").write_text(json.dumps(report, indent=2))
    print(f"\nramp (by measured hollowness): " +
          "  ".join(f"{s}={report['shapes'][s]['openness']:.2f} (fill {report['shapes'][s]['fill']:.3f})"
                    for s in report["ramp"]))
    # ⚠ A ramp that is not strictly increasing means two shapes are interchangeable to the rig,
    # and one of them will simply never be selected. Say so rather than shipping a dead frame.
    vals = [report["shapes"][s]["openness"] for s in report["ramp"]]
    if any(b <= a for a, b in zip(vals, vals[1:])):
        print("  ⚠ WARNING: the ramp is not strictly increasing - a shape in it is unreachable")
    print(f"wrote {outdir}/{name}-visemes.json")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    fl = {a.split("=")[0]: a.split("=")[1] for a in sys.argv[1:] if "=" in a and a.startswith("--")}
    if not args:
        sys.exit(__doc__)
    main(pathlib.Path(args[0]), fl.get("--name", "serberus"),
         pathlib.Path(fl.get("--out", "public/vtuber/visemes")))
