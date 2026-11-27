"""M202 pass 2 (Alex 11-27): CROAKARC (Croakling's Storm form) rebuilt as a SKINK in body AND gait. Locked art athernyx assets/stage2/
028-croakarc.png (looked at, never traced, never in this repo); grimoire-ledger divergence_note "Croakling-storm = a skink, not a frog
(lure dropped)". Pass 1 hung skink parts on the frog's upright sculpt; Alex: "LOW and lizard-like: long low body slung between splayed
legs, belly near the ground, the long curling tail carried behind, head forward; walk like a lizard (sprawl gait), not hop; veins as crisp
branching lightning (glowing) at game distance". So she leaves the frog's sculpt and rig: her own body here (the Marlotl salamander route,
sculpt_v2 + marching), her own skeleton in rig_croakarc.py (the M132 quadruped plan, a sprawl walk + scurry). Kept from the line: the
Croakling face (big round eyes, a wide smile, two nostril dots), round toe pads, the croak unit space (so she still stands at true size
beside her base and sisters), her storm palette, the pointed crest, the dorsal spines, the violet brow gem.
    python sculpt_croakarc.py <out.glb> [tris]
LIGHTNING VEINS: branching jagged bolts walked over her surface (seeded, so every build is the same), drawn twice: (1) a thin UNLIT tube
on the eyes part (the game draws `eyes` MeshBasic, toneMapped false = it glows at any light), its verts later skinned to the nearest body
vertex by the rig; (2) a pale halo band cut into the skin round each bolt, so the glow bleeds."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
import sculpt_v2 as S
V3, su, ss, ell, cone = S.V3, S.su, S.ss, S.ell, S.cone
C = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])
mir = lambda P: np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
lin = lambda c: (*np.round(255 * (np.array(c) / 255.) ** 2.2), 255)

# ── landmarks (rig_croakarc.py reads these); croak units: the base Croakling stands ~1.0 tall ──
L = dict(head=(0, .255, .40), chest=(0, .20, .20), pelvis=(0, .20, -.36),
         f=[(.120, .185, .220), (.250, .125, .245), (.272, .034, .290)],          # shoulder, elbow, wrist: elbows OUT (a sprawl)
         h=[(.120, .185, -.380), (.262, .130, -.410), (.282, .034, -.370)],       # hip, knee, ankle
         tail=[(0, .195, -.44), (0, .165, -.70), (0, .140, -.96), (0, .155, -1.18), (0, .235, -1.34), (0, .355, -1.38), (0, .445, -1.31), (0, .470, -1.22)],
         tailr=[.105, .080, .058, .042, .032, .024, .017, .009])
TC = S.catmull([(*a, r) for a, r in zip(L['tail'], L['tailr'])], 6)

def trunk(P):
    b = ell(P, (0, .195, -.09), (.165, .118, .40))                                        # long and low: the belly ~8 cm (glb) off the ground
    return su(b, cone(P, (0, .205, .22), (0, .195, -.40), .118, .108), .06)
def head(P):
    h = ell(P, L['head'], (.185, .135, .175))                                             # a skink's head, forward on a short neck
    h = su(h, ell(P, (0, .215, .545), (.150, .088, .115)), .06)                          # the blunt snout
    h = su(h, ell(P, (0, .190, .43), (.160, .070, .15)), .05)                            # the jaw, full under the smile
    for s in (1, -1): h = su(h, ell(P, (s * .118, .315, .475), (.078, .074, .074)), .045)   # the eye bulges (the Croakling's big eyes)
    return su(h, cone(P, (0, .335, .405), (0, .505, .300), .070, .008), .05)            # the pointed crest, swept up and back
def legs(P):
    M = mir(P); f, h = L['f'], L['h']
    d = cone(M, f[0], f[1], .046, .036); d = su(d, cone(M, f[1], f[2], .036, .028), .03)
    d = su(d, ell(M, (.280, .022, .312), (.040, .020, .040)), .025)
    t = cone(M, h[0], h[1], .054, .040); t = su(t, cone(M, h[1], h[2], .040, .030), .03)
    t = su(t, ell(M, (.290, .022, -.345), (.042, .020, .044)), .025)
    for k, a in enumerate(np.radians([-52, -18, 16, 50])):                                # four splayed toes, each a round pad at the tip
        df = V3(np.sin(a) * .9 + .25, 0, np.cos(a)); df /= np.linalg.norm(df); p0 = V3(.282, .020, .315); q = p0 + df * .070 + V3(0, -.004, 0)
        d = su(d, su(cone(M, p0, q, .0125, .0090), ell(M, q, (.017, .012, .017)), .006), .010)
        dh = V3(np.sin(a) * .9 + .30, 0, np.cos(a) * .55 - .35); dh /= np.linalg.norm(dh); p1 = V3(.292, .020, -.348); q = p1 + dh * .075 + V3(0, -.004, 0)
        t = su(t, su(cone(M, p1, q, .0125, .0090), ell(M, q, (.017, .012, .017)), .006), .010)
    return su(d, t, .001)
def tail(P):
    Q = P * V3(1.25, 1, 1); d = np.full(P.shape[:-1], 9.)                                   # a touch flat-sided, round on top
    for a, b in zip(TC[:-1], TC[1:]): d = np.minimum(d, cone(Q, a[:3], b[:3], a[3], b[3]))
    return d / 1.12
def box(fn, P, lo, hi):
    sh = P.shape[:-1]; Q = P.reshape(-1, 3); m = np.all((Q >= lo) & (Q <= hi), 1); out = np.full(len(Q), 9.)
    if m.any(): out[m] = fn(Q[m])
    return out.reshape(sh)
def body0(P):
    b = su(trunk(P), head(P), .08); b = su(b, np.minimum(box(legs, P, V3(-.42, -.05, -.60), V3(.42, .26, .50)), .3), .035)
    return su(b, tail(P), .06)

def march_down(x, z, top=1.0):
    p = V3(x, top, z)
    for _ in range(80): p = p - V3(0, 1, 0) * np.clip(body0(p[None])[0], -.03, .03) * .9
    return p
# dorsal spines: a row of small cones from behind the crest down the back onto the tail
SPN = [march_down(0, z) for z in (.26, .14, .02, -.10, -.22, -.34, -.48, -.62, -.76, -.90, -1.03)]
SPH = [.034, .038, .040, .040, .038, .036, .033, .029, .025, .021, .017]
def spines(P):
    d = np.full(P.shape[:-1], 9.)
    for p, hh in zip(SPN, SPH): d = np.minimum(d, cone(P, p - V3(0, .015, 0), p + V3(0, hh, -.012), .020, .003))
    return d
def field(P): return su(body0(P), box(spines, P, V3(-.05, .05, -1.15), V3(.05, .45, .35)), .012)
def grad(X, e=2e-3): return np.stack([field(X + np.eye(3)[i] * e) - field(X - np.eye(3)[i] * e) for i in range(3)], -1) / (2 * e)
def onto(X):
    for _ in range(6): g = grad(X); X = X - g * (field(X) / np.maximum((g * g).sum(-1), 1e-9))[..., None]
    return X

# ── the lightning: seeded branching jagged bolts on the skin ──
def bolts(seed=28):
    rng = np.random.default_rng(seed); out = []
    seeds = [(.10, .30, .05), (-.10, .30, .05), (.14, .26, -.20), (-.14, .26, -.20), (.12, .28, -.45), (-.12, .28, -.45), (.16, .22, .10),
             (-.16, .22, .10), (-.05, .28, -.80), (.04, .24, -1.00), (-.03, .30, -1.24), (.12, .30, .36), (-.12, .30, .36),
             (.17, .17, -.30), (-.17, .17, -.30), (.06, .20, .55), (-.16, .20, -.05), (.16, .20, -.55), (-.16, .20, -.55)]
    ok = lambda p: p[1] > .085 and not (abs(p[0]) > .19 and p[1] < .16) and np.linalg.norm((abs(p[0]) - .118, p[1] - .315, p[2] - .475)) > .095
    def walk(p, d, n, depth):
        pts = [p]
        for k in range(n):
            g = grad(p[None])[0]; nrm = g / np.linalg.norm(g); d = d - (d @ nrm) * nrm; d /= np.linalg.norm(d)
            a = rng.uniform(-.55, .55) * (1.6 if rng.random() < .25 else 1); b = np.cross(nrm, d); d2 = np.cos(a) * d + np.sin(a) * b
            q = onto((p + d2 * rng.uniform(.026, .040))[None])[0]
            if not ok(q): break
            pts.append(q); p = q
            if depth < 2 and rng.random() < (.22 if depth == 0 else .12):
                b2 = np.cross(nrm, d); walk(p, d + b2 * rng.choice([-1, 1]) * 1.2, int(rng.integers(3, 7 - depth)), depth + 1)
        if len(pts) > 2: out.append(np.array(pts))
    for s in seeds:
        p = onto(V3(*s)[None])[0]
        if not ok(p): continue
        g = grad(p[None])[0]; t = np.cross(g, rng.normal(size=3)); walk(p, t / np.linalg.norm(t), int(rng.integers(9, 15)), 0)
    return out
def seg_dist(V, B):
    A0 = np.vstack([b[:-1] for b in B]); A1 = np.vstack([b[1:] for b in B]); d = np.full(len(V), 9.)
    for i in range(0, len(V), 4000):
        X = V[i:i + 4000, None]; ab = A1 - A0; t = np.clip(((X - A0) * ab).sum(-1) / np.maximum((ab * ab).sum(-1), 1e-12), 0, 1)
        d[i:i + 4000] = np.linalg.norm(X - A0 - t[..., None] * ab, axis=-1).min(1)
    return d
VEIN = (232, 246, 255)                                                                     # the glowing core (unlit)
def vein_tubes(B, r=.0050, lift=.0030):
    Vs, Fs, o = [], [], 0
    for b in B:
        n = grad(b); n /= np.linalg.norm(n, axis=1, keepdims=True); t = np.gradient(b, axis=0); t /= np.linalg.norm(t, axis=1, keepdims=True)
        w = np.cross(t, n); w /= np.linalg.norm(w, axis=1, keepdims=True); c = b + n * lift; ring = []
        for a in (0, 2.094, 4.189): ring.append(c + r * (np.cos(a) * n + np.sin(a) * w) * np.linspace(.6, 1, len(b))[::-1][:, None] ** 0 * np.r_[np.ones(len(b) - 1), .4][:, None])
        R = np.stack(ring, 1).reshape(-1, 3); k = len(b)
        for i in range(k - 1):
            for j in range(3):
                a0, a1, b0, b1 = o + i * 3 + j, o + i * 3 + (j + 1) % 3, o + (i + 1) * 3 + j, o + (i + 1) * 3 + (j + 1) % 3; Fs += [(a0, b0, a1), (a1, b0, b1)]
        Vs.append(R); o += len(R)
    return np.vstack(Vs), np.array(Fs)

# ── colour classes (positive inside), cut into the mesh; later classes win ──
PAL = dict(lo='#6a8cc0', hi='#a6c2ea', belly='#e6eef9', pad='#c6d8f0', halo='#c8e0ff', mouth='#34507a', nose='#34507a')
ORDER = ('belly', 'pad', 'halo', 'mouth', 'nose')
BOLTS = None
def classes(V):
    x, y, z = V.T; A = np.abs(x); out = []
    out.append(np.minimum.reduce([.150 - y + .05 * np.clip(A - .05, 0, 1), .125 - A + .3 * np.clip(.20 - y, 0, .1), z + .46, .60 - z]))   # pale belly + chin
    out.append(np.where((y < .040) & (A > .20), 1., -1.))                                                                                   # toe pads
    out.append(np.where(y > .07, .0095 - seg_dist(V, BOLTS), -1.))                                                                          # the glow halo round each bolt
    sm = .200 + .95 * x ** 2
    out.append(np.minimum.reduce([.0085 - np.abs(y - sm), .150 - A, z - .50]))                                                              # the smile
    out.append(.0095 - np.sqrt((A - .036) ** 2 + (y - .245) ** 2 + (z - .655) ** 2 * .2))                                                    # nostrils
    return out

def eyes():
    """big round Croakling eyes (pale rim, deep blue iris, black pupil, two catchlights), the violet brow gem, and the lightning tubes; unlit"""
    import trimesh
    Vs, Fs, Cs, o = [], [], [], 0
    def put(v, f, col):
        nonlocal o; Vs.append(v); Fs.append(f + o); o += len(v); Cs.append(np.tile(lin(col), (len(v), 1)))
    for s in (1, -1):
        u = V3(s * .62, .42, .66); u /= np.linalg.norm(u); p = V3(s * .118, .315, .475)
        for _ in range(60): p = p + u * np.clip(-field(p[None])[0], -.02, .02) * .8 + u * 0
        p = onto(p[None])[0]; g = grad(p[None])[0]; g /= np.linalg.norm(g)
        for c, r, col, sub in ((p - g * .020, .074, (190, 210, 236), 3), (p + g * .004, .056, (46, 104, 204), 3), (p + g * .030, .036, (10, 14, 22), 3),
                               (p + g * .064 + V3(s * .010, .016, 0), .012, (255, 255, 255), 1), (p + g * .062 + V3(-s * .012, -.012, 0), .006, (214, 236, 255), 1)):
            b = trimesh.creation.icosphere(subdivisions=sub, radius=r); put(b.vertices + c, b.faces, col)
    p = onto(V3(.0, .33, .50)[None])[0]; g = grad(p[None])[0]; g /= np.linalg.norm(g)                     # the brow gem, between the eyes
    for c, r, col in ((p + g * .002, .028, (170, 112, 236)), (p + g * .016, .012, (236, 214, 255))):
        b = trimesh.creation.icosphere(subdivisions=2, radius=r); v = b.vertices * (1, 1, .55); put(v + c, b.faces, col)
    tv, tf = vein_tubes(BOLTS); put(tv, tf, VEIN)
    return np.vstack(Vs), np.vstack(Fs), np.vstack(Cs)

def finish(V, Fa, path):
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(Fa), -1); pal = [C(PAL[k]) for k in ORDER]
    for k in range(len(ORDER)):
        V, Fa, lab, side = S.cut(V, Fa, lab, classes(V)[k]); lab = np.where(side, k, lab)
    ep = .004; N = np.stack([field(V + np.eye(3)[i] * ep) - field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    base = np.array([1, 2, 3]); cols = np.array([pal[k] if k >= 0 else base for k in lab]); key, inv = np.unique(np.c_[Fa.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == base).all(1); sh = np.clip(.5 + .5 * NN[:, 1], 0, 1)[:, None]; CC[g, :3] = C(PAL['lo']) * (1 - sh[g]) + C(PAL['hi']) * sh[g]
    eV, eF, eC = eyes(); S.glb(path, dict(body=(VV, FF, CC.astype(np.uint8), NN), eyes=(eV, eF, eC, S.normals(eV, eF))))
    print('croakarc body tris', len(FF), 'eyes+veins tris', len(eF), 'bolts', len(BOLTS), 'bolt pts', sum(len(b) for b in BOLTS))

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else 11000
    import trimesh
    from marching import surface
    BOLTS = bolts()
    def decimate(V, F, n):
        import fast_simplification as fs
        best = None
        for agg in (3, 4, 5, 6):
            for k in (1, .95, 1.05, .9, 1.1):
                v, f = fs.simplify(np.asarray(V, np.float32), np.asarray(F, np.int32), target_count=int(n * k), agg=agg); t = trimesh.Trimesh(v, f, process=False); t.merge_vertices()
                c = np.unique(t.edges_sorted, axis=0, return_counts=True)[1]
                if t.body_count == 1 and (c % 2).sum() == 0 and len(t.faces) < n * 1.4:
                    p = int((c > 2).sum()); best = (p, t) if best is None or p < best[0] else best
                    if p == 0: return t
        if best is None: raise SystemExit('no closed decimation')
        print('pinched edges', best[0]); return best[1]
    lo, hi, h = V3(-.42, -.033, -1.50), V3(.42, .62, .70), .0065
    Vr, Fr = surface(field, lo, hi, h); m = trimesh.Trimesh(Vr, Fr, process=False); print('raw', len(Fr), 'closed', m.is_watertight)
    parts = m.split(only_watertight=False); k = max(parts, key=lambda c: len(c.faces)); print('dropped crumbs', len(parts) - 1)
    t = decimate(k.vertices, k.faces, TRIS); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    finish(np.array(t.vertices), np.array(t.faces), OUT)
