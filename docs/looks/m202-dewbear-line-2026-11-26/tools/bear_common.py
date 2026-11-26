"""M202 the rest of the Dewbear line: the shared PIPELINE (never a shared body). Each form's own sculpt_<form>.py describes her
body (field, colour classes, palette, landmarks, unlit details); this file only runs the machinery Cragbear's sculpt ran:
marching tetrahedra -> one closed piece -> decimation -> colour cuts -> glb with `body` + `eyes` (the eyes node also carries her
unlit details: runes, lightning veins, bubbles, the mouth line, each laid on her surface as geometry, because a thin colour cut
breaks into dashes on a decimated mesh).
    uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python sculpt_<form>.py <out.glb> [tris]"""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
import sculpt_v2 as S
V3, su, ss, ell, cone = S.V3, S.su, S.ss, S.ell, S.cone
C = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])
mir = lambda P: np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
def rotz(a): c, s = np.cos(a), np.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
def rotx(a): c, s = np.cos(a), np.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def frame(g):
    g = np.array(g, float); g /= np.linalg.norm(g); t = np.cross(g, V3(0, 0, 1) if abs(g[2]) < .9 else V3(1, 0, 0)); t /= np.linalg.norm(t); return np.c_[t, g, np.cross(t, g)]
def lin(c): return np.round(255 * (np.array(c, float) / 255.) ** 2.2)

class Deco:
    """unlit geometry laid on her surface (the `eyes` node): lenses (eyes, bubbles) and ribbons (runes, veins, lines)"""
    def __init__(s, field): s.field, s.V, s.F, s.C, s.o = field, [], [], [], 0
    def grad(s, P):
        e = 1e-3; g = np.stack([s.field(P + np.eye(3)[i] * e) - s.field(P - np.eye(3)[i] * e) for i in range(3)], -1); return g / np.maximum(np.linalg.norm(g, axis=-1, keepdims=True), 1e-9)
    def at(s, th, y, cy=None):
        """points on her surface at polar angle th (0 = her face, +x = her left) and height y, found along the ray out from her axis"""
        th, y = np.atleast_1d(np.asarray(th, float)), np.atleast_1d(np.asarray(y, float)); d = np.stack([np.sin(th), 0 * th, np.cos(th)], -1)
        o = np.stack([0 * th, y if cy is None else 0 * th + cy, 0 * th], -1); a, b = np.zeros(len(th)), np.full(len(th), .9)
        for _ in range(30):
            m = (a + b) / 2; inside = s.field(o + d * m[:, None]) < 0; a, b = np.where(inside, m, a), np.where(inside, b, m)
        P = o + d * b[:, None]; return P, s.grad(P)
    def add(s, v, f, col):
        s.V.append(v); s.F.append(f + s.o); s.o += len(v); s.C.append(np.tile((*lin(col), 255), (len(v), 1)))
    def lens(s, p, r, flat, g, col, sub=2):
        import trimesh
        b = trimesh.creation.icosphere(subdivisions=sub, radius=r); v = b.vertices; g = np.asarray(g, float); v = v + np.outer(v @ g, g) * (flat - 1); s.add(v + p, b.faces, col)
    def ribbon(s, P, N, w, col, lift=.004):
        """a flat strip through the surface points P (normals N), width w, both faces"""
        if len(P) < 2: return
        T = np.gradient(P, axis=0); T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-9); Sd = np.cross(N, T); Sd /= np.maximum(np.linalg.norm(Sd, axis=1, keepdims=True), 1e-9)
        Q = P + N * lift; v = np.vstack([Q + Sd * w / 2, Q - Sd * w / 2]); n = len(P); f = []
        for i in range(n - 1): f += [(i, i + 1, n + i + 1), (i, n + i + 1, n + i)]
        f = np.array(f); s.add(v, np.vstack([f, f[:, ::-1]]), col)
    def stroke(s, th, y, w, col, lift=.004, n=None):
        """a ribbon along a path given in (polar angle, height) on her surface, resampled fine"""
        th, y = np.asarray(th, float), np.asarray(y, float); k = n or (6 if len(th) == 2 else 8 * len(th))
        t = np.linspace(0, len(th) - 1, k); th2, y2 = np.interp(t, np.arange(len(th)), th), np.interp(t, np.arange(len(y)), y); P, N = s.at(th2, y2); s.ribbon(P, N, w, col, lift)
    def mesh(s): return np.vstack(s.V), np.vstack(s.F), np.vstack(s.C)

def rune(rng, th0, y0, sw, sh):
    """a generic glyph in a cell (not a canon rune, a mark like the art's): a stem and two or three branches; returns strokes"""
    out = [([th0, th0], [y0 - sh / 2, y0 + sh / 2])]
    for _ in range(rng.integers(2, 4)):
        a = rng.uniform(-.4, .4); b = rng.choice([-1, 1]); ya = y0 + a * sh; out.append(([th0, th0 + b * sw / 2], [ya, ya + rng.uniform(-.35, .35) * sh]))
    return out

def finish(SM, V, Fa, path):
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(Fa), -1); pal = [C(SM.PAL[k]) for k in SM.ORDER]
    for k in range(len(SM.ORDER)):
        V, Fa, lab, side = S.cut(V, Fa, lab, SM.classes(V)[k]); lab = np.where(side, k, lab)
    ep = .004; N = np.stack([SM.field(V + np.eye(3)[i] * ep) - SM.field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    base = np.array([1, 2, 3]); cols = np.array([pal[k] if k >= 0 else base for k in lab]); key, inv = np.unique(np.c_[Fa.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == base).all(1); sh = np.clip(.5 + .5 * NN[:, 1], 0, 1)[:, None]; CC[g, :3] = C(SM.PAL['lo']) * (1 - sh[g]) + C(SM.PAL['hi']) * sh[g]
    eV, eF, eC = SM.deco(); S.glb(path, dict(body=(VV, FF, CC.astype(np.uint8), NN), eyes=(eV, eF, eC, S.normals(eV, eF))))
    print(SM.NAME, 'body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF), 'bounds', VV.min(0).round(3).tolist(), VV.max(0).round(3).tolist())

def build(SM, out, tris=10000, h=.0058):
    import trimesh
    from marching import surface
    def decimate(V, F, n):
        import fast_simplification as fs
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
    Vr, Fr = surface(SM.field, V3(*SM.LO), V3(*SM.HI), h); m = trimesh.Trimesh(Vr, Fr, process=False); print('raw', len(Fr), 'closed', m.is_watertight, 'parts', m.body_count)
    parts = m.split(only_watertight=False); k = max(parts, key=lambda c: len(c.faces)); print('dropped crumbs', len(parts) - 1, [(len(p.faces), p.centroid.round(2).tolist()) for p in parts if p is not k and len(p.faces) > 60][:12])
    t = decimate(k.vertices, k.faces, tris); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count)
    finish(SM, np.array(t.vertices), np.array(t.faces), out)
