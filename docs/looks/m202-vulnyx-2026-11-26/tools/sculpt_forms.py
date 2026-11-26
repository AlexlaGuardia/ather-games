"""M202 s1: the Vulnyx line's four SECOND FORMS (Vulnara / Vulnarc / Vulnore / Vulnix), sculpted in code off the live Vulnyx
(docs/looks/vulnyx-2026-11-24/tools/sculpt_v2.py: the same signed-distance body, so the M132 rig plan fits unchanged), re-coloured
and re-marked FROM THE LOCKED ART ONLY: /root/athernyx/assets/stage2/001-vulnara.png, 011-vulnarc.png, 012-vulnore.png,
013-vulnix.png (grimoire-ledger.json #1 / #11 / #12 / #13).
    python sculpt_forms.py <form> <out.glb> [tris]      form = mana | storm | earth | water
What each picture shows and this carries (and what it does not: see README.md):
  mana  Vulnara  violet coat, white muzzle / bib / tail tip, pink ear insides, gold rune rings (haunch, shoulder, flank), a pink
                 diamond gem in gold on the brow with small gold marks beside it, violet eyes
  storm Vulnarc  pale steel-blue coat crazed with darker crackle lines, white muzzle / ruff / tail tip, a violet bolt on the
                 brow, bright blue eyes
  earth Vulnore  orange coat, cream muzzle / bib with an amber blaze, a green leaf mantle over the shoulders, a mossy stone
                 mound on the back, dark brown stockings and ear tips, an amber diamond on the brow, amber eyes
  water Vulnix   aqua coat with paler bubble rings, paler aqua muzzle / bib / tail tip, a cyan teardrop gem on the brow,
                 blue-grey eyes"""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
import sculpt_v2 as S
from marching import surface
V3 = S.V3; zig = S.zig
C = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])

FORMS = {
    'mana': dict(name='vulnara', lo='#4f3f96', hi='#8a74cf', mid='#dcd2ee', cream='#f6f1fb', tip='#f7f3fc', ear='#e9a3b4', dark='#2a1a2e',
                 iris=((70, 30, 120), (160, 100, 220), (30, 14, 50)), brow=(214, 196, 240)),
    'storm': dict(name='vulnarc', lo='#5f86b8', hi='#9cc0e6', mid='#dfe9f4', cream='#f4f8fc', tip='#f3f7fb', ear='#e6a8a4', dark='#1c2030',
                  iris=((20, 70, 120), (70, 160, 225), (14, 20, 36)), brow=(220, 236, 250)),
    'earth': dict(name='vulnore', lo='#bf5a17', hi='#ec8f34', mid='#f6dcae', cream='#fbefd6', tip='#f8ead0', ear='#f8e6c8', dark='#2a1a12',
                  iris=((110, 56, 14), (214, 140, 34), (28, 16, 10)), brow=(255, 222, 160)),
    'water': dict(name='vulnix', lo='#1c8fa3', hi='#4fcad6', mid='#a6e4ea', cream='#c4eef2', tip='#a8e6ee', ear='#e2b4bc', dark='#10242c',
                  iris=((24, 60, 80), (90, 150, 180), (10, 22, 30)), brow=(190, 240, 246)),
}
F = None   # the form being built

# ── geometry: the live body, plus the Vulnore's mossy stone mound on her back (the picture's lump behind the shoulders) ──
BASE_FIELD = S.field
def mound(P):
    d = S.ell(P, (0, .505, -.085), (.105, .068, .12))
    d = S.su(d, S.ell(P, (.055, .50, .005), (.075, .060, .075)), .05)
    d = S.su(d, S.ell(P, (-.045, .495, -.170), (.075, .055, .07)), .05)
    for c, r in (((.06, .545, -.07), .040), ((-.05, .550, -.02), .036), ((.0, .560, -.13), .040), ((-.08, .53, -.11), .032), ((.09, .52, -.13), .030)):
        d = S.su(d, S.ell(P, c, (r, r * .8, r)), .025)                                            # stones in the moss
    return d
def field_earth(P): return S.su(BASE_FIELD(P), mound(P), .03)

def surf_pts(V, targets):
    """the body vertex nearest each target (a point ON the surface to centre a ring on)"""
    return np.array([V[np.argmin(((V - V3(*t)) ** 2).sum(1))] for t in targets])

def ring(V, p, r, w):
    d = np.linalg.norm(V - p, axis=1); return np.minimum(r + w - d, d - (r - w))
def dot(V, p, r): return r - np.linalg.norm(V - p, axis=1)

def classes(V):
    """sculpt_v2's seven classes (muzzle soft, muzzle, bib, tail tip, ear inside, ear fluff, nose), then the form's own"""
    out = S.classes(V); x, y, z = V.T; A = np.abs(x); form = F['form']
    if form == 'mana':     # gold rune rings: haunch (big), shoulder, flank; a dot in each
        for sx in (1, -1):
            for t, r in (((.155, .33, -.17), .050), ((.125, .36, .10), .034), ((.14, .25, -.03), .026)):
                p = surf_pts(V, [(sx * t[0], t[1], t[2])])[0]; out.append(ring(V, p, r, .0105)); out.append(dot(V, p, r * .32))
    if form == 'storm':    # crackle: thin darker lines crazing the coat, kept off the white muzzle / ruff / tail tip
        n = np.abs(np.sin(31 * x + 7 * y + 3) + np.sin(23 * y - 17 * z + 1) + np.sin(19 * z + 13 * x + 2) + .6 * np.sin(41 * (x + y - z)))
        out.append(np.minimum(.20 - n, np.minimum.reduce([.50 - y + .4 * np.clip(z - .2, 0, 1), np.where(z < -.62, -1, 1.), np.maximum(A - .105, .105 - z)])) * .2)
    if form == 'earth':    # leaf mantle over shoulders + upper flanks (leaf-toothed hem), the mound mossy, stockings, ear tips, amber blaze
        hem = .27 + .035 * zig(z * 1.0 + .5, 9) + .02 * zig(x + .5, 7)
        out.append(np.minimum.reduce([y - hem, .19 - z, z + .06, A - .045 + .2 * np.clip(.40 - y, 0, 1), .50 - y + .3 * np.clip(-z, 0, 1)]) * .5)
        out.append(.012 - mound(V))
        out.append(np.minimum(.17 + .012 * zig(z + .5, 30) - y, np.where(z > -.5, 1., -1)))
        ax = S.EAR_T - S.EAR_A; ln = np.linalg.norm(ax); u = ax / ln; t = ((np.c_[A, y, z] - S.EAR_A) @ u) / ln; out.append(np.minimum.reduce([(t - .74) * ln, z, A - .05]))
        out.append(np.minimum.reduce([.05 - A + .3 * np.clip(y - .30, 0, .1), z - (.15 + .25 * A), y - .30, .42 - y]))
    if form == 'water':    # bubble rings scattered over the coat
        rng = np.random.default_rng(13); pts = []
        while len(pts) < 26:
            q = V[rng.integers(len(V))]
            if q[1] > .16 and q[2] > -.46 and q[2] < .30 and abs(q[0]) > .05 and q[1] < .52 and all(np.linalg.norm(q - o) > .07 for o in pts): pts.append(q)
        for i, p in enumerate(pts): out.append(ring(V, p, .018 + .011 * (i % 3), .0065))
    return out

def palette():
    pal = [C(F['mid']), C(F['cream']), C(F['cream']), C(F['tip']), C(F['ear']), C(F['cream']), C(F['dark'])]
    form = F['form']; gold = C('#e3b23c')
    if form == 'mana': pal += [gold, gold] * 6
    if form == 'storm': pal += [C('#34507e')]
    if form == 'earth': pal += [C('#5f8a32'), C('#7d8f55'), C('#5a3420'), C('#3a2216'), C('#f0b340')]
    if form == 'water': pal += [C('#d4fafc')] * 26
    return pal

def eyes():
    """sculpt_v2's eye recipe with the form's iris, plus the brow mark (gem / bolt) in the same unlit part (head-weighted)"""
    parts = []
    def zsurf(X, Y):
        z = np.full(len(X), .50)
        for _ in range(60): z -= np.clip(S.field(np.stack([X, Y, z], -1)), -.02, .02) * .8
        return z
    def patch(pts, col, dz, rings=3):
        pts = np.array(pts, float); c = pts.mean(0); n = len(pts); X = [c]
        for r in range(1, rings + 1): X += list(c + (pts - c) * r / rings)
        X = np.array(X); P = np.c_[X, zsurf(X[:, 0], X[:, 1])]
        e = 1e-3; g = np.stack([S.field(P + np.eye(3)[i] * e) - S.field(P - np.eye(3)[i] * e) for i in range(3)], -1); g /= np.linalg.norm(g, axis=1, keepdims=True); P = P + g * dz
        Fc = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
        for r in range(rings - 1):
            a, b = 1 + r * n, 1 + (r + 1) * n
            for i in range(n): j = (i + 1) % n; Fc += [(a + i, b + i, b + j), (a + i, b + j, a + j)]
        Fc = np.array(Fc); nn = np.cross(P[Fc[:, 1]] - P[Fc[:, 0]], P[Fc[:, 2]] - P[Fc[:, 0]])
        if (nn * g[Fc[:, 0]]).sum() < 0: Fc = Fc[:, ::-1]
        parts.append((P, Fc, col))
    ir0, ir1, pu = F['iris']
    for s in (1, -1):
        c = V3(.1135, .588); th = np.linspace(0, 2 * np.pi, 20, endpoint=False)
        def alm(w, h, dx=0, dy=0, tilt=.16):
            x, y = np.cos(th) * w, np.sin(th) * h * (1 + .12 * np.cos(th)); y = np.where(y > 0, y * .66, y); p = np.c_[x * np.cos(tilt) - y * np.sin(tilt), x * np.sin(tilt) + y * np.cos(tilt)] + c + (dx, dy); p[:, 0] *= s; return p
        patch(alm(.060, .050, 0, .003), (42, 24, 14), .003)
        lash = np.array([(.040, .020), (.062, .022), (.090, .041), (.066, .004), (.052, -.002)]) + c; lash[:, 0] *= s; patch(lash, (42, 24, 14), .0032, 2)
        patch(alm(.052, .041), (255, 246, 222), .0045)
        def disc(r, dx, dy, col, dz, ry=1.12, n=16):
            t = np.linspace(0, 2 * np.pi, n, endpoint=False); p = np.c_[np.cos(t) * r, np.sin(t) * r * ry] + c + (dx, dy); p[:, 1] = np.minimum(p[:, 1], c[1] + .022 + .20 * (p[:, 0] - c[0])); p[:, 0] *= s; patch(p, col, dz, 2)
        disc(.0355, -.007, -.001, ir0, .006); disc(.0315, -.007, -.001, ir1, .0072); disc(.0185, -.007, .001, pu, .0085, 1.15)
        t = np.linspace(0, 2 * np.pi, 10, endpoint=False); p = np.c_[np.cos(t) * .0095, np.sin(t) * .0095] + (c[0] * s + .004, c[1] + .011); patch(p, (255, 255, 250), .0100, 1)
        b = np.array([(-.030, .050), (.005, .066), (.040, .066), (.050, .058), (.008, .057)]) + c; b[:, 0] *= s; patch(b, F['brow'], .0025, 1)
    form = F['form']; gy = .675
    dia = lambda w, h, y=gy: [(0, y + h), (w, y), (0, y - h), (-w, y)]
    if form == 'mana':
        patch(dia(.034, .046), (227, 178, 60), .004, 2); patch(dia(.022, .032), (226, 92, 178), .0062, 2); patch(dia(.008, .014, gy + .008), (255, 200, 236), .0075, 1)
        for s in (1, -1):    # the small gold marks either side of the gem
            m = np.array([(.050, .668), (.070, .684), (.064, .660)]); m[:, 0] *= s; patch(m, (227, 178, 60), .004, 1)
            m = np.array([(.052, .700), (.066, .716), (.060, .694)]); m[:, 0] *= s; patch(m, (227, 178, 60), .004, 1)
    if form == 'storm':      # a violet bolt, slanted
        patch([(.006, .712), (.020, .706), (.004, .672), (.016, .672), (-.010, .636), (-.004, .664), (-.016, .664)], (150, 104, 226), .0055, 1)
    if form == 'earth':
        patch(dia(.030, .042), (150, 96, 22), .004, 2); patch(dia(.021, .031), (242, 186, 52), .0062, 2); patch(dia(.007, .012, gy + .008), (255, 236, 170), .0075, 1)
    if form == 'water':
        t = np.linspace(0, 2 * np.pi, 14, endpoint=False); r = .020; drop = np.c_[np.sin(t) * r * (1 - .55 * np.clip(np.cos(t), 0, 1)), gy - .008 + np.cos(t) * r * 1.6]
        patch(drop * [1.35, 1] + [0, -.004 * 0], (40, 150, 190), .004, 2); patch(drop, (150, 236, 255), .0062, 2)
    Vs, Fs, Cs, o = [], [], [], 0
    for P, f, col in parts: Vs.append(P); Fs.append(f + o); Cs.append(np.tile((*np.round(255 * (np.array(col) / 255.) ** 2.2), 255), (len(P), 1))); o += len(P)
    return np.vstack(Vs), np.vstack(Fs), np.vstack(Cs)

def finish(V, Fa, path, eye):
    """sculpt_v2.finish with the form's coat: the shading ramp (darker under, lighter on top) runs lo -> hi on the coat class"""
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0)
    pal = palette(); lab = np.full(len(Fa), -1)
    for k in range(len(pal)):
        V, Fa, lab, side = S.cut(V, Fa, lab, classes(V)[k]); lab = np.where(side, k, lab)
    ep = np.where(V[:, 2] < -.30, .034, .006)[:, None]
    N = np.stack([S.field(V + np.eye(3)[i] * ep) - S.field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    base = np.array([1, 2, 3]); cols = np.array([pal[k] if k >= 0 else base for k in lab]); key, inv = np.unique(np.c_[Fa.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == base).all(1); sh = np.clip(.5 + .5 * NN[:, 1], 0, 1)[:, None]; CC[g, :3] = C(F['lo']) * (1 - sh[g]) + C(F['hi']) * sh[g]
    eV, eF, eC = eye
    nv, nf, nr, ns = [], [], 6, 18
    for a in range(nr + 1):
        for b in range(ns):
            t, u = np.pi * a / nr, 2 * np.pi * b / ns; nv.append((np.sin(t) * np.cos(u) * .0300 * (1 + .16 * np.sin(t) * np.sin(u)), .5335 + np.sin(t) * np.sin(u) * .0228, .503 + np.cos(t) * .0235))
    for a in range(nr):
        for b in range(ns): p, q = a * ns + b, a * ns + (b + 1) % ns; nf += ([] if a == 0 else [(p, p + ns, q)]) + ([] if a == nr - 1 else [(p + ns, q + ns, q)])
    eF = np.vstack([eF, np.array(nf) + len(eV)]); eV = np.vstack([eV, nv]); eC = np.vstack([eC, np.tile((2, 1, 1, 255), (len(nv), 1))])
    S.glb(path, dict(body=(VV, FF, CC.astype(np.uint8), NN), eyes=(eV, eF, eC, S.normals(eV, eF)))); print(F['name'], 'body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF))

if __name__ == '__main__':
    form, OUT = sys.argv[1], sys.argv[2]; TRIS = int(sys.argv[3]) if len(sys.argv) > 3 else 4700
    F = dict(FORMS[form], form=form)
    if form == 'earth': S.field = field_earth
    import trimesh
    lo, hi, h = V3(-.341, -.033, -1.101), V3(.341, 1.03, .56), .0078
    Vr, Fr = surface(S.field, lo, hi, h); m = trimesh.Trimesh(Vr, Fr, process=False)
    k = max(m.split(only_watertight=False), key=lambda c: len(c.faces)); t = S.decimate(k.vertices, k.faces, TRIS + (500 if form == 'earth' else 0))
    print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count)
    finish(np.array(t.vertices), np.array(t.faces), OUT, eyes())
