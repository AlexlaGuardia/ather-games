"""Croakling base form (M174): a signed-distance sculpt (numpy + scipy, no art asset, no outside service), the Shellmere / Lepara route.
python sculpt_croakling.py <out.glb> [tris]  ->  one closed surface -> decimated -> colour lines cut in -> glb nodes `body` + `eyes`
(y 0..~1 = the top of the lure's arch, +z = its face; sRGB bytes on the body, linear bytes on the unlit part: eyes, lids, mouth, nostrils, lure).
Reference: base-forms.md section 7 + the locked base ref (looked at, never traced, never in this repo). A hefty young frog sitting up: a big round
teal-green body on a cream-yellow belly and puffy throat, a wide flat head with a wide smile, two big bulging chartreuse eyes on top, straight
front legs on four round-padded fingers, folded hind haunches with long four-toed feet splayed out. The signature (canon, Alex 2026-06-22):
the anglerfish LURE, a slender stalk arching up off the top of the head with a warm glowing lantern-orb hanging at its tip, rigged on its own
bones. Uninfused base kit: no marks (base-forms.md: the lantern and the eyes are the only glow)."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
from marching import surface
from sculpt_v2 import cone, ell, su, ss, cut, glb, normals, V3
TRIS = 9000; RE = .080; KE = RE / .066; LID = .060
TC, TR = V3(0, .30, -.01), V3(.36, .28, .27)                           # torso
HC, HR = V3(0, .54, .07), V3(.35, .19, .27)                            # head
EBC = V3(.195, .690, .125)                                             # eye bulge centre (right side; M = |x|)
EN = V3(.42, .32, 1.); EN = EN / np.linalg.norm(EN)                    # eye facing
# the lure: a quadratic Bezier off the top of the head (it hangs on its left side, -x, as in the ref), the orb hanging under its tip
L0, L1, L2 = V3(0, .700, -.03), V3(-.12, 1.10, .04), V3(-.40, .925, .20); ORB, ORBR = V3(-.424, .842, .230), V3(.080, .086, .080)
bez = lambda t: np.outer((1 - t) ** 2, L0) + np.outer(2 * (1 - t) * t, L1) + np.outer(t * t, L2)
ARM = ((.215, .380, .180), (.222, .070, .300)); HAND = V3(.232, .030, .326); FINGERS = [(-.60, .085), (-.17, .092), (.26, .090), (.70, .080)]
HAUNCH, HAUNCHR = V3(.315, .205, -.070), V3(.165, .160, .215); SHIN = ((.360, .120, -.165), (.392, .072, .065)); FOOT = V3(.402, .030, .120)   # haunch + heel held off the ground: only the feet and toe pads touch it
TOES = [(-.20, .120), (.18, .135), (.55, .130), (.92, .105)]
def tips(c, fan, y, sx=1):
    return [(c + V3(sx * L * np.sin(a), 0, L * np.cos(a)) * V3(1, 0, 1) + V3(0, y - c[1], 0)) for a, L in fan]
FT_TIPS, TOE_TIPS = tips(HAND, FINGERS, .028), tips(FOOT, TOES, .029)
def torso(M):
    d = su(ell(M, TC, TR), ell(M, (0, .24, .07), (.33, .21, .26)), .06)                                # round body + low full belly
    return ss(d, M[..., 1] - .045, .03)                                                                  # sits flat
def head(M):
    d = su(ell(M, HC, HR), ell(M, (0, .485, .14), (.325, .120, .225)), .05)                             # wide flat skull + full jaw
    return su(d, ell(M, EBC, (.118, .112, .112)), .05)                                                   # the two big eye bulges
def throat(M): return ell(M, (0, .415, .215), (.235, .095, .135))
def arms(M):
    a, b = V3(*ARM[0]), V3(*ARM[1]); d = cone(M, a, b, .074, .054); d = su(d, ell(M, HAND, (.058, .030, .058)), .03)
    for (a_, L), t in zip(FINGERS, FT_TIPS): d = su(d, cone(M, HAND + V3(0, 0, .01), t, .024, .017), .014)
    return d
def hind(M):
    d = ell(M, HAUNCH, HAUNCHR); d = su(d, cone(M, V3(*SHIN[0]), V3(*SHIN[1]), .070, .044), .05); d = su(d, ell(M, FOOT, (.068, .029, .105)), .03)
    for (a_, L), t in zip(TOES, TOE_TIPS): d = su(d, cone(M, FOOT + V3(0, 0, .02), t, .022, .017), .014)
    return d
def pads(M):
    d = 9
    for t in FT_TIPS: d = np.minimum(d, ell(M, t, (.030, .026, .030)))
    for t in TOE_TIPS: d = np.minimum(d, ell(M, t, (.032, .027, .032)))
    return d
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = su(torso(M), head(M), .09); d = su(d, throat(M), .05); d = su(d, hind(M), .05); d = su(d, arms(M), .035)
    return su(d, pads(M), .012)
C8 = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])
SKIN, BELLY, PAD = map(C8, ('#3fbb92', '#f1e48c', '#86dcac'))
HEADC = SKIN; STALK, BULB, CAP = (88, 196, 140), (255, 214, 104), (236, 150, 62); MOUTH = (34, 92, 66)
def classes(V):
    M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; ar, hn, pd = arms(M), hind(M), pads(M); core = np.minimum(np.minimum(torso(M), head(M)), throat(M)); out = []
    qb = (M[:, 0] / .275) ** 2 + ((M[:, 1] - .26) / .27) ** 2 + ((M[:, 2] - .32) / .32) ** 2                       # cream belly, front and low
    qt = (M[:, 0] / .235) ** 2 + ((M[:, 1] - .415) / .075) ** 2 + ((M[:, 2] - .32) / .22) ** 2                     # the puffy throat under the smile
    out.append(np.where(core < np.minimum(ar, hn) - .004, np.clip(np.minimum(.03 * (1 - np.minimum(qb, qt)), .439 - V[:, 1]), -.05, .05), -.05))
    out.append(np.where(V[:, 1] < .08, np.clip(np.minimum(np.minimum(core, ar), hn) - pd + .004, -.05, .05), -.05))  # pale round toe pads
    return out
PAL = [BELLY, PAD]
def grad(P, e=2e-3):
    g = np.stack([field(P + np.eye(3)[i] * e) - field(P - np.eye(3)[i] * e) for i in range(3)], -1); return g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)
def ray(p, u, hi):
    p, u = np.broadcast_arrays(np.atleast_2d(np.asarray(p, float)), np.atleast_2d(np.asarray(u, float))); lo, hi = np.zeros(len(p)), np.full(len(p), hi)
    for _ in range(26): m = (lo + hi) / 2; f = field(p + u * m[:, None]) < 0; lo, hi = np.where(f, m, lo), np.where(f, hi, m)
    return p + u * lo[:, None]

#----
def frame(p):
    """surface point -> (normal, two tangents)"""
    n = grad(p[None], 3e-3)[0]; t1 = np.cross(V3(0, 1, 0) if abs(n[1]) < .9 else V3(1, 0, 0), n); t1 /= np.linalg.norm(t1); return n, t1, np.cross(n, t1)
def strip(Q, col, wd, lift=.0035, closed=False):
    G = grad(Q, 3e-3); T = np.roll(Q, -1, 0) - np.roll(Q, 1, 0) if closed else np.gradient(Q, axis=0); Bn = np.cross(T, G); Bn /= np.linalg.norm(Bn, axis=1, keepdims=True)
    P = np.vstack([Q + G * lift + Bn * wd, Q + G * lift - Bn * wd]); n_ = len(Q); rng = range(n_) if closed else range(n_ - 1)
    F = np.array([f for i in rng for j in [(i + 1) % n_] for f in ((i, n_ + i, n_ + j), (i, n_ + j, j))])
    return P, (F if np.cross(P[1] - P[0], P[n_] - P[0]) @ G[0] > 0 else F[:, ::-1]), col
def disc(c, n, t1, t2, r, col, lift=.004, k=14):
    a = np.arange(k) / k * 2 * np.pi; P = np.vstack([[c + n * lift], c + n * lift + r * (np.cos(a)[:, None] * t1 + np.sin(a)[:, None] * t2)]); F = np.array([(0, 1 + i, 1 + (i + 1) % k) for i in range(k)])
    return P, (F if np.cross(P[1] - P[0], P[2] - P[0]) @ n > 0 else F[:, ::-1]), col

#----
def join(parts):
    V, F, C, o = [], [], [], 0
    for P, f, col in parts: V.append(P); F.append(f + o); C.append(np.c_[np.broadcast_to(np.round(255 * (np.array(col, float) / 255.) ** 2.2), (len(P), 3)), np.full(len(P), 255)]); o += len(P)
    return np.vstack(V), np.vstack(F), np.vstack(C)
def refine(V, F, want, mx):
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
    import trimesh, fast_simplification as fs; best = None
    for mid, a1 in ((40000, 4), (24000, 5), (30000, 3)):
        v0, f0 = fs.simplify(np.asarray(V, np.float32), np.asarray(F, np.int32), target_count=mid, agg=a1); tm = trimesh.Trimesh(v0, f0, process=False); tm.merge_vertices()
        for agg in (.5, 1, 2, 3, 4, 5):
            v, f = fs.simplify(np.asarray(tm.vertices, np.float32), np.asarray(tm.faces, np.int32), target_count=n, agg=agg); t = trimesh.Trimesh(v, f, process=False); t.merge_vertices(); trimesh.repair.fix_winding(t)
            ok = t.is_watertight and t.is_winding_consistent and t.body_count == 1 and t.euler_number == 2; print('agg', agg, len(t.faces), ok, t.euler_number)
            if ok and (best is None or abs(len(t.faces) - n) < abs(len(best.faces) - n)): best = t
            if best is not None and len(best.faces) < n * 1.05: return best
    return best
def eye_normal():
    """the right eye's surface point + facing (the rig slides each lid along it)"""
    o, n, lo, hi = EBC.copy(), EN.copy(), 0, .5
    for _ in range(40): m = (lo + hi) / 2; lo, hi = (m, hi) if field((o + n * m)[None])[0] < 0 else (lo, m)
    E = o + n * lo; return E, grad(E[None], 2e-3)[0]
def eyes():
    parts = []
    o = EBC.copy(); n = EN.copy(); lo, hi = 0, .5
    for _ in range(40): m = (lo + hi) / 2; lo, hi = (m, hi) if field((o + n * m)[None])[0] < 0 else (lo, m)
    E = o + n * lo; n = grad(E[None], 2e-3)[0]; ux = np.cross(V3(0, 1, 0), n); ux /= np.linalg.norm(ux); uy = np.cross(n, ux); print('eye at', E.round(3), 'n', n.round(2))
    a = np.arange(24) / 24 * 2 * np.pi; rim_ = E + RE * (np.cos(a)[:, None] * ux + np.sin(a)[:, None] * uy); hh = np.full(24, .05)
    for _ in range(60): hh -= np.clip(field(rim_ + hh[:, None] * n), -.02, .02) * .7
    base = hh.max() + .003; dome_ = lambda r: base + .030 * KE * (1 - (r / RE) ** 2)
    def cap(s, x0, y0, rad, col, dz, rings=3, n_=20, ry=1.0):
        a = np.arange(n_) / n_ * 2 * np.pi; X = np.array([(x0, y0)] + [(x0 + rad * k / rings * np.cos(t), y0 + ry * rad * k / rings * np.sin(t)) for k in range(1, rings + 1) for t in a]); F = [(0, 1 + i, 1 + (i + 1) % n_) for i in range(n_)]
        for k in range(rings - 1):
            p, q = 1 + k * n_, 1 + (k + 1) * n_
            for i in range(n_): j = (i + 1) % n_; F += [(p + i, q + i, q + j), (p + i, q + j, p + j)]
        P = E + X[:, :1] * ux + X[:, 1:] * uy + (dome_(np.minimum(np.hypot(X[:, 0], X[:, 1] / ry), RE)) + dz)[:, None] * n; F = np.array(F)
        if rad > .05: P = np.vstack([P, P[-n_:] - .026 * n]); m = 1 + (rings - 1) * n_; F = np.vstack([F, [f for i in range(n_) for f in ((m + i, m + n_ + i, m + n_ + (i + 1) % n_), (m + i, m + n_ + (i + 1) % n_, m + (i + 1) % n_))]])
        P = P * V3(s, 1, 1); parts.append((P, F if s > 0 else F[:, ::-1], col))
    k = KE
    for s in (1, -1):
        cap(s, 0, 0, RE, (70, 150, 96), 0, 2, 24); cap(s, 0, 0, .0600 * k, (208, 236, 104), .0018 * k, 2, 24); cap(s, 0, .002 * k, .0360 * k, (10, 14, 16), .0036 * k, 2, 20)      # green rim, chartreuse iris, big round pupil
        cap(s, -s * .012 * k, .016 * k, .0130 * k, (255, 253, 244), .0052 * k, 1, 12); cap(s, s * .016 * k, -.017 * k, .0060 * k, (226, 246, 214), .0050 * k, 1, 8)
        k0 = len(parts); cap(s, 0, 0, RE + .004, tuple(HEADC), .0100 * k, 3, 24); q = np.linspace(-1, 1, 11); up = np.c_[q * .064 * k, (-.008 - .024 * (1 - q * q)) * k]; dn = up + np.c_[0 * q, (-.004 - .008 * (1 - q * q)) * k]; X = np.vstack([up, dn])
        F = np.array([f for i in range(10) for f in ((i, 11 + i, 12 + i), (i, 12 + i, i + 1))]); P = (E + X[:, :1] * ux + X[:, 1:] * uy + (dome_(np.minimum(np.hypot(X[:, 0], X[:, 1]), RE)) + .0130 * k)[:, None] * n) * V3(s, 1, 1); parts.append((P, F if s > 0 else F[:, ::-1], MOUTH))
        for j in range(k0, len(parts)): parts[j] = (parts[j][0] - n * V3(s, 1, 1) * LID, *parts[j][1:])     # tucked straight back into the bulge (each lid rides its own bone along its eye's facing)
    for s in (1, -1):                                                                                     # nostrils: two small dark dots above the smile
        u = V3(s * .17, .02, 1); p = ray(HC + V3(0, -.03, 0), u / np.linalg.norm(u), .5)[0]; n_, t1, t2 = frame(p); parts.append(disc(p, n_, t1, t2, .0105, MOUTH, .003, 10))
    xs = np.linspace(-1, 1, 25); Q = []                                                                   # the wide smile, right round the jaw, corners turned up
    for x in xs:
        a = x * 1.18; o_ = V3(0, .445 + .020 * x * x, .05); u = V3(np.sin(a), .0, np.cos(a)); Q.append(ray(o_, u, .5)[0])
    parts.append(strip(np.array(Q), MOUTH, .0060, .0030))
    T = np.linspace(0, 1, 19); C = bez(T); D = np.gradient(C, axis=0); k_ = 10; Pp, Ff = [], []           # the lure stalk: a tapered tube (rigged on lure / lure2 / lure3)
    for i, (c, d) in enumerate(zip(C, D)):
        d = d / np.linalg.norm(d); t1 = np.cross(d, V3(1, 0, 0)); t1 /= np.linalg.norm(t1); t2 = np.cross(d, t1); r = .026 - .011 * T[i]; an = np.arange(k_) / k_ * 2 * np.pi
        Pp += list(c + r * (np.cos(an)[:, None] * t1 + np.sin(an)[:, None] * t2))
    Pp = np.array(Pp); Ff = []
    for i in range(len(T) - 1):
        for j in range(k_): p0, p1, q0, q1 = i * k_ + j, i * k_ + (j + 1) % k_, (i + 1) * k_ + j, (i + 1) * k_ + (j + 1) % k_; Ff += [(p0, p1, q1), (p0, q1, q0)]
    Ff = np.array(Ff); f0 = Ff[3]; tn = np.cross(Pp[f0[1]] - Pp[f0[0]], Pp[f0[2]] - Pp[f0[0]]) @ (Pp[f0[0]] - C[0]); parts.append((Pp, Ff if tn > 0 else Ff[:, ::-1], STALK))
    def ball(c, r, col, nu=10, nv=16):
        u_, v_ = np.meshgrid(np.linspace(0, np.pi, nu), np.arange(nv) / nv * 2 * np.pi, indexing='ij'); S = np.c_[(np.sin(u_) * np.cos(v_)).ravel(), np.cos(u_).ravel(), (np.sin(u_) * np.sin(v_)).ravel()]
        P = c + S * r; Fb = np.array([(i * nv + j, i * nv + (j + 1) % nv, (i + 1) * nv + (j + 1) % nv) for i in range(nu - 1) for j in range(nv)] + [(i * nv + j, (i + 1) * nv + (j + 1) % nv, (i + 1) * nv + j) for i in range(nu - 1) for j in range(nv)])
        tn = np.cross(P[Fb[nv * 2][1]] - P[Fb[nv * 2][0]], P[Fb[nv * 2][2]] - P[Fb[nv * 2][0]]) @ (P[Fb[nv * 2][0]] - c); parts.append((P, Fb if tn > 0 else Fb[:, ::-1], col))
    ball(ORB, ORBR, BULB, 12, 18)                                                                         # the lantern orb
    ball(ORB + V3(0, ORBR[1] * .80, 0), V3(.040, .024, .040), CAP)                                        # its little stem cap
    for a in (0, np.pi):                                                                                  # two small calyx points either side of the cap
        d = V3(np.cos(a), -.35, np.sin(a) * 0 + .0); ball(ORB + V3(0, ORBR[1] * .55, 0) + V3(np.cos(a + .6), 0, np.sin(a + .6)) * .060, V3(.016, .010, .016), CAP, 6, 10)
    return parts
def finish(V, F, path, eye):
    V, F = refine(V, F, lambda V: ((V[:, 2] > .22) & (V[:, 1] > .40)) | (V[:, 1] < .07), .026)
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(F), -1); C = classes
    for k in range(len(PAL)): V, F, lab, side = cut(V, F, lab, C(V)[k]); lab = np.where(side, k, lab)
    N = grad(V, .006); cols = np.array([PAL[k] if k >= 0 else SKIN for k in lab]); key, inv = np.unique(np.c_[F.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN = V[key[:, 0]], N[key[:, 0]]; CC = np.c_[key[:, 1:], np.full(len(key), 255)].astype(float); FF = inv.reshape(-1, 3)
    sh = np.clip(.5 + .5 * NN[:, 1], 0, 1) * np.clip(.35 + VV[:, 1] * 1.2, .35, 1); CC[:, :3] = CC[:, :3] * (.84 + .16 * sh[:, None])   # soft painted top light, deeper underneath
    CC[:, :3] *= (.90 + .10 * np.clip((VV[:, 2] + .30) / .60, 0, 1))[:, None]                                                           # a touch deeper down the back
    eV, eF, eC = join(eye); glb(path, dict(body=(VV, FF, np.round(CC), NN), eyes=(eV, eF, eC, normals(eV, eF)))); print('body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF))

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else TRIS
    import trimesh
    lo, hi, h = V3(-.60, -.033, -.40), V3(.60, .86, .52), .0075
    V, F = surface(field, lo, hi, h); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False); print('raw', len(F), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number, 'bounds', k.bounds.round(3).tolist())
    t = decimate(k.vertices, k.faces, TRIS); X = np.array(t.vertices)
    for _ in range(3): X = X - grad(X, 3e-3) * np.clip(field(X), -.004, .004)[:, None] * .6
    t = trimesh.Trimesh(X, np.array(t.faces), process=False); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    finish(np.array(t.vertices), np.array(t.faces), OUT, eyes())
