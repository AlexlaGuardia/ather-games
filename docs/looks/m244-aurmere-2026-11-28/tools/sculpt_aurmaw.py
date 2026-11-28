"""M244 sheet 15 (sprites, 2026-11-28): AURMERE's four awakened forms, OWNER PREVIEW. Canon spirits-species.md 'Aurmere (Mana):
Aurmerok · Aurmelys · Aurmevex · Aurhael (Enigma, pure)'. Locked art athernyx assets/stage3 057-060 (looked at, never traced, never in this repo).
    python sculpt_aurmaw.py <form> <out.glb>        form = aurmerok | aurmelys | aurmevex | aurhael
Starts from the LIVE Aurmere (m202-shellmere-line tools/sculpt_aurmere.py, imported, never edited: her violet palette, dark eyes, gold antenna
bulbs) and re-shapes her BY NAME exactly as sheet 14 did for Mesamere (m244-mesamere tools/sculpt_mesaaw.py): shell centre + radii, scute seats,
head centre HC + neck, legs LEGS (she WALKS on four legs, the base Shellmere rig), antennae AB / AT (moved with her head), moss, colours. Her
MOTIF is a separate 'aura' part (unlit, it glows), each piece on one bone (written to <out>-aura.json for the rig). Marks are PATTERN only
(rings, dots, seams): no rune or sigil text. The free-piece helpers are sheet 11's (m244-tidemere tools/sculpt_tideaw.py), read and run by name.
  AURMEROK  (Champion)  massive: a broad high GOLD shell, violet scaly pillar legs, standing big in front of a plain gold SUN DISC (rim + edge dots).
  AURMELYS  (Virtuoso)  lavender-violet shell with GOLD seams, pale blue skin, gold rings on her legs, gold SOUND RINGS swirling round her + a spiral.
  AURMEVEX  (Ace)       lean low deep-violet shell with gold dots, amber plastron, head out front, a gold RING round her body, long lit antennae.
  AURHAEL   (Enigma, pure)  violet shell, gold dots + gold seams, a moss cap with a CROWN of gold spires, a gold halo over it, long antennae, gold claws."""
import sys, os, json, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
LINE = os.path.join(HERE, '../../m202-shellmere-line-2026-11-27/tools'); sys.path.insert(0, LINE)
FORM = sys.argv[1] if __name__ == '__main__' else os.environ['AURAW_FORM']
import sculpt_aurmere as F
import shell_common as C
from shell_common import cone, ell, su, ss, V3
from sculpt_v2 import normals
S = F.S; S.TRIS = 4800; rng = np.random.default_rng({'aurmerok': 57, 'aurmelys': 58, 'aurmevex': 59, 'aurhael': 60}[FORM])
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
S.runes = no_marks
def scute_pts(costals=True, verts=True):
    out = []
    for c in S.SCUTES:
        if abs(c[0]) < 1e-6 and not verts: continue
        if abs(c[0]) > 1e-6 and not costals: continue
        for s in ((1,) if abs(c[0]) < 1e-6 else (1, -1)): out.append(np.array([c[0] * s, c[1], c[2]]))
    return out

if FORM == 'aurmerok':
    S.ANT = False
    reshape((0, .315, -.08), (.58, .58, .62), (0, .020, .110), [((.290, .272, .262), (.430, .062, .405)), ((.290, .252, -.350), (.430, .062, -.485))],
            (.156, .138), 1.22, neck=((0, .350, .210), (0, .450, .500), .140, .128), slab=(.022, .016))
    colours('#7c6ec8', '#f4b018', '#8a5408', '#f6c040', '#eee6f6', '#6aa83c', '#4c3e92', '#9a8ad6')
    zb = S.SC[2] - S.SR[2] - .07; cd = V3(0, .68, zb); R = .60                                                    # the plain sun disc standing behind him
    disc_slab(cd, (0, 0, 1), R, .008, GOLD2, 'shell', 64)
    ring_tube(loop(cd + V3(0, 0, .010), (1, 0, 0), (0, 1, 0), R - .010, R - .010, 64), .018, GOLD3, 'shell', 6)
    ring_tube(loop(cd + V3(0, 0, .012), (1, 0, 0), (0, 1, 0), R - .085, R - .085, 56), .007, GOLD, 'shell', 5)
    for a in np.arange(14) / 14 * 2 * np.pi + .11:                                                              # little dots round the disc's edge (pattern only)
        sphere(cd + V3((R - .045) * np.cos(a), (R - .045) * np.sin(a), .014), .016, GOLD3, 'shell', 1)
    for s in ('l', 'r'): leg_ring(0, s, .30, .4, GOLD, .009)                                                     # a gold band on each fore leg
elif FORM == 'aurmelys':
    S.ANT = False
    reshape((0, .300, -.10), (.48, .47, .53), (0, .020, .100), [((.228, .268, .232), (.350, .062, .352)), ((.228, .248, -.322), (.348, .062, -.432))],
            (.106, .090), .96, slab=(.016, .009))
    colours('#90aeea', '#9a82d4', '#e8b84a', '#f0b860', '#eae4f6', '#6aa83c', '#7a6cb4', '#bcb0e6')
    for i in (0, 1):                                                                                            # gold rings on all four legs (the art's leg marks)
        for s in ('l', 'r'): leg_ring(i, s, .42, .4, GOLD, .009); leg_ring(i, s, .62, .4, GOLD2, .005)
    c0 = V3(0, .42, S.SC[2])
    for (h, ru, rv, tilt, a0, a1, wd) in ((.22, .76, .84, -.10, .4, 5.6, .016), (.70, .80, .84, -.10, 2.0, 7.6, .014), (.90, .60, .64, .14, -1.0, 4.2, .011)):   # sound rings
        u = V3(1, 0, 0); v = V3(0, np.sin(tilt), np.cos(tilt)); Q = loop(c0 + V3(0, h - .42, 0), u, v, ru, rv, 56, a0, a1)
        Q[:, 1] += np.linspace(0, .06, len(Q)); n_ = np.cross(u, v); ribbon(Q, n_, np.linspace(wd * .3, wd, len(Q)), GOLD if wd > .009 else GOLD2, 'shell', .0045)
    t = np.linspace(0, 3.2 * np.pi, 70); r = np.linspace(.26, .07, 70)                                            # the spiral over her shell
    tube(np.c_[r * np.cos(t), .98 + .22 * t / t[-1], S.SC[2] + .05 + r * np.sin(t)], .007, .004, GOLD2, 'shell', 5); sphere((r[-1] * np.cos(t[-1]), 1.21, S.SC[2] + .05 + r[-1] * np.sin(t[-1])), .016, GOLD, 'shell', 1)
elif FORM == 'aurmevex':
    reshape((0, .300, -.11), (.50, .37, .60), (0, .050, .150), [((.258, .262, .252), (.400, .062, .372)), ((.250, .242, -.352), (.385, .062, -.462))],
            (.112, .096), 1.08, neck=((0, .340, .210), (0, .500, .560), .122, .112), slab=(.018, .010))
    colours('#6c5ec4', '#5642ac', '#2e2272', '#e0883a', '#e8e2f6', '#6aa83c', '#3e3290', '#8a7cd4')
    S.AT = S.AT + V3(.030, .080, 0); S.BULB, S.STALK = (255, 214, 84), (150, 132, 222)                            # longer antennae, lit bulbs
    for p in scute_pts(): patch(p - S.SC, .060, GOLD, 'shell')                                                      # gold dots on the scutes
    for m in S.MARG[1:-1:2]:
        for s in (1, -1): mm = np.array([m[0] * s, m[1] + .03, m[2]]); patch(mm - S.SC, .032, GOLD2, 'shell')
    c0 = V3(0, .300, S.SC[2] + .02)                                                                                 # the gold ring round her body
    ring_tube(loop(c0, (1, 0, 0), (0, 0, 1), .72, .98, 64), .018, GOLD, 'shell', 6)
    ring_tube(loop(c0 + V3(0, .004, 0), (1, 0, 0), (0, 0, 1), .78, 1.04, 64), .006, GOLD2, 'shell', 5)
    for _ in range(10):                                                                                            # and specks of gold off it
        a = rng.uniform(0, 2 * np.pi); rr = rng.uniform(.78, 1.0); sphere(c0 + V3(rr * .9 * np.cos(a), rng.uniform(-.06, .22), rr * np.sin(a)), rng.uniform(.008, .014), GOLD2, 'shell', 1)
elif FORM == 'aurhael':
    reshape((0, .300, -.09), (.55, .44, .60), (0, .000, .100), [((.252, .268, .252), (.382, .062, .372)), ((.252, .248, -.345), (.382, .062, -.462))],
            (.124, .108), 1.0, slab=(.020, .012))
    colours('#6a5cc0', '#5e48b6', '#d2a23a', '#e2a63c', '#f0c860', '#6aa83c', '#463a94', '#8a7cd4')
    S.AT = S.AT + V3(.020, .060, 0); S.BULB, S.STALK = (255, 206, 80), (140, 124, 214)
    top = surf((0, 1, 0)); MOSS = np.array([tuple(surf((rng.uniform(-.55, .55), 1, rng.uniform(-.55, .55)))) for _ in range(16)]); MR = rng.uniform(.040, .060, len(MOSS))
    for p in scute_pts(verts=False): patch(p - S.SC, .066, GOLD, 'shell')                                          # big gold dots on the costals
    for m in S.MARG[1:-1]:
        for s in (1, -1): mm = np.array([m[0] * s, m[1] + .03, m[2]]); patch(mm - S.SC, .030, GOLD2, 'shell')
    a6 = np.arange(6) / 6 * 2 * np.pi
    def spire(p, h, r, lean, col):
        u = np.asarray(lean, float) + V3(0, 1, 0); u /= np.linalg.norm(u); t1 = np.cross(u, V3(0, 0, 1)); t1 /= np.linalg.norm(t1); t2 = np.cross(u, t1)
        ring = lambda c, rr: c + rr * (np.cos(a6)[:, None] * t1 + np.sin(a6)[:, None] * t2); hull(np.vstack([ring(p - u * .03, r), ring(p + u * h * .78, r * .9), [p + u * h]]), col, 'shell')
    for k, (ang, h, r) in enumerate(((0, .30, .046), (.9, .24, .040), (-.9, .24, .040), (1.8, .19, .036), (-1.8, .19, .036), (2.7, .16, .032), (-2.7, .16, .032))):   # the crown
        d = V3(.17 * np.sin(ang), 0, .17 * np.cos(ang)); p = surf(top - S.SC + d * 1.6) - V3(0, .015, 0); spire(p, h, r, d * 1.2, GOLD if k % 2 == 0 else GOLD2)
    spire(top - V3(0, .015, 0), .34, .050, (0, 0, 0), GOLD3)
    ring_tube(loop(top + V3(0, .48, .02), (1, 0, 0), (0, 0, 1), .22, .22, 48), .011, GOLD2, 'shell', 6)               # the halo over the crown
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
sys.modules['sculpt_aurmere'] = F
if __name__ == '__main__': C.build(S, sys.argv[2])
