"""M244 sheet 17 (sprites, 2026-11-28): VOLTMERE's four awakened forms, OWNER PREVIEW. Canon spirits-species.md 'Voltmere (Storm):
Voltmerkor · Voltmeraya · Voltvis (Ace, pure) · Voltmeth'. Locked art athernyx assets/stage3 077-080 (078 = voltmere-virtuoso_06 per the ledger;
looked at, never traced, never in this repo).
    python sculpt_voltaw.py <form> <out.glb>        form = voltmerkor | voltmeraya | voltvis | voltmeth
Starts from the LIVE Voltmere (m202-shellmere-line tools/sculpt_voltmere.py, imported, never edited: her pale icy palette, ice-blue eyes, the
white lightning forks over the shell, no antennae) and re-shapes her BY NAME exactly as sheets 14 / 15 did (sculpt_mesaaw.py / sculpt_aurmaw.py):
shell centre + radii, scute seats, head centre HC + neck, legs LEGS (she WALKS on four legs, the base Shellmere rig), colours. Her MOTIF is a
separate 'aura' part (unlit, it glows), each piece on one bone (written to <out>-aura.json for the rig). Marks are PATTERN only: no glyphs.
  VOLTMERKOR  (Champion)  massive: a high khaki-bronze shell of raised plates crowned with ICE-CRYSTAL SPIKES, lightning over it, pillar legs.
  VOLTMERAYA  (Virtuoso)  the ancient one: pearly blue shell with khaki seams, a long raised neck, cream plastron; a faint arc of lightning.
  VOLTVIS     (Ace, pure) low and streamlined: a deep blue shell with khaki seams, head out front, a LIGHTNING JET streaming off her tail.
  VOLTMETH    (Enigma)    pale storm-blue shell with lightning forks, carrying her own STORM CLOUD over her back, a bolt down to the shell."""
import sys, os, json, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
LINE = os.path.join(HERE, '../../m202-shellmere-line-2026-11-27/tools'); sys.path.insert(0, LINE)
FORM = sys.argv[1] if __name__ == '__main__' else os.environ['VOLTAW_FORM']
import sculpt_voltmere as F
import shell_common as C
from shell_common import cone, ell, su, ss, V3
from sculpt_v2 import normals
S = F.S; S.TRIS = 4600 if FORM == 'voltmeraya' else 4800   # Voltmeraya's long neck: 4800 gave 9081 body verts (> 9k)
rng = np.random.default_rng({'voltmerkor': 77, 'voltmeraya': 78, 'voltvis': 79, 'voltmeth': 80}[FORM])
AURA = []                                             # (P, F, col, bone)
TIDE = os.path.join(HERE, '../../m244-tidemere-2026-11-28/tools/sculpt_tideaw.py'); _src = open(TIDE).read()
a_, b_ = _src.index('# ── free pieces for the aura ──'), _src.index('# ── her shape, by name ──'); exec(compile(_src[a_:b_], 'sculpt_tideaw(helpers)', 'exec'), globals())
for _n in ('sphere', 'tube', 'hull', 'ribbon', 'surf', 'spike'): assert _n in globals(), _n
GOLD, GOLD2, GOLD3 = (255, 200, 72), (255, 222, 128), (240, 172, 52)

def patch(d, r, col, bone, lift=.005, k=16):
    """a panel lying ON the dome (sheet 14): a two-ring disc of radius r round the surface point toward d, cast back onto the surface, closed into a slab"""
    p = surf(d); n, t1, t2 = S.frame(p); a = np.arange(k) / k * 2 * np.pi; P = [p]
    for rr in (r * .55, r):
        tg = p + rr * (np.cos(a)[:, None] * t1 + np.sin(a)[:, None] * t2); U = tg - S.SC; U /= np.linalg.norm(U, axis=1, keepdims=True); P += list(S.ray(np.tile(S.SC, (k, 1)), U, 2.))
    P = np.array(P); P = P + S.grad(P, 3e-3) * lift
    Fc = [(0, 1 + i, 1 + (i + 1) % k) for i in range(k)] + [f for i in range(k) for j in [(i + 1) % k] for f in ((1 + i, 1 + k + i, 1 + k + j), (1 + i, 1 + k + j, 1 + j))]
    Fc = np.array(Fc); v = P[Fc[0]]
    if np.cross(v[1] - v[0], v[2] - v[0]) @ n < 0: Fc = Fc[:, ::-1]
    bot = P - S.grad(P, 3e-3) * (lift + .004); P2 = np.vstack([P, bot]); m = len(P); Fb = Fc[:, ::-1] + m
    rim = [(1 + k + i, 1 + k + (i + 1) % k) for i in range(k)]; Fs = [f for a2, b2 in rim for f in ((a2, b2 + m, b2), (a2, a2 + m, b2 + m))]
    Fs = np.array(Fs); vs = P2[Fs[0]]
    if np.cross(vs[1] - vs[0], vs[2] - vs[0]) @ (vs[0] - p) < 0: Fs = Fs[:, ::-1]
    AURA.append((P2, np.vstack([Fc, Fb, Fs]), col, bone))
def loop(c, u, v, ru, rv, n=48, a0=0., a1=2 * np.pi):
    """points on an ellipse (or an arc of it) round c in the plane of u, v"""
    t = np.linspace(a0, a1, n, endpoint=(a1 - a0) < 2 * np.pi - 1e-6); u, v = np.asarray(u, float), np.asarray(v, float)
    return np.asarray(c, float) + np.cos(t)[:, None] * u * ru + np.sin(t)[:, None] * v * rv
def ring_tube(Q, r, col, bone, k=6):
    """a closed tube along a closed loop Q (the last point joins the first)"""
    tube(np.vstack([Q, Q[:2]]), r, r, col, bone, k)
def disc_slab(c, nrm, R, th, col, bone, k=48):
    """a flat round slab (two faces + a side) centred at c facing nrm"""
    nrm = np.asarray(nrm, float) / np.linalg.norm(nrm); t1 = np.cross(nrm, V3(0, 1, 0) if abs(nrm[1]) < .9 else V3(1, 0, 0)); t1 /= np.linalg.norm(t1); t2 = np.cross(nrm, t1)
    a = np.arange(k) / k * 2 * np.pi; ring = R * (np.cos(a)[:, None] * t1 + np.sin(a)[:, None] * t2)
    P = np.vstack([[c + nrm * th], c + nrm * th + ring, [c - nrm * th], c - nrm * th + ring]); m = k + 1
    Fc = [(0, 1 + i, 1 + (i + 1) % k) for i in range(k)] + [(m, m + 1 + (i + 1) % k, m + 1 + i) for i in range(k)]
    Fc += [f for i in range(k) for j in [(i + 1) % k] for f in ((1 + i, m + 1 + i, m + 1 + j), (1 + i, m + 1 + j, 1 + j))]
    Fc = np.array(Fc); v = P[Fc[0]]
    if np.cross(v[1] - v[0], v[2] - v[0]) @ nrm < 0: Fc = Fc[:, ::-1]
    AURA.append((P, Fc, col, bone))
def leg_ring(i, s, t, r, col, wd=.010):
    """a gold band round leg i (s = 'l' | 'r') at fraction t from hip to foot, on that leg's bone"""
    x = 1 if s == 'l' else -1; a, b = np.array(S.LEGS[i][0]) * (x, 1, 1), np.array(S.LEGS[i][1]) * (x, 1, 1); c = a + (b - a) * t
    ax = (b - a) / np.linalg.norm(b - a); u = np.cross(ax, V3(0, 0, 1)); u /= np.linalg.norm(u); v = np.cross(ax, u)
    tg = loop(c, u, v, .4, .4, 28); U = tg - c; U /= np.linalg.norm(U, axis=1, keepdims=True); Q = S.ray(np.tile(c, (28, 1)), U, .4) + U * .004
    ribbon(np.vstack([Q, Q[:2]]), ax, wd, col, 'leg%d_%s' % (i, s), .004)

# ── her shape, by name (sheet 14's reshape, her moss + leg-scale classes) ──
MOSS, MR = np.array([[0, .4, -.1]]), np.array([.01])
def moss_f(M):
    d = np.linalg.norm(M[..., None, :] - MOSS, axis=-1) - MR; m = d.min(-1); return m - .012 * np.log(np.exp(-(d - m[..., None]) / .012).sum(-1))
def reshape(SC, SR, HC_off, legs, leg_r=(.128, .112), pad=1.0, neck=None, tail=None, slab=(.019, .010), plast_y=.240, cut=.262, bounds_top=None):
    S.SC, S.SR = V3(*SC), V3(*SR); S.HC = C.HC0 + V3(*HC_off); S.LEGS = [tuple(map(tuple, l)) for l in legs]
    def dome(M):
        d = ss(ell(M, S.SC, S.SR), M[..., 1] - cut, .03); g = S.scute_gap(M)
        return d + slab[0] * np.exp(-(g / .017) ** 2) * (M[..., 1] > cut + .04) - slab[1] * np.clip(g / .09, 0, 1) * (M[..., 1] > cut + .08)
    def rim(M): return su(ell(M, (0, cut + .043, S.SC[2]), (S.SR[0] + .01, .052, S.SR[2] + .05)), moss_f(M), .02)
    def plastron(M): return su(ell(M, (0, plast_y, S.SC[2] + .02), (.76 * S.SR[0], .12, .84 * S.SR[2])), ell(M, (0, plast_y + .015, S.SC[2] + .31), (.25, .11, .16)), .05)
    def legs_(M):
        d = 9
        for a, b in S.LEGS:
            a, b = V3(*a), V3(*b); d = np.minimum(d, cone(M, a, b + V3(0, max(.030, leg_r[1] - .082), 0), *leg_r))
            d = su(d, ell(M, b + V3(.006, -.017, .012), (.118 * pad, .046, .122 * pad)), .03)
            for t in (-.6, 0, .6): d = su(d, ell(M, b + V3((.075 * np.sin(t) + .012) * pad, -.030, .100 * np.cos(t) * pad), (.036 * pad, .032, .036 * pad)), .014)
        return d
    def claws(M):
        d = 9
        for a, b in S.LEGS:
            b = V3(*b)
            for t in (-.6, 0, .6): d = np.minimum(d, ell(M, b + V3((.090 * np.sin(t) + .014) * pad, -.034, .124 * np.cos(t) * pad), (.022 * pad, .019, .022 * pad)))
        return d
    S.dome, S.rim, S.plastron, S.legs, S.claws = dome, rim, plastron, legs_, claws
    if neck: S.neck = lambda M: cone(M, *neck)
    if tail: S.tail = lambda P: cone(P, *tail)
    DH = S.HC - C.HC0; S.AB, S.AT = S.AB + DH, S.AT + DH                              # her antennae ride her head
    x = max(abs(l[1][0]) for l in legs) + .16; z0 = min(S.SC[2] - S.SR[2] - .12, (tail[1][2] - .05) if tail else -9)
    S.BOUNDS = (V3(-max(x, S.SR[0] + .1), -.033, z0), V3(max(x, S.SR[0] + .1), max(bounds_top or 0, S.SC[1] + S.SR[1] + .16, S.HC[1] + .26), S.HC[2] + .26))
    C.scutes(S, vz=(-.56 * S.SR[2], .02, .58 * S.SR[2]), cx=.62 * S.SR[0], cz=(-.55 * S.SR[2], .02, .55 * S.SR[2]), mk=9, my=cut + .05)
LP = rng.normal(0, 1, (260, 3)); _classes = S.classes
def classes(V):
    """the base classes + MOSS (her moss lumps) + leg SCALES (sheet 14's plate seams on the legs: the art's scaly violet legs)"""
    out = _classes(V); M = np.c_[np.abs(V[:, 0]), V[:, 1:]]
    out.append(np.where(V[:, 1] > .29, np.clip(.012 - (np.min(np.linalg.norm(M[:, None] - MOSS, axis=-1) - MR, -1)), -.05, .05), -.05))
    lg = S.legs(M); other = np.minimum(np.minimum(S.dome(M), S.rim(M)), np.minimum(S.head(M), S.plastron(M)))
    P = np.vstack([np.array(a) + (np.array(b) - np.array(a)) * t for a, b in S.LEGS for t in np.linspace(0, 1, 6)]); pts = P[np.arange(len(LP)) % len(P)] + LP * .10
    dd = np.sort(np.linalg.norm(M[:, None] - pts, axis=-1), -1); g = dd[:, 1] - dd[:, 0]
    out.append(np.where((lg < other) & (V[:, 1] > .07) & (V[:, 1] < .27), .007 - g, -.05))
    return out
S.classes = classes
def colours(skin, shell, groove, plast, claw, moss, scale, blush):
    S.SKIN, S.SHELLC, S.GROOVE, S.PLAST, S.CLAWC, S.BLUSH = map(S.C8, (skin, shell, groove, plast, claw, blush)); S.HEADC = S.SKIN
    S.PAL[:] = [S.PLAST, S.SHELLC, S.GROOVE, S.CLAWC, S.BLUSH, S.C8(moss), S.C8(scale)]
def no_marks(): return []
VOLT_RUNES = S.runes; S.runes = no_marks
def scute_pts(costals=True, verts=True):
    out = []
    for c in S.SCUTES:
        if abs(c[0]) < 1e-6 and not verts: continue
        if abs(c[0]) > 1e-6 and not costals: continue
        for s in ((1,) if abs(c[0]) < 1e-6 else (1, -1)): out.append(np.array([c[0] * s, c[1], c[2]]))
    return out

ICE, ICE2, WHITE = (150, 222, 255), (206, 240, 255), (240, 250, 255)
def bolt(a, b, n, amp, seed, r, col, bone, k=5):
    """a jagged lightning bolt in the air from a to b (n kinks), a thin tapering tube"""
    rr = np.random.default_rng(seed); a, b = np.asarray(a, float), np.asarray(b, float); T = np.linspace(0, 1, n + 1); P = np.outer(1 - T, a) + np.outer(T, b)
    P[1:-1] += rr.normal(0, amp, (n - 1, 3)); Q = np.vstack([np.outer(1 - s, P[i]) + np.outer(s, P[i + 1]) for i in range(n) for s in [np.linspace(0, 1, 4, endpoint=i == n - 1)]])
    tube(Q, r, r * .45, col, bone, k)
if FORM == 'voltmerkor':
    reshape((0, .330, -.08), (.58, .56, .62), (0, .020, .110), [((.290, .272, .262), (.430, .062, .405)), ((.290, .252, -.350), (.430, .062, -.485))],
            (.156, .138), 1.22, neck=((0, .350, .210), (0, .450, .500), .140, .128), slab=(.024, .018))
    colours('#a8c2e2', '#b09868', '#5a4a2c', '#d8cca0', '#c4ecff', '#6aa83c', '#86a2c8', '#c4d2ee'); S.runes = VOLT_RUNES
    for p in scute_pts(): spike(p - S.SC, .24 if abs(p[0]) < 1e-6 else .19, .052, ICE2 if abs(p[0]) < 1e-6 else ICE, 'shell')        # the crystal crown on his plates
    for a in np.arange(16) / 16 * 2 * np.pi + .2:                                                                  # and a ring of crystal spikes round his rim
        if abs(np.sin(a / 2 - 0)) < .2: continue                                                                    # (none over his head)
        d = V3(np.sin(a) * S.SR[0], .05, np.cos(a) * S.SR[2]); spike(d, .15, .040, ICE, 'shell', V3(np.sin(a), 0, np.cos(a)) * .9)
    for k, a in enumerate((.9, 2.2, -1.0, -2.3)):                                                                  # lightning crackling off his flanks
        p = surf(V3(np.sin(a), .35, np.cos(a))); bolt(p, p + V3(np.sin(a) * .34, .12 + .08 * (k % 2), np.cos(a) * .24), 4, .04, 90 + k, .008, WHITE, 'shell')
elif FORM == 'voltmeraya':
    reshape((0, .310, -.12), (.50, .44, .56), (0, .260, .160), [((.230, .268, .228), (.345, .062, .340)), ((.230, .248, -.335), (.345, .062, -.440))],
            (.106, .090), .96, neck=((0, .330, .200), (0, .655, .610), .120, .100), slab=(.016, .008))
    colours('#a6c2ea', '#b6c8e4', '#8e8a5c', '#e4d6a2', '#eef2fa', '#6aa83c', '#88a8d8', '#c6d4f2')
    for p in scute_pts(): patch(p - S.SC, .045, (222, 234, 250), 'shell', .004)                                      # a pearly sheen on each plate
    for k, (a, h) in enumerate(((1.9, .55), (-2.1, .75))):                                                          # the faint lightning beside her
        p = V3(np.sin(a) * .85, h, np.cos(a) * .55 + S.SC[2]); bolt(p, p + V3(np.sin(a) * .10, .38, -.12), 5, .05, 70 + k, .005, ICE2, 'shell', 4)
elif FORM == 'voltvis':
    reshape((0, .290, -.10), (.50, .34, .62), (0, .050, .170), [((.258, .262, .252), (.400, .062, .372)), ((.250, .242, -.352), (.385, .062, -.462))],
            (.110, .094), 1.04, neck=((0, .330, .210), (0, .490, .580), .120, .110), slab=(.018, .010))
    colours('#9cbce6', '#3c68be', '#b89c5a', '#dcc890', '#e8eef8', '#6aa83c', '#6a8ecc', '#b4c8ee')
    zb = S.SC[2] - S.SR[2] + .02; o = V3(0, .30, zb)                                                                  # the lightning jet streaming off her tail
    for k, (dx, dy, ln) in enumerate(((0, 0, .78), (.10, .06, .62), (-.10, .05, .66), (.05, -.06, .55), (-.06, .10, .50))):
        bolt(o + V3(dx * .3, dy * .3, 0), o + V3(dx, dy, -ln), 5, .035, 50 + k, .020 - .003 * k, ICE if k else WHITE, 'shell', 6)
    for _ in range(8):
        sphere(o + V3(rng.uniform(-.16, .16), rng.uniform(-.08, .14), -rng.uniform(.15, .75)), rng.uniform(.010, .018), ICE2, 'shell', 1)
elif FORM == 'voltmeth':
    reshape((0, .310, -.09), (.54, .42, .60), (0, .000, .110), [((.252, .268, .252), (.382, .062, .372)), ((.252, .248, -.345), (.382, .062, -.462))],
            (.124, .108), 1.0, slab=(.020, .012))
    colours('#a8c0e0', '#a6bad8', '#62749c', '#d8c890', '#eef0f6', '#6aa83c', '#88a0c6', '#c2d0ec'); S.runes = VOLT_RUNES
    top = surf((0, 1, 0)); CL = [(148, 158, 184), (118, 128, 156), (188, 196, 216)]
    for _ in range(7):                                                                                              # the low cloud resting on her back
        d = V3(rng.uniform(-.5, .5), 1, rng.uniform(-.6, .3)); sphere(surf(d) + V3(0, .03, 0), rng.uniform(.07, .11), CL[rng.integers(3)], 'shell', 2)
    cc = top + V3(0, .62, -.04)                                                                                    # and the storm cloud riding over her
    for _ in range(18):
        a = rng.uniform(0, 2 * np.pi); rr = np.sqrt(rng.uniform(0, 1)); sphere(cc + V3(rr * .42 * np.cos(a), rng.uniform(-.05, .09) * (1.3 - rr), rr * .34 * np.sin(a)), rng.uniform(.10, .16), CL[rng.integers(3)], 'shell', 2)
    for k, dx in enumerate((-.10, .14)): bolt(cc + V3(dx, -.10, 0), top + V3(dx * 1.4, .04, .06 * k), 4, .045, 80 + k, .010, WHITE, 'shell')
else: raise SystemExit('form?')
F.MOSS, F.MR = MOSS, MR

_glb = S.glb
def glb_with_aura(path, parts):
    V, Fs, Cc, bones, o = [], [], [], [], 0
    for P, f, col, bone in AURA:
        V.append(P); Fs.append(f + o); Cc.append(np.c_[np.broadcast_to(np.round(255 * (np.array(col, float) / 255.) ** 2.2), (len(P), 3)), np.full(len(P), 255)]); bones.append([len(P), bone]); o += len(P)
    V, Fs, Cc = np.vstack(V), np.vstack(Fs), np.vstack(Cc); print('aura tris', len(Fs), 'verts', len(V))
    json.dump(bones, open(path.replace('.glb', '-aura.json'), 'w'))
    return _glb(path, dict(parts, aura=(V, Fs, Cc, normals(V, Fs))))
S.glb = glb_with_aura
sys.modules['sculpt_voltmere'] = F
if __name__ == '__main__': C.build(S, sys.argv[2])
