"""Shellmere base form (M174): a signed-distance sculpt (numpy + scipy, no art asset, no outside service), the Lepara / Dewbear route.
python sculpt_shellmere.py <out.glb> [tris]  ->  one closed surface -> decimated -> colour lines cut in -> glb nodes `body` + `eyes`
(y 0..1 = antenna-bulb top, +z = his face; sRGB bytes on the body, linear bytes on the unlit part: eyes, lids, mouth, shell runes, antennae).
Reference: base-forms.md section 3 + the locked base ref (looked at, never traced, never in this repo). A hefty young turtle: a tall jade
domed shell cut into thick scutes (grooved in the surface, not only painted), a flared marginal rim, an amber plastron (the shell-glow),
a big round cream head with a wide gentle smile and big dark-teal eyes, four thick stub legs with three-toed pads, a short tail, and the two
little glowing antennae (Alex's call on the ref). The canon shell runes (spirits-species.md "shell patterns hold faint rune-light"; base-forms
"amber runic lines on the shell") = one gold ring + inner ring + centre dot per scute, unlit geometry in `eyes` (not colour cuts: thin marks on a
decimated body break into blobs, the Aurlotl lesson). Rings, not invented glyphs."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
from marching import surface
from sculpt_v2 import cone, ell, su, ss, cut, glb, normals, V3
TRIS = 7000; RE = .056; KE = RE / .066; LID = .060
SC, SR = V3(0, .345, -.07), V3(.43, .375, .47)                         # shell dome centre + radii
HC = V3(0, .455, .50)                                                  # head centre
AB, AT = V3(.062, .600, .505), V3(.150, .925, .470)                    # antenna base on the head, bulb centre (right side; M = |x|)
LEGS = [((.215, .265, .235), (.325, .062, .335)), ((.215, .245, -.300), (.320, .062, -.375))]   # front, hind: shoulder -> foot
def _dome_y(x, z): return SC[1] + SR[1] * np.sqrt(np.clip(1 - (x / SR[0]) ** 2 - (z / SR[2]) ** 2, 0, 1))
# scute centres on the dome (M space, x >= 0): three vertebrals on the ridge, three costals a side, a ring of marginals at the lip
_cz = lambda x, z: (x, _dome_y(x, z - SC[2]), z)
SCUTES = [_cz(0, SC[2] + z) for z in (-.24, .02, .27)] + [_cz(.25, SC[2] + z) for z in (-.25, .02, .27)]
MARG = [(.98 * SR[0] * np.sin(t), .335, SC[2] + .98 * SR[2] * np.cos(t)) for t in np.linspace(0, np.pi, 8)]
CEN = np.array(SCUTES + MARG)
def scute_gap(M):
    """second-nearest minus nearest scute centre: 0 on a seam between two scutes"""
    d = np.sort(np.linalg.norm(M[..., None, :] - CEN, axis=-1), -1); return d[..., 1] - d[..., 0]
def dome(M):
    d = ss(ell(M, SC, SR), M[..., 1] - .262, .03)                                                       # dome, bottom cut flat
    return d + .011 * np.exp(-(scute_gap(M) / .013) ** 2) * (M[..., 1] > .30)                           # the scute seams, grooved in
def rim(M): return ell(M, (0, .300, SC[2]), (.465, .052, .505))                                        # the flared marginal lip
def plastron(M): return su(ell(M, (0, .240, -.050), (.335, .115, .410)), ell(M, (0, .255, .230), (.235, .105, .150)), .05)   # + the chest plate under the chin
def shell(M): return su(su(dome(M), rim(M), .04), plastron(M), .05)
def head(M):
    d = ell(M, HC, (.195, .170, .170)); d = su(d, ell(M, HC + V3(0, -.060, .060), (.175, .100, .120)), .05)   # round skull + full jaw
    return su(d, ell(M, HC + V3(.120, -.040, .020), (.090, .085, .090)), .05)                                  # cheeks (M = |x|)
def neck(M): return cone(M, (0, .345, .200), (0, .425, .420), .125, .118)
def legs(M):
    d = 9
    for a, b in LEGS:
        a, b = V3(*a), V3(*b); d = np.minimum(d, cone(M, a, b + V3(0, .030, 0), .098, .080))
        d = su(d, ell(M, b + V3(.006, -.017, .012), (.092, .046, .098)), .03)                         # the pad
        for k, t in enumerate((-.55, 0, .55)): d = su(d, ell(M, b + V3(.055 * np.sin(t) + .010, -.030, .078 * np.cos(t)), (.030, .028, .030)), .014)   # toes
    return d
def claws(M):
    d = 9
    for a, b in LEGS:
        b = V3(*b)
        for t in (-.55, 0, .55): d = np.minimum(d, ell(M, b + V3(.068 * np.sin(t) + .012, -.034, .098 * np.cos(t)), (.018, .016, .018)))
    return d
def tail(P): return cone(P, (0, .230, -.430), (0, .150, -.610), .060, .022)
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = su(shell(M), tail(P), .04); d = su(d, legs(M), .04); d = su(d, neck(M), .05); d = su(d, head(M), .06)
    return su(d, claws(M), .01)
def grad(P, e=2e-3):
    g = np.stack([field(P + np.eye(3)[i] * e) - field(P - np.eye(3)[i] * e) for i in range(3)], -1); return g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)
def ray(p, u, hi):
    p, u = np.broadcast_arrays(np.atleast_2d(np.asarray(p, float)), np.atleast_2d(np.asarray(u, float))); lo, hi = np.zeros(len(p)), np.full(len(p), hi)
    for _ in range(26): m = (lo + hi) / 2; f = field(p + u * m[:, None]) < 0; lo, hi = np.where(f, m, lo), np.where(f, hi, m)
    return p + u * lo[:, None]
C8 = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])
SKIN, SHELLC, GROOVE, PLAST, CLAWC, BLUSH, HEADC = map(C8, ('#e2ebcd', '#74b287', '#3f7a55', '#f0cd70', '#f6f1dc', '#efc8a6', '#e2ebcd'))
RUNE, BULB, STALK = (236, 198, 104), (255, 232, 132), (214, 226, 158)
def classes(V):
    M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; dm, rm, pl, hd, nk, lg, tl, cl = dome(M), rim(M), plastron(M), head(M), neck(M), legs(M), tail(V), claws(M)
    soft = np.minimum(np.minimum(hd, nk), np.minimum(lg, tl)); sh = np.minimum(dm, rm); out = []
    out.append(np.clip(np.minimum(np.minimum(sh, soft), cl) - pl, -.05, .05))                                            # amber plastron
    out.append(np.clip(np.minimum(np.minimum(pl, soft), cl) - sh + .004, -.05, .05))                                     # jade shell + lip
    g = scute_gap(M); out.append(np.where((out[1] > 0) & (V[:, 1] > .29), .0105 - g, -.05))                              # dark seams
    out.append(np.where(V[:, 1] < .35, np.clip(np.minimum(np.minimum(sh, pl), soft) - cl + .006, -.05, .05), -.05))     # pale claws
    out.append(np.where((V[:, 2] > .45) & (hd < np.minimum(sh, nk)), .034 - np.linalg.norm((M - V3(.150, .415, .600)) * V3(1, 1.3, .7), axis=1), -.05))   # cheek blush
    return out
PAL = [PLAST, SHELLC, GROOVE, CLAWC, BLUSH]

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
def runes():
    """per vertebral + costal scute: an outer gold ring, an inner ring, a centre dot (mirrored for the costals)"""
    parts = []
    for c in SCUTES:
        for s in ((1,) if c[0] == 0 else (1, -1)):
            cc = V3(c[0] * s, c[1], c[2]); p = ray(SC, (cc - SC) / np.linalg.norm(cc - SC), 1.)[0]; n, t1, t2 = frame(p)
            for r, wd in ((.072, .0062), (.040, .0050)):
                a = np.arange(28) / 28 * 2 * np.pi; tg = p + r * (np.cos(a)[:, None] * t1 + np.sin(a)[:, None] * t2); Q = ray(SC, (tg - SC) / np.linalg.norm(tg - SC, axis=1, keepdims=True), 1.)
                parts.append(strip(Q, RUNE, wd, closed=True))
            parts.append(disc(p, n, t1, t2, .012, RUNE))
            for t in np.arange(6) / 6 * 2 * np.pi + np.pi / 6:                                         # six short spokes between the rings
                tg = p + np.outer(np.linspace(.046, .066, 4), np.cos(t) * t1 + np.sin(t) * t2); Q = ray(SC, (tg - SC) / np.linalg.norm(tg - SC, axis=1, keepdims=True), 1.); parts.append(strip(Q, RUNE, .0042))
    return parts
def eyes():
    parts = []
    o = V3(.090, .490, .520); n = V3(.50, .10, 1.); n /= np.linalg.norm(n); lo, hi = 0, .5
    for _ in range(40): m = (lo + hi) / 2; lo, hi = (m, hi) if field((o + n * m)[None])[0] < 0 else (lo, m)
    E = o + n * lo; n = grad(E[None], 2e-3)[0]; ux = np.cross(V3(0, 1, 0), n); ux /= np.linalg.norm(ux); uy = np.cross(n, ux); print('eye at', E.round(3), 'n', n.round(2))
    a = np.arange(24) / 24 * 2 * np.pi; rim_ = E + RE * (np.cos(a)[:, None] * ux + np.sin(a)[:, None] * uy); hh = np.full(24, .05)
    for _ in range(60): hh -= np.clip(field(rim_ + hh[:, None] * n), -.02, .02) * .7
    base = hh.max() + .003; dome_ = lambda r: base + .024 * KE * (1 - (r / RE) ** 2)
    def cap(s, x0, y0, rad, col, dz, rings=3, n_=20, ry=1.08):
        a = np.arange(n_) / n_ * 2 * np.pi; X = np.array([(x0, y0)] + [(x0 + rad * k / rings * np.cos(t), y0 + ry * rad * k / rings * np.sin(t)) for k in range(1, rings + 1) for t in a]); F = [(0, 1 + i, 1 + (i + 1) % n_) for i in range(n_)]
        for k in range(rings - 1):
            p, q = 1 + k * n_, 1 + (k + 1) * n_
            for i in range(n_): j = (i + 1) % n_; F += [(p + i, q + i, q + j), (p + i, q + j, p + j)]
        P = E + X[:, :1] * ux + X[:, 1:] * uy + (dome_(np.minimum(np.hypot(X[:, 0], X[:, 1] / 1.08), RE)) + dz)[:, None] * n; F = np.array(F)
        if rad > .04: P = np.vstack([P, P[-n_:] - .022 * n]); m = 1 + (rings - 1) * n_; F = np.vstack([F, [f for i in range(n_) for f in ((m + i, m + n_ + i, m + n_ + (i + 1) % n_), (m + i, m + n_ + (i + 1) % n_, m + (i + 1) % n_))]])
        P = P * V3(s, 1, 1); parts.append((P, F if s > 0 else F[:, ::-1], col))
    k = KE
    for s in (1, -1):
        cap(s, 0, 0, RE, (24, 52, 60), 0, 2); cap(s, 0, -.003 * k, .0575 * k, (46, 132, 150), .0018 * k, 2); cap(s, 0, .004 * k, .0480 * k, (14, 20, 26), .0036 * k, 2)
        cap(s, -s * .016 * k, .022 * k, .0200 * k, (255, 253, 248), .0056 * k, 1, 12); cap(s, s * .018 * k, -.022 * k, .0085 * k, (200, 236, 236), .0054 * k, 1, 8)
        k0 = len(parts); cap(s, 0, 0, RE + .003, tuple(HEADC), .0085 * k, 3); q = np.linspace(-1, 1, 11); up = np.c_[q * .052 * k, (-.010 - .020 * (1 - q * q)) * k]; dn = up + np.c_[0 * q, (-.004 - .007 * (1 - q * q)) * k]; X = np.vstack([up, dn])
        F = np.array([f for i in range(10) for f in ((i, 11 + i, 12 + i), (i, 12 + i, i + 1))]); P = (E + X[:, :1] * ux + X[:, 1:] * uy + (dome_(np.minimum(np.hypot(X[:, 0], X[:, 1]), RE)) + .0115 * k)[:, None] * n) * V3(s, 1, 1); parts.append((P, F if s > 0 else F[:, ::-1], (60, 92, 70)))
        for j in range(k0, len(parts)): parts[j] = (parts[j][0] - V3(0, 0, LID), *parts[j][1:])
    for s in (1, -1):                                                                                     # nostrils: two small dark dots high on the snout
        p = ray(HC, V3(s * .10, .02, 1) / np.linalg.norm([.10, .02, 1]), .4)[0]; n_, t1, t2 = frame(p); parts.append(disc(p, n_, t1, t2, .0085, (70, 92, 72), .003, 10))
    # the wide gentle smile: one curve across the jaw front, turned up at the corners
    xs = np.linspace(-.105, .105, 15); Q = np.array([ray(HC + V3(0, -.07, 0), V3(x, -.072 + .30 * x * x - .02, .14) / np.linalg.norm([x, -.072 + .30 * x * x - .02, .14]), .4)[0] for x in xs])
    parts.append(strip(Q, (62, 80, 58), .0050, .0030))
    parts += runes()
    for s in (1, -1):                                                                                     # antennae: a tapered stalk and a glowing bulb (rigged on ant / ant2)
        X = V3(s, 1, 1); a, b = AB * X, AT * X; k_ = 10; L = 12; Pp, Ff = [], []
        ax = (b - a) / np.linalg.norm(b - a); t1 = np.cross(ax, V3(0, 0, 1)); t1 /= np.linalg.norm(t1); t2 = np.cross(ax, t1)
        for i in range(L + 1):
            u = i / L; c = a - ax * .03 + (b - a + ax * .03) * u + V3(0, 0, .03) * np.sin(np.pi * u); r = .017 - .007 * u; an = np.arange(k_) / k_ * 2 * np.pi
            Pp += list(c + r * (np.cos(an)[:, None] * t1 + np.sin(an)[:, None] * t2))
        for i in range(L):
            for j in range(k_): p0, p1, q0, q1 = i * k_ + j, i * k_ + (j + 1) % k_, (i + 1) * k_ + j, (i + 1) * k_ + (j + 1) % k_; Ff += [(p0, p1, q1), (p0, q1, q0)]
        Pp = np.array(Pp); Ff = np.array(Ff); c0 = Pp[:k_].mean(0); test = np.cross(Pp[Ff[0][1]] - Pp[Ff[0][0]], Pp[Ff[0][2]] - Pp[Ff[0][0]]) @ (Pp[Ff[0][0]] - (a + (b - a) * .0))
        parts.append((Pp, Ff if test > 0 else Ff[:, ::-1], STALK))
        u_, v_ = np.meshgrid(np.linspace(0, np.pi, 9), np.arange(14) / 14 * 2 * np.pi, indexing='ij'); S = np.c_[(np.sin(u_) * np.cos(v_)).ravel(), np.cos(u_).ravel(), (np.sin(u_) * np.sin(v_)).ravel()]
        P = b + S * V3(.040, .046, .040); Fb = [(i * 14 + j, i * 14 + (j + 1) % 14, (i + 1) * 14 + (j + 1) % 14) for i in range(8) for j in range(14)] + [(i * 14 + j, (i + 1) * 14 + (j + 1) % 14, (i + 1) * 14 + j) for i in range(8) for j in range(14)]
        Fb = np.array(Fb); tn = np.cross(P[Fb[20][1]] - P[Fb[20][0]], P[Fb[20][2]] - P[Fb[20][0]]) @ (P[Fb[20][0]] - b); parts.append((P, Fb if tn > 0 else Fb[:, ::-1], BULB))
    return parts
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
def finish(V, F, path, eye):
    M = lambda V: np.c_[np.abs(V[:, 0]), V[:, 1:]]
    V, F = refine(V, F, lambda V: ((scute_gap(M(V)) < .035) & (V[:, 1] > .29)) | ((V[:, 2] > .45) & (V[:, 1] > .33)), .028)
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(F), -1); C = classes
    for k in range(len(PAL)): V, F, lab, side = cut(V, F, lab, C(V)[k]); lab = np.where(side, k, lab)
    N = grad(V, .006); cols = np.array([PAL[k] if k >= 0 else SKIN for k in lab]); key, inv = np.unique(np.c_[F.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN = V[key[:, 0]], N[key[:, 0]]; CC = np.c_[key[:, 1:], np.full(len(key), 255)].astype(float); FF = inv.reshape(-1, 3)
    sh = np.clip(.5 + .5 * NN[:, 1], 0, 1) * np.clip(.35 + VV[:, 1] * 1.2, .35, 1); CC[:, :3] = CC[:, :3] * (.84 + .16 * sh[:, None])   # soft painted top light, deeper underneath
    eV, eF, eC = join(eye); glb(path, dict(body=(VV, FF, np.round(CC), NN), eyes=(eV, eF, eC, normals(eV, eF)))); print('body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF))

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else TRIS
    import trimesh
    lo, hi, h = V3(-.52, -.033, -.66), V3(.52, .76, .72), .0078
    V, F = surface(field, lo, hi, h); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False); print('raw', len(F), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number, 'bounds', k.bounds.round(3).tolist())
    t = decimate(k.vertices, k.faces, TRIS); X = np.array(t.vertices)
    for _ in range(3): X = X - grad(X, 3e-3) * np.clip(field(X), -.004, .004)[:, None] * .6
    t = trimesh.Trimesh(X, np.array(t.faces), process=False); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    finish(np.array(t.vertices), np.array(t.faces), OUT, eyes())
