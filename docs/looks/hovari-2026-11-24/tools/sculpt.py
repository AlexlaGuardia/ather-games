"""Hovari base form v2 (feather ruff + layered tufts, soft painted colour, clean needle beak): a signed-distance sculpt (numpy + scipy, no art asset), the Vulnyx v2 / Noctyx route.   python sculpt.py <out.glb> [tris]
-> one closed surface -> Blender collapse (dec.py) -> crisp colour lines -> glb nodes `body` (toon), `eyes` (unlit: eyes, lids, blush, claws)
and `shimmer` (the wing-blur petals, hidden inside the wings at rest). y 0..1, +z = face, +x = her left. Reference: base-forms.md section 10 +
hovari_v2_01.png (looked at, not traced; landmarks are its pixels / 790). Mid-hover stance, wings raised as the ref holds them."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
from marching import surface
from sculpt_v2 import cone, ell, su, cut, glb, normals, V3
TRIS = 2500; LID = .07; ZW = -.085; TH = .0105; C8 = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)]); zig = lambda u, n: np.abs(((u * n) % 1) - .5) * 2
# wing: arm + seven feathers (root, tip, half width), a thin sheet in the x-y plane
SH, WR = V3(.165, .590), V3(.400, .800)
FE = [((.375, .800), (.650, .955), .042), ((.365, .785), (.640, .808), .047), ((.340, .760), (.590, .664), .048), ((.305, .725), (.506, .546), .046), ((.270, .690), (.418, .462), .046), ((.230, .650), (.330, .420), .040), ((.190, .610), (.256, .425), .036)]
FE = [((a[0] + .02, a[1]), (a[0] + .02 + (b[0] - a[0]) * 1.18, a[1] + (b[1] - a[1]) * 1.13), w * 1.10) for a, b, w in FE]
def cone2(q, a, b, ra, rb): a, b = V3(*a), V3(*b); e = b - a; t = np.clip(((q - a) @ e) / (e @ e), 0, 1); return np.linalg.norm(q - a - t[..., None] * e, axis=-1) - (ra + (rb - ra) * t)
def feather(q, f, g=0): a, b, w = V3(*f[0]), V3(*f[1]), f[2] + g; m = a + (b - a) * .62; return su(cone2(q, a, m, w * .8, w), cone2(q, m, b, w, .020), .012)
def feathers(q): return np.stack([feather(q, f) for f in FE], -1)
def fan(D):
    s = D[..., 0]
    for i in range(1, D.shape[-1]): s = su(s, D[..., i], .024)
    return s
def covert(q): return np.minimum(np.stack([feather(q, (f[0], (f[0][0] + (f[1][0] - f[0][0]) * .50, f[0][1] + (f[1][1] - f[0][1]) * .50), f[2] * .86)) for f in FE], -1).min(-1), web(q) + .030)
def web(q): return np.minimum(cone2(q, (.12, .555), (.235, .610), .055, .085), cone2(q, (.235, .610), (.365, .760), .085, .045))
def wing(M):
    out = np.full(M.shape[:-1], 9.); m = (M[..., 0] > .03) & (M[..., 1] > .36) & (M[..., 1] < 1.03) & (np.abs(M[..., 2] - ZW) < .07)
    if not m.any(): return out
    p = M[m]; q = p[:, :2]; s = fan(feathers(q)); s = su(s, web(q), .02) - .0015; d = np.maximum(s, np.abs(p[:, 2] - ZW) - TH); d = su(d, np.maximum(covert(q), np.abs(p[:, 2] - ZW) - TH - .007), .004)
    a = su(cone(p, (*SH, ZW), (*WR, ZW), .036, .024), cone(p, (*WR, ZW), (.52, .888, ZW), .024, .008), .02)
    for u, v, r in (((.20, .66), (.235, .735), .026), ((.26, .71), (.292, .770), .022)): a = su(a, cone(p, (*u, ZW), (*v, ZW), r, .003), .01)      # ragged shoulder feathers
    out[m] = su(d, a, .012); return out
# tail: three broad feathers, a thin sheet down and back
TO = V3(0, .360, -.095); TD = V3(0, -.325, -.185); TD /= np.linalg.norm(TD); TN = V3(0, TD[2], -TD[1])
TF = [((.0, .0), (.0, .435), .070), ((.04, .0), (.150, .385), .066), ((.07, .02), (.245, .285), .052)]
def tq(M): q = M - TO; return np.stack([M[..., 0], q @ TD], -1), q @ TN
def tail(M):
    out = np.full(M.shape[:-1], 9.); m = (M[..., 1] < .40) & (M[..., 2] < .03) & (M[..., 0] < .27)
    if not m.any(): return out
    q, n = tq(M[m]); s = np.minimum.reduce([feather(q, f) for f in TF]); out[m] = su(np.maximum(s, np.abs(n + 1.2 * q[:, 0] ** 2) - .011), np.abs(q[:, 0]) * 0 + cone2(np.c_[q[:, 0], n], (0, 0), (0, .001), .03, .03) + np.maximum(0, q[:, 1] - .12) + np.maximum(0, -q[:, 1]), .02); return out
BK = [V3(0, .790, .150), V3(0, .800, .290), V3(0, .862, .680)]
def beak(M): return cone(M, (0, .788, .120), (0, .793, .190), .045, .030)                          # only the feathered cuff: the needle itself is the unlit part
HC = V3(0, .815, 0)
def egg(M):
    b = ell(M, (0, .450, .012), (.232, .228, .222)); b = su(b, ell(M, (0, .600, .016), (.160, .14, .150)), .07); return su(b, ell(M, (0, .345, -.050), (.135, .12, .115)), .08)
def ball(M): d = ell(M, HC, (.216, .190, .206)); return su(d, ell(M, (.112, .850, .100), (.07, .05, .07)), .05)
def core(M): return su(egg(M), ball(M), .055)
def tufts():
    """overlapping feather tips laid on the form: (angle from the face, y, length, how far it lifts, root radius)"""
    sp = [(a, .715 + .02 * np.cos(a), .088, .050, .046) for a in np.radians([62, 82, 102, 128, 154, 180])]            # the ruff
    sp += [(a, .615, .085, .040, .046) for a in np.radians([54, 74, 150, 176])] + [(a, .520, .088, .036, .050) for a in np.radians([26, 52, 78, 130, 160])]
    sp += [(a, .420, .088, .036, .050) for a in np.radians([40, 66, 92, 118, 146])] + [(a, .335, .085, .034, .046) for a in np.radians([0, 30, 60, 90, 120])]
    sp += [(a, y, .085, .034, .044) for a, y in ((np.radians(116), .80), (np.radians(142), .84), (np.radians(170), .82), (np.radians(180), .90), (np.radians(150), .92), (np.radians(128), .88))] + [(np.radians(104), .745, .085, .034, .044)]
    out = []
    for a, y, l, lift, rr in sp:
        d = V3(np.sin(a), 0, np.cos(a)); t = np.linspace(.02, .32, 300); f = core(np.abs(d * [1, 0, 0]) * t[:, None] + V3(0, y, 0) + V3(0, 0, d[2]) * t[:, None]); k = np.where(f < 0)[0]; R0 = t[k[-1]]
        t2 = core(V3(abs(d[0]), 0, d[2]) * t[:, None] + V3(0, y - l, 0)); k2 = np.where(t2 < 0)[0]; R1 = t[k2[-1]] if len(k2) else R0
        A_, B_ = d * (R0 - rr * .62) + V3(0, y, 0), d * (R1 + lift) + V3(0, y - l, 0); A_[0] = max(A_[0], 0); B_[0] = max(B_[0], 0); out.append((A_, B_, rr))
    return out
TU = tufts(); CR = [((0, .955, -.02), (0, 1.028, -.085), .045), ((.045, .95, -.05), (.070, 1.000, -.120), .042), ((0, .93, -.09), (0, .985, -.175), .045)]
def coat(M, d, lo, hi):
    for a, b, rr in TU:
        if lo < a[1] <= hi: d = su(d, cone(M, a, b, rr, .005), .014)
    return d
def head(M):
    d = coat(M, ball(M), .735, 2)
    for a, b, rr in CR: d = su(d, cone(M, a, b, rr, .004), .022)
    return d
def trunk(M): b = coat(M, egg(M), 0, .735); return su(b, cone(M, (.115, .575, -.045), (.165, .600, ZW), .075, .042), .04)                      # the wing's shoulder
def thigh(M): return cone(M, (.078, .300, .070), (.084, .215, .095), .045, .016)
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); b = su(trunk(M), head(M), .040); b = su(b, thigh(M), .02)
    b = su(b, tail(M), .02); b = su(b, wing(M), .016); return su(b, beak(M), .030)

MINT, AQUA, TEAL, DEEP, BLUE, WARM, RU, CO, GLOW = (C8(s) / 255. for s in ('#3ed6ac', '#10a692', '#07807e', '#043f58', '#1168b4', '#ccff8e', '#bc0036', '#f42c52', '#6fecb4'))
onw = lambda V: (np.abs(V[:, 0]) > .205) & (np.abs(V[:, 2] - ZW) < .045) & (wing(np.c_[np.abs(V[:, 0]), V[:, 1:]]) < .008)
def ont(V): M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; return (tail(M) < .008) & (V[:, 1] < .30) & (trunk(M) > .008)
def wp(V): q = np.c_[np.abs(V[:, 0]), V[:, 1]]; D = feathers(q); return D.argmin(1), D[:, 1::2].min(1) - D[:, 0::2].min(1), covert(q), q
def tp(V): u, _ = tq(np.c_[np.abs(V[:, 0]), V[:, 1:]]); f = [feather(u, t) for t in TF]; return u, f[1] - np.minimum(f[0], f[2]), np.stack(f).argmin(0)
def fields(V):
    """only the feather edges are cut into the mesh; everything else is painted soft from vertex to vertex"""
    w, t = onw(V), ont(V); k, odd, cov, q = wp(V); u, ot, _ = tp(V)
    return [np.where(w, cov, -.05), np.where(w, np.maximum(odd, -cov), .05), np.where(t, ot, .05)]
ss_ = lambda a, b, x: (lambda t: t * t * (3 - 2 * t))(np.clip((x - a) / (b - a), 0, 1))
mixc = lambda a, b, w: a * (1 - w[:, None]) + b * w[:, None]
WSTOP = [.30, .50, .66, .80, .92, 1.05]; WCOL = np.array([C8(s) for s in ('#35c9a4', '#9fe0a0', '#ffd08a', '#ff9eae', '#d596e8', '#7f8cf0')]) / 255.
def paint(V, N, C):
    """colour of a triangle's corner (V, N) in the triangle whose middle is C (that one says which feather it is)"""
    x, y, z = V.T; A = np.abs(x); M = np.c_[A, y, z]; a = np.arctan2(x, z); n1 = np.sin(a * 5 + 3 * np.sin(y * 17)) * np.sin(y * 31 + 1.3); n2 = np.sin(x * 37 + 2) * np.sin(y * 29) * np.sin(z * 33 + 1)
    f = .5 + .5 * np.cos(a) * np.clip(np.hypot(x, z) / .17, 0, 1) + .10 * n1; c = mixc(np.tile(DEEP, (len(V), 1)), np.tile(TEAL, (len(V), 1)), ss_(.0, .34, f)); c = mixc(c, AQUA, ss_(.30, .72, f)); c = mixc(c, MINT, ss_(.70, 1.02, f) * .75)
    c = mixc(c, BLUE, .55 * ss_(.15, .75, n2 + .6 * n1) * (1 - ss_(.55, .85, f)) * (y < .74))                              # blue glints on flank and back
    c = mixc(c, MINT, .55 * ss_(.88, 1.0, y) * ss_(.25, .6, f)); c = mixc(c, TEAL, .55 * ss_(.73, .66, y) * ss_(.60, .70, y) * (1 - ss_(.6, .9, f)))
    c = mixc(c, WARM, .92 * ss_(1.15, .15, np.sqrt((A / .155) ** 2 + ((y - .425) / .155) ** 2) + .10 * n1) * (z > .02))      # the warm light in the belly
    tip = ss_(.006, .030, core(M)); body = y < .97; c = mixc(c, GLOW, .42 * tip * body * ss_(.1, .5, f)); c = mixc(c, AQUA, .40 * tip * body * (1 - ss_(.1, .5, f)))                  # lit feather tips
    r = np.sqrt((A / .185) ** 2 + ((y - .635) / np.where(y > .635, .118, .160)) ** 2) + .13 * n1 + .06 * n2; th = ss_(1.15, .60, r) * ss_(.02, .09, z); c = mixc(c, mixc(np.tile(RU, (len(V), 1)), CO, ss_(.660, .530, y)), th)
    t, w = ont(C), onw(C); u, ot, ti = tp(C); uv, _, _ = tp(V); g = ss_(.12, .46, uv[:, 1]); tc = mixc(np.tile(C8('#0f6f86') / 255., (len(V), 1)), C8('#5a58b0') / 255., ss_(.10, .55, g)); tc = mixc(tc, C8('#d98ac8') / 255., ss_(.60, 1., g)) * np.where(ti == 1, 1.12, .96)[:, None]; c = np.where(t[:, None], tc, c)
    k, odd, cov, q = wp(C); qv = np.c_[A, y]; fr, ft = np.array([f_[0] for f_ in FE]), np.array([f_[1] for f_ in FE]); al = np.linalg.norm(qv - fr[k], axis=1) / np.linalg.norm(ft - fr, axis=1)[k] + np.array([.03, 0, -.03, -.05, -.03, 0, .04])[k]
    wc = np.stack([np.interp(al, WSTOP, WCOL[:, i]) for i in range(3)], 1) * np.where(k % 2, 1.0, .92)[:, None]; sh_ = ss_(.07, -.06, covert(qv)); cc = mixc(np.tile(AQUA, (len(V), 1)), DEEP * .4 + TEAL * .6, ss_(.0, .05, -covert(qv)))
    return np.clip(np.where(w[:, None], np.where((cov < 0)[:, None], cc, wc), c), 0, 1) * 255
YAW = np.radians(42); EY = .797; ER = V3(.0640, .0680)
def eyes():
    parts = []; R = np.array([[np.cos(YAW), 0, np.sin(YAW)], [0, 1, 0], [-np.sin(YAW), 0, np.cos(YAW)]])       # eye frame -> model: the eye looks out at YAW
    face = lambda Q: su(head(np.stack([np.abs(Q[..., 0]), Q[..., 1], Q[..., 2]], -1)), trunk(np.stack([np.abs(Q[..., 0]), Q[..., 1], Q[..., 2]], -1)), .055)
    ff = lambda Q: face(Q @ R.T)
    def lay(X, dz):
        z = np.full(len(X), .26)
        for _ in range(80): z -= np.clip(ff(np.c_[X, z]), -.02, .02) * .7
        P = np.c_[X, z]; e = 4e-3; g = np.stack([ff(P + np.eye(3)[i] * e) - ff(P - np.eye(3)[i] * e) for i in range(3)], -1); g /= np.linalg.norm(g, axis=1, keepdims=True); return P + g * dz, g
    def add(P, F, col, back=0):
        P = P @ R.T - V3(0, 0, back); parts.append((P, F, col)); parts.append((P * V3(-1, 1, 1), F[:, ::-1], col))
    def put(X, F, col, dz, back=0, skirt=0):
        P, g = lay(np.array(X), dz); F = np.array(F); nn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]); F = F[:, ::-1] if (nn * g[F[:, 0]]).sum() < 0 else F
        if skirt: n = skirt; m = len(P) - n; P = np.vstack([P, P[-n:] - g[-n:] * .018]); k = len(P) - n; S = [f for i in range(n) for f in ((m + i, k + i, k + (i + 1) % n), (m + i, k + (i + 1) % n, m + (i + 1) % n))]; F = np.vstack([F, np.array(S)])
        add(P, F, col, back)
    def patch(pts, col, dz, rings=1, back=0, skirt=False):
        pts = np.array(pts); c = pts.mean(0); n = len(pts); X = [c]
        for r in range(1, rings + 1): X += list(c + (pts - c) * r / rings)
        F = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
        for r in range(rings - 1):
            a, b = 1 + r * n, 1 + (r + 1) * n
            for i in range(n): j = (i + 1) % n; F += [(a + i, b + i, b + j), (a + i, b + j, a + j)]
        put(np.array(X), F, col, dz, back, n if skirt else 0)
    th = lambda n: np.arange(n) / n * 2 * np.pi
    def oval(kx, ky, dx=0, dy=0, n=16): a = th(n); return np.c_[dx + ER[0] * kx * np.cos(a), EY + dy + ER[1] * ky * np.sin(a)]
    patch(oval(1.0, 1.0), (14, 34, 40), .006, 2, skirt=True); patch(oval(.88, .89), (206, 250, 224), .0075, 2)
    patch(oval(.80, .82), (34, 138, 142), .009, 2); patch(oval(.58, .42, 0, -.025), (110, 240, 214), .0105, 1); patch(oval(.66, .66, 0, .009), (10, 14, 20), .012, 2)
    a = th(10); patch(np.c_[.006 + .016 * np.cos(a), EY + .030 + .017 * np.sin(a)], (255, 255, 255), .0138); a = th(7)
    patch(np.c_[-.018 + .006 * np.cos(a), EY - .030 + .006 * np.sin(a)], (190, 255, 236), .0138); patch(np.c_[.020 + .005 * np.cos(a), EY - .026 + .005 * np.sin(a)], (150, 240, 220), .0138)
    patch([(-.066, EY + .040), (-.045, EY + .066), (0, EY + .078), (.045, EY + .066), (.080, EY + .046), (.046, EY + .054), (0, EY + .062), (-.043, EY + .052)], (16, 62, 72), .004)      # the lash line
    a = th(14); r = .027; patch(np.c_[.030 + 1.2 * r * np.cos(a), EY - .098 + r * .9 * np.sin(a)], (214, 70, 92), .003)                       # the cheek's blush
    patch(oval(1.10, 1.08), (54, 158, 136), .0195, 2, LID, True); q = np.linspace(-1, 1, 8); mid = np.c_[q * .046, EY - .008 - .026 * (1 - q * q)]
    X = np.vstack([mid + [0, .004], mid - np.c_[0 * q, .004 * (1 - q * q) + .001]]); put(X, [f for i in range(7) for f in ((i, 8 + i, 9 + i), (i, 9 + i, i + 1))], (12, 48, 56), .0215, LID)
    n = 4
    def tube(pts, rs, col):
        pts = [V3(*p) for p in pts]; P = []
        for i, (c, r) in enumerate(zip(pts[:-1], rs)):
            d = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]; d /= np.linalg.norm(d); e1 = np.cross(d, V3(1, 0, 0)); e1 /= np.linalg.norm(e1); e2 = np.cross(d, e1); P += [c + r * (np.cos(t) * e1 + np.sin(t) * e2) for t in th(n)]
        P.append(pts[-1]); k = len(pts) - 1; F = [f for j in range(k - 1) for i in range(n) for f in ((j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n), (j * n + i, (j + 1) * n + (i + 1) % n, (j + 1) * n + i))] + [((k - 1) * n + i, (k - 1) * n + (i + 1) % n, k * n) for i in range(n)]
        P, F = np.array(P), np.array(F); F = F[:, ::-1] if (np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]) * (P[F].mean(1) - P.mean(0))).sum() < 0 else F
        parts.append((P, F, col)); parts.append((P * V3(-1, 1, 1), F[:, ::-1], col))
    for dx, dz in ((-.026, .000), (0, .010), (.026, .002)): tube([(.084 + dx * .25, .216, .094), (.086 + dx, .212, .132 + dz), (.086 + dx * 1.1, .180, .148 + dz), (.086 + dx, .156, .122 + dz)], (.015, .0155, .012), (34, 36, 34))      # curled toes
    # the beak's dark skin: unlit, laid over the sculpt's own beak (the teal emissive floor lifts any dark to grey-green, as with the Vulnyx nose)
    m = 10; st = np.array([0, .16, .38, .68, 1.]); ctr = np.stack([np.interp(st, [0, .30, 1], [p[k] for p in BK]) for k in range(3)], 1); rad = np.array([.050, .040, .025, .0165, .0075]); t = np.arange(m) / m * 2 * np.pi
    P = np.vstack([ctr[i_] + rad[i_] * np.c_[np.cos(t), np.sin(t), 0 * t] for i_ in range(5)] + [[BK[2] + (0, .002, .030)]]); F, top = [], []
    for j in range(5):
        for i_ in range(m):
            a_, b_ = j * m + i_, j * m + (i_ + 1) % m; q_ = [(a_, b_, 5 * m)] if j == 4 else [(a_, b_, a_ + m), (b_, b_ + m, a_ + m)]; F += q_; top += [0 if i_ >= 5 else 2 if i_ in (2,) else 1] * len(q_)
    F, top = np.array(F), np.array(top)
    for k_, col in ((1, (52, 50, 62)), (2, (104, 106, 124)), (0, (34, 26, 34))): parts.append((P, F[top == k_], col))
    V, F, C, o = [], [], [], 0
    for P, f, col in parts: u_, f = np.unique(f, return_inverse=True); P = P[u_]; f = f.reshape(-1, 3); V.append(P); F.append(f + o); C.append(np.tile((*np.round(255 * (np.array(col) / 255.) ** 2.2), 255), (len(P), 1))); o += len(P)
    return np.vstack(V), np.vstack(F), np.vstack(C)
RB = [C8(s) for s in ('#66d8b4', '#8f9af0', '#f0a0d0', '#ffc090', '#ffe08a')]
def shimmer():
    """two blur petals a wing: the wing's own outline as broad flat blades (three lobes), both faces drawn, hidden in the wing sheet at rest"""
    V, F, C, o = [], [], [], 0; W = []
    for p in range(2):
        for x in (1, -1):
            for li, idx in enumerate(((0, 1), (2, 3), (4, 5, 6))):
                a = np.mean([FE[i][0] for i in idx], 0) * .55 + SH * .45; b = np.mean([FE[i][1] for i in idx], 0); e = (b - a) * .87; n_ = V3(-e[1], e[0]); n_ /= np.linalg.norm(n_); wd = (.052, .056, .050)[li]; ts = [(0, .35), (.35, .80), (.70, .9), (.90, .5)]
                pts = [a] + [a + e * t + s * n_ * wd * 1.15 * w for t, w in ts[1:] for s in (1, -1)] + [a + e]; col = [RB[0], RB[1 + li], RB[1 + li], RB[2 + li] , RB[2 + li], RB[3 + li // 2], RB[3 + li // 2], RB[4]]
                f = [(0, 2, 1), (1, 2, 3), (2, 4, 3), (3, 4, 5), (4, 6, 5), (5, 6, 7)]
                for sd in (1, -1):
                    P = np.c_[np.array(pts), np.full(8, ZW + sd * .0004)] * V3(x, 1, 1); V.append(P); g = np.array(f); F.append((g if sd * x > 0 else g[:, ::-1]) + o); C.append(np.c_[np.clip(np.array(col) * .62 + 92, 0, 255).astype(int), np.full(8, 255)]); o += 8; W += [(p, x)] * 8
    V = np.vstack(V); F = np.vstack(F); fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]); return V, F, np.vstack(C)
def refine(V, F, want, mx):
    """split every edge longer than mx whose two ends are wanted (closed stays closed)"""
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
    return np.array(V), np.array(out)
def finish(V, F, path):
    V, F = refine(V, F, lambda V: onw(V) & (np.abs(V[:, 0]) < .70), .085); V, F = refine(V, F, lambda V: (V[:, 2] > .05) & (np.abs(V[:, 0]) < .19) & (V[:, 1] > .30) & (V[:, 1] < .72), .055)
    lab = np.zeros(len(F), int); n = len(fields(V))
    for k in range(n): V, F, lab, _ = cut(V, F, lab, fields(V)[k])
    ep = .006; N = np.stack([field(V + np.eye(3)[i] * ep) - field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    cols = np.round(paint(V[F.ravel()], N[F.ravel()], np.repeat(V[F].mean(1), 3, 0)) / 3) * 3; key, inv = np.unique(np.c_[F.ravel(), np.clip(cols, 0, 255).astype(int)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    eV, eF, eC = eyes(); sV, sF, sC = shimmer(); glb(path, dict(body=(VV, FF, CC, NN), eyes=(eV, eF, eC, normals(eV, eF)), shimmer=(sV, sF, sC, normals(sV, sF)))); print('body tris', len(FF), 'verts', len(VV), 'eyes', len(eF), 'shimmer', len(sF))
GX = np.linspace(0, .85, 1701); GK = 1 + 1.1 * np.clip((GX - .16) / .12, 0, 1) + 0 * GX; GW = np.where(GX > .16, .16 + (GX - .16) * GK, GX)
def warp(V, back=False):
    """the wings are drawn out while the collapse runs (and put back after), so their feather outline keeps more of the triangles"""
    V = np.array(V, float); A = np.abs(V[:, 0]); x = np.interp(A, GW, GX) if back else A; k = np.interp(x, GX, GK); V[:, 0] = np.sign(V[:, 0]) * (x if back else np.interp(x, GX, GW)); V[:, 1] = .6 + (V[:, 1] - .6) * (1 / k if back else k); return V

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else TRIS
    import trimesh, subprocess, tempfile
    lo, hi, h = V3(-.8012, -.123, -.421), V3(.8012, 1.07, .36), .0058
    V, F = surface(lambda P: (lambda d: np.where(np.abs(d) < .0007, .0007, d))(field(P)), lo, hi, h); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False); print('raw', len(F), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number); T_ = tempfile.mkdtemp(); np.savez(T_ + '/i.npz', v=warp(k.vertices), f=k.faces)
    subprocess.run([os.environ.get('BLENDER', '/opt/blender/blender'), '-b', '-P', os.path.join(HERE, 'dec.py'), '--', T_ + '/i.npz', T_ + '/o.npz', str(TRIS)], stdout=subprocess.DEVNULL, check=True); d = np.load(T_ + '/o.npz'); t = trimesh.Trimesh(warp(d['v'], True), d['f'], process=False)
    print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, 'euler', t.euler_number, t.bounds.round(3).tolist()); assert t.is_watertight and t.body_count == 1 and t.euler_number == 2
    finish(np.array(t.vertices), np.array(t.faces), OUT)
