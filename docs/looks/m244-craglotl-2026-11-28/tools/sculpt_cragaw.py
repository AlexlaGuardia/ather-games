"""M244 sheet 16: CRAGLOTL's four AWAKENED forms (Earth), OWNER PREVIEW.    CRAGAW_FORM=<kor|laya|lix|myr> python sculpt_cragaw.py <out.glb> [tris]
Art LOCKED athernyx assets/stage3/085-088 (PRIVATE, read for shape + colour). Each starts from the LIVE Craglotl (m202-manalotl-line tools/
sculpt_craglotl.py, imported, never edited: her broad dome head with no neck, the big smile, amber eyes, four short leaf-flame gills a side,
moss over her crown and back, stones in her back, the warm belly, the palette) and re-shapes her BY NAME:
  kor  CRAGKOR (Champion, pure)  STANDS UP (sheet 9's ground biped, as Arclotar): a stocky barrel on thick legs, mossy arms out, big flame
                                 gills, a ring of little yellow flowers on her crown, a short thick tail. Aura (root): pale crystal spires
                                 standing on the ground behind her.
  laya CRAGLAYA (Virtuoso)       four legs, the widest + lowest: a broad crouch, an OPEN grin, bigger gills. Aura (halo): a ring of warm
                                 glowing pebbles round her on the ground.
  lix  CRAGLIX (Ace)             four legs, sleek: narrower, longer, a long tail with a leaf fin, gills swept back. Aura (halo): ripple rings
                                 on the ground under her.
  myr  CRAGLOMYR (Enigma)        four legs, TALL (long legs, the body carried high), coral antlers branching off her crown, a banded belly.
                                 Aura (head): glowing crystals along her brow.
Exposes the names the rigs read: biped (rig_cragaw.py = rig_arcaw.py): P_, HC, HS, TCU, trunk_up, head_up, legs_up, tail_up, arm_side,
AURA_BONE, AURA_DEFAULT; quadruped (rig_cragq.py = rig_arclun.py): L, GILLS, DY, gills, SITA, AURA_Q."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-manalotl-line-2026-11-26/tools'))
import sculpt_craglotl as C
import lotl_common as LC
from lotl_common import V3, su, ell, cone, mir, box, polyline, S
from sculpt_v2 import catmull
FORM = os.environ.get('CRAGAW_FORM', 'kor'); NAME = dict(kor='cragkor', laya='craglaya', lix='craglix', myr='craglomyr')[FORM]
BIPED = FORM == 'kor'
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)
# ── the quadrupeds' frame: her body read through a per-form scale SC + lift R (the legs are rebuilt to reach the ground) ──
SC = dict(kor=V3(1, 1, 1), laya=V3(1.14, 1.0, 1.02), lix=V3(.88, .92, 1.12), myr=V3(1.0, 1.0, 1.0))[FORM]
R = dict(kor=0., laya=0., lix=0., myr=.13)[FORM]
OFF = V3(0, R, 0)
D = V3(0, .52, -.24) if BIPED else OFF                                                   # biped: her head lifted onto the standing body
fw = lambda p: V3(*p) * SC + OFF                                                         # her rest frame -> this form's
GK = dict(kor=1.40, laya=1.30, lix=1.15, myr=1.20)[FORM]                                  # gill length
GSWEEP = dict(kor=-.05, laya=0., lix=.40, myr=.10)[FORM]                                   # gills swept back (z)
GLIFT = dict(kor=.25, laya=.10, lix=0., myr=0.)[FORM]                                    # gills raised (y): Cragkor's fronds stand up
if BIPED: GILLS = [(tuple(V3(*r) + D), tuple(nz(V3(d[0], d[1] + GLIFT, d[2] - GSWEEP))), ln * GK) for r, d, ln in C.GILLS]
else: GILLS = [(tuple(fw(r)), tuple(nz(V3(d[0], d[1] + GLIFT, d[2] - GSWEEP))), ln * GK) for r, d, ln in C.GILLS]
_tips = np.array([np.array(r) + np.array(d) * ln for r, d, ln in GILLS] + [np.array(r) for r, d, ln in GILLS])
GHI = _tips.max(0) + .08; GLO = _tips.min(0) - .08; GLO[0] = -GHI[0]
def _gills(P):
    M = mir(P); d = np.full(P.shape[:-1], 9.)
    for g in GILLS: d = np.minimum(d, C.gill1(M, *g)[0])
    return d
def gills(P): return np.minimum(box(_gills, P, GLO, GHI), np.maximum(np.abs(P[..., 0]) - GHI[0], .1))
def gill_t(P):
    M = mir(P); best, t = np.full(P.shape[:-1], 9.), np.zeros(P.shape[:-1])
    for g in GILLS:
        d, tt = C.gill1(M, *g); w = d < best; best = np.where(w, d, best); t = np.where(w, tt, t)
    return best, t
DY = 0.; EYE_R, IRIS, SHINE, SMILE_COL = C.EYE_R, C.IRIS, C.SHINE, C.SMILE_COL
if BIPED: EYE = (C.EYE[0], C.EYE[1] + D[1]); SMILE_W = C.SMILE_W; SMILE = lambda x: C.SMILE(x) + D[1]
else:
    EYE = (C.EYE[0] * SC[0], C.EYE[1] * SC[1] + R); SMILE_W = C.SMILE_W * SC[0] * (1.25 if FORM == 'laya' else 1.)
    SMILE = lambda x: C.SMILE(x / SC[0]) * SC[1] + R
if FORM == 'myr': IRIS = (196, 110, 20)                                                   # her big orange eyes
HC = V3(0, .330, .390) + D; HS = 1.0
# ════════ CRAGKOR: the standing biped ════════
def head0(P): return C.head(P - D)
FLOWERS = [V3(np.sin(a) * .20, .0, .39 + np.cos(a) * .17) for a in np.radians([-70, -38, -10, 18, 46, 74])]
def flowers(P):
    d = np.full(P.shape[:-1], 9.)
    for f in FLOWERS:
        c = f + D; c = c + V3(0, .330 + .215 * np.sqrt(max(0., 1 - (f[0] / .30) ** 2 - ((f[2] - .39) / .235) ** 2)) - .005, 0)
        d = np.minimum(d, ell(P, c, (.032, .014, .032)))
    return d
def head_up(P):
    h = su(head0(P), gills(P), .018)
    return su(h, flowers(P), .006) if BIPED else h
P_ = dict(HIP=V3(.165, .34, -.05), KNEE=V3(.235, .19, .04), ANK=V3(.245, .055, -.01), RL=(.105, .085),
          SHO=V3(.250, .66, .04), ELB=V3(.400, .52, .14), HND=V3(.450, .36, .24), RA=(.080, .066), FIST=.055,
          trunk=((0, .48, -.03), (.320, .34, .27)), belly=((0, .42, .07), (.290, .27, .23)), chest=((0, .66, .0), (.26, .14, .19)),
          tail=[(0, .30, -.22), (0, .20, -.38), (0, .12, -.52), (0, .085, -.64)], tr=[.15, .125, .090, .045]) if BIPED else {}
if BIPED:
    for k in ('SHO', 'ELB', 'HND'): P_.setdefault(k + '2', P_[k])
    TCU = catmull([(*a, r) for a, r in zip(P_['tail'], P_['tr'])], 8)
def trunk_up(P):
    (c, r), (c2, r2) = P_['trunk'], P_['belly']; d = su(ell(P, c, r), ell(P, c2, r2), .07)
    return su(d, cone(P, P_['chest'][0], HC - V3(0, .14, .06), .20, .18), .07)
def legs_up(P):
    M = mir(P); a, b, c = P_['HIP'], P_['KNEE'], P_['ANK']; r0, r1 = P_['RL']
    d = su(su(ell(M, a + V3(.02, 0, 0), (r0 * 1.5, r0 * 1.4, r0 * 1.5)), cone(M, a, b, r0, r1), .05), cone(M, b, c, r1, r1 * .80), .03)
    d = su(d, ell(M, c + V3(.01, -.028, .04), (.080, .028, .100)), .025)
    for a_ in (-.45, 0., .45):                                                                       # three short thick claws (hers)
        dirn = V3(np.sin(a_), 0, np.cos(a_)); p0 = c + V3(.01, -.030, .07); q = p0 + dirn * .08; q[1] = .022
        d = su(d, cone(M, p0, q, .026, .018), .012); d = su(d, cone(M, q, q + dirn * .035 + V3(0, -.006, 0), .016, .006), .006)
    return d
def arm_side(M, S_, E_, H_):
    r0, r1 = P_['RA']; d = su(cone(M, S_, E_, r0, r1), cone(M, E_, H_, r1, r1 * .85), .025)
    u = nz(H_ - E_); d = su(d, ell(M, H_ + u * .015, (P_['FIST'], P_['FIST'] * .8, P_['FIST'])), .02)
    w = nz(np.cross(u, V3(0, 1, 0)))
    for a_ in (-.70, 0., .70):
        q = H_ + u * .015 + (u * np.cos(a_) + w * np.sin(a_)) * (P_['FIST'] + .040)
        d = su(d, cone(M, H_ + u * .015, q, .019, .014), .010); d = su(d, cone(M, q, q + (u * np.cos(a_) + w * np.sin(a_)) * .030, .013, .005), .005)
    return d
def arms_up(P): return np.minimum(arm_side(P, P_['SHO'], P_['ELB'], P_['HND']), arm_side(P * V3(-1, 1, 1), P_['SHO2'], P_['ELB2'], P_['HND2']))
def tail_up(P):
    Q = P * V3(1.2, 1, 1); d = np.full(P.shape[:-1], 9.)
    for a, b in zip(TCU[:-1], TCU[1:]): d = np.minimum(d, cone(Q, a[:3] * V3(1.2, 1, 1), b[:3] * V3(1.2, 1, 1), a[3], b[3]))
    return d / 1.1
def biped_field(P):
    d = su(trunk_up(P), head0(P), .09); d = su(d, legs_up(P), .045); d = su(d, arms_up(P), .040); d = su(d, tail_up(P), .06)
    return su(su(d, gills(P), .018), flowers(P), .006)
# ════════ CRAGLAYA / CRAGLIX / CRAGLOMYR: four legs ════════
L = dict(head=tuple(fw(C.L['head'])), chest=tuple(fw(C.L['chest'])), pelvis=tuple(fw(C.L['pelvis'])), tail=[tuple(fw(p)) for p in C.L['tail']])
def chain(c):
    """a leg chain: hip + knee follow the body (scaled + lifted), the paw stays on the ground"""
    a, b, p = [V3(*q) for q in c]; a = a * SC + OFF; b = b * SC + OFF * .45; p = V3(p[0] * SC[0], p[1], p[2] * SC[2]); return [tuple(a), tuple(b), tuple(p)]
L['f'], L['h'] = chain(C.L['f']), chain(C.L['h'])
if FORM == 'lix': L['tail'] = [(0, .23, -.42), (0, .20, -.62), (0, .17, -.82), (0, .15, -1.00), (0, .14, -1.14)]   # her own long tail chain
SITA = dict(kor=.22, laya=.20, lix=.18, myr=.26)[FORM]
LR = dict(laya=1.12, lix=.92, myr=1.10).get(FORM, 1.)                                      # leg thickness
def legs(P):
    M = mir(P); f, h = [V3(*q) for q in L['f']], [V3(*q) for q in L['h']]; d = np.full(P.shape[:-1], 9.)
    for ch, fz, sgn in ((f, .030, 1), (h, -.025, -1)):
        t = su(cone(M, ch[0], ch[1], .072 * LR, .056 * LR), cone(M, ch[1], ch[2], .056 * LR, .046 * LR), .03)
        foot = V3(ch[2][0] + .007, .024, ch[2][2] + fz); t = su(t, ell(M, foot, (.058 * LR, .024, .050 * LR)), .025)
        for a in np.radians([-45, -10, 25]):                                                       # three short thick claws (hers)
            df = V3(np.sin(a) * .9 + .35, 0, np.cos(a)) if sgn > 0 else V3(np.sin(a) * .9 + .40, 0, np.cos(a) * .5 - .4); df = nz(df)
            p0 = foot + (V3(.008, -.002, .015) if sgn > 0 else V3(.012, -.002, -.015)); t = su(t, cone(M, p0, p0 + df * .060 + V3(0, -.008, 0), .020, .010), .01)
        d = np.minimum(d, t)
    return d
def inv(P): return (P - OFF) / SC
smin = float(min(SC))
def upper(P):
    """her trunk + head (+ tail + stones), read through the form's frame"""
    Q = inv(P); b = su(C.trunk(Q), C.head(Q), .10) * smin
    if FORM == 'lix':                                                                            # a long tail with a leaf fin standing on it
        pts = L['tail']; t = polyline(P * V3(1.25, 1, 1), [V3(*p) * V3(1.25, 1, 1) for p in pts], .11, .025) / 1.15
        fin = np.maximum(np.maximum(np.abs(P[..., 0]) - .012, ell(P, (0, .20, -.86), (.04, .15, .30))), -(P[..., 1] - .15))
        b = su(b, su(t, fin, .02), .05)
    else: b = su(b, C.tail(Q) * smin, .06)
    keep = dict(laya=[0, 1, 2, 3], lix=[1, 2], myr=[1, 2, 3])[FORM]
    st = np.full(P.shape[:-1], 9.)
    for i in keep:
        c, r = C.STONES[i]; st = np.minimum(st, ell(Q, c, r) * smin + .006 * np.sin(Q[..., 0] * 70) * np.sin(Q[..., 2] * 60))
    return su(b, st, .012)
ANTLERS = []
if FORM == 'myr':                                                                                 # coral antlers: a stem, three branches, twigs
    for s in (1,):
        base = V3(.10, .52 + R, .36); top = V3(.20, .86 + R, .30)
        ANTLERS.append((base, top, .034, .020))
        for k, (t, d_, ln) in enumerate(((.35, V3(.9, .6, -.1), .16), (.55, V3(-.5, .8, .1), .14), (.75, V3(.8, .9, -.2), .13), (.90, V3(-.2, 1, -.1), .10))):
            p = base + (top - base) * t; q = p + nz(d_) * ln; ANTLERS.append((p, q, .020, .011))
            ANTLERS.append((q, q + nz(d_ + V3(0, .8, 0)) * .06, .011, .006))
def antlers(P):
    M = mir(P); d = np.full(P.shape[:-1], 9.)
    for a, b, r0, r1 in ANTLERS: d = np.minimum(d, cone(M, a, b, r0, r1))
    return d
def quad_body(P):
    b = su(upper(P), np.minimum(box(legs, P, V3(-.62, -.05, -.62), V3(.62, .45, .55)), .3), .04)
    return su(b, antlers(P), .016) if ANTLERS else b
def quad_field(P): return su(quad_body(P), gills(P), .018)
body = biped_field if BIPED else quad_body
field = biped_field if BIPED else quad_field
if BIPED: BOUNDS = ((-.86, -.033, -.80), (.86, 1.55, .78))
else:
    lo = np.minimum(np.array(C.BOUNDS[0]) * SC, GLO); hi = np.maximum(np.array(C.BOUNDS[1]) * SC + OFF, GHI)
    if FORM == 'lix': lo[2] = -1.25
    if FORM == 'myr': hi[1] = 1.05 + R
    lo[1] = -.033; BOUNDS = (tuple(lo), tuple(hi))
# ── colour: hers (Craglix browner, Craglomyr greyer with a gold belly) ──
PAL = dict(C.PAL, mouth='#c0443a', flower='#ffe04a', fcore='#e88a1a', antler='#d9b98c', band='#c8822a')
if FORM == 'lix': PAL.update(lo='#a85a24', hi='#d8903e')
if FORM == 'myr': PAL.update(lo='#8a7a52', hi='#b8a878', belly='#f2b448')
if FORM == 'kor': PAL.update(lo='#c06a2a', hi='#eaa050')
def _noise(V): x, y, z = V.T; return np.sin(x * 23 + 1.3) * np.sin(z * 19 + .7) + .6 * np.sin(x * 41 - z * 37 + y * 13)
def classes(V):
    x, y, z = V.T; A = np.abs(x); gd, gt = gill_t(V); gill = gd < .007; out = [None] * len(ORDER); I = ORDER.index
    if BIPED:
        H = V - D; hx, hy, hz = H.T; (c, r) = P_['belly']; qb = (x / (r[0] * .85)) ** 2 + ((y - c[1]) / (r[1] * 1.05)) ** 2
        tk = trunk_up(V); oth = np.minimum.reduce([arms_up(V), legs_up(V), tail_up(V), head0(V)]); bel = (tk < oth - .004) & (z > .03)
        out[I('belly')] = np.where(bel, np.clip(.05 * (1 - qb), -.05, .05), np.where((head0(V) < .004) & (hy < .20) & (hz > .43) & (np.abs(hx) < .22), .01, -.05))   # belly + chin
        out[I('glow')] = .035 - np.sqrt((x * .35) ** 2 + ((y - .36) * .9) ** 2 + ((z - .30) * .25) ** 2)
        nn = _noise(V); top = (hy > .40 - .05 * (hz < .2)) & ~((hz > .46) & (np.abs(hx) < .22) & (hy < .50))
        arm = (arms_up(V) < .004) & (y > P_['ELB'][1] - .05); sho = (tk < .004) & (A > .17) & (y > .60) & (z < .10)
        out[I('moss')] = np.where(top | arm | sho, nn + .2, -1.); out[I('mossd')] = np.where(top & (hy > .43), nn - .45, -1.)
        out[I('stone')] = np.full(len(V), -1.)
        hand = np.where((x >= 0)[:, None], P_['HND'], P_['HND2'] * V3(-1, 1, 1)); dh = np.linalg.norm(V - hand, axis=1)
        out[I('claw')] = np.where(((y < .03) & (z > P_['ANK'][2] + .10)) | ((arms_up(V) < .003) & (dh > P_['FIST'] + .055) & (dh < P_['FIST'] + .14)), 1., -1.)
        out[I('blush')] = .030 - np.sqrt(((np.abs(hx) - .195) * .9) ** 2 + ((hy - .305) * 1.6) ** 2 + (hz - .55) ** 2 * .3)
        fl = flowers(V); out[I('flower')] = .004 - fl
        fc = np.min([np.hypot(x - f[0], z - (f[2] + D[2])) for f in FLOWERS], 0); out[I('fcore')] = np.where(fl < .004, .011 - fc, -1.)
    else:
        Q = inv(V); base = C.classes(Q)
        for k in ('belly', 'glow', 'moss', 'mossd', 'stone', 'blush'): out[I(k)] = base[C.ORDER.index(k)]
        if FORM == 'myr': out[I('stone')] = np.where(antlers(V) < .02, -1., out[I('stone')])
        out[I('claw')] = np.where((y < .03) & (A > (L['f'][2][0] - .005)), 1., -1.)
    out[I('gill')] = np.where(gill, 1., -1.); out[I('gtip')] = np.where(gill, gt - .55 + .06 * np.sin(z * 80), -1.)
    out[I('mouth')] = np.full(len(V), -1.)
    if FORM == 'laya':                                                                            # the open grin: a red mouth under the smile line
        sm = SMILE(x); out[I('mouth')] = np.where((z > .40) & (A < SMILE_W * .92) & (y < sm - .004) & (y > sm - .010 - .060 * (1 - (x / SMILE_W) ** 2)), 1., -1.)
    out[I('antler')] = (.004 - antlers(V)) if ANTLERS else np.full(len(V), -1.)
    out[I('band')] = np.full(len(V), -1.)
    if FORM == 'myr':                                                                             # her banded belly
        out[I('band')] = np.where(out[I('belly')] > 0, .25 - np.abs(np.sin((z - .1) * 48)), -1.)
    return out
ORDER = ('belly', 'band', 'glow', 'moss', 'mossd', 'stone', 'gill', 'gtip', 'claw', 'blush', 'mouth', 'antler') + (('flower', 'fcore') if BIPED else ())
# ── her motif: the aura part (unlit, glows in game) ──
lin = lambda c: np.round(255 * (np.array(c) / 255.) ** 2.2)
SPIRE, PEB, RIP, GEM = (255, 236, 196), (255, 196, 110), (255, 226, 170), (150, 240, 220)
AURA_BONE = {}; AURA_DEFAULT = 'root'; AURA_Q = 'head' if FORM == 'myr' else 'halo'
def crystal(c, up, r, h, col, sides=6):
    """a hexagonal crystal: a prism with a pointed cap, its foot at c"""
    up = nz(up); u = nz(np.cross(up, V3(1, 0, 0) if abs(up[0]) < .9 else V3(0, 0, 1))); w = np.cross(up, u); P, F = [], []
    for k in range(sides): a = 2 * np.pi * k / sides; P.append(c + r * (np.cos(a) * u + np.sin(a) * w))
    for k in range(sides): a = 2 * np.pi * k / sides; P.append(c + up * h * .72 + r * (np.cos(a) * u + np.sin(a) * w))
    P.append(c + up * h); P.append(c); n = sides
    if c[1] < .05: P = [np.array([q[0], max(q[1], .003), q[2]]) for q in P]                       # a ground spire's foot never dips under the ground
    for k in range(n):
        k2 = (k + 1) % n; F += [(k, k2, n + k), (k2, n + k2, n + k), (n + k, n + k2, 2 * n), (k2, k, 2 * n + 1)]
    return np.array(P), np.array(F), col
def pebble(c, r, col, seed):
    import trimesh
    b = trimesh.creation.icosphere(subdivisions=1, radius=1.); rng = np.random.default_rng(seed); v = b.vertices * (1 + rng.uniform(-.15, .15, (len(b.vertices), 1))) * V3(r, r * .6, r * .85)
    v = v + c; v[:, 1] = np.maximum(v[:, 1], .004); return v, b.faces, col
def ring(c, R_, r, col, n=56):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False); Q = np.stack([c[0] + R_ * np.cos(t), np.full(n, c[1]), c[2] + R_ * np.sin(t)], 1); sides = 4; P, F = [], []
    for i in range(n):
        u = V3(np.cos(t[i]), 0, np.sin(t[i]))
        for j in range(sides): a = 2 * np.pi * j / sides; P.append(Q[i] + r * (np.cos(a) * u + np.sin(a) * V3(0, 1, 0)))
    for i in range(n):
        i2 = (i + 1) % n
        for j in range(sides):
            a, b, c_, d = i * sides + j, i * sides + (j + 1) % sides, i2 * sides + j, i2 * sides + (j + 1) % sides; F += [(a, c_, b), (b, c_, d)]
    P = np.array(P); P[:, 1] = np.maximum(P[:, 1], .003); return P, np.array(F), col
def aura_parts():
    out = []
    if FORM == 'kor':                       # pale crystal spires on the ground behind + beside her
        for k, (x, z, h, r, tx, tz) in enumerate(((-.55, -.30, .55, .055, -.15, -.05), (-.66, -.08, .38, .045, -.25, .05), (-.42, -.52, .42, .050, -.08, -.15), (.56, -.34, .48, .052, .15, -.08), (.68, -.12, .32, .042, .25, .0), (.38, -.58, .36, .046, .05, -.18), (-.08, -.70, .30, .045, 0, -.2))):
            out.append(crystal(V3(x, 0, z), V3(tx, 1, tz), r, h, SPIRE))
    elif FORM == 'laya':                    # a ring of warm glowing pebbles round her on the ground
        for k in range(11):
            a = 2 * np.pi * k / 11 + .2; R_ = .80 + .06 * np.sin(3 * a); out.append(pebble(V3(np.sin(a) * R_ * 1.1, .02, np.cos(a) * R_ - .10), .035 + .012 * (k % 3), PEB, k))
    elif FORM == 'lix':                     # ripple rings spreading on the ground under her
        for R_ in (.42, .58, .74): out.append(ring(V3(0, .006, -.12), R_, .007, RIP))
    elif FORM == 'myr':                     # glowing crystals along her brow (they ride her head)
        for k, (x, z, h, tx) in enumerate(((.0, .46, .10, 0), (.09, .44, .085, .3), (-.09, .44, .085, -.3), (.18, .40, .075, .5), (-.18, .40, .075, -.5), (.25, .33, .06, .7), (-.25, .33, .06, -.7))):
            yy = .330 + .215 * np.sqrt(max(0., 1 - (x / .30) ** 2 - ((z - .39) / .235) ** 2)) + R - .02
            out.append(crystal(V3(x, yy, z), V3(tx, 1, .25), .022, h, GEM))
    return out
_glb = S.glb
def glb_with_aura(path, parts):
    aV, aF, aC = [], [], []; o = 0
    for v, f, col in aura_parts(): aV.append(v); aF.append(f + o); o += len(v); aC.append(np.tile((*lin(col), 255), (len(v), 1)))
    aV, aF, aC = np.vstack(aV), np.vstack(aF), np.vstack(aC).astype(np.uint8)
    parts = dict(parts, aura=(aV, aF, aC, S.normals(aV, aF))); print('aura tris', len(aF), 'y', aV[:, 1].min().round(3), aV[:, 1].max().round(3)); return _glb(path, parts)
S.glb = glb_with_aura
if __name__ == '__main__': LC.run(sys.modules[__name__], NAME)
