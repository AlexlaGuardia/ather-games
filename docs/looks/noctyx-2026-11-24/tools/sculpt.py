"""Noctyx base form: a signed-distance sculpt (numpy + scipy, no art asset), the Vulnyx v2 / Athowl route.   python sculpt.py <out.glb> [tris]
-> one closed surface -> decimated -> crisp colour lines -> glb nodes `body` + `eyes` (y 0..1, +z = her face, raw sRGB bytes on the
body, linear bytes on the unlit eyes). Reference: base-forms.md section 5 + noctyx_03.png (looked at, not traced; every landmark
below is a pixel of it / 820). Sculpted with the wings OPEN as the ref stands; the rig folds them into the cloak."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
from marching import surface
from sculpt_v2 import cone, ell, su, ss, cut, glb, normals, V3, rx, rz, catmull
TRIS = 3000; LID = .085; ZW = -.095; TH = .0085                       # wing sheet: its z, half thickness
# ── wing: a thin sheet in the x-y plane, arm + three finger ribs ──
WR = V3(.292, .455, ZW)                                                 # the wrist
ARM = [V3(.095, .375, ZW), V3(.205, .392, ZW), WR]
FIN = [[WR, V3(.412, .410, ZW), V3(.528, .310, ZW)], [WR, V3(.352, .330, ZW), V3(.394, .200, ZW)], [WR, V3(.278, .310, ZW), V3(.270, .176, ZW)]]
def curve(p, n=6): return catmull([(*a, 0) for a in p], n)[:, :2]
WP = np.vstack([curve([(.080, .410), (.160, .400), (.217, .404), (.250, .438), (.277, .474), (.318, .476), (.405, .440), (.475, .382), (.534, .304)])[:-1],
    curve([(.534, .304), (.470, .300), (.420, .275), (.394, .196)], 5)[:-1], curve([(.394, .196), (.365, .232), (.316, .228), (.270, .172)], 5)[:-1], curve([(.270, .172), (.252, .228), (.205, .262), (.140, .258), (.080, .21)], 5)])
def poly(x, y, P):
    """signed distance to a closed 2D polygon"""
    s = np.ones(x.shape); d = np.full(x.shape, 9.); n = len(P)
    for i in range(n):
        a, b = P[i - 1], P[i]; e = a - b
        if e @ e < 1e-12: continue
        wx, wy = x - b[0], y - b[1]; t = np.clip((wx * e[0] + wy * e[1]) / (e @ e), 0, 1); d = np.minimum(d, (wx - e[0] * t) ** 2 + (wy - e[1] * t) ** 2)
        c1, c2, c3 = y >= b[1], y < a[1], e[0] * wy > e[1] * wx; s = np.where((c1 & c2 & c3) | (~c1 & ~c2 & ~c3), -s, s)
    return s * np.sqrt(d)
def ribs(M):
    d = np.minimum(cone(M, ARM[0], ARM[1], .030, .022), cone(M, ARM[1], ARM[2], .022, .018)); d = su(d, ell(M, WR, (.020, .022, .020)), .01)
    for f in FIN: d = su(d, np.minimum(cone(M, f[0], f[1], .0145, .0125), cone(M, f[1], f[2], .0125, .006)), .006)
    return d
def wing(M):
    out = np.full(M.shape[:-1], 9.); m = (M[..., 0] > .03) & (M[..., 1] > .12) & (M[..., 1] < .53) & (np.abs(M[..., 2] - ZW) < .08)
    if not m.any(): return out
    q = M[m]; s = poly(q[:, 0], q[:, 1], WP); d = np.maximum(s, np.abs(q[:, 2] - ZW) - TH); out[m] = su(d, ribs(q), .010); return out
# ── ear: a dished leaf ──
EP = np.vstack([curve([(.404, 1.0), (.300, .955), (.228, .905), (.165, .850), (.118, .790), (.105, .70)])[:-1], curve([(.105, .70), (.15, .60), (.225, .562)])[:-1], curve([(.225, .562), (.300, .592), (.350, .670), (.385, .80), (.398, .90), (.404, 1.0)])])
def earz(s): k = np.clip(-s / .085, 0, 1); return .010 - .060 * k * k * (3 - 2 * k)
def ear(M):
    out = np.full(M.shape[:-1], 9.); m = (M[..., 0] > .04) & (M[..., 1] > .49) & (np.abs(M[..., 2]) < .16)
    if not m.any(): return out
    q = M[m]; s = poly(q[:, 0], q[:, 1], EP); z = q[:, 2] - earz(s) - .06 * (q[:, 1] - .75) * -1 - .0; th = .011 + .012 * np.clip(-s / .06, 0, 1)
    out[m] = -su(-s, -(np.abs(z) - th) * .8, .012); return out
TUFTS = [((.165, .575, .02), (.246, .566, .0), .060), ((.170, .530, .02), (.290, .520, -.005), .064), ((.165, .505, .03), (.276, .480, .0), .058), ((.15, .475, .035), (.240, .440, .01), .056), ((.12, .455, .045), (.182, .408, .03), .052), ((.07, .45, .06), (.100, .398, .06), .045)]
def head(M):
    d = ell(M, (0, .605, -.005), (.218, .180, .165)); d = su(d, ell(M, (0, .522, .010), (.222, .116, .152)), .08)
    d = su(d, ell(M, (.112, .562, .085), (.088, .085, .075)), .06)                                # the brow + eye domes: the face is broad and shallow
    d = su(d, ell(M, (0, .490, .105), (.080, .056, .085)), .06)                                  # small muzzle
    d = su(d, ell(M, (0, .508, .184), (.020, .014, .014)), .012)
    for a, b, r in TUFTS: d = su(d, cone(M, a, b, r, .003), .022)
    for a, b, r in (((0, .74, .04), (0, .826, .045), .050), ((.03, .74, .03), (.050, .806, .02), .042), ((.07, .73, .01), (.095, .785, -.01), .04), ((0, .74, -.05), (0, .805, -.09), .05)): d = su(d, cone(M, a, b, r, .003), .02)
    d = su(d, ear(M), .022)
    for a, b in (((.150, .655, .06), (.190, .680, .075)), ((.160, .620, .06), (.215, .630, .07)), ((.165, .58, .05), (.225, .585, .055))): d = su(d, cone(M, a, b, .034, .003), .012)      # fur over the ear's root
    return d
ARMB = [V3(.112, .358, .022), V3(.192, .285, .032), V3(.214, .218, .056)]
def armb(M, g=0):
    d = su(cone(M, ARMB[0], ARMB[1], .046 + g, .042 + g), cone(M, ARMB[1], ARMB[2], .042 + g, .033 + g), .015)
    if not g:
        for x, z in ((-.020, .012), (.002, .020), (.022, .008)): d = su(d, cone(M, (.214 + x * .6, .205, .058 + z * .6), (.216 + x, .176, .060 + z), .018, .010), .006)
    return d
def feet(M):
    d = ell(M, (.108, .148, .012), (.074, .080, .080)); d = su(d, cone(M, (.098, .10, .015), (.092, .045, .02), .052, .044), .03); d = su(d, ell(M, (.092, .030, .042), (.046, .032, .056)), .02)
    for x, z in ((-.028, .084), (0, .096), (.028, .084)): d = su(d, cone(M, (.092 + x * .7, .028, .05), (.092 + x, .021, z), .025, .019), .006)
    return d
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    b = ell(M, (0, .222, .0), (.154, .148, .130)); b = su(b, ell(M, (0, .345, -.005), (.118, .10, .098)), .08)
    b = su(b, cone(M, (0, .14, .045), (0, .062, .085), .07, .004), .03); b = su(b, cone(M, (.045, .14, .045), (.056, .084, .080), .055, .004), .03)
    b = su(b, feet(M), .030)
    b = su(b, ell(M, (0, .345, -.005), (.118, .10, .098)), .01); b = ss(b, np.maximum(armb(M, .017), (M[..., 1] - .300) * .9), .004)                 # the arms hang free of the body from the elbow down
    b = su(b, armb(M), .004); b = su(b, ell(M, (.085, .365, -.06), (.05, .045, .05)), .03)
    b = su(b, wing(M), .014); return su(b, head(M), .020)

C8 = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])
FUR, BELLY, TUFT, MEM, MEM2, PINK, PINK2, RIB = map(C8, ('#4f3f74', '#78659a', '#715e98', '#b9b2c9', '#d0cada', '#e6a3ae', '#f2bdc2', '#43336e'))
zig = lambda u, n: np.abs(((u * n) % 1) - .5) * 2
def lens(x, y, cx, cy, hw, hl, lean=0):
    v = (y - cy) / hl; return np.where(np.abs(v) < 1, hw * np.clip(1 - v * v, 0, 1) ** .8 - np.abs(x - cx - lean * (y - cy)), (1 - np.abs(v)) * hl)
def segd(q, a, b): a, b = a[:2], b[:2]; e = b - a; t = np.clip(((q - a) @ e) / (e @ e), 0, 1); return np.linalg.norm(q - a - t[:, None] * e, axis=1)
def onwing(V):
    M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; return (M[:, 0] > .125) & (M[:, 1] < .50) & (np.abs(M[:, 2] - ZW) < .030) & (wing(M) < .006)
def classes(V):
    x, y, z = V.T; A = np.abs(x); M = np.c_[A, y, z]; out = []; w = onwing(V) | ((A > .12) & (np.abs(z - ZW) < .03) & (y < .42))
    q = M[:, :2]; s = poly(A, y, WP); rd = np.minimum.reduce([segd(q, f[i], f[i + 1]) - (.0125 - .003 * i) for f in FIN for i in (0, 1)] + [segd(q, ARM[0], ARM[1]) - .026, segd(q, ARM[1], ARM[2]) - .021])
    out.append(np.where(w, np.minimum.reduce([rd, -s - .0015]), -.05))                                            # the membrane between the ribs
    sh = np.minimum.reduce([rd - .014, A - .20, -s - .042]); out.append(np.where(w, sh, -.05))        # its lighter sweep (the canvas)
    e = poly(A, y, EP); ek = e + .024 + .010 * np.clip((.70 - y) / .1, 0, 1); fr = np.where((A > .13) & (z > earz(e) + .06 * (.75 - y) - .004) & (z < .050), 1, 0)
    tuft = (A - .165 - .25 * np.clip(y - .60, 0, 1) - .026 * zig(y, 22)); out.append(np.where((fr == 1) & (y > .565), np.minimum(-ek, tuft), -.05))      # ear inside
    out.append(np.where((fr == 1) & (y > .565), np.minimum.reduce([-ek - .030, tuft - .02, y - .64]), -.05))
    bel = 1 - np.sqrt((A / .100) ** 2 + ((y - .232) / .135) ** 2); out.append(np.where((z > .02) & ~onwing(V), (bel + .26 * zig(np.arctan2(x, y - .23) / 6.283 + .5, 14) - .16) * .1, -.05))      # pale belly, ragged
    L = [(.0, .330, .010, .034, 0), (.034, .345, .009, .030, .2), (.064, .335, .008, .028, .3), (.0, .815, .012, .05, 0)]
    out.append(np.where((z > .02) & ~onwing(V) & ((y < .39) | (y > .74)), np.maximum.reduce([lens(A, y, *l) for l in L] + [lens(A, y, .038, .735, .007, .035, .4)]), -.05))
    out.append(np.where((z > .06) & (y > .62), np.maximum.reduce([lens(A, y, .018, .690, .006, .030, .25), lens(A, y, .052, .672, .005, .024, .5)]), -.05))
    return out
PAL = [MEM, MEM2, PINK, PINK2, BELLY, TUFT, TUFT]

EC = V3(.116, .563); ER = V3(.0585, .0590)
def eyes():
    parts = []
    def zsurf(X, Y):
        z = np.full(len(X), .30)
        for _ in range(80): z -= np.clip(field(np.stack([X, Y, z], -1)), -.02, .02) * .7
        return z
    def lay(X, dz):
        P = np.c_[X, zsurf(X[:, 0], X[:, 1])]; e = 4e-3; g = np.stack([field(P + np.eye(3)[i] * e) - field(P - np.eye(3)[i] * e) for i in range(3)], -1); g /= np.linalg.norm(g, axis=1, keepdims=True); return P + g * dz, g
    def put(X, F, col, dz, back=0, skirt=0):
        P, g = lay(np.array(X), dz); F = np.array(F); nn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]); F = F[:, ::-1] if (nn * g[F[:, 0]]).sum() < 0 else F
        if skirt: n = skirt; m = len(P) - n; P = np.vstack([P, P[-n:] - g[-n:] * .020]); k = len(P) - n; u_, w_ = X[m + 1] - X[m], X[m + 2] - X[m + 1]; sgn = 1 if u_[0] * w_[1] > u_[1] * w_[0] else -1; S = [f for i in range(n) for f in ((m + i, k + i, k + (i + 1) % n), (m + i, k + (i + 1) % n, m + (i + 1) % n))]; F = np.vstack([F, np.array(S)[:, ::sgn]])
        parts.append((P - V3(0, 0, back), F, col))
    def patch(pts, col, dz, rings=2, back=0, skirt=False):
        pts = np.array(pts); c = pts.mean(0); n = len(pts); X = [c]
        for r in range(1, rings + 1): X += list(c + (pts - c) * r / rings)
        F = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
        for r in range(rings - 1):
            a, b = 1 + r * n, 1 + (r + 1) * n
            for i in range(n): j = (i + 1) % n; F += [(a + i, b + i, b + j), (a + i, b + j, a + j)]
        put(np.array(X), F, col, dz, back, n if skirt else 0)
    def strip(up, dn, col, dz, back=0):
        n = len(up); put(np.vstack([up, dn]), [f for i in range(n - 1) for f in ((i, n + i, n + i + 1), (i, n + i + 1, i + 1))], col, dz, back)
    th = lambda n: np.arange(n) / n * 2 * np.pi
    def oval(s, kx, ky, dx=0, dy=0, n=20): a = th(n); return np.c_[s * (EC[0] + dx + ER[0] * kx * np.cos(a)), EC[1] + dy + ER[1] * ky * np.sin(a)]
    def disc(cx, cy, r, n=12): a = th(n); return np.c_[cx + r * np.cos(a), cy + r * np.sin(a)]
    for s in (1, -1):
        patch(oval(s, 1.0, 1.0), (28, 18, 44), .006, 2, skirt=True); patch(oval(s, .89, .90, .003), (226, 206, 232), .0075, 2)
        patch(oval(s, .80, .88, -.003), (74, 78, 136), .009, 2); patch(oval(s, .56, .40, -.003, -.026), (142, 138, 208), .0105, 2); patch(oval(s, .64, .68, -.005, .007), (18, 12, 34), .012, 2)
        patch(disc(s * EC[0] + .006, EC[1] + .027, .0155), (255, 255, 255), .0138, 1); patch(disc(s * EC[0] + .025, EC[1] + .008, .0065, 8), (236, 228, 255), .0138, 1)
        patch(disc(s * (EC[0] - .012), EC[1] - .036, .006, 8), (206, 196, 255), .0138, 1)
        q = np.linspace(-1, 1, 9)
        patch(oval(s, 1.10, 1.10), (90, 77, 134), .0195, 3, LID, True)                           # closed lids: wait inside the skull, the lids bone brings them forward
        mid = np.c_[s * (EC[0] + q * .046), EC[1] - .010 - .026 * (1 - q * q)]; strip(mid + [0, .004], mid - np.c_[0 * q, .004 * (1 - q * q) + .001], (40, 26, 62), .0215, LID)
        br = np.c_[s * (.088 + .040 * (q + 1) / 2), .648 + .010 * (1 - q * q) + .004 * q]; wdt = .0052 * (1 - q * q) + .0004; strip(br + np.c_[0 * q, wdt], br - np.c_[0 * q, wdt], (44, 32, 74), .004)      # brow stroke
        a, b, c = V3(.0, .4745), V3(.026, .4700), V3(.058, .4745); t = np.linspace(0, 1, 9)[:, None]; m = (1 - t) ** 2 * a + 2 * t * (1 - t) * (b - [0, .012]) + t * t * c; wm = .0030 * (1 - .75 * t[:, 0]); m[:, 0] *= s; m[:, 1] -= .0; strip(m + np.c_[0 * wm, wm], m - np.c_[0 * wm, wm], (36, 22, 52), .004)
        def claw(b, t, r, n=6):
            b, t = V3(*b), V3(*t); d = (t - b) / np.linalg.norm(t - b); e1 = np.cross(d, V3(0, 0, 1) if abs(d[2]) < .8 else V3(1, 0, 0)); e1 /= np.linalg.norm(e1); e2 = np.cross(d, e1); mm = b + (t - b) * .55 + V3(0, .004, .003)
            P = np.vstack([[c + k * (np.cos(q) * e1 + np.sin(q) * e2) for q in th(n)] for c, k in ((b, r), (mm, r * .7))] + [[t]]); F = np.array([f for i in range(n) for f in ((i, (i + 1) % n, n + (i + 1) % n), (i, n + (i + 1) % n, n + i), (n + i, n + (i + 1) % n, 2 * n))])
            if (np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]) * (P[F].mean(1) - b)).sum() < 0: F = F[:, ::-1]
            parts.append((P * V3(s, 1, 1), F if s > 0 else F[:, ::-1], (38, 26, 56)))
        for x, z in ((-.028, .084), (0, .096), (.028, .084)): claw((.092 + x, .024, z + .010), (.092 + x * 1.08, .004, z + .036), .0125)
        for x, z in ((-.020, .012), (.002, .020), (.022, .008)): claw((.216 + x, .180, .060 + z), (.216 + x * 1.1, .150, .066 + z), .0088, 5)
    nv, nf, nr, ns = [], [], 5, 14                                                              # the nose: a small dark button with a light
    zn = zsurf(np.array([0.]), np.array([.507]))[0] - .004
    for a in range(nr + 1):
        for b in range(ns): t, u = np.pi * a / nr, 2 * np.pi * b / ns; nv.append((np.sin(t) * np.cos(u) * .0255 * (1 + .25 * np.sin(t) * np.sin(u)), .508 + np.sin(t) * np.sin(u) * .0155, zn + np.cos(t) * .0140))
    for a in range(nr):
        for b in range(ns): p, q = a * ns + b, a * ns + (b + 1) % ns; nf += ([] if a == 0 else [(p, p + ns, q)]) + ([] if a == nr - 1 else [(p + ns, q + ns, q)])
    parts.append((np.array(nv), np.array(nf), (40, 28, 52))); patch(disc(0, .5135, .0055, 8) * [1.5, 1] , (150, 136, 172), .010, 1)
    V, F, C, o = [], [], [], 0
    for P, f, col in parts: V.append(P); F.append(f + o); C.append(np.tile((*np.round(255 * (np.array(col) / 255.) ** 2.2), 255), (len(P), 1))); o += len(P)
    return np.vstack(V), np.vstack(F), np.vstack(C)

def refine(V, F, want, mx, proj=True):
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
    if proj and len(P):
        for _ in range(4):
            e = 2e-3; g = np.stack([field(P + np.eye(3)[i] * e) - field(P - np.eye(3)[i] * e) for i in range(3)], -1); P = P - g / np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9) * np.clip(field(P), -.004, .004)[:, None] * .8
        V[k:] = P
    return V, np.array(out)
def finish(V, F, path, eye):
    fc = lambda V: (V[:, 2] > .05) & (np.abs(V[:, 0]) < .20) & (V[:, 1] > .44) & (V[:, 1] < .70)
    V, F = refine(V, F, fc, .052)
    V, F = refine(V, F, onwing, .085, False); V, F = refine(V, F, onwing, .062, False)
    V, F = refine(V, F, lambda V: (V[:, 2] > .05) & (np.abs(V[:, 0]) < .125) & (V[:, 1] > .10) & (V[:, 1] < .37), .040)
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(F), -1)
    for k in range(len(PAL)): V, F, lab, side = cut(V, F, lab, classes(V)[k]); lab = np.where(side, k, lab)
    ep = .004; N = np.stack([field(V + np.eye(3)[i] * ep) - field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    cols = np.array([PAL[k] if k >= 0 else FUR for k in lab]); key, inv = np.unique(np.c_[F.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == FUR).all(1); sh = np.clip(.5 + .5 * NN[:, 1] + .25 * NN[:, 2], 0, 1)[:, None]
    CC[g, :3] = C8('#3a2d60') * (1 - sh[g]) + C8('#604d8a') * sh[g]                             # deep indigo underneath, purple on top
    A = np.c_[np.abs(VV[:, 0]), VV[:, 1:]]; rb = g & onwing(VV); CC[rb, :3] = RIB
    eV, eF, eC = eye; glb(path, dict(body=(VV, FF, CC, NN), eyes=(eV, eF, eC, normals(eV, eF)))); print('body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF))

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else TRIS
    import trimesh, subprocess, tempfile
    lo, hi, h = V3(-.5712, -.033, -.211), V3(.5712, 1.03, .26), .0056
    V, F = surface(lambda P: (lambda d: np.where(np.abs(d) < .0007, .0007, d))(field(P)), lo, hi, h); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False); print('raw', len(F), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number); T_ = tempfile.mkdtemp(); np.savez(T_ + '/i.npz', v=k.vertices, f=k.faces)
    subprocess.run([os.environ.get('BLENDER', '/opt/blender/blender'), '-b', '-P', os.path.join(HERE, 'dec.py'), '--', T_ + '/i.npz', T_ + '/o.npz', str(TRIS)], stdout=subprocess.DEVNULL, check=True); d = np.load(T_ + '/o.npz'); t = trimesh.Trimesh(d['v'], d['f'], process=False)
    print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, 'euler', t.euler_number, t.bounds.round(3).tolist()); assert t.is_watertight and t.body_count == 1 and t.euler_number == 2
    finish(np.array(t.vertices), np.array(t.faces), OUT, eyes())
