"""
Rasterize a dumped Hollow mesh to a shaded PNG — the shape question, answered by a picture.

⚠ THE COMPANION TO `hollow_silhouette.py`, NOT A REPLACEMENT. That one draws the blob field; this
one draws the modelled mesh. Rendering them at the SAME camera and scale is the whole point: the
comparison is what "it still looks the same" was a verdict about, and a comparison between two
pictures taken from two cameras is not a comparison.

Run: python3 tools/render/mesh_silhouette.py mesh.json out.png [--res 640] [--yaw 25]
"""
import json, sys
import numpy as np
from PIL import Image

def render(path, out, res=640, yaw=25.0, height=1.75, bg=(16, 16, 20)):
    d = json.load(open(path))
    V = np.array(d["verts"], dtype=np.float64).reshape(-1, 3)
    F = np.array(d["index"], dtype=np.int64).reshape(-1, 3)

    a = np.radians(yaw)
    R = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    P = V @ R.T

    # orthographic, body centred, a fixed world height so every form shares one scale
    cx = (P[:, 0].max() + P[:, 0].min()) / 2
    span = height
    s = res / span
    px = (P[:, 0] - cx) * s + res / 2
    py = res - (P[:, 1] * s) - res * 0.04          # feet near the bottom edge

    img = np.zeros((res, res, 3), dtype=np.float64)
    img[:] = np.array(bg) / 255.0
    zbuf = np.full((res, res), -1e9)

    # ★ SMOOTH VERTEX NORMALS, INTERPOLATED PER PIXEL. Flat face normals make a 16-sided limb look
    # like a cut gem, which is a picture of the RENDERER's choice and not of the body — and the whole
    # reason this file exists is that the last four judgements were made about the wrong layer.
    VN = np.zeros_like(P)
    fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3):
        np.add.at(VN, F[:, k], fn)
    ln_ = np.linalg.norm(VN, axis=1, keepdims=True); ln_[ln_ < 1e-12] = 1
    VN /= ln_

    light = np.array([-0.45, 0.72, 0.53]); light /= np.linalg.norm(light)
    for f in F:
        p = np.stack([px[f], py[f]], axis=1)
        w = P[f]
        n = np.cross(w[1] - w[0], w[2] - w[0])
        ln = np.linalg.norm(n)
        if ln < 1e-12:
            continue
        n /= ln
        if n[2] < 0:                                # back faces: the mesh is closed
            continue
        x0, x1 = int(max(0, np.floor(p[:, 0].min()))), int(min(res - 1, np.ceil(p[:, 0].max())))
        y0, y1 = int(max(0, np.floor(p[:, 1].min()))), int(min(res - 1, np.ceil(p[:, 1].max())))
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        d0 = ((p[1, 0] - p[0, 0]) * (ys - p[0, 1]) - (p[1, 1] - p[0, 1]) * (xs - p[0, 0]))
        d1 = ((p[2, 0] - p[1, 0]) * (ys - p[1, 1]) - (p[2, 1] - p[1, 1]) * (xs - p[1, 0]))
        d2 = ((p[0, 0] - p[2, 0]) * (ys - p[2, 1]) - (p[0, 1] - p[2, 1]) * (xs - p[2, 0]))
        inside = ((d0 >= 0) & (d1 >= 0) & (d2 >= 0)) | ((d0 <= 0) & (d1 <= 0) & (d2 <= 0))
        if not inside.any():
            continue
        z = w[:, 2].mean()
        sel = inside & (z > zbuf[ys, xs])
        if not sel.any():
            continue
        yy, xx = ys[sel], xs[sel]
        zbuf[yy, xx] = z
        # barycentric, so the shading follows the SURFACE and not the tessellation
        area = d0 + d1 + d2
        area[np.abs(area) < 1e-9] = 1e-9
        b0, b1, b2 = (d1 / area)[sel], (d2 / area)[sel], (d0 / area)[sel]
        nn = (VN[f[0]] * b0[:, None] + VN[f[1]] * b1[:, None] + VN[f[2]] * b2[:, None])
        nl = np.linalg.norm(nn, axis=1, keepdims=True); nl[nl < 1e-12] = 1
        lam = np.clip((nn / nl) @ light, 0, 1)
        shade = 0.10 + 0.78 * lam ** 0.9            # dead-flat diffuse, no borrowed spec here
        img[yy, xx] = np.array([0.58, 0.575, 0.60]) * shade[:, None]
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(out)
    print(f"{path} → {out}")

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    kw = {a.split("=")[0][2:]: float(a.split("=")[1]) for a in sys.argv[1:] if a.startswith("--")}
    render(args[0], args[1], res=int(kw.get("res", 640)), yaw=kw.get("yaw", 25.0))
