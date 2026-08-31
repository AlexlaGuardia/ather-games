#!/usr/bin/env python3
"""
DRAW A SYNTHETIC AVATAR SO THE REPO SHIPS NO ONE'S FACE AND THE GUARDS KEEP THEIR SUBJECT.

★★★ WHY THIS EXISTS. Alex's avatar art was stripped from HEAD (an AI render whose licence was
never confirmed, in a PUBLIC repo). Deleting it alone would have left two bad options: guards
that assert against files that no longer exist and stand permanently red, or guards that skip
and exit 0 — and PATTERNS is explicit that *"I found no drift"* and *"I could not look"* must
not share an exit code. A committed fixture removes the dilemma instead of choosing a side.

★ IT IS DELIBERATELY PLAIN. This is not a design; it is a subject for the pipeline to act on,
drawn from primitives so it carries no licence and no likeness. Real art goes in as `serberus`
(gitignored) and is selected with `/vtuber?avatar=serberus`.

Run: python3 scripts/vtuber-fixture.py
"""
import pathlib, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1000, 1040
OUT = pathlib.Path("public/vtuber")
CX, CY = W / 2, H * 0.56          # where the mouth sits
MW, MH = W * 0.30, H * 0.052      # mouth half-width, band thickness

BG = (26, 18, 44)
HOOD = (16, 11, 30)
GLOW = (238, 228, 255)


def frame() -> Image.Image:
    """A hooded silhouette on a violet ground. Shadowed face, exactly like the real thing."""
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    # a soft radial lift behind the head so the silhouette reads
    glowimg = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glowimg)
    gd.ellipse([W * 0.16, H * 0.06, W * 0.84, H * 0.86], fill=(62, 40, 104))
    im = Image.blend(im, glowimg.filter(ImageFilter.GaussianBlur(90)), 0.75)
    d = ImageDraw.Draw(im)
    # hood: a pointed arch over the shoulders
    d.polygon([(W * 0.5, H * 0.07), (W * 0.80, H * 0.34), (W * 0.80, H * 0.80),
               (W * 0.20, H * 0.80), (W * 0.20, H * 0.34)], fill=HOOD)
    d.ellipse([W * 0.20, H * 0.55, W * 0.80, H * 1.02], fill=HOOD)
    # the face opening, darker still - nothing in it is ever lit except the mouth
    d.ellipse([W * 0.29, H * 0.22, W * 0.71, H * 0.72], fill=(10, 7, 20))
    return im


def mouth_mask(gap: float, width: float, teeth: int = 11) -> Image.Image:
    """
    A crescent grin, optionally parted by `gap` (in units of band thickness).

    The band follows a parabola so it curves like a smile rather than sitting flat, and the two
    rows are drawn separately with a dark interval between them - which is precisely the
    structure the real art turned out NOT to have, and the reason a set had to be drawn at all.
    """
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    hw = MW * width
    curve = MH * 2.6

    def band(y_off: float, thick: float):
        pts_top, pts_bot = [], []
        for i in range(81):
            t = -1 + 2 * i / 80
            x = CX + t * hw
            y = CY + y_off + curve * (t * t)
            pts_top.append((x, y - thick / 2))
            pts_bot.append((x, y + thick / 2))
        d.polygon(pts_top + pts_bot[::-1], fill=255)

    if gap <= 0.01:
        band(0, MH * 1.9)
    else:
        band(-MH * gap, MH * 0.95)
        band(+MH * gap, MH * 0.80)
    # ⚠⚠ TOOTH DIVIDERS MUST NOT SEVER THE BAND, AND THE CUTTER CAUGHT ME DOING EXACTLY THAT.
    # Full-height dividers split the grin into eleven separate bright regions, so no single
    # component dominated and `vtuber-layers.py` REFUSED the whole avatar (largest region 10%
    # of bright pixels). That refusal is the guard working: a luma cut is only valid when the
    # mouth is the one lit thing. So the dividers are drawn short, centred on the band's own
    # curve, leaving the rows continuous at top and bottom - which is also how real teeth read.
    def divider_y(t: float, y_off: float) -> float:
        return CY + y_off + curve * (t * t)

    spans = [(0.0, MH * 1.9)] if gap <= 0.01 else [(-MH * gap, MH * 0.95), (+MH * gap, MH * 0.80)]
    for k in range(1, teeth):
        t = -1 + 2 * k / teeth
        x = CX + t * hw
        for y_off, thick in spans:
            y = divider_y(t, y_off)
            d.line([(x, y - thick * 0.32), (x, y + thick * 0.32)], fill=0, width=2)
    return m


def compose(mask: Image.Image) -> Image.Image:
    im = frame()
    lit = Image.new("RGB", (W, H), GLOW)
    im.paste(lit, (0, 0), mask)
    bloom = Image.new("RGB", (W, H), (0, 0, 0))
    bloom.paste(lit, (0, 0), mask)
    bloom = bloom.filter(ImageFilter.GaussianBlur(26))
    return Image.fromarray(
        np.clip(np.asarray(im).astype(int) + np.asarray(bloom).astype(int) * 0.75, 0, 255).astype(np.uint8))


def round_mask() -> Image.Image:
    """The pucker: a narrow ring, which no point on the open/shut ramp can reach."""
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    rw, rh = MW * 0.34, MH * 2.6
    d.ellipse([CX - rw, CY - rh, CX + rw, CY + rh], fill=255)
    d.ellipse([CX - rw * 0.52, CY - rh * 0.55, CX + rw * 0.52, CY + rh * 0.55], fill=0)
    return m


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    compose(mouth_mask(0, 1.0)).save(OUT / "fixture-src.png")
    print(f"  fixture-src.png  {W}x{H}")
    vs = OUT / "fixture-visemes-src"
    vs.mkdir(exist_ok=True)
    # gap and width per shape - `wide` is both more open and slightly narrower, because a real
    # mouth's corners come in as it opens.
    for name, gap, width in [("closed", 0.0, 1.00), ("ajar", 1.5, 0.98),
                             ("mid", 3.0, 0.94), ("wide", 5.2, 0.88)]:
        compose(mouth_mask(gap, width)).save(vs / f"viseme-{name}.png")
        print(f"  viseme-{name}.png  gap={gap}")
    compose(round_mask()).save(vs / "viseme-round.png")
    print("  viseme-round.png")
    print("\nnext: python3 scripts/vtuber-layers.py public/vtuber/fixture-src.png --name=fixture")
    print("      python3 scripts/vtuber-visemes-cut.py public/vtuber/fixture-visemes-src --name=fixture")
