"""M202 Athowl line: the SHARED owl pipeline (tools only, no body). Each form's sculpt_<form>.py builds her own body from her own
locked art and hands this module her pieces: trunk, head, wings, feet, tail, eyes, marks, palette, rig landmarks.
What is shared is machinery: the signed-distance helpers (Vulnyx v2 route), the wing-blade frame, the hidden neck groove (so the
head can turn right round without shearing), the eye-cap builder, colour cutting and the glb export.
    python sculpt_<form>.py <out.glb> [tris]"""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
from marching import surface
from sculpt_v2 import cone, ell, su, ss, cut, glb, decimate, normals, V3, rx, rz

C8 = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])
zig = lambda u, n: np.abs(((u * n) % 1) - .5) * 2
def yrot(a): c, s = np.cos(a), np.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def mirror(P): return np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)


class Wing:
    """a wing blade in its own frame: u from the shoulder SH to the tip, w across it (+ = front edge), n out of the blade.
    FEATH = (t mid, w mid, half length, half width, pointed) feather lobes; bow = how much the blade bellies out."""
    def __init__(s, SH, TIP, ang, FEATH, bow=.042, thick=(.034, .022)):
        s.SH = V3(*SH); s.WU = V3(*TIP) - s.SH; s.WL = np.linalg.norm(s.WU); s.WU = s.WU / s.WL; s.FEATH = FEATH; s.bow = bow; s.thick = thick
        n = V3(np.cos(ang), 0, np.sin(ang)); s.WN = n - (n @ s.WU) * s.WU; s.WN /= np.linalg.norm(s.WN)
        c = np.cross(s.WU, s.WN); s.WW = -c if c[2] < 0 else c
    def loc(s, M):
        q = M - s.SH; t = (q @ s.WU) / s.WL; w = q @ s.WW; bow = s.bow * np.sin(np.pi * np.clip(t, 0, 1)) - 1.5 * w * w; return t, w, q @ s.WN - bow
    def blade(s, M, grow=0):
        t, w, n = s.loc(M); d = np.full(M.shape[:-1], 9.)
        for tc, wc, a, hw, pt in s.FEATH:
            v = (t - tc) / (a + grow / s.WL); th = (s.thick[1] if pt else s.thick[0]) + grow; h = hw + grow
            if pt:
                h = h * np.clip(1 - np.abs(v) ** 2.4, .02, 1); k = np.sqrt(((w - wc) / h) ** 2 + (n / (th * np.clip(1.06 - np.abs(v) ** 3, .12, 1))) ** 2)
                e = np.maximum((k - 1) * np.minimum(h, th), (np.abs(v) - 1) * .2)
            else: k = np.sqrt(v ** 2 + ((w - wc) / h) ** 2 + (n / th) ** 2); e = (k - 1) * th
            d = su(d, e, .012)
        return d


class Owl:
    """F = the form's module. Needed from it: NECK_Y, NECK_R (inner, outer), GROOVE (radius of the groove's outer lip), LID, WING (a
    Wing), WING_CUT (centre, radius of the pocket the body is cut back round the blade root), trunk(P, M), head(M), feet(M), classes(V, o),
    PAL, coat(VV, NN, g) -> colours, eye spec EYE, decals(o, parts), BOUNDS, WING_YMAX."""
    def __init__(s, F): s.F = F; s.W = F.WING
    def wingmask(s, V):
        M = mirror(V); t, w, n = s.W.loc(M); return (s.W.blade(M) < .006) & (M[:, 1] < s.F.WING_YMAX), t, w, n
    def field(s, P):
        F = s.F; M = mirror(P)
        b = F.trunk(P, M)
        c, r = F.WING_CUT
        b = ss(b, np.maximum(s.W.blade(M, .019), r - np.linalg.norm(M - V3(*c), axis=-1)), .006)            # the body is cut back from the blade
        b = su(b, cone(M, *F.SHOULDER), .018); b = su(b, s.W.blade(M), .010)
        h = F.head(M); R = np.sqrt(P[..., 0] ** 2 + P[..., 2] ** 2)
        g = np.sqrt(((R - F.GROOVE) / (F.GROOVE - F.NECK_R[0])) ** 2 + ((P[..., 1] - F.NECK_Y) / .017) ** 2)
        d = su(b, cone(P, (0, F.NECK_Y - .057, 0), (0, F.NECK_Y + .10, 0), F.NECK_R[0] + .015, F.NECK_R[0] + .015), .01); d = np.minimum(d, h)
        return ss(d, np.maximum((g - 1) * .017, F.NECK_R[0] - R), .004)
    # ── the unlit part: eyes, lids, claws, gems, glyph strokes ──
    def eyes(s):
        F = s.F; E = F.EYE; parts = []; field = s.field
        DC, DR, RE = V3(*E['c']), yrot(E['yaw']), E['r']
        disc = DR @ V3(0, 0, 1); ux, uy = DR @ V3(1, 0, 0), V3(0, 1, 0)
        a = np.arange(24) / 24 * 2 * np.pi; rim = DC + RE * (np.cos(a)[:, None] * ux + np.sin(a)[:, None] * uy); hh = np.full(24, .30)
        for _ in range(80): hh -= np.clip(field(rim + hh[:, None] * disc), -.02, .02) * .7
        base = np.median(hh) + .006; dome = lambda r: base + E.get('dome', .020) * (1 - np.clip(r / RE, 0, 1) ** 2)
        def cap(sg, x0, y0, rad, col, dz, rings=3, n=24, wall=False, ry=1.):
            a = np.arange(n) / n * 2 * np.pi; X = np.array([(x0, y0)] + [(x0 + rad * k / rings * np.cos(t), y0 + ry * rad * k / rings * np.sin(t)) for k in range(1, rings + 1) for t in a])
            Fc = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
            for k in range(rings - 1):
                p, q = 1 + k * n, 1 + (k + 1) * n
                for i in range(n): j = (i + 1) % n; Fc += [(p + i, q + i, q + j), (p + i, q + j, p + j)]
            P = DC + X[:, :1] * ux + X[:, 1:] * uy + (dome(np.hypot(X[:, 0], X[:, 1])) + dz)[:, None] * disc; Fc = np.array(Fc)
            if wall: P = np.vstack([P, P[-n:] - .030 * disc]); m = 1 + (rings - 1) * n; Fc = np.vstack([Fc, [f for i in range(n) for f in ((m + i, m + n + i, m + n + (i + 1) % n), (m + i, m + n + (i + 1) % n, m + (i + 1) % n))]])
            P = P * V3(sg, 1, 1); parts.append((P, Fc if sg > 0 else Fc[:, ::-1], col))
        for sg in (1, -1):
            for k, (rad, col) in enumerate(E['rings']): cap(sg, 0, E.get('iris_dy', 0) * (k > 0), rad, col, .0016 * k, 2, wall=(k == 0))
            cap(sg, sg * RE * .26, RE * .36, RE * .21, (255, 252, 240), .0016 * len(E['rings']) + .0018, 1, 12)
            if E.get('brow'):                                                          # a frowning brow stroke over the eye (Voltowl)
                q = np.linspace(-1, 1, 11); up = np.c_[q * RE * 1.05, RE * (.80 + .22 * q * sg)]; dn = up - np.c_[0 * q, .012 + .010 * (1 - q * q)]
                X = np.vstack([up, dn]); Fb = np.array([f for i in range(10) for f in ((i, 11 + i, 12 + i), (i, 12 + i, i + 1))])
                P = (DC + X[:, :1] * ux + X[:, 1:] * uy + (dome(np.hypot(X[:, 0], X[:, 1])) + .009)[:, None] * disc) * V3(sg, 1, 1); parts.append((P, Fb if sg > 0 else Fb[:, ::-1], E['brow']))
            # the closed lid waits LID behind the eye inside the skull; the rig's lids bone brings it forward (blink, sleep)
            k0 = len(parts); cap(sg, 0, 0, RE + .0015, E['lid'], .0016 * len(E['rings']) + .0045, 3)
            q = np.linspace(-1, 1, 11); up = np.c_[q * RE * .78, -.020 - .030 * (1 - q * q)]; dn = up + np.c_[0 * q, -.004 - .006 * (1 - q * q)]; X = np.vstack([up, dn])
            Fl = np.array([f for i in range(10) for f in ((i, 11 + i, 12 + i), (i, 12 + i, i + 1))]); P = (DC + X[:, :1] * ux + X[:, 1:] * uy + (dome(np.hypot(X[:, 0], X[:, 1])) + .0075 + .0016 * len(E['rings']))[:, None] * disc) * V3(sg, 1, 1)
            parts.append((P, Fl if sg > 0 else Fl[:, ::-1], E['lidline']))
            for k in range(k0, len(parts)): parts[k] = (parts[k][0] - V3(0, 0, F.LID), *parts[k][1:])
        F.decals(s, parts)
        V, Fs, C, o = [], [], [], 0
        for P, f, col in parts: V.append(P); Fs.append(f + o); C.append(np.tile((*np.round(255 * (np.array(col) / 255.) ** 2.2), 255), (len(P), 1))); o += len(P)
        return np.vstack(V), np.vstack(Fs), np.vstack(C)
    # decal helpers for the forms
    def lay(s, X, dz, z0=.40):
        z = np.full(len(X), z0)
        for _ in range(80): z -= np.clip(s.field(np.c_[X, z]), -.02, .02) * .7
        P = np.c_[X, z]; e = 4e-3; g = np.stack([s.field(P + np.eye(3)[i] * e) - s.field(P - np.eye(3)[i] * e) for i in range(3)], -1); g /= np.linalg.norm(g, axis=1, keepdims=True); return P + g * dz, g
    def put(s, parts, X, Fc, col, dz):
        P, g = s.lay(np.array(X, float), dz); Fc = np.array(Fc); nn = np.cross(P[Fc[:, 1]] - P[Fc[:, 0]], P[Fc[:, 2]] - P[Fc[:, 0]]); parts.append((P, Fc[:, ::-1] if (nn * g[Fc[:, 0]]).sum() < 0 else Fc, col))
    def ring(s, parts, o, i_, col, dz):
        n = len(o); s.put(parts, np.vstack([o, i_]), [f for k in range(n) for f in ((k, (k + 1) % n, n + (k + 1) % n), (k, n + (k + 1) % n, n + k))], col, dz)
    def disc2(s, parts, cx, cy, r, col, dz, n=14, ry=1.):
        X = [(cx, cy)] + [(cx + r * np.cos(t), cy + r * ry * np.sin(t)) for t in np.arange(n) / n * 2 * np.pi]; s.put(parts, X, [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)], col, dz)
    def stroke(s, parts, pts, w, col, dz):
        """a ribbon laid on her front along 2D (x, y) points: an unlit painted line (glyph patterns, veins)"""
        pts = np.array(pts, float); d = np.gradient(pts, axis=0); d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-9); nrm = np.c_[-d[:, 1], d[:, 0]] * w / 2
        X = np.vstack([pts + nrm, pts - nrm]); n = len(pts); s.put(parts, X, [f for i in range(n - 1) for f in ((i, n + i, n + i + 1), (i, n + i + 1, i + 1))], col, dz)
    def claw(s, parts, b, t, r0, col):
        b, t = V3(*b), V3(*t); n = 7; d = (t - b) / np.linalg.norm(t - b); e1 = V3(1, 0, 0); e2 = np.cross(d, e1); mm = b + (t - b) * .5 + V3(0, .010, .004)
        for sg in (1, -1):
            P = np.vstack([[c + r * (np.cos(q) * e1 + np.sin(q) * e2) for q in np.arange(n) / n * 2 * np.pi] for c, r in ((b, r0), (mm, r0 * .76))] + [[t]])
            Fc = np.array([f for i in range(n) for f in ((i, (i + 1) % n, n + (i + 1) % n), (i, n + (i + 1) % n, n + i), (n + i, n + (i + 1) % n, 2 * n))])
            if (np.cross(P[Fc[:, 1]] - P[Fc[:, 0]], P[Fc[:, 2]] - P[Fc[:, 0]]) * (P[Fc].mean(1) - b)).sum() < 0: Fc = Fc[:, ::-1]
            P = P * V3(sg, 1, 1); parts.append((P, Fc if sg > 0 else Fc[:, ::-1], col))
    def finish(s, V, F_, path, eye):
        F = s.F; V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(F_), -1)
        for k in range(len(F.PAL)): V, F_, lab, side = cut(V, F_, lab, F.classes(V, s)[k]); lab = np.where(side, k, lab)
        ep = .006; N = np.stack([s.field(V + np.eye(3)[i] * ep) - s.field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
        cols = np.array([F.PAL[k] if k >= 0 else F.COAT_KEY for k in lab]); key, inv = np.unique(np.c_[F_.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
        VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
        g = (key[:, 1:] == F.COAT_KEY).all(1); y = VV[:, 1]; sh = np.clip(.55 + .45 * NN[:, 1], 0, 1) * np.where(y < .5, np.clip((y - .02) / .36, .0, 1) * .55 + .45, 1)
        gr = np.clip(1 - np.abs(y - F.NECK_Y) / .03, 0, 1) * (np.hypot(VV[:, 0], VV[:, 2]) < F.GROOVE - .07); sh = np.clip(sh - .7 * gr, 0, 1)[:, None]
        CC[g, :3] = F.COAT[0] * (1 - sh[g]) + F.COAT[1] * sh[g]                                       # darker underneath, light on top
        eV, eF, eC = eye; glb(path, dict(body=(VV, FF, CC, NN), eyes=(eV, eF, eC, normals(eV, eF)))); print('body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF))
    def run(s, out, tris=4200, h=.0068):
        import trimesh
        lo, hi = s.F.BOUNDS; V, Fc = surface(s.field, V3(*lo), V3(*hi), h); m = trimesh.Trimesh(V, Fc, process=False); ps = m.split(only_watertight=False)
        print('raw', len(Fc), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps][:6])
        k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number)
        try: t = decimate(k.vertices, k.faces, tris)
        except SystemExit:                                   # thin wing lobes flip a few faces: same quadric pass, winding repaired after
            import fast_simplification as fs
            v, f = fs.simplify(np.asarray(k.vertices, np.float32), np.asarray(k.faces, np.int32), target_count=tris, agg=3); t = trimesh.Trimesh(v, f, process=False); t.merge_vertices(); trimesh.repair.fix_winding(t)
            assert t.is_watertight and t.is_winding_consistent and t.body_count == 1, 'no closed decimation, even with the winding repaired'
        print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
        s.finish(np.array(t.vertices), np.array(t.faces), out, s.eyes())
