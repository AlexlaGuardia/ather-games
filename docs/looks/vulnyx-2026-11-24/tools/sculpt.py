"""Vulnyx, CANDIDATE B: a signed-distance sculpt (numpy + scipy, no art asset) -> one closed surface -> decimated -> crisp
colour lines -> glb with nodes `body` + `eyes` (the shape spirit-model.tsx reads: y 0..1, +z = her face, +x = her left, raw
sRGB bytes in COLOR_0).   python sculpt.py <out.glb> [tris]
Reference: base-forms.md section 1 + glim_lumin_01.png (looked at, not traced). One smooth-union field, so the body cannot
have islands or open edges by construction; left and right halves are mirrored from one description (except the tail)."""
import sys, os, json, struct
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from marching import surface
TRIS = 4700
V3 = lambda *a: np.array(a, float)

# ── field helpers (P: (...,3)) ──
def cone(P, a, b, ra, rb):
    """round cone: a capsule whose radius runs ra -> rb"""
    a, b = V3(*a), V3(*b); ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - a - t[..., None] * ab, axis=-1) - (ra + (rb - ra) * t)
def ell(P, c, r, R=None):
    q = P - V3(*c)
    if R is not None: q = q @ R
    r = V3(*r); k = np.linalg.norm(q / r, axis=-1); g = np.linalg.norm(q / (r * r), axis=-1)
    return k * (k - 1) / np.maximum(g, 1e-9)
def su(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0) / k; return np.minimum(a, b) - h * h * k * .25
def ss(a, b, k): return -su(-a, b, k)
def rx(a): c, s = np.cos(a), np.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def rz(a): c, s = np.cos(a), np.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

# ── landmarks (the rig fit reads these) ──
L = dict(head=(0, .565, .255), chest=(0, .395, .13), pelvis=(0, .385, -.165),
         f=[(.080, .38, .150), (.084, .210, .118), (.086, .055, .145)],                       # shoulder, elbow/wrist, paw
         h=[(.080, .35, -.165), (.100, .225, -.105), (.096, .130, -.222), (.096, .04, -.190)],  # hip, knee, hock, paw
         tail=[(0, .415, -.25), (0, .395, -.35), (0, .375, -.47), (0, .40, -.60), (0, .51, -.715), (0, .66, -.765), (0, .80, -.80), (0, .895, -.89), (0, .905, -.965)], tailr=[.050, .068, .110, .145, .158, .148, .100, .045, .004])
EAR_A, EAR_T = V3(.132, .655, .225), V3(.212, .992, .150)

def catmull(pts, n=10):
    p = np.array(pts, float); p = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]]); out = []
    for i in range(1, len(p) - 2):
        for t in np.arange(n) / n:
            out.append(.5 * (2 * p[i] + (p[i + 1] - p[i - 1]) * t + (2 * p[i - 1] - 5 * p[i] + 4 * p[i + 1] - p[i + 2]) * t * t + (3 * p[i] - p[i - 1] - 3 * p[i + 1] + p[i + 2]) * t ** 3))
    return np.array(out + [p[-2]])
TC = catmull([(*a, r) for a, r in zip(L['tail'], L['tailr'])], 5)

def ear(P):
    """an elegant triangle: a flattened cone, its front face scooped"""
    ax = EAR_T - EAR_A; ln = np.linalg.norm(ax); u = ax / ln; q = P - EAR_A
    t = (q @ u) / ln; w = V3(1, 0, 0) - u[0] * u; w = w - w @ V3(0, 0, 1) * V3(0, 0, 0); w /= np.linalg.norm(w); d = np.cross(w, u)   # w across, d front
    x, z = q @ w, q @ d; tc = np.clip(t, -.3, 1.02)
    half = .118 * np.clip(1 - tc, 0, 2) ** .86 * (1 + .10 * np.sin(np.pi * np.clip(tc, 0, 1))) + .004; dep = .50 * half + .006
    k = np.sqrt((x / half) ** 2 + (z / dep) ** 2); body = (k - 1) * np.minimum(half, dep) * .9
    body = np.maximum(body, np.maximum(t - 1.015, -.28 - t) * ln)
    s = np.sqrt((x / np.maximum(half * .70, .004)) ** 2 + ((z - dep * 1.15) / np.maximum(dep * 1.25, .004)) ** 2)
    sc = np.maximum((s - 1) * np.maximum(dep, .004), np.maximum(.10 - t, t - .90) * ln)
    return body, sc

def head(P):
    A = np.abs(P[..., 0]); M = np.stack([A, P[..., 1], P[..., 2]], -1)
    d = ell(M, (0, .605, .235), (.205, .150, .165))
    d = su(d, ell(M, (0, .525, .270), (.195, .095, .130)), .07)                                # broad cheeks
    d = su(d, cone(M, (.11, .545, .255), (.300, .520, .175), .085, .004), .045)                # cheek points
    d = su(d, cone(M, (.10, .505, .250), (.232, .468, .185), .060, .004), .03)
    d = su(d, cone(M, (0, .518, .345), (0, .508, .478), .076, .026), .07)                      # muzzle
    d = su(d, cone(M, (0, .474, .330), (0, .474, .425), .045, .019), .04)                      # chin
    d = su(d, ell(M, (0, .530, .500), (.026, .018, .016)), .008)                               # nose
    d = su(d, cone(M, (0, .72, .27), (0, .800, .245), .040, .003), .04)                        # crown tuft
    e, sc = ear(M); d = su(d, e, .03); return ss(d, sc, .012)

def legs(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); f, h = L['f'], L['h']
    d = cone(M, f[0], f[1], .076, .048); d = su(d, cone(M, f[1], f[2], .048, .042), .03)
    d = su(d, ell(M, (.086, .034, .168), (.050, .034, .062)), .03)
    for x in (-.026, 0, .026): d = su(d, ell(M, (.086 + x, .024, .216), (.0165, .024, .022)), .012)   # toes
    t = ell(M, (.084, .315, -.165), (.068, .122, .108), rx(-.25))                              # haunch
    t = su(t, cone(M, h[0], h[1], .088, .062), .05)
    t = su(t, cone(M, h[1], h[2], .060, .044), .04); t = su(t, cone(M, h[2], h[3], .044, .042), .03)
    t = su(t, ell(M, (.096, .034, -.166), (.050, .034, .066)), .03)
    for x in (-.026, 0, .026): t = su(t, ell(M, (.096 + x, .024, -.116), (.0165, .024, .022)), .012)
    return d, t

def tail(P):
    d = np.full(P.shape[:-1], 9.); Q = P * V3(1, 1, 1)
    for a, b in zip(TC[:-1], TC[1:]): d = np.minimum(d, cone(Q, a[:3], b[:3], a[3], b[3]))
    T = [(.36, -1, .30, .15), (.50, -1, .45, .16), (.60, 1, .55, .14), (.60, -1, .5, .16), (.70, -1, .8, .12)]   # points along the brush
    for u, s, lean, ln in T:
        i = int(u * (len(TC) - 1)); c, r = TC[i, :3], TC[i, 3]; t = TC[min(i + 2, len(TC) - 1), :3] - TC[i - 2, :3]; t /= np.linalg.norm(t)
        for sx, w in ((0, 1.), (.8, .9), (-.8, .9)):
            up = np.cross(t, V3(1, 0, 0)) * s * -1; n = up * (1 - .45 * abs(sx)) + V3(sx, 0, 0); n /= np.linalg.norm(n)
            d = su(d, cone(P, c + n * r * .55, c + n * (r + .022 * w) + t * ln * w, r * .42, .003), .02)
    return d

def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    b = cone(P, (0, .395, .115), (0, .395, -.165), .118, .096)                                 # trunk
    b = su(b, ell(P, (0, .385, .135), (.112, .130, .105)), .05)                                # deep chest
    b = ss(b, ell(P, (0, .215, -.045), (.3, .085, .13)), .07)                                   # the belly tucked up
    b = su(b, cone(P, (0, .44, .17), (0, .53, .225), .098, .092), .06)                         # neck
    for x, y, z, tx, ty, tz, r in ((0, .40, .205, 0, .285, .268, .058), (.052, .41, .19, .062, .315, .250, .050), (0, .345, .20, 0, .245, .228, .05), (.092, .425, .155, .112, .345, .212, .042)):
        b = su(b, cone(M, (x, y, z), (tx, ty, tz), r, .004), .025)                              # chest ruff
    f, h = legs(P); b = su(b, f, .045); b = su(b, h, .05)
    b = su(b, tail(P), .035); return su(b, head(P), .03)

# ── colour classes: one scalar line per class (positive inside), so the edge can be cut into the mesh ──
GOLD, CREAM, PINK, DARK, PAW = [np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)]) for s in ('#f0b41f', '#fff0c8', '#e9a091', '#2a1a12', '#f0b41f')]
zig = lambda u, n: np.abs(((u * n) % 1) - .5) * 2
def classes(V):
    x, y, z = V.T; A = np.abs(x); out = []
    # cream muzzle + lower cheeks (the ref's mask line dips to the nose and rises to the cheek point)
    line = .512 + .030 * np.clip((A - .03) / .22, 0, 1) - .018 * np.exp(-(A / .05) ** 2)
    out.append(np.minimum.reduce([line - y, z - (.150 + .9 * np.clip(.51 - y, 0, .1) + .02 * zig(y + .5, 30)), y - .43, .33 - A]))
    # bib: cream down the chest between the forelegs, ragged lower edge
    out.append(np.minimum.reduce([.105 - A + .25 * np.clip(y - .40, 0, .1) , z - (.105 + .25 * A), y - (.245 + .5 * A + .012 * zig(x + .5, 22)), .535 - y]))
    # tail tip: ragged line across the brush
    d = ((V[:, None] - TC[None, :, :3]) ** 2).sum(-1); i = d.argmin(1); s = i / (len(TC) - 1.); ang = np.arctan2(x, (y - TC[i, 1]) + (z - TC[i, 2]) * .4)
    out.append(np.where(z < -.5, (s - .62) - .10 * zig(ang / (2 * np.pi) + .5, 8), -1.) * .5)
    # ear insides
    M = np.c_[A, y, z]; ax = EAR_T - EAR_A; ln = np.linalg.norm(ax); u = ax / ln; q = M - EAR_A; t = (q @ u) / ln; w = V3(1, 0, 0) - u[0] * u; w /= np.linalg.norm(w); dv = np.cross(w, u)
    half = .118 * np.clip(1 - t, 0, 2) ** .86
    e = np.minimum.reduce([half * .66 - np.abs(q @ w), (q @ dv) + .010, (t - .10) * ln, (.88 - t) * ln]); out.append(e)
    out.append(np.minimum.reduce([e + .0, (.30 + .12 * zig((q @ w) * 1. + .5, 30) - t) * ln]))        # cream fluff at the ear's root
    # nose
    out.append(.030 - np.sqrt(((A) / 1.0) ** 2 + ((y - .532) * 1.25) ** 2 + ((z - .504) * 1.0) ** 2))
    return out
PAL = [CREAM, CREAM, CREAM, PINK, CREAM, DARK]

def cut(V, F, lab, fld):
    """split every triangle the line fld = 0 crosses; returns V, F, lab (per face inherits), and the side flag per face"""
    s = fld.copy(); s[np.abs(s) < 1e-4] = 1e-4; V = list(V); mid = {}; nF, nL, nS = [], [], []
    def m(a, b):
        k = (min(a, b), max(a, b))
        if k not in mid: a, b = k; t = s[a] / (s[a] - s[b]); t = min(.92, max(.08, t)); V.append(V[a] + (V[b] - V[a]) * t); mid[k] = len(V) - 1
        return mid[k]
    for f, l in zip(F, lab):
        sg = [s[i] > 0 for i in f]; c = sum(sg)
        if c in (0, 3): nF.append(f); nL.append(l); nS.append(c == 3); continue
        k = sg.index(True) if c == 1 else sg.index(False); a, b, d = f[k], f[(k + 1) % 3], f[(k + 2) % 3]; p, q = m(a, b), m(a, d)
        nF += [(a, p, q), (p, b, d), (p, d, q)]; nL += [l] * 3; nS += [c == 1, c != 1, c != 1]
    return np.array(V), np.array(nF), np.array(nL), np.array(nS)

def eyes():
    """almond eyes laid on the face surface: dark lid line with a lash flick, cream, amber iris, pupil, catchlight (ref)"""
    parts = []
    def zsurf(X, Y):
        z = np.full(len(X), .50)
        for _ in range(60): z -= np.clip(field(np.stack([X, Y, z], -1)), -.02, .02) * .8
        return z
    def patch(pts, col, dz, rings=3):
        pts = np.array(pts); c = pts.mean(0); n = len(pts); X = [c]
        for r in range(1, rings + 1): X += list(c + (pts - c) * r / rings)
        X = np.array(X); P = np.c_[X, zsurf(X[:, 0], X[:, 1])]
        e = 1e-3; g = np.stack([field(P + np.eye(3)[i] * e) - field(P - np.eye(3)[i] * e) for i in range(3)], -1); g /= np.linalg.norm(g, axis=1, keepdims=True); P = P + g * dz
        F = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
        for r in range(rings - 1):
            a, b = 1 + r * n, 1 + (r + 1) * n
            for i in range(n): j = (i + 1) % n; F += [(a + i, b + i, b + j), (a + i, b + j, a + j)]
        F = np.array(F); nn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
        if (nn * g[F[:, 0]]).sum() < 0: F = F[:, ::-1]
        parts.append((P, F, col))
    for s in (1, -1):
        c = V3(.1135, .588); th = np.linspace(0, 2 * np.pi, 20, endpoint=False)
        def alm(w, h, dx=0, dy=0, tilt=.16):
            x, y = np.cos(th) * w, np.sin(th) * h * (1 + .12 * np.cos(th)); y = np.where(y > 0, y * .66, y); p = np.c_[x * np.cos(tilt) - y * np.sin(tilt), x * np.sin(tilt) + y * np.cos(tilt)] + c + (dx, dy); p[:, 0] *= s; return p
        patch(alm(.060, .050, 0, .003), (42, 24, 14), .003)
        lash = np.array([(.040, .020), (.062, .022), (.090, .041), (.066, .004), (.052, -.002)]) + c; lash[:, 0] *= s; patch(lash, (42, 24, 14), .0032, 2)
        patch(alm(.052, .041), (255, 246, 222), .0045)
        def disc(r, dx, dy, col, dz, ry=1.12, n=16):
            t = np.linspace(0, 2 * np.pi, n, endpoint=False); p = np.c_[np.cos(t) * r, np.sin(t) * r * ry] + c + (dx, dy); p[:, 1] = np.minimum(p[:, 1], c[1] + .022 + .20 * (p[:, 0] - c[0])); p[:, 0] *= s; patch(p, col, dz, 2)
        disc(.0355, -.007, -.001, (120, 58, 14), .006); disc(.0315, -.007, -.001, (226, 128, 26), .0072); disc(.0185, -.007, .001, (28, 16, 10), .0085, 1.15)
        t = np.linspace(0, 2 * np.pi, 10, endpoint=False); p = np.c_[np.cos(t) * .0095, np.sin(t) * .0095] + (c[0] * s + .004, c[1] + .011); patch(p, (255, 255, 250), .0100, 1)
        # the pale brow stroke of the ref
        b = np.array([(-.030, .050), (.005, .066), (.040, .066), (.050, .058), (.008, .057)]) + c; b[:, 0] *= s; patch(b, (255, 226, 140), .0025, 1)
    V, F, C, o = [], [], [], 0
    for P, f, col in parts: V.append(P); F.append(f + o); C.append(np.tile((*np.round(255 * (np.array(col) / 255.) ** 2.2), 255), (len(P), 1))); o += len(P)
    return np.vstack(V), np.vstack(F), np.vstack(C)

def normals(V, F, weld=True):
    n = np.zeros_like(V); fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    for k in range(3): np.add.at(n, F[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
def glb(path, parts):
    bufs, views, accs, meshes, nodes = [], [], [], [], []
    def add(a, ct, ty, tg, norm=False, mm=False):
        off = sum(map(len, bufs)); b = a.tobytes(); bufs.append(b + b'\0' * (-len(b) % 4)); views.append(dict(buffer=0, byteOffset=off, byteLength=len(b), target=tg)); d = dict(bufferView=len(views) - 1, componentType=ct, count=a.size if ty == 'SCALAR' else len(a), type=ty)
        if norm: d['normalized'] = True
        if mm: d['min'], d['max'] = a.min(0).tolist(), a.max(0).tolist()
        accs.append(d); return len(accs) - 1
    for n, (V, F, C, N) in parts.items():
        at = dict(POSITION=add(V.astype(np.float32), 5126, 'VEC3', 34962, mm=True), NORMAL=add(N.astype(np.float32), 5126, 'VEC3', 34962), COLOR_0=add(C.astype(np.uint8), 5121, 'VEC4', 34962, True))
        meshes.append(dict(name=n, primitives=[dict(attributes=at, indices=add(F.astype(np.uint16).ravel(), 5123, 'SCALAR', 34963), mode=4)])); nodes.append(dict(name=n, mesh=len(meshes) - 1))
    blob = b''.join(bufs); j = json.dumps(dict(asset=dict(version='2.0'), scene=0, scenes=[dict(nodes=list(range(len(nodes))))], nodes=nodes, meshes=meshes, accessors=accs, bufferViews=views, buffers=[dict(byteLength=len(blob))]), separators=(',', ':')).encode(); j += b' ' * (-len(j) % 4)
    open(path, 'wb').write(struct.pack('<4sII', b'glTF', 2, 28 + len(j) + len(blob)) + struct.pack('<I4s', len(j), b'JSON') + j + struct.pack('<I4s', len(blob), b'BIN\0') + blob)

def finish(V, F, path, eye, classes_fn=classes, pal=PAL, base=GOLD):
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0)      # flat soles on the ground
    lab = np.full(len(F), -1)
    for k in range(len(pal)):
        V, F, lab, side = cut(V, F, lab, classes_fn(V)[k]); lab = np.where(side, k, lab)
    N = np.stack([field(V + np.eye(3)[i] * .006) - field(V - np.eye(3)[i] * .006) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)      # the field's own slope: no sliver shading
    cols = np.array([pal[k] if k >= 0 else base for k in lab]); key, inv = np.unique(np.c_[F.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    # a soft darker gold underneath / warmer top, as the ref's shading, only on gold
    g = (key[:, 1:] == base).all(1); sh = np.clip(.5 + .5 * NN[:, 1], 0, 1)[:, None]; CC[g, :3] = (np.array([222, 150, 20]) * (1 - sh[g]) + np.array([248, 196, 44]) * sh[g])
    eV, eF, eC = eye; glb(path, dict(body=(VV, FF, CC, NN), eyes=(eV, eF, eC, normals(eV, eF)))); print('body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF))

def decimate(V, F, n):
    """quadric decimation; the first setting whose result is still closed, one piece and near the target"""
    import trimesh, fast_simplification as fs
    for agg in (3, 4, 5, 6, 7):
        for k in (1, .95, .9, 1.05, .85, 1.1):
            v, f = fs.simplify(np.asarray(V, np.float32), np.asarray(F, np.int32), target_count=int(n * k), agg=agg); t = trimesh.Trimesh(v, f, process=False); t.merge_vertices()
            if len(t.faces) < n * 1.4 and t.is_watertight and t.is_winding_consistent and t.body_count == 1: print('agg', agg, k); return t
    raise SystemExit('no closed decimation')

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else TRIS
    import trimesh, fast_simplification as fs
    lo, hi, h = V3(-.341, -.033, -1.101), V3(.341, 1.03, .56), .0078
    V, F = surface(field, lo, hi, h); m = trimesh.Trimesh(V, F, process=False); print('raw', len(F), 'closed', m.is_watertight, 'parts', m.body_count)
    k = max(m.split(only_watertight=False), key=lambda c: len(c.faces)); V, F = k.vertices, k.faces          # a crumb in a crease is dropped
    m = t = decimate(V, F, TRIS); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    finish(np.array(m.vertices), np.array(m.faces), OUT, eyes())
