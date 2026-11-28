"""M244 sheet 11 (sprites, 2026-11-28): TIDEMERE's four awakened forms, OWNER PREVIEW. Canon spirits-species.md 'Tidemere (Water): Tidemok ·
Tidessa (Virtuoso, pure) · Tidemerk · Tidemyr' + 'The Tidemere line carries its own water': every form keeps its FLIPPERS and glides on its
own water sheet (no legs), so every form is rigged on Tidemere's own glide rig (rig_tideaw.py runs m202-tidemere-glide rig_tidemere.py).
Locked art athernyx assets/stage3 061-064 (looked at, never traced, never in this repo).
    python sculpt_tideaw.py <form> <out.glb>        form = tidemok | tidessa | tidemerk | tidemyr
Starts from the LIVE Tidemere (m202-shellmere-line tools/sculpt_tidemere.py, imported, never edited) and re-shapes her BY NAME: shell centre +
radii (dome / rim / plastron follow them), head + neck, the flipper chains FORE / HIND (the rig reads them), colours, the shell marks
(runes()). Her MOTIF is a separate 'aura' part (unlit, it glows), each piece on one bone (written to <out>-aura.json for the rig):
  TIDEMOK  (Champion)  the heaviest: a big high dome, a heavy head, broad flippers, a ROW OF BIG CRYSTAL SPIKES down the ridge + round the lip.
  TIDESSA  (Virtuoso, pure Water)  slender, neck up and proud: a branching CORAL CROWN, a pearl necklace, a cluster of pearls on her back and
           PEARLS FLOATING round her.
  TIDEMERK (Ace)  lean and fast: a long low narrow shell, a pointed head out front, long swept-back fore-flippers, water peeling off her sides.
  TIDEMYR  (Enigma)  a little REEF on her back (rocks, branching coral, weed) and a WATERFALL pouring off the back of her shell onto her sheet."""
import sys, os, json, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
LINE = os.path.join(HERE, '../../m202-shellmere-line-2026-11-27/tools'); sys.path.insert(0, LINE)
FORM = sys.argv[1] if __name__ == '__main__' else os.environ['TIDEAW_FORM']
import sculpt_tidemere as F
import shell_common as C
from shell_common import cone, ell, su, ss, V3
from sculpt_v2 import normals
F.S.TRIS = 6400; S = F.S; rng = np.random.default_rng({'tidemok': 61, 'tidessa': 62, 'tidemerk': 63, 'tidemyr': 64}[FORM])
AURA = []                                             # (P, F, col, bone)

# ── free pieces for the aura ──
def sphere(c, r, col, bone, sub=1):
    import trimesh; t = trimesh.creation.icosphere(subdivisions=sub); AURA.append((np.asarray(c) + np.array(t.vertices) * r, np.array(t.faces), col, bone))
def tube(Q, r0, r1, col, bone, k=6):
    Q = np.asarray(Q, float); n = len(Q); T = np.gradient(Q, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True)
    a = np.cross(T[0], V3(0, 1, 0) if abs(T[0][1]) < .9 else V3(1, 0, 0)); a /= np.linalg.norm(a); P = []
    for i in range(n):
        a = a - T[i] * (a @ T[i]); a /= np.linalg.norm(a); b = np.cross(T[i], a); r = r0 + (r1 - r0) * i / (n - 1); an = np.arange(k) / k * 2 * np.pi
        P += list(Q[i] + r * (np.cos(an)[:, None] * a + np.sin(an)[:, None] * b))
    P.append(Q[0] - T[0] * r0 * .3); P.append(Q[-1] + T[-1] * max(r1, .002)); P = np.array(P); Fc = []
    for i in range(n - 1):
        for j in range(k): p0, p1, q0, q1 = i * k + j, i * k + (j + 1) % k, (i + 1) * k + j, (i + 1) * k + (j + 1) % k; Fc += [(p0, q1, p1), (p0, q0, q1)]
    s0, s1 = n * k, n * k + 1; Fc += [(s0, j, (j + 1) % k) for j in range(k)] + [(s1, (n - 1) * k + (j + 1) % k, (n - 1) * k + j) for j in range(k)]
    Fc = np.array(Fc); c = P[:n * k].mean(0); v = P[Fc[k // 2]]                                               # outward winding
    if np.cross(v[1] - v[0], v[2] - v[0]) @ (v[0] - Q[0]) < 0: Fc = Fc[:, ::-1]
    AURA.append((P, Fc, col, bone))
def hull(P, col, bone):
    v, f, _ = C.hull_part(P, col); AURA.append((v, f, col, bone))
def ribbon(Q, side, wd, col, bone, th=.005):
    """a thin closed band along Q (a flat slab: `side` = the direction of its width, wd = half-width per point, th = half-thickness)"""
    Q = np.asarray(Q, float); n = len(Q); side = np.broadcast_to(np.asarray(side, float), Q.shape); wd = np.broadcast_to(np.asarray(wd, float).reshape(-1, 1), (n, 1))
    T = np.gradient(Q, axis=0); N = np.cross(T, side); N /= np.linalg.norm(N, axis=1, keepdims=True)
    P = np.vstack([np.c_[Q + side * wd + N * th, Q - side * wd + N * th, Q - side * wd - N * th, Q + side * wd - N * th].reshape(n, 4, 3).reshape(-1, 3)]); Fc = []
    def face(a, b, c, ctr):
        f = (a, b, c); return f if np.cross(P[b] - P[a], P[c] - P[a]) @ ((P[a] + P[b] + P[c]) / 3 - ctr) > 0 else (a, c, b)
    for i in range(n - 1):
        ctr = (Q[i] + Q[i + 1]) / 2
        for k in range(4): a, b, c, d = 4 * i + k, 4 * i + (k + 1) % 4, 4 * (i + 1) + (k + 1) % 4, 4 * (i + 1) + k; Fc += [face(a, b, c, ctr), face(a, c, d, ctr)]
    for i, o in ((0, -1), (n - 1, 1)):
        ctr = Q[i] - o * T[i] / np.linalg.norm(T[i]) * .01; Fc += [face(4 * i, 4 * i + 1, 4 * i + 2, ctr), face(4 * i, 4 * i + 2, 4 * i + 3, ctr)]
    AURA.append((P, np.array(Fc), col, bone))
def surf(d):
    """the dome surface point in direction d from the shell centre (her own body field)"""
    d = np.asarray(d, float); return S.ray(S.SC, d / np.linalg.norm(d), 2.)[0]
def spike(d, h, r, col, bone, lean=V3(0, 0, 0), k=7):
    p = surf(d); n, t1, t2 = S.frame(p); a = np.arange(k) / k * 2 * np.pi; ring = p - n * .025 + r * (np.cos(a)[:, None] * t1 + np.sin(a)[:, None] * t2)
    hull(np.vstack([ring, p + (n + lean) / np.linalg.norm(n + lean) * h]), col, bone)
def coral(p, d, L, r, col, bone, depth):
    d = np.asarray(d, float) / np.linalg.norm(d); q = p + d * L; m = (p + q) / 2 + rng.normal(0, L * .12, 3); tube([p, m, q], r, r * .7, col, bone, 5)
    if depth == 0: sphere(q, r * .8, col, bone, 0); return
    for _ in range(2 + (rng.random() < .4)):
        e = d + rng.normal(0, .55, 3); e[1] = abs(e[1]) + .25; coral(q, e, L * .72, r * .72, col, bone, depth - 1)

# ── her shape, by name ──
def reshape(SC, SR, HC_off, fore, hind, neck_a, neck_b, head_k=1.0):
    S.SC, S.SR = V3(*SC), V3(*SR); S.HC = C.HC0 + V3(*HC_off); F.FORE[:] = [V3(*p) for p in fore]; F.HIND[:] = [V3(*p) for p in hind]
    cut = S.SC[1] - .038
    def dome(M):
        d = ss(ell(M, S.SC, S.SR), M[..., 1] - cut, .03)
        d = su(d, ell(M, S.SC + V3(0, 0, -.32 * S.SR[2]), (.68 * S.SR[0], .72 * S.SR[1], .72 * S.SR[2])), .10)
        return d + .007 * np.exp(-(S.scute_gap(M) / .012) ** 2) * (M[..., 1] > cut + .05)
    def rim(M): return ell(M, (0, S.SC[1] - .008, S.SC[2] - .02), (S.SR[0] + .015, .030, S.SR[2] + .02))
    def plastron(M): return ell(M, (0, .225, S.SC[2] + .02), (.77 * S.SR[0], .085, .84 * S.SR[2]))
    def neck(M): return cone(M, neck_a, neck_b, .118 * head_k, .108 * head_k)
    H0 = S.head
    def head(M): return H0(S.HC + (M - S.HC) / head_k) * head_k
    def tail(P): z = S.SC[2] - S.SR[2] - .02; return cone(P, (0, .210, z + .10), (0, .160, z - .04), .050, .018)
    S.dome, S.rim, S.plastron, S.neck, S.head, S.tail = dome, rim, plastron, neck, head, tail
    x = max(abs(p[0]) for p in fore) + .12; S.BOUNDS = (V3(-x, -.033, S.SC[2] - S.SR[2] - .30), V3(x, max(.75, S.SC[1] + S.SR[1] + .1), S.HC[2] + .32))
    C.scutes(S, vz=(-.58 * S.SR[2], 0, .52 * S.SR[2]), cx=.6 * S.SR[0], cz=(-.55 * S.SR[2], -.03, .45 * S.SR[2]), mk=9, my=S.SC[1] + .01)
    F.SP = np.vstack([np.array(p) + (np.array(q) - np.array(p)) * t + rng.normal(0, .03, 3) for p, q in ((F.FORE[1], F.FORE[3]), (F.HIND[1], F.HIND[2])) for t in rng.uniform(0, 1, 14)])
def colours(skin, shell, groove, plast, spot):
    S.SKIN, S.SHELLC, S.GROOVE, S.PLAST, S.CLAWC, S.BLUSH = map(S.C8, (skin, shell, groove, plast, spot, skin)); S.HEADC = S.SKIN
    S.PAL[:] = [S.PLAST, S.SHELLC, S.GROOVE, S.CLAWC, S.BLUSH, S.C8(spot)]
SWIRLS = S.runes
def no_runes(): return []

if FORM == 'tidemok':
    reshape((0, .300, -.12), (.52, .37, .66), (0, -.005, .110), [(.230, .265, .220), (.420, .190, .260), (.590, .100, .190), (.680, .035, .090)],
            [(.200, .245, -.380), (.330, .140, -.560), (.410, .035, -.680)], (0, .300, .190), (0, .400, .500), 1.12)
    colours('#46a89a', '#2f8a7e', '#1c5e58', '#bfe2cc', '#8fd4c0'); S.runes = no_runes
    _b = F.blade; F.blade = lambda M, pts, rads, flat: _b(M, pts, [r * 1.22 for r in rads], flat)      # broad heavy flippers
    CRY, CRY2 = (176, 246, 240), (214, 252, 250)
    for t, h in zip(np.linspace(1.05, -1.9, 6), (.20, .27, .30, .29, .25, .19)):                        # the ridge: six BIG crystal spikes, nape to tail
        spike((0, .60, t), h, .080, CRY2, 'shell', V3(0, 0, -.30))
    for s in (1, -1):
        for t, h in zip(np.linspace(1.1, -1.6, 5), (.13, .18, .19, .17, .13)):                           # a costal row a side
            spike((s * .70, .55, t), h, .060, CRY, 'shell', V3(s * .45, 0, -.2))
        for a in np.linspace(.45, 2.85, 6):                                                                 # and the lip
            spike((s * np.sin(a), -.08, np.cos(a) * 1.2), .10, .040, CRY, 'shell', V3(s * .6, .3, 0))
elif FORM == 'tidessa':
    reshape((0, .275, -.11), (.42, .25, .58), (0, .060, .080), [(.200, .260, .210), (.370, .195, .230), (.510, .105, .160), (.590, .035, .070)],
            [(.180, .240, -.340), (.290, .140, -.490), (.360, .035, -.600)], (0, .300, .190), (0, .470, .480), .98)
    colours('#7cccc0', '#58b4a8', '#3a8a82', '#d8f2e6', '#c8f2e8'); S.runes = SWIRLS
    PEARL, NECK, CORAL, CORAL2 = (244, 236, 218), (238, 228, 210), (244, 166, 150), (250, 196, 178)
    for d, r in (((0, .70, -.75), .062), ((.18, .62, -.85), .052), ((-.18, .62, -.85), .052), ((.10, .80, -.45), .048), ((-.10, .80, -.45), .048),
                 ((.30, .55, -.65), .044), ((-.30, .55, -.65), .044), ((0, .85, -.20), .040), ((.22, .45, -1.0), .040), ((-.22, .45, -1.0), .040)):
        sphere(surf(d) + np.asarray(d) / np.linalg.norm(d) * r * .55, r, PEARL, 'shell', 2)              # the pearls heaped on her back
    for i, a in enumerate(np.linspace(0, 2 * np.pi, 9, endpoint=False)):                                  # pearls floating round her
        R = .74 + .10 * np.sin(3 * a); sphere((R * np.cos(a), .30 + .32 * (.5 + .5 * np.sin(2 * a + 1)), S.SC[2] + 1.05 * R * np.sin(a)), .030 + .012 * (i % 3), PEARL, 'shell', 2)
    nb = np.array([0, .425, .395]); ax = np.array([0, .10, .29]); ax /= np.linalg.norm(ax)                  # the necklace round her neck
    u = np.cross(ax, V3(1, 0, 0)); v = np.cross(ax, u)
    for a in np.linspace(0, 2 * np.pi, 16, endpoint=False):
        sphere(nb + .130 * (np.cos(a) * V3(1, 0, 0) + np.sin(a) * u) - .02 * ax, .017, NECK, 'neck', 1)
    top = S.ray(S.HC, V3(0, 1, 0), .5)[0]
    for i, (x, z, tilt) in enumerate(((0, .02, 0), (.075, -.02, .55), (-.075, -.02, -.55), (.040, -.06, .30), (-.040, -.06, -.30))):   # the coral crown
        p = S.ray(S.HC, np.array([x, 1, z]) / np.linalg.norm([x, 1, z]), .5)[0] - V3(0, .015, 0)
        coral(p, (np.sin(tilt) * 1.3, 1, -.10), (.135 if i == 0 else .115), .021, CORAL if i % 2 == 0 else CORAL2, 'head', 2)
elif FORM == 'tidemerk':
    reshape((0, .255, -.17), (.36, .20, .70), (0, -.025, .200), [(.180, .250, .220), (.400, .185, .190), (.620, .095, .060), (.780, .035, -.090)],
            [(.160, .235, -.420), (.270, .140, -.600), (.330, .035, -.740)], (0, .290, .190), (0, .400, .610), .94)
    colours('#3cbcc6', '#279eae', '#156e80', '#c8f0ec', '#a8eaf0')
    def lines():                                                                                             # speed lines: the long wave down each side
        parts = []
        for s in (1, -1):
            for yy, ph in ((.31, 0), (.36, 1.3)):
                z = np.linspace(.40, -.80, 44); tg = np.c_[s * (.30 + .02 * np.sin(z * 12 + ph)), np.full(44, yy), S.SC[2] + z]
                Q = S.ray(np.tile(S.SC, (44, 1)), (tg - S.SC) / np.linalg.norm(tg - S.SC, axis=1, keepdims=True), 1.5); parts.append(S.strip(Q, (176, 240, 244), .0055, .0035))
        return parts
    S.runes = lines
    SPRAY, SPRAY2 = (214, 246, 250), (180, 232, 244)
    for s in (1, -1):                                                                                         # water peeling off her sides, swept back
        for k, (y0, z0, L, w) in enumerate(((.25, .20, .70, .042), (.20, -.10, .62, .036), (.30, -.40, .48, .030))):
            t = np.linspace(0, 1, 14); p0 = surf((s * 1, (y0 - S.SC[1]) / .2, z0))
            Q = p0 + np.c_[s * (.03 + .22 * t ** 1.3), .02 + .22 * t ** 2, -L * t]
            ribbon(Q, V3(0, 1, .3) / np.linalg.norm([0, 1, .3]), w * (1 - .5 * t), SPRAY if k % 2 == 0 else SPRAY2, 'shell')
elif FORM == 'tidemyr':
    reshape((0, .275, -.12), (.47, .24, .62), (0, -.010, .120), [(.215, .258, .225), (.395, .190, .245), (.540, .100, .170), (.620, .035, .080)],
            [(.190, .240, -.370), (.310, .140, -.530), (.380, .035, -.650)], (0, .300, .190), (0, .400, .520), 1.05)
    colours('#5cb4a4', '#6a9e86', '#3c6a5c', '#d4ecd8', '#b4e2d0'); S.runes = no_runes
    ROCK, ROCK2, COR, COR2, TEAL, WEED, FALL, FALL2, FOAM = (122, 150, 136), (150, 170, 150), (244, 140, 90), (246, 178, 150), (92, 200, 184), (110, 184, 92), (190, 232, 246), (210, 242, 252), (238, 252, 255)
    for d, r in (((0, .9, -.05), .14), ((.25, .75, -.40), .11), ((-.22, .78, .20), .10), ((.12, .80, .35), .085), ((-.18, .70, -.55), .10)):
        p = surf(d); V0 = []; import trimesh; t = trimesh.creation.icosphere(1); v = np.array(t.vertices) * (r, r * .55, r) + p
        AURA.append((v + rng.normal(0, r * .06, v.shape), np.array(t.faces), ROCK if r > .085 else ROCK2, 'shell'))
    for d, c in (((.05, .9, -.25), COR), ((-.20, .85, -.20), COR), ((.28, .70, .10), COR2), ((-.10, .8, .40), TEAL), ((.30, .62, -.60), TEAL), ((-.32, .6, -.35), COR2)):
        coral(surf(d) - V3(0, .01, 0), (rng.normal(0, .3), 1, rng.normal(0, .3)), .13, .018, c, 'shell', 2)
    for d in ((.15, .85, .15), (-.05, .9, .05), (-.28, .7, .00), (.20, .7, -.25), (0, .8, -.50)):           # weed fronds
        p = surf(d); h = rng.uniform(.14, .20); t = np.linspace(0, 1, 9); ph = rng.uniform(0, 6)
        tube(p + np.c_[.025 * np.sin(t * 7 + ph), h * t, .02 * np.cos(t * 6 + ph)], .011, .003, WEED, 'shell', 5)
    yb = .225 - .085 + .008                                                                                 # her plastron's underside: the water lands on her sheet
    for i, a in enumerate(np.linspace(-1.05, 1.05, 13)):                                                    # the waterfall: a curtain off the back of her shell
        o = np.array([np.sin(a), 0, -np.cos(a)]); top = surf((np.sin(a) * .8, .30, -np.cos(a))); rimp = surf((np.sin(a), -.02, -np.cos(a) * 1.05)) + o * .05
        t = np.linspace(0, 1, 18); arc = top + (rimp + V3(0, .02, 0) - top) * np.sqrt(t)[:, None]                       # over the shell to past the lip
        drop = rimp + V3(0, .02, 0) + np.c_[o[0] * .05 * np.sqrt(t), (yb - rimp[1] - .02) * t ** 1.2, o[2] * .05 * np.sqrt(t)]
        Q = np.vstack([arc[:-1] + o * .012, drop]); side = np.cross(o, V3(0, 1, 0)); w = .036 + .006 * np.sin(i * 2.1)
        ribbon(Q, side, np.full(len(Q), w), FALL if i % 2 == 0 else FALL2, 'shell', .006)
        for k in range(2): sphere(Q[-1] + o * (.025 + .03 * k) + V3(rng.normal(0, .015), .010, 0), .024 - .006 * k, FOAM, 'shell', 1)
else: raise SystemExit('form?')

_glb = S.glb
def glb_with_aura(path, parts):
    V, Fs, Cc, bones, o = [], [], [], [], 0
    for P, f, col, bone in AURA:
        V.append(P); Fs.append(f + o); Cc.append(np.c_[np.broadcast_to(np.round(255 * (np.array(col, float) / 255.) ** 2.2), (len(P), 3)), np.full(len(P), 255)]); bones.append([len(P), bone]); o += len(P)
    V, Fs, Cc = np.vstack(V), np.vstack(Fs), np.vstack(Cc); print('aura tris', len(Fs), 'verts', len(V))
    json.dump(bones, open(path.replace('.glb', '-aura.json'), 'w'))
    return _glb(path, dict(parts, aura=(V, Fs, Cc, normals(V, Fs))))
S.glb = glb_with_aura
sys.modules['sculpt_tidemere'] = F
if __name__ == '__main__': C.build(S, sys.argv[2])
