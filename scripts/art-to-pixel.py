#!/usr/bin/env python3
"""Generated art (a flux render, a photo, a painting) → a palette-indexed pixel icon in THIS repo's
contract, headless.

Run: python3 scripts/art-to-pixel.py <in.png> --name GLOVE_T1 [--out-dir DIR] [--size 32]
     [--key auto|#00ff00] [--tol 34] [--colors 7] [--outline] [--method both|lanczos|cell]

── ★ WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────────
Alex ruled 2026-09-04 that game icons no longer wait on his hand. `scripts/png2sprite.mts` already
turns a PIXEL png into the `px()` literal using the editor's own mapping — but it needs art that is
ALREADY 16 or 32 px and already sitting on a small palette. Nothing produced that. This is the step
in front of it: background out, crop, downsample, quantise, and emit an `ITEM_PALETTES`-shaped list
so that png2sprite's mapping is exact instead of a snap.

⚠ EMIT-ONLY, same law as png2sprite. This writes PNGs, a palette line and a literal into an output
directory. It never touches `sprites/items.ts`; `/shimmer/save-sprite` and a human own that file.

── ★ TWO DOWNSAMPLERS, ON PURPOSE, BECAUSE THEY FAIL DIFFERENTLY ──────────────────────────────────
`lanczos`  resizes with a proper filter, then quantises. It keeps thin features alive (a cord, a
           finger gap) by blending them into a half-tone pixel — and that blend is a lie at 32px:
           it invents intermediate colours that then eat palette slots.
`cell`     takes the MEDIAN opaque colour of each source cell and the cell's own opaque coverage as
           alpha. Nothing is invented; every output pixel is a colour that was really there. A
           feature thinner than one cell DISAPPEARS rather than greying out.
Both are written every run. Which one reads better is a judgement about the SUBJECT, so the script
refuses to pick and prints a coverage/edge readout for each instead of a verdict it cannot earn.

── ★ SLOT 0 IS FILLED, DELIBERATELY. READ THIS BEFORE "FIXING" IT ─────────────────────────────────
png2sprite warns when `paletteForItem(id)` returns the DEFAULT palette — the test is
`palette.every((c,i) => c === ITEM_PALETTE[i])`, ALL EIGHT slots. So an entry that keeps slot 0 as
the `#d544c8` sentinel is *not* the default palette and silences the warning anyway, while making
the sentinel index 1 — the slot `nearestPaletteColor` opens on, i.e. the one a near-miss lands in.
That ships magenta out of a palette that claims somebody chose it: strictly worse than either
alternative. Every shipped item fills slot 0 (`worn_blade` opens on '#8a7f6a'), so this does too.
The sentinel stays meaningful because it stays where it means something: an item with NO entry.
"""
import argparse, os, sys, colorsys
from collections import deque
import numpy as np
from PIL import Image

HOUSE_DARK = '#1a1a2e'   # the outline colour worn_blade / goldwood_blade use


def hexc(rgb):
    return '#%02x%02x%02x' % tuple(int(v) for v in rgb)


def lum(rgb):
    r, g, b = [v / 255 for v in rgb]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


# ── 1. background ──────────────────────────────────────────────────────────────────────────────
def _gradmag(f):
    g = np.zeros(f.shape[:2])
    g[1:-1, :] += np.abs(f[2:, :] - f[:-2, :]).sum(axis=2)
    g[:, 1:-1] += np.abs(f[:, 2:] - f[:, :-2]).sum(axis=2)
    return g


def _bg_model(f, bg, cells=24):
    """A coarse median-colour model of the background, interpolated over the whole frame.

    ⚠ THE THING THIS EXISTS FOR: a single key colour is not a background. The flux ground vignettes
    from #884e26 in the corner to #ebcE98 in the middle — an L1 spread of ~335, which is FURTHER than
    the object is from either. Any global key wide enough to take the corner takes the goldwood too.
    So the "key" is a field, not a colour, and every later test is against the LOCAL value.
    """
    h, w, _ = f.shape
    grid = np.full((cells, cells, 3), np.nan)
    for j in range(cells):
        for i in range(cells):
            y0, y1 = h * j // cells, h * (j + 1) // cells
            x0, x1 = w * i // cells, w * (i + 1) // cells
            m = bg[y0:y1, x0:x1]
            if m.mean() > 0.15:
                grid[j, i] = np.median(f[y0:y1, x0:x1][m], axis=0)
    # fill cells the flood never reached (behind the object) from their neighbours, repeatedly
    for _ in range(cells):
        miss = np.isnan(grid[:, :, 0])
        if not miss.any():
            break
        for j, i in zip(*np.where(miss)):
            vals = [grid[j + dj, i + di] for dj, di in ((1, 0), (-1, 0), (0, 1), (0, -1))
                    if 0 <= j + dj < cells and 0 <= i + di < cells and not np.isnan(grid[j + dj, i + di, 0])]
            if vals:
                grid[j, i] = np.mean(vals, axis=0)
    if np.isnan(grid).any():
        grid = np.nan_to_num(grid, nan=float(np.nanmean(grid)))
    return np.array(Image.fromarray(grid.astype(np.uint8), 'RGB').resize((w, h), Image.BILINEAR)).astype(np.int16)


def strip_background(rgb, key, tol, edge=90, model_tol=64, shadow=True):
    """Return (foreground mask, the key colour used).

    An explicit `--key` (a chroma ground, which is what route B generates onto) is one global
    distance test and nothing else — it is exact, so do not dress it up.

    `auto` is for art that was NOT generated on a key, and it is three passes because no one of them
    is right alone:
      (a) EDGE-STOPPED region grow from the border. Each step compares to the pixel it came from, so
          a gradient ground is walked happily; a strong local gradient stops it, so the object's
          rim is a wall. Tolerance alone is not enough — the ground's corner-to-centre spread is
          larger than the gap between ground and object, so a tolerance wide enough to cross the
          vignette also crosses the object's edge and eats it (measured: 2.6% foreground left).
      (b) a LOCAL background model (see `_bg_model`) to reach ground the grow cannot walk to — the
          hole inside a bracelet ring is enclosed by cord and touches no border.
      (c) a shadow test. A cast shadow is the ground scaled down in luminance with its hue intact,
          so it fails (b) and would ship as a grey blob welded to the silhouette. A pixel that is a
          near-uniform dimming of its local ground is ground.
    ⚠ (b) and (c) are the halves that can eat object pixels. The caller prints foreground coverage;
    an implausible number there is the tell, and it is why this reports instead of just returning.
    """
    h, w, _ = rgb.shape
    f = rgb.astype(np.int16)
    if key != 'auto':
        keyc = np.array([int(key[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.int16)
        return ~(np.abs(f - keyc).sum(axis=2) <= tol), keyc

    border = np.concatenate([f[0], f[-1], f[:, 0], f[:, -1]])
    keyc = np.median(border, axis=0)
    g = _gradmag(f)

    bg = np.zeros((h, w), bool)
    q = deque()
    for y, x in [(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)] + \
                [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)]:
        if not bg[y, x]:
            bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        c0 = f[y, x]
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx]:
                if np.abs(f[ny, nx] - c0).sum() <= tol and g[ny, nx] <= edge:
                    bg[ny, nx] = True; q.append((ny, nx))

    B = _bg_model(f, bg)
    bg |= np.abs(f - B).sum(axis=2) <= model_tol
    if shadow:
        ratio = (f + 1) / (B + 1)
        dim = ratio.mean(axis=2)
        spread = ratio.max(axis=2) - ratio.min(axis=2)
        bg |= (dim > 0.55) & (dim < 1.02) & (spread < 0.16)
    return ~bg, keyc


def erode(mask, n):
    """Shave n source pixels off the foreground before downsampling.

    ⚠ WHY IT IS NOT OPTIONAL ON KEYED INPUT: a generator's chroma ground is anti-aliased against the
    object, so the outermost ring of "object" pixels is a BLEND of object and key. A distance test
    keeps them (they are far enough from pure key), the median-cut then spends a palette slot on
    them, and the icon ships with a green rim — visible on three of the first eight route-B pieces.
    Nothing downstream can undo it, because by then it is a legitimate colour in the palette.
    """
    if n <= 0:
        return mask
    m = mask.copy()
    for _ in range(n):
        e = m.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.ones_like(m)
            h, w = m.shape
            ys = slice(max(dy, 0), h + min(dy, 0)); yd = slice(max(-dy, 0), h + min(-dy, 0))
            xs = slice(max(dx, 0), w + min(dx, 0)); xd = slice(max(-dx, 0), w + min(-dx, 0))
            sh[yd, xd] = m[ys, xs]
            e &= sh
        m = e
    return m


def bbox_square(mask, pad_frac=0.06):
    ys, xs = np.where(mask)
    if len(ys) == 0:
        sys.exit('✗ background removal left nothing opaque — raise --tol or pass an explicit --key')
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    side = max(y1 - y0, x1 - x0)
    side = int(side * (1 + 2 * pad_frac))
    cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    return cy - side // 2, cx - side // 2, side


# ── 2/3. downsamplers ──────────────────────────────────────────────────────────────────────────
def down_lanczos(rgb, mask, box, size):
    y, x, side = box
    im = Image.fromarray(np.dstack([rgb.astype(np.uint8), (mask * 255).astype(np.uint8)]), 'RGBA')
    im = im.crop((x, y, x + side, y + side)).resize((size, size), Image.LANCZOS)
    a = np.array(im)
    return a[:, :, :3].astype(np.int16), a[:, :, 3] >= 128


def down_cell(rgb, mask, box, size):
    """Median of each cell's OPAQUE pixels; alpha = cell coverage >= 50%. Invents nothing."""
    y, x, side = box
    h, w, _ = rgb.shape
    out = np.zeros((size, size, 3), np.int16)
    oa = np.zeros((size, size), bool)
    for j in range(size):
        for i in range(size):
            y0, y1 = y + side * j // size, y + side * (j + 1) // size
            x0, x1 = x + side * i // size, x + side * (i + 1) // size
            y0, y1 = max(y0, 0), min(max(y1, y0 + 1), h)
            x0, x1 = max(x0, 0), min(max(x1, x0 + 1), w)
            if y0 >= h or x0 >= w:
                continue
            m = mask[y0:y1, x0:x1]
            if m.size == 0 or m.mean() < 0.5:
                continue
            px = rgb[y0:y1, x0:x1][m]
            out[j, i] = np.median(px, axis=0)
            oa[j, i] = True
    return out, oa


# ── 4. quantise ────────────────────────────────────────────────────────────────────────────────
def quantise(rgb, opaque, ncolors):
    """Median-cut over the opaque pixels only, then nearest-map. Palette sorted dark → light so the
    index order is stable across runs and reads like a ramp in items.ts."""
    pixels = rgb[opaque]
    if len(pixels) == 0:
        sys.exit('✗ nothing opaque to quantise')
    strip = Image.fromarray(pixels.astype(np.uint8).reshape(1, -1, 3), 'RGB')
    pal_img = strip.quantize(colors=ncolors, method=Image.MEDIANCUT, dither=Image.NONE)
    raw = pal_img.getpalette()[: ncolors * 3]
    # ⚠ getpalette() can come back SHORTER than ncolors*3 on flat input — median-cut stops when it
    # runs out of distinct boxes. Slicing past the end yields empty tuples that crash the sort three
    # lines down, so derive the count from what actually came back.
    pal = [tuple(raw[i * 3:i * 3 + 3]) for i in range(len(raw) // 3)]
    # median-cut can return duplicate/unused entries on a flat image; drop them
    used = sorted({p for p in pal}, key=lambda c: lum(c))
    idx = np.zeros(rgb.shape[:2], np.uint8)
    P = np.array(used, np.int16)
    d = np.abs(rgb[:, :, None, :] - P[None, None, :, :]).sum(axis=3)
    idx = d.argmin(axis=2).astype(np.uint8) + 1     # 1-based; 0 = transparent
    idx[~opaque] = 0
    return idx, used


# ── 5. outline ─────────────────────────────────────────────────────────────────────────────────
def add_outline(idx, palette):
    """1px dark rim drawn OUTWARD, into the 1px margin `--outline` reserved at downsample time.

    ⚠ THE FIRST VERSION DREW IT INWARD AND DELETED THE SUBJECT. Inward keeps the silhouette the size
    the crop said it was, which sounds like the careful choice — but every edge pixel of a feature
    thinner than 3px IS the feature, so the bracelet's cord became 100% outline and the whole ring
    went black. Measured, on the tier-1 bracelet: cord gone, three gold discs left floating.
    Outward cannot do that, because it only ever writes into pixels that were transparent — at the
    cost of one pixel of headroom, which is why `main` downsamples to size-2 and insets by 1.
    """
    dark = palette[0]
    if lum(dark) > 0.22:                      # nothing dark enough to read as an outline
        palette = [tuple(int(HOUSE_DARK[i:i + 2], 16) for i in (1, 3, 5))] + palette
        idx = np.where(idx > 0, idx + 1, 0).astype(np.uint8)
    op = idx > 0
    h, w = idx.shape
    near = np.zeros_like(op)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
        sh = np.zeros_like(op)
        ys = slice(max(dy, 0), h + min(dy, 0)); yd = slice(max(-dy, 0), h + min(-dy, 0))
        xs = slice(max(dx, 0), w + min(dx, 0)); xd = slice(max(-dx, 0), w + min(-dx, 0))
        sh[yd, xd] = op[ys, xs]
        near |= sh
    idx = np.where(near & ~op, 1, idx).astype(np.uint8)
    return idx, palette


# ── output ─────────────────────────────────────────────────────────────────────────────────────
def render(idx, palette):
    h, w = idx.shape
    out = np.zeros((h, w, 4), np.uint8)
    for i, c in enumerate(palette, start=1):
        m = idx == i
        out[m] = (*c, 255)
    return Image.fromarray(out, 'RGBA')


def literal(idx, name):
    h, w = idx.shape
    rows = '\n'.join('  ' + ''.join(format(v, 'x') for v in row) for row in idx)
    return f'const {name} = px({w}, {h}, `\n{rows}\n`)'


def palette_line(item_id, palette):
    cols = [hexc(c) for c in palette][:8]
    while len(cols) < 8:                      # ITEM_PALETTES rows are 8 wide in items.ts
        cols.append('#1a1a2e')
    body = ', '.join("'%s'" % c for c in cols)
    return f"  {item_id + ':':<19}[{body}],"


def report(idx, label):
    op = int((idx > 0).sum())
    ncol = len(set(idx.flatten().tolist()) - {0})
    return f'{label:<8} {op:4d}/{idx.size} px opaque ({100*op/idx.size:4.1f}%), {ncol} indices used'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input')
    ap.add_argument('--name', required=True, help='sprite const name, e.g. GLOVE_T1')
    ap.add_argument('--item', default=None, help='item id for the ITEM_PALETTES line (default: name.lower())')
    ap.add_argument('--out-dir', default='.')
    ap.add_argument('--size', type=int, default=32)
    ap.add_argument('--key', default='auto', help='auto | #RRGGBB chroma key')
    ap.add_argument('--tol', type=int, default=34, help='background L1 tolerance (0-765)')
    ap.add_argument('--edge', type=int, default=90, help='auto-key: gradient wall the flood will not cross')
    ap.add_argument('--model-tol', type=int, default=64, help='auto-key: L1 from the local ground model')
    ap.add_argument('--no-shadow', action='store_true', help='auto-key: keep cast shadow as foreground')
    ap.add_argument('--erode', type=int, default=2, help='source px shaved off the mask (kills key fringe)')
    ap.add_argument('--colors', type=int, default=7)
    ap.add_argument('--outline', action='store_true')
    ap.add_argument('--method', default='both', choices=('both', 'lanczos', 'cell'))
    a = ap.parse_args()

    item_id = a.item or a.name.lower()
    os.makedirs(a.out_dir, exist_ok=True)
    src = Image.open(a.input).convert('RGB')
    rgb = np.array(src).astype(np.int16)
    mask, keyc = strip_background(rgb, a.key, a.tol, a.edge, a.model_tol, not a.no_shadow)
    mask = erode(mask, a.erode)
    box = bbox_square(mask)
    print(f'{a.input}  {src.width}x{src.height}  key {hexc(keyc)} tol {a.tol}  '
          f'foreground {100*mask.mean():.1f}%  crop {box[2]}px at ({box[1]},{box[0]})')

    methods = ('lanczos', 'cell') if a.method == 'both' else (a.method,)
    for m in methods:
        inner = a.size - 2 if a.outline else a.size
        low, opa = (down_lanczos if m == 'lanczos' else down_cell)(rgb, mask, box, inner)
        idx, pal = quantise(low, opa, a.colors)
        if a.outline:
            pad = np.zeros((a.size, a.size), np.uint8)
            pad[1:-1, 1:-1] = idx
            idx, pal = add_outline(pad, pal)
        if idx.max() > 15:
            sys.exit('✗ index > 15; px() is hex-digit based. Lower --colors.')
        stem = os.path.join(a.out_dir, f'{item_id}-{m}')
        img = render(idx, pal)
        img.save(stem + '.png')
        img.resize((a.size * 8, a.size * 8), Image.NEAREST).save(stem + '-x8.png')
        open(stem + '.literal.txt', 'w').write(literal(idx, a.name) + '\n')
        open(stem + '.palette.txt', 'w').write(palette_line(item_id, pal) + '\n')
        print('  ' + report(idx, m) + f'  → {stem}.png')
        print('  ' + palette_line(item_id, pal).strip())


if __name__ == '__main__':
    main()
