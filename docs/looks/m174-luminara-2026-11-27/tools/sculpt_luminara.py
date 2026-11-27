"""Luminara base form (M174): a signed-distance sculpt (numpy + scipy, no art asset, no outside service), the Shellmere / Lepara / Croakling route.
python sculpt_luminara.py <out.glb> [tris]  ->  one closed surface -> decimated -> colour lines cut in -> glb nodes `body` + `eyes` + `lamp`
(+z = her face; the rest pose is drawn level-ish at y ~0.05..1.1, the rig lifts it to her hover; sRGB bytes on body + lamp, linear on the unlit `eyes` part:
eyes, lids, blush, smile, antennae, the four wings).
Reference: base-forms.md section 6 + the locked base ref (looked at, never traced, never in this repo). A hefty young firefly hovering: a big round head
(dark amber-brown hood over a cream face, big amber eyes, blush, a small smile), two antennae with round knob tips, a small thorax with two little arms
and a pair of tucked legs, two pairs of delicate lacy wings, and a big round SEGMENTED abdomen: amber-gold underneath, the dark shell over its back.
The quirk (canon): the abdomen is brightest, a warm-white orb that pulses like a tiny sun = its own glow part `lamp` (the game pulses a glow part's
emissive). Uninfused base kit: no marks (the ref's gold filigree on the abdomen is ornament of the painting, not canon; no gem on the brow)."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
from marching import surface
from sculpt_v2 import cone, ell, su, ss, cut, glb, normals, V3
TRIS = 9000; RE = .066; KE = RE / .066; LID = .050
HC, HR = V3(0, .66, .20), V3(.215, .200, .195)                         # head
TXC, TXR = V3(0, .47, .03), V3(.150, .135, .140)                        # thorax
AC, AR_ = V3(0, .31, -.19), V3(.225, .225, .300)                        # abdomen centre + radii (its long axis tipped back and down)
AX = V3(0, .574, .819)                                                  # abdomen axis, pointing to the front-top (the waist)
ADN = V3(0, .819, -.574)                                                # its dorsal normal (the shell side)
RA = np.stack([V3(1, 0, 0), ADN, AX], 1)                                # local frame: q = (P - AC) @ RA -> (x, dorsal, along)
GROOVES = (-.17, -.05, .07, .18)                                        # segment seams along the abdomen axis (local z)
EBC = V3(.092, .672, .315)                                              # eye centre (right side; M = |x|)
EN = V3(.30, .04, 1.); EN = EN / np.linalg.norm(EN)                     # eye facing
ARM = ((.110, .430, .110), (.175, .345, .205)); HAND = V3(.182, .335, .218)
LEG = ((.075, .405, -.010), (.120, .345, .035)); FOOTL = V3(.126, .336, .044)
WROOT = {'f': V3(.090, .560, -.010), 'h': V3(.100, .520, -.060)}         # wing roots on the thorax top (right side)
def aq(M): return (M - AC) @ RA
def abdomen(M):
    q = aq(M); d = ell(q, (0, 0, 0), AR_)
    for z in GROOVES: d = d + .011 * np.exp(-((q[..., 2] - z) / .016) ** 2) * (q[..., 1] > -.30)        # segment seams, grooved
    return d
def head(M):
    d = su(ell(M, HC, HR), ell(M, (0, .605, .245), (.190, .135, .150)), .05)                        # round skull + full cheeks
    return d
def thorax(M): return su(ell(M, TXC, TXR), ell(M, (0, .555, .10), (.10, .07, .08)), .04)          # + a neck
def arms(M):
    d = cone(M, ARM[0], ARM[1], .036, .028); return su(d, ell(M, HAND, (.034, .032, .034)), .015)
def legs(M):
    d = cone(M, LEG[0], LEG[1], .026, .019); return su(d, ell(M, FOOTL, (.024, .020, .026)), .012)
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = su(abdomen(M), thorax(M), .07); d = su(d, head(M), .06); d = su(d, legs(M), .025)
    return su(d, arms(M), .03)
C8 = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])
GOLD, SHELL, FACE, SEAM, LIMB = map(C8, ('#e8ab42', '#7f4a20', '#ffeacb', '#5e3416', '#a4622a'))
HEADC = FACE; HOODC = SHELL
def classes(V):
    M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; ab, hd, tx, ar, lg = abdomen(M), head(M), thorax(M), arms(M), legs(M); out = []
    q = aq(M); core = np.minimum(np.minimum(ab, hd), tx)
    dors = (M - AC) @ ADN                                                                          # the shell: over the back of the abdomen, the thorax top and the hood
    wav = .018 * np.sin(np.arctan2(q[:, 0], q[:, 1]) * 0 + q[:, 2] * 34)                          # its rim scalloped along the segments
    out.append(np.where(core < np.minimum(ar, lg) - .004, np.clip(dors - .045 + wav * (ab < hd), -.05, .05), -.05))
    fq = (M[:, 0] / .165) ** 2 + ((M[:, 1] - .615) / .125) ** 2                                     # the cream face (front of the head, under the hood's brow)
    out.append(np.where((hd < ab) & (M[:, 2] > .26), np.clip(.03 * (1 - fq), -.05, .05), -.05))
    sm_ = np.min([.0075 - np.abs(q[:, 2] - z) for z in GROOVES], 0)                                 # dark seam lines in the grooves
    out.append(np.where((ab < np.minimum(hd, tx) - .01) & (dors < .045 + .05), np.clip(sm_, -.05, .05), -.05))
    out.append(np.where(np.minimum(ar, lg) < core - .002, .02, -.05))                               # arms + legs
    return out
PAL = [SHELL, FACE, SEAM, LIMB]
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
# antennae: a quadratic Bezier a side off the top of the head, curling out and forward, a round knob at the tip
A0, A1, A2 = V3(.060, .835, .165), V3(.080, 1.030, .110), V3(.175, 1.075, .225); KNOB = A2 + V3(.010, .012, .010)
abz = lambda t: np.outer((1 - t) ** 2, A0) + np.outer(2 * (1 - t) * t, A1) + np.outer(t * t, A2)
STALK, KNOBC, KNOBHI = (96, 54, 26), (222, 150, 58), (255, 226, 160)
MEMB, VEIN, RIM = (255, 244, 208), (226, 176, 92), (196, 132, 58)
# wings (right side): root, span direction, chord direction (in the wing plane), span length, chord width; the left side mirrors
def wdir(el, back, sweep):
    d = V3(np.cos(el) * np.cos(sweep), np.sin(el), -np.cos(el) * np.sin(sweep)); n = V3(0, -np.sin(back) * .2, 1); n = n - (n @ d) * d; n /= np.linalg.norm(n); return d, np.cross(n, d), n
WINGS = {'f': (WROOT['f'], *wdir(.42, .5, .30), .50, .20), 'h': (WROOT['h'], *wdir(-.20, .5, .40), .36, .15)}
def wing_outline(L, W, k=30):
    th = np.linspace(0, 2 * np.pi, k, endpoint=False); s = L * (.5 - .5 * np.cos(th)); t = W * np.sin(th) * (s / L) ** .45 * (1.12 - .3 * s / L)
    return np.c_[s, t]
def wing(name, sx):
    """a closed thin slab (a membrane both faces see), with a rim and the lacy veins drawn as strips on both faces"""
    R0, d, c, n, L, W = WINGS[name]; O = wing_outline(L, W); k = len(O); th = .0045; parts = []
    P2 = lambda st, off=0.: R0 + st[..., :1] * d + st[..., 1:] * c + off * n
    top, bot = P2(O, th), P2(O, -th); ct, cb = R0 + d * L * .5 + n * th, R0 + d * L * .5 - n * th
    P = np.vstack([top, bot, [ct], [cb]]); F = [(2 * k, i, (i + 1) % k) for i in range(k)] + [(2 * k + 1, k + (i + 1) % k, k + i) for i in range(k)]
    F += [f for i in range(k) for j in [(i + 1) % k] for f in ((i, k + i, k + j), (i, k + j, j))]; F = np.array(F)
    if np.cross(P[F[0][1]] - P[F[0][0]], P[F[0][2]] - P[F[0][0]]) @ n < 0: F = F[:, ::-1]
    parts.append((P, F, MEMB))
    def band(Q, col, wd):                                                                       # a strip on each face along a 2D (s, t) path
        Q = np.asarray(Q, float); T = np.gradient(Q, axis=0); B = np.c_[-T[:, 1], T[:, 0]]; B /= np.linalg.norm(B, axis=1, keepdims=True); m_ = len(Q)
        for side in (1, -1):
            X = np.vstack([P2(Q + B * wd, side * (th + .0012)), P2(Q - B * wd, side * (th + .0012))]); Fv = np.array([f for i in range(m_ - 1) for f in ((i, m_ + i, m_ + i + 1), (i, m_ + i + 1, i + 1))])
            if np.cross(X[Fv[0][1]] - X[Fv[0][0]], X[Fv[0][2]] - X[Fv[0][0]]) @ (n * side) < 0: Fv = Fv[:, ::-1]
            parts.append((X, Fv, col))
    band(np.vstack([O, O[:1]]) * .985, RIM, .0050)
    for f in (-.55, 0., .55):                                                                   # three long veins out from the root
        s = np.linspace(.02, .88, 12) * L; band(np.c_[s, f * W * np.sin(np.pi * s / L * .92) * .8], VEIN, .0030)
    for u in (.34, .55, .74):                                                                    # cross veins: the lace
        t = np.linspace(-.78, .78, 9) * W * np.sin(np.pi * u) ** .5 * .95; band(np.c_[u * L + .02 * L * np.cos(t / W * 3), t], VEIN, .0026)
    if sx < 0:
        parts = [(X * V3(-1, 1, 1), Fx[:, ::-1], col) for X, Fx, col in parts]
    return parts
def ball(c, r, col, nu=10, nv=16):
    u_, v_ = np.meshgrid(np.linspace(0, np.pi, nu), np.arange(nv) / nv * 2 * np.pi, indexing='ij'); S = np.c_[(np.sin(u_) * np.cos(v_)).ravel(), np.cos(u_).ravel(), (np.sin(u_) * np.sin(v_)).ravel()]
    P = c + S * r; Fb = np.array([(i * nv + j, i * nv + (j + 1) % nv, (i + 1) * nv + (j + 1) % nv) for i in range(nu - 1) for j in range(nv)] + [(i * nv + j, (i + 1) * nv + (j + 1) % nv, (i + 1) * nv + j) for i in range(nu - 1) for j in range(nv)])
    tn = np.cross(P[Fb[nv * 2][1]] - P[Fb[nv * 2][0]], P[Fb[nv * 2][2]] - P[Fb[nv * 2][0]]) @ (P[Fb[nv * 2][0]] - c); return (P, Fb if tn > 0 else Fb[:, ::-1], col)
def eyes():
    parts = []
    E, n = eye_normal(); ux = np.cross(V3(0, 1, 0), n); ux /= np.linalg.norm(ux); uy = np.cross(n, ux); print('eye at', E.round(3), 'n', n.round(2))
    a = np.arange(24) / 24 * 2 * np.pi; rim_ = E + RE * (np.cos(a)[:, None] * ux + np.sin(a)[:, None] * uy); hh = np.full(24, .05)
    for _ in range(60): hh -= np.clip(field(rim_ + hh[:, None] * n), -.02, .02) * .7
    base = hh.max() + .003; dome_ = lambda r: base + .026 * KE * (1 - (r / RE) ** 2)
    def cap(s, x0, y0, rad, col, dz, rings=3, n_=20, ry=1.0):
        a = np.arange(n_) / n_ * 2 * np.pi; X = np.array([(x0, y0)] + [(x0 + rad * k / rings * np.cos(t), y0 + ry * rad * k / rings * np.sin(t)) for k in range(1, rings + 1) for t in a]); F = [(0, 1 + i, 1 + (i + 1) % n_) for i in range(n_)]
        for k in range(rings - 1):
            p, q = 1 + k * n_, 1 + (k + 1) * n_
            for i in range(n_): j = (i + 1) % n_; F += [(p + i, q + i, q + j), (p + i, q + j, p + j)]
        P = E + X[:, :1] * ux + X[:, 1:] * uy + (dome_(np.minimum(np.hypot(X[:, 0], X[:, 1] / ry), RE)) + dz)[:, None] * n; F = np.array(F)
        if rad > .05: P = np.vstack([P, P[-n_:] - .024 * n]); m = 1 + (rings - 1) * n_; F = np.vstack([F, [f for i in range(n_) for f in ((m + i, m + n_ + i, m + n_ + (i + 1) % n_), (m + i, m + n_ + (i + 1) % n_, m + (i + 1) % n_))]])
        P = P * V3(s, 1, 1); parts.append((P, F if s > 0 else F[:, ::-1], col))
    k = KE
    for s in (1, -1):
        cap(s, 0, 0, RE, (58, 30, 12), 0, 2, 24); cap(s, 0, -.002 * k, .0560 * k, (214, 138, 40), .0018 * k, 2, 24); cap(s, 0, -.004 * k, .0300 * k, (34, 16, 8), .0036 * k, 2, 20)   # dark rim, amber iris, big pupil
        cap(s, -s * .016 * k, .018 * k, .0150 * k, (255, 253, 244), .0052 * k, 1, 12); cap(s, s * .016 * k, -.020 * k, .0065 * k, (255, 236, 200), .0050 * k, 1, 8)
        k0 = len(parts); cap(s, 0, 0, RE + .004, tuple(HEADC), .0100 * k, 3, 24); q = np.linspace(-1, 1, 11); up = np.c_[q * .066 * k, (-.008 - .024 * (1 - q * q)) * k]; dn = up + np.c_[0 * q, (-.004 - .008 * (1 - q * q)) * k]; X = np.vstack([up, dn])
        F = np.array([f for i in range(10) for f in ((i, 11 + i, 12 + i), (i, 12 + i, i + 1))]); P = (E + X[:, :1] * ux + X[:, 1:] * uy + (dome_(np.minimum(np.hypot(X[:, 0], X[:, 1]), RE)) + .0130 * k)[:, None] * n) * V3(s, 1, 1); parts.append((P, F if s > 0 else F[:, ::-1], SEAMLIN))
        for j in range(k0, len(parts)): parts[j] = (parts[j][0] - n * V3(s, 1, 1) * LID, *parts[j][1:])     # tucked straight back into the head (each lid rides its own bone along its eye's facing)
    for s in (1, -1):                                                                                     # blush under each eye
        u = V3(s * .62, -.40, 1); p = ray(HC, u / np.linalg.norm(u), .5)[0]; n_, t1, t2 = frame(p); parts.append(disc(p, n_, t1, t2, .030, (244, 150, 128), .003, 16))
    xs = np.linspace(-1, 1, 13); Q = []                                                                   # a small smile
    for x in xs:
        a = x * .30; o_ = V3(0, .585 + .012 * x * x, .20); u = V3(np.sin(a), .0, np.cos(a)); Q.append(ray(o_, u, .5)[0])
    parts.append(strip(np.array(Q), SEAMLIN, .0042, .0030))
    T = np.linspace(0, 1, 17); k_ = 8                                                                    # the antennae: tapered tubes + knobs (bones ant / ant2 a side)
    for sx in (1, -1):
        C = abz(T) * V3(sx, 1, 1); D = np.gradient(C, axis=0); Pp = []
        for i, (c, d) in enumerate(zip(C, D)):
            d = d / np.linalg.norm(d); t1 = np.cross(d, V3(1, 0, 0)); t1 /= np.linalg.norm(t1); t2 = np.cross(d, t1); r = .017 - .007 * T[i]; an = np.arange(k_) / k_ * 2 * np.pi
            Pp += list(c + r * (np.cos(an)[:, None] * t1 + np.sin(an)[:, None] * t2))
        Pp = np.array(Pp); Ff = []
        for i in range(len(T) - 1):
            for j in range(k_): p0, p1, q0, q1 = i * k_ + j, i * k_ + (j + 1) % k_, (i + 1) * k_ + j, (i + 1) * k_ + (j + 1) % k_; Ff += [(p0, p1, q1), (p0, q1, q0)]
        Ff = np.array(Ff); f0 = Ff[3]; tn = np.cross(Pp[f0[1]] - Pp[f0[0]], Pp[f0[2]] - Pp[f0[0]]) @ (Pp[f0[0]] - C[0]); parts.append((Pp, Ff if tn > 0 else Ff[:, ::-1], STALK))
        kc = KNOB * V3(sx, 1, 1); parts.append(ball(kc, V3(.036, .036, .036), KNOBC, 10, 16)); parts.append(ball(kc + V3(-sx * .012, .016, .022), V3(.011, .009, .008), KNOBHI, 6, 10))
    for sx in (1, -1):
        for w in ('f', 'h'): parts += wing(w, sx)
    return parts
SEAMLIN = (70, 36, 16)
def lamp():
    """the glowing orb on the belly: a warm-white dome set into the abdomen's front underside, a gold ring round it (glow part `lamp`)"""
    u = V3(0, -.20, 1.); u /= np.linalg.norm(u); p = ray(AC, u[None], .6)[0]; n, t1, t2 = frame(p); print('lamp at', p.round(3), 'n', n.round(2))
    nu, nv, R = 9, 28, .165; P, Fl, C = [], [], []
    for i in range(nu + 1):
        r = R * (1 - (i / nu) ** 1.6) if i else R; h = .006 + .030 * np.sqrt(max(0, 1 - (r / R) ** 2)) if i else -.030   # conformed to the abdomen (each ring point cast onto its surface)
        for j in range(nv): a = 2 * np.pi * j / nv; q_ = p + r * (np.cos(a) * t1 + np.sin(a) * t2 * .95); u_ = q_ - AC; q_ = ray(AC, (u_ / np.linalg.norm(u_))[None], .7)[0]; P.append(q_ + grad(q_[None], 3e-3)[0] * h); C.append((255, 214, 120) if i < 2 else (255, 236, 176) if i < 4 else (255, 250, 232))
    P.append(p + n * .036); C.append((255, 252, 240)); P = np.array(P); top = len(P) - 1
    for i in range(nu):
        for j in range(nv): a, b, c_, d = i * nv + j, i * nv + (j + 1) % nv, (i + 1) * nv + j, (i + 1) * nv + (j + 1) % nv; Fl += [(a, b, d), (a, d, c_)]
    Fl += [(nu * nv + j, nu * nv + (j + 1) % nv, top) for j in range(nv)]; Fl += [(j, nv - 1 - j if False else (j + 1) % nv, 0) for j in range(0)]
    bot = len(P); P = np.vstack([P, [p - n * .030]]); C.append((255, 214, 120)); Fl += [((j + 1) % nv, j, bot) for j in range(nv)]
    Fl = np.array(Fl); f0 = Fl[nv * 3]
    if np.cross(P[f0[1]] - P[f0[0]], P[f0[2]] - P[f0[0]]) @ n < 0: Fl = Fl[:, ::-1]
    return P, Fl, np.array(C)
def finish(V, F, path, eye):
    V, F = refine(V, F, lambda V: (V[:, 2] > .26) & (V[:, 1] > .52), .024)
    lab = np.full(len(F), -1); C = classes
    for k in range(len(PAL)): V, F, lab, side = cut(V, F, lab, C(V)[k]); lab = np.where(side, k, lab)
    N = grad(V, .006); cols = np.array([PAL[k] if k >= 0 else GOLD for k in lab]); key, inv = np.unique(np.c_[F.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN = V[key[:, 0]], N[key[:, 0]]; CC = np.c_[key[:, 1:], np.full(len(key), 255)].astype(float); FF = inv.reshape(-1, 3)
    sh = np.clip(.5 + .5 * NN[:, 1], 0, 1); CC[:, :3] = CC[:, :3] * (.86 + .14 * sh[:, None])                                         # soft painted top light
    gl = np.exp(-np.linalg.norm(VV - LAMP_AT, axis=1) ** 2 / .03); CC[:, :3] = np.minimum(255, CC[:, :3] * (1 + .22 * gl[:, None]) + 30 * gl[:, None])   # the belly lit warm round the orb
    eV, eF, eC = join(eye); lP, lF, lC = lamp(); lN = normals(lP, lF)
    glb(path, dict(body=(VV, FF, np.round(CC), NN), eyes=(eV, eF, eC, normals(eV, eF)), lamp=(lP, lF, np.c_[lC, np.full(len(lC), 255)], lN))); print('body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF), 'lamp tris', len(lF))
LAMP_AT = AC + V3(0, -.06, .26)

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else TRIS
    import trimesh
    lo, hi, h = V3(-.30, .02, -.52), V3(.30, .90, .44), .0072
    V, F = surface(field, lo, hi, h); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False); print('raw', len(F), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number, 'bounds', k.bounds.round(3).tolist())
    t = decimate(k.vertices, k.faces, TRIS); X = np.array(t.vertices)
    for _ in range(3): X = X - grad(X, 3e-3) * np.clip(field(X), -.004, .004)[:, None] * .6
    t = trimesh.Trimesh(X, np.array(t.faces), process=False); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    finish(np.array(t.vertices), np.array(t.faces), OUT, eyes())
