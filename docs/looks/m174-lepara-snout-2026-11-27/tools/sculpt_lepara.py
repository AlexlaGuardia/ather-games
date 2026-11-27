"""Lepara base form (M174): a signed-distance sculpt (numpy + scipy, no art asset, no outside service), the Dewbear / Vulnyx v2 route.
python sculpt_lepara.py <out.glb> [tris]  ->  one closed surface -> decimated -> colour lines cut in -> glb nodes `body` + `eyes`
(y 0..1 = ear tip, +z = her face; sRGB bytes on the body, linear bytes on the unlit part: eyes, lids, nostrils).
Reference: base-forms.md section 8 + the locked base ref (looked at, never traced, never in this repo). A chubby rabbit x platypus
kit sitting up: long soft ears, round lilac-grey head with full cheeks, a soft round manatee-like snout (two puffy muzzle pads, no bill
edge; M174 rework, Alex 11-26) with canon's twitchy rabbit nose (spirits-species.md), a cream pear body, small forepaws
on the belly, big hind feet out in front, a flat paddle tail behind."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
from marching import surface
from sculpt_v2 import cone, ell, su, ss, cut, glb, normals, V3
NOSE = [0.]; TRIS = 5200; RE = .046; KE = RE / .066; LID = .060
HC = V3(0, .555, .050)                                             # head centre
EA = .24                                                           # ear tilt out from vertical (rad)
EC = V3(.148, .835, -.016)                                         # ear centre (right side; M = |x|)
ER = np.c_[[np.cos(EA), -np.sin(EA), 0], [np.sin(EA), np.cos(EA), 0], [0, 0, 1]]
def ears(M):
    d = ell(M, EC, (.082, .188, .033), ER)
    return ss(d, -ell(M, EC + ER @ V3(0, .014, .026), (.056, .150, .022), ER), .008)          # the cupped front of the ear
def head(M):
    d = ell(M, HC, (.220, .180, .190)); d = su(d, ell(M, HC + V3(.140, -.070, .055), (.120, .100, .110)), .06)   # full low cheeks
    d = su(d, ell(M, HC + V3(0, .060, -.040), (.170, .120, .150)), .05)                                       # round crown
    return d
def bill(M):
    """the snout (name kept so the rig's part masks are unchanged): a broad soft bridge + two puffy muzzle pads with a shallow cleft, manatee-like"""
    d = ell(M, (0, .508, .238), (.092, .060, .072))                                                          # bridge, rising into the face
    return su(d, ell(M, (.044, .466, .262), (.070, .060, .064)), .03)                                       # the two pads (M = |x|)
def body(M):
    d = ell(M, (0, .200, -.010), (.250, .220, .230)); d = su(d, ell(M, (0, .335, .025), (.170, .120, .150)), .06)
    return su(d, ell(M, (.150, .130, -.030), (.120, .120, .150)), .05)                                        # haunches
def feet(M):
    c = V3(.130, .036, .170); d = ell(M, c, (.066, .040, .100))
    for dx in (-.032, 0, .032): d = su(d, ell(M, c + V3(dx, -.004, .085), (.024, .026, .026)), .012)
    return d
def arms(M):
    d = cone(M, (.170, .335, .070), (.142, .245, .185), .046, .040)
    return su(d, ell(M, (.142, .238, .205), (.046, .036, .040)), .02)
def tail(P): return ell(P, (0, .088, -.318), (.088, .042, .118))
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = su(body(M), tail(P), .05); d = su(d, feet(M), .03); d = su(d, arms(M), .025); d = su(d, head(M), .07); d = su(d, bill(M), .06)
    return su(d, ears(M), .035)
def grad(P, e=2e-3):
    g = np.stack([field(P + np.eye(3)[i] * e) - field(P - np.eye(3)[i] * e) for i in range(3)], -1); return g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)
def ray(p, u, hi):
    p, u = np.broadcast_arrays(np.atleast_2d(np.asarray(p, float)), np.atleast_2d(np.asarray(u, float))); lo, hi = np.zeros(len(p)), np.full(len(p), hi)
    for _ in range(26): m = (lo + hi) / 2; f = field(p + u * m[:, None]) < 0; lo, hi = np.where(f, m, lo), np.where(f, hi, m)
    return p + u * lo[:, None]
C8 = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])
CREAM, HEADC, BELLY, EARIN, BILLC, BLUSH = map(C8, ('#f4ece4', '#e4dee8', '#fff8ec', '#f5ad98', '#f7f1f2', '#f3bdb6'))
def parts_d(V):
    M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; return M, body(M), head(M), ears(M), bill(M), feet(M), arms(M), tail(V)
def classes(V):
    M, bd, hd, er, bl, ft, am, tl = parts_d(V); x, y, z = M.T; low = np.minimum(np.minimum(bd, ft), np.minimum(am, tl)); hh = np.minimum(hd, er); out = []
    out.append(np.where((z > .02) & (y < .40), .045 - np.linalg.norm((M - V3(0, .200, .22)) * V3(1 / 1.45, 1 / 1.25, .5), axis=1) * .3, -.05))   # pale belly front
    out.append(np.clip(low - hh, -.05, .05))                                                                                  # lilac head + ears
    q = (M - EC) @ ER; out.append(np.where((q[:, 2] > -.004) & (er < hd), .82 - np.linalg.norm(q[:, :2] / V3(.056, .152, 1)[:2], axis=1), -.05))  # pink in the ear
    out.append(np.where((z > .14) & (hd < bl), .040 - np.linalg.norm((M - V3(.150, .470, .200)) * V3(1, 1.25, .6), axis=1), -.05))          # blush on the cheeks
    out.append(np.where(z > .17, np.clip(np.minimum(hd, low) - bl + .012, -.05, .05), -.05))                                  # the pale muzzle
    return out
PAL = [BELLY, HEADC, EARIN, BLUSH, BILLC]

def eyes():
    parts = []
    o = V3(.090, .572, .060); n = V3(.42, .04, 1.); n /= np.linalg.norm(n); lo, hi = 0, .5
    for _ in range(40): m = (lo + hi) / 2; lo, hi = (m, hi) if field((o + n * m)[None])[0] < 0 else (lo, m)
    E = o + n * lo; n = grad(E[None], 2e-3)[0]; ux = np.cross(V3(0, 1, 0), n); ux /= np.linalg.norm(ux); uy = np.cross(n, ux); print('eye at', E.round(3), 'n', n.round(2))
    a = np.arange(24) / 24 * 2 * np.pi; rim = E + RE * (np.cos(a)[:, None] * ux + np.sin(a)[:, None] * uy); hh = np.full(24, .05)
    for _ in range(60): hh -= np.clip(field(rim + hh[:, None] * n), -.02, .02) * .7
    base = hh.max() + .003; dome = lambda r: base + .024 * KE * (1 - (r / RE) ** 2)
    def cap(s, x0, y0, rad, col, dz, rings=3, n_=20, ry=1.08):
        a = np.arange(n_) / n_ * 2 * np.pi; X = np.array([(x0, y0)] + [(x0 + rad * k / rings * np.cos(t), y0 + ry * rad * k / rings * np.sin(t)) for k in range(1, rings + 1) for t in a]); F = [(0, 1 + i, 1 + (i + 1) % n_) for i in range(n_)]
        for k in range(rings - 1):
            p, q = 1 + k * n_, 1 + (k + 1) * n_
            for i in range(n_): j = (i + 1) % n_; F += [(p + i, q + i, q + j), (p + i, q + j, p + j)]
        P = E + X[:, :1] * ux + X[:, 1:] * uy + (dome(np.minimum(np.hypot(X[:, 0], X[:, 1] / 1.08), RE)) + dz)[:, None] * n; F = np.array(F)
        if rad > .04: P = np.vstack([P, P[-n_:] - .022 * n]); m = 1 + (rings - 1) * n_; F = np.vstack([F, [f for i in range(n_) for f in ((m + i, m + n_ + i, m + n_ + (i + 1) % n_), (m + i, m + n_ + (i + 1) % n_, m + (i + 1) % n_))]])
        P = P * V3(s, 1, 1); parts.append((P, F if s > 0 else F[:, ::-1], col))
    k = KE
    for s in (1, -1):
        cap(s, 0, 0, RE, (92, 66, 58), 0, 2); cap(s, 0, -.003 * k, .0575 * k, (150, 104, 80), .0018 * k, 2); cap(s, 0, .004 * k, .0505 * k, (38, 24, 22), .0036 * k, 2)
        cap(s, -s * .014 * k, .022 * k, .0215 * k, (255, 253, 248), .0056 * k, 1, 12); cap(s, s * .018 * k, -.022 * k, .0085 * k, (236, 214, 200), .0054 * k, 1, 8)
        k0 = len(parts); cap(s, 0, 0, RE + .003, tuple(HEADC), .0085 * k, 3); q = np.linspace(-1, 1, 11); up = np.c_[q * .050 * k, (-.012 - .020 * (1 - q * q)) * k]; dn = up + np.c_[0 * q, (-.004 - .007 * (1 - q * q)) * k]; X = np.vstack([up, dn])
        F = np.array([f for i in range(10) for f in ((i, 11 + i, 12 + i), (i, 12 + i, i + 1))]); P = (E + X[:, :1] * ux + X[:, 1:] * uy + (dome(np.minimum(np.hypot(X[:, 0], X[:, 1]), RE)) + .0115 * k)[:, None] * n) * V3(s, 1, 1); parts.append((P, F if s > 0 else F[:, ::-1], (70, 56, 66)))
        for j in range(k0, len(parts)): parts[j] = (parts[j][0] - V3(0, 0, LID), *parts[j][1:])
    # the rabbit nose: a soft pink rounded inverted triangle on the bridge top, and a little Y mouth down the cleft (nodes in `eyes`, the rig twitches it)
    p = ray(V3(0, .505, .10), V3(0, .05, 1) / np.linalg.norm([0, .05, 1]), .3)[0]; nn = grad(p[None], .004)[0]; e1 = V3(1, 0, 0); e2 = np.cross(nn, e1); e2 /= np.linalg.norm(e2)
    if e2[1] < 0: e2 = -e2
    a = np.arange(18) / 18 * 2 * np.pi; r = .025 * (1 - .28 * np.sin(a) ** 2 * (np.sin(a) < 0)); X = np.c_[r * np.cos(a) * (1 - .35 * (np.sin(a) < 0) * -np.sin(a)), .015 * np.sin(a) + .004]
    P = np.vstack([[p + nn * .0045], p + nn * .0030 + X[:, :1] * e1 + X[:, 1:] * e2]); F = np.array([(0, 1 + i, 1 + (i + 1) % 18) for i in range(18)])
    parts.append((P, F if np.cross(P[1] - P[0], P[2] - P[0]) @ nn > 0 else F[:, ::-1], (214, 130, 136)))
    NOSE[:] = [p[1]]
    for side in (1, -1):                                                                                  # the mouth: a short drop then a curl out on each side
        Q = [ray(V3(side * x, y, .10), V3(0, 0, 1), .3)[0] for x, y in ((0, .486), (0, .468), (.012, .452), (.026, .449), (.036, .455))]; Q = np.array(Q)
        G = grad(Q, .004); T = np.gradient(Q, axis=0); Bn = np.cross(T, G); Bn /= np.linalg.norm(Bn, axis=1, keepdims=True); wd = .0032
        P = np.vstack([Q + G * .0028 + Bn * wd, Q + G * .0028 - Bn * wd]); n_ = len(Q); F = np.array([f for i in range(n_ - 1) for f in ((i, n_ + i, n_ + i + 1), (i, n_ + i + 1, i + 1))])
        parts.append((P, F if np.cross(P[1] - P[0], P[n_] - P[0]) @ G[0] > 0 else F[:, ::-1], (120, 84, 92)))
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
    V, F = refine(V, F, lambda V: (V[:, 2] > .10) & (V[:, 1] > .40) & (V[:, 1] < .66), .045)
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(F), -1); C = classes
    for k in range(len(PAL)): V, F, lab, side = cut(V, F, lab, C(V)[k]); lab = np.where(side, k, lab)
    N = grad(V, .006); cols = np.array([PAL[k] if k >= 0 else CREAM for k in lab]); key, inv = np.unique(np.c_[F.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN = V[key[:, 0]], N[key[:, 0]]; CC = np.c_[key[:, 1:], np.full(len(key), 255)].astype(float); FF = inv.reshape(-1, 3)
    sh = np.clip(.5 + .5 * NN[:, 1], 0, 1) * np.clip(.35 + VV[:, 1] * 1.2, .35, 1); CC[:, :3] = CC[:, :3] * (.86 + .14 * sh[:, None])   # soft painted top light, deeper underneath
    eV, eF, eC = join(eye); glb(path, dict(body=(VV, FF, np.round(CC), NN), eyes=(eV, eF, eC, normals(eV, eF)))); print('body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF))

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else TRIS
    import trimesh
    lo, hi, h = V3(-.36, -.033, -.52), V3(.36, 1.07, .40), .0078
    V, F = surface(field, lo, hi, h); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False); print('raw', len(F), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number, 'bounds', k.bounds.round(3).tolist())
    t = decimate(k.vertices, k.faces, TRIS); X = np.array(t.vertices)
    for _ in range(3): X = X - grad(X, 3e-3) * np.clip(field(X), -.004, .004)[:, None] * .6
    t = trimesh.Trimesh(X, np.array(t.faces), process=False); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    finish(np.array(t.vertices), np.array(t.faces), OUT, eyes())
