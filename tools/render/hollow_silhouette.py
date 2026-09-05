"""
Render the shipped Hollow blob field to a shaded silhouette PNG — the front end of image-to-3D.

★ WHY (2026-09-05, sprites lane). Text-to-3D has two attractors and nothing in between: name a
person and you get anatomy wearing a FACE, a loincloth and boots; remove every person-word and you
get flawless goop with no body. Counts are ignored as thoroughly as negatives. A Hollow is defined
by being ALMOST a person, so the prompt route cannot reach it. Image-to-3D follows a shape you hand
it, and the shape we hand it is the one canon-derived code already builds.

⚠ THE FIELD IS READ FROM `hollow_field_dump.mts`, WHICH IMPORTS `hollow-pose` — never a copy of its
numbers. A hand-kept mirror of shipped geometry agrees with its source right up until someone edits
one of them, and then it is confidently wrong (PATTERNS 2026-08-22).

Orthographic spheres, nearest-wins, lambert-shaded. Overlapping spheres read as one fused mass
because the 09-05 skeleton solve guarantees every joint overlaps (worst joint +0.16) — so the
silhouette is a body, not beads on a string.

Run: python3 tools/render/hollow_silhouette.py field.json out.png [--res 768]
"""
import json, sys
import numpy as np
from PIL import Image

def render(blobs, res=768, margin=0.12):
    xs = [b["x"] for b in blobs]; ys = [b["y"] for b in blobs]; rs = [b["r"] for b in blobs]
    lo_x = min(x - r for x, r in zip(xs, rs)); hi_x = max(x + r for x, r in zip(xs, rs))
    lo_y = min(y - r for y, r in zip(ys, rs)); hi_y = max(y + r for y, r in zip(ys, rs))
    # One scale for both axes or the body is stretched — the silhouette IS the instruction here.
    span = max(hi_x - lo_x, hi_y - lo_y) * (1 + 2 * margin)
    cx, cy = (lo_x + hi_x) / 2, (lo_y + hi_y) / 2
    px = np.linspace(cx - span / 2, cx + span / 2, res)
    py = np.linspace(cy + span / 2, cy - span / 2, res)          # row 0 = top
    gx, gy = np.meshgrid(px, py)

    depth = np.full((res, res), -1e9)
    normal = np.zeros((res, res, 3))
    hit = np.zeros((res, res), dtype=bool)
    for b in blobs:
        r = b["r"]
        if r <= 1e-4:                                            # a shed piece has radius 0
            continue
        # ELLIPSOIDS, not spheres. `Blob.s` is what makes a mass an egg, a slab or a drip, and a
        # renderer that ignored it would draw the balloon animal this pass exists to remove — the
        # producer/consumer trap, arriving in the instrument instead of in the game.
        sx, sy, sz = b.get("s", [1.0, 1.0, 1.0])
        a, bb, cc = r * sx, r * sy, r * sz
        dx, dy = gx - b["x"], gy - b["y"]
        q = (dx / a) ** 2 + (dy / bb) ** 2
        inside = q < 1.0
        if not inside.any():
            continue
        dz = np.zeros_like(q)
        dz[inside] = cc * np.sqrt(1.0 - q[inside])
        z = b["z"] + dz                                          # camera at +Z, nearest = largest z
        win = inside & (z > depth)
        depth[win] = z[win]
        # Ellipsoid normal is the gradient of (x/a)^2+(y/b)^2+(z/c)^2, i.e. (x/a^2, y/b^2, z/c^2).
        n = np.stack([dx[win] / (a * a), dy[win] / (bb * bb), dz[win] / (cc * cc)], axis=-1)
        normal[win] = n / np.linalg.norm(n, axis=-1, keepdims=True)
        hit |= inside

    key = np.array([-0.45, 0.62, 0.64]); key /= np.linalg.norm(key)
    lam = np.clip((normal * key).sum(-1), 0, 1)
    shade = 0.24 + 0.62 * lam ** 0.85                            # flat-ish: it owns no colour
    img = np.ones((res, res, 3)) * 0.97                          # clean plate, easy to segment
    for c in range(3):
        img[..., c] = np.where(hit, shade, img[..., c])
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    res = int(sys.argv[sys.argv.index("--res") + 1]) if "--res" in sys.argv else 768
    d = json.load(open(src))
    blobs = [b for b in d["blobs"] if b["r"] > 1e-4]
    render(blobs, res).save(dst)
    print(f"{dst}  ·  {d['form']} @ t={d['t']}  ·  {len(blobs)} blobs  ·  {res}px")
