"""Dewbear base form: a signed-distance sculpt (numpy + scipy, no art asset), the Vulnyx v2 / Athowl route.   python sculpt.py <out.glb> [tris]
-> one closed surface -> decimated -> crisp colour lines -> glb nodes `body` + `eyes` (y 0..1, +z = her face, sRGB bytes on the body,
linear bytes on the unlit part: eyes, lids and the light lying in the seams between the plates). Reference: base-forms.md section 9 +
dewbear_final_01.png (looked at, not traced). A tardigrade: six back plates over a pale belly, EIGHT legs in four pairs, no mouth."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
from marching import surface
from sculpt_v2 import cone, ell, su, ss, cut, glb, normals, V3
TRIS = 4600; LID = .085
# ── back plates, front to back: z, top, half width, half length, hem height ──
PL = [(.265, .930, .425, .205, .250), (.100, .995, .480, .200, .225), (-.075, 1.0, .500, .200, .205), (-.250, .935, .480, .195, .195), (-.415, .805, .420, .185, .190), (-.555, .620, .325, .165, .185)]
NP = len(PL)
def sup(P, c, r, e=(2.3, 2.3, 2.0)):
    """a rounded square: super-ellipsoid, distance to first order"""
    q = np.abs(P - V3(*c)) / V3(*r); t = np.sum(q ** np.array(e), -1); f = np.sqrt(np.maximum(t, 1e-9))
    g = np.array(e) * np.maximum(q, 1e-6) ** (np.array(e) - 1) / V3(*r) / (2 * f[..., None]); return (f - 1) / np.maximum(np.linalg.norm(g, axis=-1), 1.4)
def plates(M):
    out = []
    for z, top, w, c, hem in PL:
        yc = .40 if top > .7 else .34; out.append(-su(-sup(M, (0, yc, z), (w, top - yc, c)), M[..., 1] - hem + .12 * (M[..., 2] - z), .05))
    return out
HC = V3(0, .592, .515)
def head(M):
    d = ell(M, HC, (.310, .290, .262)); d = su(d, ell(M, HC + V3(.150, -.085, .080), (.168, .150, .160)), .11)      # full round cheeks, widest below the eyes
    d = su(d, ell(M, HC + V3(0, .0, -.16), (.23, .21, .20)), .10)
    return su(d, ell(M, (0, .545, .748), (.078, .054, .040)), .06)                                             # a broad soft muzzle
# legs: hip (hidden in the flank), knee, sole centre; radii
LEG = [((.215, .300, .375), (.262, .170, .410), (.270, .055, .420), .100, .100, .078), ((.24, .28, .175), (.300, .160, .170), (.312, .055, .180), .105, .110, .080), ((.24, .28, -.085), (.312, .160, -.085), (.324, .055, -.075), .108, .112, .080), ((.21, .26, -.345), (.275, .155, -.345), (.288, .055, -.335), .100, .105, .077)]
def leg(M, i):
    a, b, c, ra, rb, rc = LEG[i]; b, c = V3(*b), V3(*c); d = su(cone(M, a, b, ra, rb), cone(M, b, c, rb, rc), .05)
    d = su(d, ell(M, c + V3(.004, -.010, .022), (.082, .048, .082)), .03)
    for dx, dz in ((-.058, .078), (0, .100), (.058, .078)): t = c + V3(dx, -.028, dz); d = su(d, cone(M, c + V3(dx * .6, -.014, dz * .4), t, .034, .028), .006)
    return d
def belly(M):
    d = sup(M, (0, .335, -.06), (.370, .275, .50), (2.6, 2.4, 2.6)); d = su(d, ell(M, (0, .40, .30), (.27, .26, .19)), .06)
    return d + .010 * np.cos((M[..., 2] - .025) * 2 * np.pi / .18) * np.clip((.36 - M[..., 1]) / .1, 0, 1)           # soft belly folds
def tail(P): return cone(P, (0, .235, -.57), (0, .135, -.735), .115, .052)
def shell(M):
    d = None
    for q in plates(M): d = q if d is None else su(d, q, .034)
    return d
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); d = su(belly(M), tail(P), .05); l = np.full(P.shape[:-1], 9.)
    for i in range(4): l = np.minimum(l, leg(M, i))
    d = su(d, l, .035); d = su(d, shell(M), .016); d = su(d, head(M), .022)
    return d
DEW = [(0, .30, .02, .022), (0, 1.02, .0, .020), (0, 1.42, .02, .030), (1, .55, .03, .028), (1, 1.10, -.02, .034), (1, 1.52, .04, .026), (2, .36, -.02, .024), (2, .86, .02, .034), (2, 1.40, -.01, .030), (3, .60, .0, .028), (3, 1.12, -.01, .036), (4, .85, .0, .028), (4, 1.40, -.01, .026)]
def ray(p, u, hi):
    """out along u from p to the skin; p, u are (n, 3) or (3,)"""
    p, u = np.broadcast_arrays(np.atleast_2d(p), np.atleast_2d(u)); lo, hi = np.zeros(len(p)), np.full(len(p), hi)
    for _ in range(22): m = (lo + hi) / 2; f = field(p + u * m[:, None]) < 0; lo, hi = np.where(f, m, lo), np.where(f, hi, m)
    return p + u * lo[:, None]
def strip(parts, rows, dz, cols):
    """a soft line laid on the skin: ink at its edges running into warm light in the middle (vertex colours, unlit)"""
    n = len(rows[0]); P = np.vstack(rows); P = P + grad(P, .012) * (dz - np.clip(field(P), -.02, .02))[:, None]; C = np.repeat(np.array(cols, float), n, 0); F = np.array([x for c in range(0, n * (len(rows) - 1), n) for k in range(c, c + n - 1) for x in ((k, k + 1, n + k + 1), (k, n + k + 1, n + k))])
    if (np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]) * grad(P[F].mean(1))).sum() < 0: F = F[:, ::-1]
    parts.append((P, F, C))
def extras():
    """unlit: the light in the seams (a ribbon along each crease) and the dew beads on the plates"""
    parts = []
    for i in range(NP):                                                                  # seam between plate i - 1 and i (0 = the head's own rim)
        f = (lambda M: head(M)) if i == 0 else (lambda M, k=i - 1: plates(M)[k]); n = 23; L, Rr = [], []
        t = np.linspace(-1, 1, n); th = t * (2.0 if i else 1.75); u = np.c_[np.sin(th), np.cos(th), 0 * th]; z = (PL[i - 1][0] + PL[i][0]) / 2 if i else .40; yc = .52 if i < 5 else .42; at = lambda z: ray(np.c_[0 * z, 0 * z + yc, z], u, .75)
        a, b = np.full(n, z - (.10 if i else .02)), np.full(n, z + (.10 if i else .16))
        for _ in range(14): m = (a + b) / 2; p = at(m); M = np.c_[np.abs(p[:, 0]), p[:, 1:]]; k = f(M) < plates(M)[i]; a, b = np.where(k, a, m), np.where(k, m, b)
        m = (a + b) / 2; p = at(m); ok = p[:, 1] > PL[i][4] + .03; sp = np.arange(n)[ok]; e = np.minimum(np.arange(n) - sp[0], sp[-1] - np.arange(n)); nn = grad(p, .03); w = .0078 * np.sqrt(np.clip(1 - nn[:, 2] ** 2, .12, 1)) * np.clip((e + .15) / 3, .02, 1);
        strip(parts, [at(m + w * k)[ok] for k in (2.5, 1.1, 0, -1.1, -2.5)], .0085, [SEAM, .62 * SEAM + .38 * GLOW, GLOW, .62 * SEAM + .38 * GLOW, SEAM])
    for i, th, dz, r in DEW:
        for s in (1, -1):
            p = ray(V3(0, .52 if i < 4 else .42, PL[i][0] + dz), V3(np.sin(th) * s, np.cos(th), 0), .75)[0]; n = grad(p[None], .01)[0]; e1 = np.cross(n, V3(0, 0, 1)); e1 /= np.linalg.norm(e1); e2 = np.cross(n, e1); a = np.arange(9) / 9 * 2 * np.pi
            P = np.vstack([[p + n * .011], p + r * (np.cos(a)[:, None] * e1 + np.sin(a)[:, None] * e2) + n * .003]); F = np.array([(0, 1 + k, 1 + (k + 1) % 9) for k in range(9)]); F = F if np.cross(P[1] - P[0], P[2] - P[0]) @ n > 0 else F[:, ::-1]
            parts.append((P, F, tuple(BEAD)))
            q = p + n * .0125 + r * (.30 * e2 * np.sign(e2[1] + 1e-9) - .25 * e1); P = np.vstack([[q], q + r * .30 * (np.cos(a[::2] * 9 / 10)[:, None] * e1 + np.sin(a[::2] * 9 / 10)[:, None] * e2)]); F = np.array([(0, 1 + k, 1 + (k + 1) % 5) for k in range(5)]); F = F if np.cross(P[1] - P[0], P[2] - P[0]) @ n > 0 else F[:, ::-1]; parts.append((P, F, (244, 252, 252)))
    return parts
C8 = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])
BLUE, HEADC, PALE, SEAM, GLOW, BEAD, BLUSH, SNOUT = map(C8, ('#8fc6d2', '#9dd2da', '#fffdf4', '#5f9fb4', '#ffeab0', '#c3ebee', '#bcc0cb', '#a4d8df'))
def classes(V):
    x, y, z = V.T; A = np.abs(x); M = np.c_[A, y, z]; P_ = np.min(plates(M), 0); h = head(M); bl = belly(M); lg = np.min([leg(M, i) for i in range(4)], 0); tl = tail(V); out = []
    up = np.minimum(np.minimum(P_, h), np.minimum(lg, tl)) - bl
    out.append(np.where(y < .6, np.clip(up, -.05, .05), -.05))                                                  # pale belly
    out.append(np.where((z > .6) & (h < .01), .058 - np.linalg.norm((M - V3(.240, .488, .69)) * V3(1, 1.3, .7), axis=1), -.05))                        # a faint blush
    out.append(np.where((z > .7), .046 - np.linalg.norm((M - V3(0, .562, .785)) * V3(.75, 1.5, .5), axis=1), -.05))
    return out
PAL = [PALE, BLUSH, SNOUT]

ED = V3(.196, .030, 0); RE = .066
def eyes():
    parts = []
    c = HC + V3(.205, .032, .30); e = 2e-3
    n = V3(.50, .05, .86); n /= np.linalg.norm(n); lo, hi = 0, .5; o = HC + V3(.205, .032, 0) - 0 * n; b = V3(.06, .63, .40); o = V3(.140, .612, .42); n = V3(.22, .02, 1.); n /= np.linalg.norm(n)
    for _ in range(40): m = (lo + hi) / 2; lo, hi = (m, hi) if field((o + n * m)[None])[0] < 0 else (lo, m)
    EC = o + n * lo; g = np.array([field((EC + np.eye(3)[i] * e)[None])[0] - field((EC - np.eye(3)[i] * e)[None])[0] for i in range(3)]); n = g / np.linalg.norm(g); ux = np.cross(V3(0, 1, 0), n); ux /= np.linalg.norm(ux); uy = np.cross(n, ux); print('eye at', EC.round(3), 'n', n.round(2))
    a = np.arange(24) / 24 * 2 * np.pi; rim = EC + RE * (np.cos(a)[:, None] * ux + np.sin(a)[:, None] * uy); hh = np.full(24, .05)
    for _ in range(60): hh -= np.clip(field(rim + hh[:, None] * n), -.02, .02) * .7
    base = hh.max() + .003; print('rim', hh.min().round(4), hh.max().round(4)); dome = lambda r: base + .024 * (1 - (r / RE) ** 2)
    def cap(s, x0, y0, rad, col, dz, rings=3, n_=20, ry=1.08):
        a = np.arange(n_) / n_ * 2 * np.pi; X = np.array([(x0, y0)] + [(x0 + rad * k / rings * np.cos(t), y0 + ry * rad * k / rings * np.sin(t)) for k in range(1, rings + 1) for t in a]); F = [(0, 1 + i, 1 + (i + 1) % n_) for i in range(n_)]
        for k in range(rings - 1):
            p, q = 1 + k * n_, 1 + (k + 1) * n_
            for i in range(n_): j = (i + 1) % n_; F += [(p + i, q + i, q + j), (p + i, q + j, p + j)]
        P = EC + X[:, :1] * ux + X[:, 1:] * uy + (dome(np.hypot(X[:, 0], X[:, 1] / 1.08)) + dz)[:, None] * n; F = np.array(F)
        if rad > .06: P = np.vstack([P, P[-n_:] - .030 * n]); m = 1 + (rings - 1) * n_; F = np.vstack([F, [f for i in range(n_) for f in ((m + i, m + n_ + i, m + n_ + (i + 1) % n_), (m + i, m + n_ + (i + 1) % n_, m + (i + 1) % n_))]])
        P = P * V3(s, 1, 1); parts.append((P, F if s > 0 else F[:, ::-1], col))
    for s in (1, -1):
        cap(s, 0, 0, RE, (84, 52, 30), 0, 2); cap(s, 0, -.003, .0575, (196, 122, 44), .0018, 2); cap(s, 0, .004, .0505, (48, 27, 17), .0036, 2); cap(s, -s * .014, .022, .0195, (255, 253, 246), .0056, 1, 12); cap(s, s * .016, -.022, .0075, (238, 176, 92), .0054, 1, 8)
        k0 = len(parts); cap(s, 0, 0, RE + .003, tuple(HEADC), .0085, 3); q = np.linspace(-1, 1, 11); up = np.c_[q * .050, -.012 - .020 * (1 - q * q)]; dn = up + np.c_[0 * q, -.004 - .007 * (1 - q * q)]; X = np.vstack([up, dn])
        F = np.array([f for i in range(10) for f in ((i, 11 + i, 12 + i), (i, 12 + i, i + 1))]); P = (EC + X[:, :1] * ux + X[:, 1:] * uy + (dome(np.hypot(X[:, 0], X[:, 1])) + .0115)[:, None] * n) * V3(s, 1, 1); parts.append((P, F if s > 0 else F[:, ::-1], (58, 96, 112)))
        for k in range(k0, len(parts)): parts[k] = (parts[k][0] - V3(0, 0, LID), *parts[k][1:])
    return parts
def join(parts):
    V, F, C, o = [], [], [], 0
    for P, f, col in parts: V.append(P); F.append(f + o); C.append(np.c_[np.broadcast_to(np.round(255 * (np.array(col, float) / 255.) ** 2.2), (len(P), 3)), np.full(len(P), 255)]); o += len(P)
    return np.vstack(V), np.vstack(F), np.vstack(C)
def refine(V, F, want, mx):
    """split every edge longer than mx whose two ends are wanted (closed stays closed), new points put back on the field"""
    V = list(V); mid = {}; w = want(np.array(V)); out = []
    def m(a, b):
        k = (min(a, b), max(a, b))
        if not (w[a] and w[b]) or np.linalg.norm(V[a] - V[b]) < mx: return None
        if k not in mid: V.append((V[a] + V[b]) / 2); mid[k] = len(V) - 1
        return mid[k]
    for a, b, c in F:
        p, q, r = m(a, b), m(b, c), m(c, a); n = sum(x is not None for x in (p, q, r))
        while n and n < 3 and (p is None or (n == 2 and q is None)): a, b, c, p, q, r = b, c, a, q, r, p
        out += [(a, b, c)] if n == 0 else [(a, p, c), (p, b, c)] if n == 1 else [(p, b, q), (a, p, q), (a, q, c)] if n == 2 else [(a, p, r), (p, b, q), (r, q, c), (p, q, r)]
    V = np.array(V); k = len(w); P = V[k:]
    for _ in range(4): P = P - grad(P) * np.clip(field(P), -.006, .006)[:, None] * .8
    V[k:] = P; return V, np.array(out)
def decimate(V, F, n):
    """quadric decimation in two steps (a fine mesh first, then slowly down to n): the closed, one-piece result nearest n"""
    import trimesh, fast_simplification as fs; best = None
    for mid, a1 in ((40000, 4), (24000, 5)):
        v0, f0 = fs.simplify(np.asarray(V, np.float32), np.asarray(F, np.int32), target_count=mid, agg=a1); tm = trimesh.Trimesh(v0, f0, process=False); tm.merge_vertices(); print('step 1', len(tm.faces), tm.is_watertight)
        for agg in (.5, 1, 2, 3, 4):
            v, f = fs.simplify(np.asarray(tm.vertices, np.float32), np.asarray(tm.faces, np.int32), target_count=n, agg=agg); t = trimesh.Trimesh(v, f, process=False); t.merge_vertices(); ok = t.is_watertight and t.is_winding_consistent and t.body_count == 1 and t.euler_number == 2; print('agg', agg, len(t.faces), ok)
            if ok and (best is None or abs(len(t.faces) - n) < abs(len(best.faces) - n)): best = t
            if best is not None and len(best.faces) < n * 1.05: return best
    return best
def grad(P, e=2e-3):
    g = np.stack([field(P + np.eye(3)[i] * e) - field(P - np.eye(3)[i] * e) for i in range(3)], -1); return g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)
def finish(V, F, path, eye):
    V, F = refine(V, F, lambda V: (V[:, 2] > .60) & (V[:, 1] > .42) & (V[:, 1] < .76), .060)
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(F), -1)
    for k in range(len(PAL)): V, F, lab, side = cut(V, F, lab, classes(V)[k]); lab = np.where(side, k, lab)
    N = grad(V, .006); M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; cols = np.array([PAL[k] if k >= 0 else BLUE for k in lab]); key, inv = np.unique(np.c_[F.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3); g = (key[:, 1:] == BLUE).all(1); MM = np.c_[np.abs(VV[:, 0]), VV[:, 1:]]
    y = VV[:, 1]; hd = head(MM) < np.min(plates(MM), 0); sh = np.clip(.5 + .5 * NN[:, 1], 0, 1) * np.where(hd, 1, np.clip((y - .05) / .75, .25, 1)); sh = np.where(hd, .30 + .7 * sh, sh)[:, None]
    CC[g, :3] = np.round(C8('#6fafc2') * (1 - sh[g]) + C8('#a9dbe1') * sh[g])
    eye = eye + extras()
    eV, eF, eC = join(eye); glb(path, dict(body=(VV, FF, CC, NN), eyes=(eV, eF, eC, normals(eV, eF)))); print('body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF))

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else TRIS
    import trimesh
    lo, hi, h = V3(-.561, -.033, -.85), V3(.561, 1.05, .87), .0088
    V, F = surface(field, lo, hi, h); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False); print('raw', len(F), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number); 
    W0 = k.vertices.copy(); W0[:, 1] -= 1.1 * np.maximum(.34 - W0[:, 1], 0);     # legs and toes are small: drawn out while the triangles are shared out, so they keep theirs
    t = decimate(W0, k.faces, TRIS); X = np.array(t.vertices); X[:, 1] = np.where(X[:, 1] < .34, .34 - (.34 - X[:, 1]) / 2.1, X[:, 1])
    for _ in range(3): X = X - grad(X, 3e-3) * np.clip(field(X), -.004, .004)[:, None] * .6
    t = trimesh.Trimesh(X, np.array(t.faces), process=False); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    finish(np.array(t.vertices), np.array(t.faces), OUT, eyes())
