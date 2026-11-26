"""M202 Manalotl line (Aurlotl / Arclotl / Craglotl): the shared machinery of sculpt_marlotl_v2.py, lifted so each form's
sculpt file holds only HER body. Every form is sculpted in Marlotl's number space (same head scale, same ground), so the
line can share one world scale in the game and reads at true relative size. Form module M must define:
  field(P), body(P), classes(V) -> list (positive inside, later wins), ORDER, PAL, DY, EYE (|x|, y), EYE_R, IRIS (rgb),
  SMILE_W, SMILE(x), BOUNDS (lo, hi), optional EXTRA_EYES(lens, project) for unlit geometry marks (fine lines, glyph strokes)."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
import sculpt_v2 as S
V3, su, ss, ell, cone = S.V3, S.su, S.ss, S.ell, S.cone
C = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])
mir = lambda P: np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)

def box(fn, P, lo, hi):
    """fn only inside the box (9 elsewhere): the dense march evaluates millions of points"""
    sh = P.shape[:-1]; Q = P.reshape(-1, 3); m = np.all((Q >= lo) & (Q <= hi), 1); out = np.full(len(Q), 9.)
    if m.any(): out[m] = fn(Q[m])
    return out.reshape(sh)

def polyline(M, pts, r0, r1):
    """a tapering tube along points"""
    pts = [V3(*p) for p in pts]; n = len(pts) - 1; d = np.full(M.shape[:-1], 9.)
    for i in range(n):
        d = np.minimum(d, cone(M, pts[i], pts[i + 1], r0 + (r1 - r0) * i / n, r0 + (r1 - r0) * (i + 1) / n))
    return d

def seg_t(M, pts):
    """distance to a polyline + how far along it (0..1) the nearest point is"""
    pts = [V3(*p) for p in pts]; L = np.cumsum([0] + [np.linalg.norm(b - a) for a, b in zip(pts[:-1], pts[1:])]); best = np.full(M.shape[:-1], 9.); t = np.zeros(M.shape[:-1])
    for i, (a, b) in enumerate(zip(pts[:-1], pts[1:])):
        ab = b - a; s = np.clip(((M - a) @ ab) / (ab @ ab), 0, 1); dd = np.linalg.norm(M - (a + s[..., None] * ab), axis=-1); w = dd < best
        best = np.where(w, dd, best); t = np.where(w, (L[i] + s * np.linalg.norm(ab)) / L[-1], t)
    return best, t

def project(field, p, axis=2, it=60):
    """march p along -axis onto the surface"""
    p = np.array(p, float); e = np.eye(3)[axis]
    for _ in range(it): p = p - e * np.clip(field(p[None])[0], -.02, .02) * .8
    return p
def grad(field, p):
    g = np.array([(field((p + np.eye(3)[i] * 1e-3)[None]) - field((p - np.eye(3)[i] * 1e-3)[None]))[0] for i in range(3)]); return g / np.linalg.norm(g)

def eyes(M):
    """Marlotl v2's eye recipe (a ring round a black pupil, big + small catchlights, a lens flattened into the face) + the smile
    as a line of geometry, + any extra marks; all unlit, all on the head bone"""
    import trimesh
    Vs, Fs, Cs, o = [], [], [], 0
    def lens(c, r, flat, g, col, sub):
        nonlocal o
        b = trimesh.creation.icosphere(subdivisions=sub, radius=r); v = b.vertices; v = v + np.outer(v @ g, g) * (flat - 1)
        Vs.append(v + c); Fs.append(b.faces + o); o += len(v); Cs.append(np.tile((*np.round(255 * (np.array(col) / 255.) ** 2.2), 255), (len(v), 1)))
    for s in (1, -1):
        p = project(M.field, (s * M.EYE[0], M.EYE[1] - M.DY, .95)); g = grad(M.field, p)
        t = np.cross(g, V3(0, 1, 0)); t /= np.linalg.norm(t); u = np.cross(t, g)
        if t[0] * s < 0: t = -t
        lens(p + g * .004, M.EYE_R, .42, g, M.IRIS, 3)
        lens(p + g * .012, M.EYE_R * .70, .40, g, (6, 7, 10), 3)
        lens(p + g * .030 + t * .018 + u * .021, M.EYE_R * .25, .5, g, getattr(M, 'SHINE', (255, 255, 250)), 2)
        lens(p + g * .028 - t * .015 - u * .018, M.EYE_R * .11, .5, g, (205, 232, 240), 1)
    for x in np.linspace(-M.SMILE_W, M.SMILE_W, 33):
        p = project(M.field, (x, M.SMILE(x) - M.DY, .95)); lens(p, .0066, .45, grad(M.field, p), getattr(M, 'SMILE_COL', (40, 30, 30)), 1)
    if hasattr(M, 'EXTRA_EYES'): M.EXTRA_EYES(lens, lambda q, axis=2: project(M.field, q, axis), lambda p: grad(M.field, p))
    return np.vstack(Vs), np.vstack(Fs), np.vstack(Cs)

def finish(M, V, Fa, path, name):
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(Fa), -1); pal = [C(M.PAL[k]) for k in M.ORDER]
    for k in range(len(M.ORDER)):
        V, Fa, lab, side = S.cut(V, Fa, lab, M.classes(V)[k]); lab = np.where(side, k, lab)
    ep = .004; N = np.stack([M.field(V + np.eye(3)[i] * ep) - M.field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    base = np.array([1, 2, 3]); cols = np.array([pal[k] if k >= 0 else base for k in lab]); key, inv = np.unique(np.c_[Fa.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == base).all(1); sh = np.clip(.5 + .5 * NN[:, 1], 0, 1)[:, None]; CC[g, :3] = C(M.PAL['lo']) * (1 - sh[g]) + C(M.PAL['hi']) * sh[g]
    eV, eF, eC = eyes(M); S.glb(path, dict(body=(VV, FF, CC.astype(np.uint8), NN), eyes=(eV, eF, eC, S.normals(eV, eF)))); print(name, 'body tris', len(FF), 'verts', len(VV))

def run(M, name):
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
    import trimesh, fast_simplification as fs
    from marching import surface
    def decimate(V, F, n):
        best = None
        for agg in (3, 4, 5, 6):
            for k in (1, .95, 1.05, .9, 1.1):
                v, f = fs.simplify(np.asarray(V, np.float32), np.asarray(F, np.int32), target_count=int(n * k), agg=agg); t = trimesh.Trimesh(v, f, process=False); t.merge_vertices()
                c = np.unique(t.edges_sorted, axis=0, return_counts=True)[1]
                if t.body_count == 1 and (c % 2).sum() == 0 and len(t.faces) < n * 1.4:
                    p = int((c > 2).sum()); best = (p, t) if best is None or p < best[0] else best
                    if p == 0: return t
        if best is None: raise SystemExit('no closed decimation')
        print('pinched edges', best[0]); return best[1]
    lo, hi = M.BOUNDS; Vr, Fr = surface(M.field, V3(*lo), V3(*hi), .0062); m = trimesh.Trimesh(Vr, Fr, process=False); print('raw', len(Fr), 'closed', m.is_watertight, 'parts', m.body_count)
    parts = m.split(only_watertight=False); k = max(parts, key=lambda c: len(c.faces)); print('dropped crumbs', len(parts) - 1, [len(p.faces) for p in parts if p is not k][:12])
    t = decimate(k.vertices, k.faces, TRIS); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    finish(M, np.array(t.vertices), np.array(t.faces), OUT, name)
