"""Athowl base form: a signed-distance sculpt (numpy + scipy, no art asset), the Vulnyx v2 route.   python sculpt.py <out.glb> [tris]
-> one closed surface -> decimated -> crisp colour lines -> glb nodes `body` + `eyes` (y 0..1, +z = her face, raw sRGB bytes on
the body, linear bytes on the unlit eyes). Reference: base-forms.md section 2 + athowl_01.png (looked at, not traced; every
landmark below is a pixel of it / 878). The wings are blades cut free of the body, the head sits on a neck hidden in a groove
under its rim (so it can turn right round)."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
from marching import surface
from sculpt_v2 import cone, ell, su, ss, cut, glb, decimate, normals, V3, rx, rz
TRIS = 4100; LID = .075
NECK_Y = .497; NECK_R = (.135, .30)                                     # the groove: its mid height, its inner and outer radius
# ── wing: local frame at the shoulder, u down the blade, w across it (+ = front edge), n out ──
SH = V3(.283, .448, .010); WU = V3(.318, .130, .020) - SH; WL = np.linalg.norm(WU); WU /= WL
_n = V3(np.cos(.50), 0, np.sin(.50)); WN = _n - (_n @ WU) * WU; WN /= np.linalg.norm(WN); WW = -np.cross(WU, WN) if np.cross(WU, WN)[2] < 0 else np.cross(WU, WN)
FEATH = [(.36, 0, .41, .118, 0), (.63, .042, .39, .054, 1), (.56, -.018, .375, .060, 1), (.46, -.072, .36, .056, 1)]       # t mid, w mid, half length, half width, pointed
def wingloc(M):
    q = M - SH; t = (q @ WU) / WL; w = q @ WW; bow = .042 * np.sin(np.pi * np.clip(t, 0, 1)) - 1.5 * w * w; return t, w, q @ WN - bow
def blade(M, grow=0):
    t, w, n = wingloc(M); d = np.full(M.shape[:-1], 9.)
    for tc, wc, a, hw, pt in FEATH:
        v = (t - tc) / (a + grow / WL); th = (.034 if not pt else .022) + grow; h = hw + grow
        if pt: h = h * np.clip(1 - np.abs(v) ** 2.4, .02, 1); k = np.sqrt(((w - wc) / h) ** 2 + (n / (th * np.clip(1.06 - np.abs(v) ** 3, .12, 1))) ** 2); e = np.maximum((k - 1) * np.minimum(h, th), (np.abs(v) - 1) * .2)
        else: k = np.sqrt(v ** 2 + ((w - wc) / h) ** 2 + (n / th) ** 2); e = (k - 1) * th
        d = su(d, e, .012)
    return d
TUFT = [(.0, .655, .285), (.07, .735, .285), (.165, .822, .235), (.262, .872, .150), (.322, .922, .105), (.366, .997, .080)]; TR = [.022, .048, .080, .066, .036, .003]
def tufts(M):
    d = np.full(M.shape[:-1], 9.)
    for a, b, ra, rb in zip(TUFT, TUFT[1:], TR, TR[1:]): d = su(d, cone(M, a, b, ra, rb), .025)
    d = su(d, cone(M, (.255, .862, .13), (.338, .905, .04), .052, .004), .03)                 # the back feather of the tuft
    return d
def yrot(a): c, s = np.cos(a), np.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
DC = V3(.160, .645, .150); DR = yrot(.30)                                                     # a face disc looks a little outward
def head(M):
    d = ell(M, (0, .715, -.005), (.305, .226, .268))
    d = su(d, ell(M, DC, (.152, .146, .128), DR), .05)
    d = ss(d, ell(M, DC + V3(0, 0, .158) @ DR.T * 1., (.128, .122, .052), DR), .014)           # the disc is a shallow dish
    d = su(d, ell(M, DC + V3(-.014, .010, .098) @ DR.T, (.092, .092, .032), DR), .012)         # and the eye a low dome in it
    d = su(d, tufts(M), .032)
    d = su(d, ell(M, (0, .885, 0), (.13, .058, .13)), .06)                                    # crown
    b = cone(M, (0, .648, .275), (0, .590, .318), .037, .030); b = su(b, cone(M, (0, .592, .316), (0, .538, .322), .030, .005), .02); return su(d, b, .010)
def feet(M):
    d = cone(M, (.130, .17, .0), (.145, .058, .012), .088, .050)
    d = su(d, ell(M, (.146, .044, .030), (.054, .044, .058)), .02)
    for x, z in ((-.062, .098), (0, .122), (.060, .098)): d = su(d, cone(M, (.148 + x * .5, .040, .045), (.148 + x * 1.06, .035, z), .030, .035), .005); d = su(d, cone(M, (.148 + x * 1.06, .030, z + .022), (.148 + x * 1.085, .013, z + .040), .014, .009), .004)
    return d
def back(P):
    """a short flat fan"""
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); d = su(cone(P * V3(.75, 1, 1), (0, .24, -.19), (0, .16, -.28), .075, .045), cone(P * V3(.34, 1, 1), (0, .16, -.27), (0, .092, -.375), .034, .019), .04)
    return su(d, cone(M, (.045, .115, -.34), (.052, .080, -.425), .030, .012), .02)
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    u = np.clip((M[..., 1] - .22) / .18, 0, 1); N = M / np.stack([1 - .20 * u * u * (3 - 2 * u), np.ones_like(u), np.ones_like(u)], -1)      # the sides drawn in under the wings
    b = ell(N, (0, .268, 0), (.296, .222, .266)); b = su(b, ell(M, (0, .355, .015), (.205, .165, .205)), .10)
    b = su(b, back(P), .06); b = su(b, feet(M), .035)
    b = ss(b, np.maximum(blade(M, .019), .088 - np.linalg.norm(M - V3(.245, .432, .004), axis=-1)), .006)                                 # the body is cut back from the blade
    b = su(b, cone(M, (.17, .415, .0), (.285, .425, .008), .055, .038), .018); b = su(b, blade(M), .010)
    h = head(M); r = np.sqrt(P[..., 0] ** 2 + P[..., 2] ** 2); g = np.sqrt(((r - .345) / (.345 - NECK_R[0])) ** 2 + ((P[..., 1] - NECK_Y) / .017) ** 2)
    d = su(b, cone(P, (0, .44, 0), (0, .60, 0), .15, .15), .01); d = np.minimum(d, h); return ss(d, np.maximum((g - 1) * .017, NECK_R[0] - r), .004)

C8 = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])
SILVER, LAV, WHITE, CREAM, HORN, CLAW, TOE = map(C8, ('#e6e0ee', '#b9a6d8', '#f8f5fc', '#f4e9d4', '#86703f', '#33291f', '#a07d4c'))
zig = lambda u, n: np.abs(((u * n) % 1) - .5) * 2
def lens(x, y, cx, cy, hw, hl):
    v = (y - cy) / hl; return (hw * np.clip(1 - v * v, 0, 1) ** .8 * np.where(v > .0, 1 - .35 * v, 1) - np.abs(x - cx)) * np.where(np.abs(v) < 1, 1, 0) + np.where(np.abs(v) < 1, 0, (1 - np.abs(v)) * hl)
def inwing(V):
    M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; t, w, n = wingloc(M); return np.where((blade(M) < .006) & (M[:, 1] < .47), 1, 0), t, w, n
def classes(V):
    x, y, z = V.T; A = np.abs(x); M = np.c_[A, y, z]; out = []; on, t, w, n = inwing(V)
    far = np.where(on == 1, 1., -1.)
    out.append(np.where(on == 1, (t - .56 - .16 * zig(w / .25 + .52, 4)) * WL, -.05))                                       # lavender wing edge
    out.append(np.where((on == 1) & (n > -.004), np.maximum.reduce([lens(w, -t * WL, wc, -tc * WL, .019, .056) for tc, wc in ((.27, .058), (.40, .004), (.25, -.052))]), -.05))     # white coverts
    tp = V3(.366, .997, .08); out.append(.150 + .022 * zig(y * .6 + z, 18) - np.linalg.norm(M - tp, axis=1))            # tuft tips lavender
    q = (M - DC) @ DR; e = 1 - np.sqrt((q[:, 0] / .138) ** 2 + (q[:, 1] / .131) ** 2); br = np.interp(A, [0, .07, .165, .262, .33], [.655 - .020, .735 - .046, .822 - .074, .872 - .062, .9])
    out.append(np.where(q[:, 2] > .02, np.minimum(e * .13, (br - y) * .8), -.05))                                          # cream face discs, under the brow
    L = [(0, .315, .028, .058), (.085, .335, .026, .05), (.155, .285, .026, .05), (.048, .235, .026, .05), (.118, .200, .024, .045), (0, .165, .022, .04)]
    out.append(np.where((z > .02) & (on == 0) & (y < .43), np.maximum.reduce([lens(A, y, *l) for l in L]), -.05))           # breast feathers
    out.append(np.where((z > .2) & (y < .67) & (y > .51), np.minimum(.041 - A, np.where(z > .10, z - np.interp(y, [.52, .56, .62, .66], [.25, .27, .283, .30]), -1)), -.05))          # beak
    out.append(np.where(A > .03, np.minimum(.080 - y, z - .035), -.05))                                            # toes
    out.append(np.where(y < .3, np.minimum(-.315 - z + .02 * zig(A, 12), .25 - y), -.05))                          # tail ends lavender
    return out
PAL = [LAV, WHITE, LAV, CREAM, WHITE, HORN, TOE, LAV]

def eyes():
    parts = []
    def zsurf(X, Y):
        z = np.full(len(X), .40)
        for _ in range(80): z -= np.clip(field(np.stack([X, Y, z], -1)), -.02, .02) * .7
        return z
    def lay(X, dz):
        P = np.c_[X, zsurf(X[:, 0], X[:, 1])]; e = 4e-3; g = np.stack([field(P + np.eye(3)[i] * e) - field(P - np.eye(3)[i] * e) for i in range(3)], -1); g /= np.linalg.norm(g, axis=1, keepdims=True); return P + g * dz, g
    def put(X, F, col, dz):
        P, g = lay(np.array(X), dz); F = np.array(F); nn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]); parts.append((P, F[:, ::-1] if (nn * g[F[:, 0]]).sum() < 0 else F, col))
    def patch(pts, col, dz, rings=2):
        pts = np.array(pts); c = pts.mean(0); n = len(pts); X = [c]
        for r in range(1, rings + 1): X += list(c + (pts - c) * r / rings)
        F = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
        for r in range(rings - 1):
            a, b = 1 + r * n, 1 + (r + 1) * n
            for i in range(n): j = (i + 1) % n; F += [(a + i, b + i, b + j), (a + i, b + j, a + j)]
        put(X, F, col, dz)
    def ring(o, i_, col, dz):
        n = len(o); put(np.vstack([o, i_]), [f for k in range(n) for f in ((k, (k + 1) % n, n + (k + 1) % n), (k, n + (k + 1) % n, n + k))], col, dz)
    circ = lambda cx, cy, r, n=22, ry=1.: np.c_[cx + r * np.cos(np.arange(n) / n * 2 * np.pi), cy + r * ry * np.sin(np.arange(n) / n * 2 * np.pi)]
    EC = DC + V3(-.016, .012, 0) @ DR.T
    disc = DR @ V3(0, 0, 1); ux, uy = DR @ V3(1, 0, 0), V3(0, 1, 0); RE = .084
    a = np.arange(24) / 24 * 2 * np.pi; rim = EC + RE * (np.cos(a)[:, None] * ux + np.sin(a)[:, None] * uy) ; hh = np.full(24, .30)
    for _ in range(80): hh -= np.clip(field(rim + hh[:, None] * disc), -.02, .02) * .7
    print('eye rim heights', hh.min().round(3), np.median(hh).round(3), hh.max().round(3)); base = np.median(hh) + .006
    dome = lambda r: base + .020 * (1 - (r / RE) ** 2)
    def cap(s, x0, y0, rad, col, dz, rings=3, n=24):
        a = np.arange(n) / n * 2 * np.pi; X = [(x0, y0)] + [(x0 + rad * k / rings * np.cos(t), y0 + rad * k / rings * np.sin(t)) for k in range(1, rings + 1) for t in a]; X = np.array(X); F = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
        for k in range(rings - 1):
            p, q = 1 + k * n, 1 + (k + 1) * n
            for i in range(n): j = (i + 1) % n; F += [(p + i, q + i, q + j), (p + i, q + j, p + j)]
        P = EC + X[:, :1] * ux + X[:, 1:] * uy + (dome(np.hypot(X[:, 0], X[:, 1])) + dz)[:, None] * disc; F = np.array(F)
        if rad > .08: P = np.vstack([P, P[-n:] - .030 * disc]); m = 1 + (rings - 1) * n; F = np.vstack([F, [f for i in range(n) for f in ((m + i, m + n + i, m + n + (i + 1) % n), (m + i, m + n + (i + 1) % n, m + (i + 1) % n))]])   # the ring's side wall, so no gap shows under its edge
        P = P * V3(s, 1, 1); parts.append((P, F if s > 0 else F[:, ::-1], col))
    for s in (1, -1):
        cap(s, 0, 0, RE, (74, 50, 24), 0, 2); cap(s, 0, 0, .0745, (200, 120, 10), .0016, 2); cap(s, 0, -.005, .0655, (242, 174, 28), .0032, 2); cap(s, 0, .003, .048, (26, 14, 8), .0048, 2)
        cap(s, s * .022, .030, .0175, (255, 252, 240), .0066, 1, 12); cap(s, -s * .020, -.028, .007, (226, 160, 60), .0064, 1, 8)
        # the closed lid: waits LID behind the eye inside the skull; the rig's lids bone brings it forward (blink, sleep)
        k0 = len(parts); cap(s, 0, 0, RE + .0015, (224, 212, 230), .0085, 3); q = np.linspace(-1, 1, 11); up = np.c_[q * .066, -.020 - .030 * (1 - q * q)]; dn = up + np.c_[0 * q, -.004 - .006 * (1 - q * q)]; X = np.vstack([up, dn])
        F = np.array([f for i in range(10) for f in ((i, 11 + i, 12 + i), (i, 12 + i, i + 1))]); P = (EC + X[:, :1] * ux + X[:, 1:] * uy + (dome(np.hypot(X[:, 0], X[:, 1])) + .0115)[:, None] * disc) * V3(s, 1, 1); parts.append((P, F if s > 0 else F[:, ::-1], (104, 80, 128)))
        for k in range(k0, len(parts)): parts[k] = (parts[k][0] - V3(0, 0, LID), *parts[k][1:])
        for x, z in ((-.062, .098), (0, .122), (.060, .098)):                                  # claws: dark, so they sit in the unlit part (the skin's floor would lift them to grey)
            b, t = V3(.148 + x * 1.06, .036, z + .024), V3(.148 + x * 1.09, .006, z + .050); n = 7; d = (t - b) / np.linalg.norm(t - b); e1 = V3(1, 0, 0); e2 = np.cross(d, e1); mm = b + (t - b) * .5 + V3(0, .010, .004)
            P = np.vstack([[c + r * (np.cos(q) * e1 + np.sin(q) * e2) for q in np.arange(n) / n * 2 * np.pi] for c, r in ((b, .0165), (mm, .0125))] + [[t]]); F = [f for i in range(n) for f in ((i, (i + 1) % n, n + (i + 1) % n), (i, n + (i + 1) % n, n + i), (n + i, n + (i + 1) % n, 2 * n))]; F = np.array(F)
            if (np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]) * (P[F].mean(1) - b)).sum() < 0: F = F[:, ::-1]
            P = P * V3(s, 1, 1); parts.append((P, F if s > 0 else F[:, ::-1], (58, 44, 30)))
    th = np.arange(24) / 24 * 2 * np.pi; GY = .815                                       # the faint gold third eye on the brow
    al = lambda k: np.c_[k * .070 * np.cos(th), GY + (k * .038 + .000) * np.sign(np.sin(th)) * np.abs(np.sin(th)) ** 1.35]
    ring(al(1), al(.84), (255, 222, 128), .0035); ring(circ(0, GY, .031, 18), circ(0, GY, .0135, 18), (255, 232, 160), .0035); patch(circ(0, GY, .0135, 12), (176, 128, 52), .0038, 1)
    V, F, C, o = [], [], [], 0
    for P, f, col in parts: V.append(P); F.append(f + o); C.append(np.tile((*np.round(255 * (np.array(col) / 255.) ** 2.2), 255), (len(P), 1))); o += len(P)
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
    for _ in range(4):
        e = 2e-3; g = np.stack([field(P + np.eye(3)[i] * e) - field(P - np.eye(3)[i] * e) for i in range(3)], -1); P = P - g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9) * np.clip(field(P), -.006, .006)[:, None] * .8
    V[k:] = P; return V, np.array(out)
def finish(V, F, path, eye):
    V, F = refine(V, F, lambda V: (inwing(V)[0] == 0) & (np.abs(V[:, 0]) < .22) & (V[:, 1] > .13) & (V[:, 1] < .40) & (V[:, 2] > .13), .030)
    V, F = refine(V, F, lambda V: (inwing(V)[0] == 1) & (inwing(V)[3] > 0), .027)
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(F), -1)
    for k in range(len(PAL)): V, F, lab, side = cut(V, F, lab, classes(V)[k]); lab = np.where(side, k, lab)
    ep = .006; N = np.stack([field(V + np.eye(3)[i] * ep) - field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    cols = np.array([PAL[k] if k >= 0 else SILVER for k in lab]); key, inv = np.unique(np.c_[F.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == SILVER).all(1); y = VV[:, 1]; sh = np.clip(.55 + .45 * NN[:, 1], 0, 1) * np.where(y < .5, np.clip((y - .02) / .36, .0, 1) * .55 + .45, 1)
    gr = np.clip(1 - np.abs(y - NECK_Y) / .03, 0, 1) * (np.hypot(VV[:, 0], VV[:, 2]) < .27); sh = np.clip(sh - .7 * gr, 0, 1)[:, None]
    CC[g, :3] = (C8('#cdc2e2') * (1 - sh[g]) + C8('#f1edf6') * sh[g])                          # lavender underneath, silver-white on top
    eV, eF, eC = eye; glb(path, dict(body=(VV, FF, CC, NN), eyes=(eV, eF, eC, normals(eV, eF)))); print('body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF))

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else TRIS
    import trimesh
    lo, hi, h = V3(-.431, -.033, -.451), V3(.431, 1.03, .40), .0068
    V, F = surface(field, lo, hi, h); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False); print('raw', len(F), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number); t = decimate(k.vertices, k.faces, TRIS); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    finish(np.array(t.vertices), np.array(t.faces), OUT, eyes())
